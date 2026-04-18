import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

// Configuration for Web Push
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
  try {
    const payload = await req.json();

    // Ensure this is triggered by our Webhook for UPDATE
    if (payload.type === "UPDATE" && payload.record && payload.old_record) {
      const new_credit = payload.record.social_credit;
      const old_credit = payload.old_record.social_credit;

      // Check the condition: social credit drops below 50
      // Depending on how it's set up in Supabase, the DB hook might already do this check,
      // but it's good to double check it here.
      if (new_credit < 50 && old_credit >= 50) {
        
        // Fetch ALL subscriptions because the user requested notifications to go to all users
        const { data: subscriptions, error } = await supabase
          .from("push_subscriptions")
          .select("roll_number, subscription");

        if (error) {
          throw error;
        }

        const notificationPayload = JSON.stringify({
          title: "Social Credit Alert!",
          body: `Someone's social credit just dropped below 50! Let's help them out.`,
        });

        // Send push notification to all users
        const pushPromises = subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(sub.subscription, notificationPayload);
            console.log(`Push sent to ${sub.roll_number}`);
          } catch (err) {
            console.error(`Failed to send push to ${sub.roll_number}:`, err);
            // Optionally, delete invalid subscriptions here if err.statusCode === 410
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabase
                .from("push_subscriptions")
                .delete()
                .eq("roll_number", sub.roll_number);
            }
          }
        });

        await Promise.all(pushPromises);
        return new Response(JSON.stringify({ success: true, message: "Notifications sent" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, message: "No action required" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in notify-low-credit:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
