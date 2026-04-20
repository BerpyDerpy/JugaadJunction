// ─── Witty message pools ─────────────────────────────────────────
const CLAIM_MESSAGES = [
  (user, title) => `@${user} just snagged your ticket "${title}"! Time to make jugaad happen.`,
  (user, title) => `Ding dong! @${user} claimed "${title}". Someone's feeling generous today.`,
  (user, title) => `Bullseye! @${user} locked onto your "${title}". Go seal the deal!`,
  (user, title) => `@${user} sprinted to claim "${title}" before anyone else could blink.`,
  (user, title) => `@${user} is on it! Your ticket "${title}" just got a hero.`,
  (user, title) => `⚡ Speed claim! @${user} grabbed "${title}" faster than a canteen samosa disappears.`,
];

const UNCLAIM_MESSAGES = [
  (user, title) => `@${user} ghosted your ticket "${title}". Back to the board it goes!`,
  (user, title) => `@${user} changed their mind about "${title}". Commitment issues, perhaps?`,
  (user, title) => `Plot twist! @${user} unclaimed "${title}". Your ticket is single again.`,
  (user, title) => `@${user} vanished from "${title}" like WiFi in the basement.`,
  (user, title) => `@${user} released "${title}". Don't worry, someone else will show up.`,
];

const NEW_TICKET_MESSAGES = [
  (user, title, type) => `📌 Fresh ${type} alert! @${user} just posted "${title}". First come, first served!`,
  (user, title, type) => `🆕 @${user} dropped a new ${type}: "${title}". Go grab it before it's gone!`,
  (user, title, type) => `🔔 New ${type} on the board! "${title}" by @${user}. The jugaad gods have spoken.`,
  (user, title, type) => `🎪 Step right up! @${user} posted "${title}". The marketplace just got spicier.`,
  (user, title, type) => `📢 Attention! @${user} needs jugaad: "${title}". Can you be the hero?`,
  (user, title, type) => `🧃 Hot off the press — @${user} posted "${title}". Don't sleep on this one!`,
];

const CLOSE_MESSAGES = [
  (owner, title) => `🔒 @${owner} closed "${title}". Deal done, chai earned. ☕`,
  (owner, title) => `✅ "${title}" is officially wrapped up by @${owner}. Another jugaad success story!`,
  (owner, title) => `🎉 Mission complete! @${owner} sealed the deal on "${title}".`,
  (owner, title) => `📦 "${title}" has been closed by @${owner}. Pack it up, folks!`,
  (owner, title) => `🏁 And that's a wrap! @${owner} closed "${title}". Jugaad delivered.`,
];

// ─── Helpers ─────────────────────────────────────────────────────
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function truncate(str, max = 40) {
  if (!str) return 'Untitled';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/**
 * Fire-and-forget call to the send-push edge function.
 * Never throws — logs warnings on failure so it never breaks the main flow.
 */
async function sendPush({ target_rollnos, title, body, exclude_rollno }) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Push: Supabase env vars missing, skipping notification.');
      return;
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ target_rollnos, title, body, exclude_rollno }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Push notification failed:', res.status, errText);
    }
  } catch (err) {
    // Completely non-blocking — never break the main workflow
    console.warn('Push notification error (non-fatal):', err);
  }
}

// ─── Exported notification triggers ──────────────────────────────

/**
 * Notify the ticket OWNER that someone claimed their ticket.
 */
export function notifyTicketClaimed(ticket, claimantUsername, actorRollno) {
  const title = '🤝 Your Ticket Got Claimed!';
  const body = pickRandom(CLAIM_MESSAGES)(claimantUsername, truncate(ticket.title));

  sendPush({
    target_rollnos: [ticket.ownerRollno],
    title,
    body,
    exclude_rollno: actorRollno, // don't notify yourself if you own + claim
  });
}

/**
 * Notify the ticket OWNER that someone unclaimed their ticket.
 */
export function notifyTicketUnclaimed(ticket, claimantUsername, actorRollno) {
  const title = '👋 Ticket Unclaimed';
  const body = pickRandom(UNCLAIM_MESSAGES)(claimantUsername, truncate(ticket.title));

  sendPush({
    target_rollnos: [ticket.ownerRollno],
    title,
    body,
    exclude_rollno: actorRollno,
  });
}

/**
 * Notify ALL users that a new ticket was posted (global broadcast).
 */
export function notifyNewTicketPosted(ticketTitle, ticketType, ownerUsername, actorRollno) {
  const typeLabel = ticketType === 'request' ? 'request' : 'offer';
  const title = '📌 New Ticket on the Board!';
  const body = pickRandom(NEW_TICKET_MESSAGES)(ownerUsername, truncate(ticketTitle), typeLabel);

  sendPush({
    target_rollnos: 'all',
    title,
    body,
    exclude_rollno: actorRollno, // poster doesn't need their own notification
  });
}

/**
 * Notify all CLAIMANTS that the ticket owner closed the ticket.
 */
export function notifyTicketClosed(ticket, ownerUsername, claimantRollnos) {
  if (!claimantRollnos || claimantRollnos.length === 0) return;

  const title = '🔒 Ticket Closed!';
  const body = pickRandom(CLOSE_MESSAGES)(ownerUsername, truncate(ticket.title));

  sendPush({
    target_rollnos: claimantRollnos,
    title,
    body,
  });
}
