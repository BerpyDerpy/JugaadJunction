import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

// Configuration
const VAPID_PUBLIC_KEY = Deno.env.get("VITE_VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@jugaadjunction.local",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn("VAPID keys are missing from environment variables.");
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  try {
    const { target_rollnos, title, body, exclude_rollno } = await req.json();

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Fetch subscriptions based on target
    let query = supabase.from("push_subscriptions").select("roll_number, subscription");

    if (target_rollnos !== "all" && Array.isArray(target_rollnos)) {
      query = query.in("roll_number", target_rollnos);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No subscriptions found", sent: 0 }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const notificationPayload = JSON.stringify({ title, body });

    let sentCount = 0;
    const errors: any[] = [];
    const pushPromises = subscriptions
      .filter((sub) => !exclude_rollno || sub.roll_number !== exclude_rollno)
      .map(async (sub) => {
        try {
          await webpush.sendNotification(sub.subscription, notificationPayload);
          sentCount++;
          console.log(`Push sent to ${sub.roll_number}`);
        } catch (err) {
          console.error(`Failed to send push to ${sub.roll_number}:`, err);
          errors.push({ roll_number: sub.roll_number, error: err.message, stack: err.stack, name: err.name });
          // Clean up expired subscriptions (only remove the specific device endpoint)
          if (err.statusCode === 410 || err.statusCode === 404) {
            const endpoint = sub.subscription?.endpoint;
            if (endpoint) {
              await supabase
                .from("push_subscriptions")
                .delete()
                .eq("roll_number", sub.roll_number)
                .eq("endpoint", endpoint);
            } else {
              await supabase
                .from("push_subscriptions")
                .delete()
                .eq("roll_number", sub.roll_number);
            }
            console.log(`Cleaned up expired subscription for ${sub.roll_number}`);
          }
        }
      });

    await Promise.all(pushPromises);

    return new Response(
      JSON.stringify({ success: true, message: "Notifications dispatched", sent: sentCount, errors }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    console.error("Error in send-push:", err);
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
