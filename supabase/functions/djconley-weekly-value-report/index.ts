/**
 * djconley-weekly-value-report
 *
 * Every Monday 8am ET, emails Pat (and any other Forever-Pricing client) a
 * personalized "what you got this week" report:
 *  - new product_changelog entries shipped in the last 7 days
 *  - count of new Command Center tiles added by Matt
 *  - reaffirms locked monthly price + lock date
 *  - one-click magic-link CTA to the owner dashboard
 *
 * This is the retention moat: clients see value delivered weekly, reinforcing
 * why their locked rate is a bargain.
 *
 * Triggered by pg_cron — see migration accompanying this function.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Matt @ Detroit Web Agency <matt@detroitwebagent.com>";
const ADMIN_EMAIL = "matthewmichels4@gmail.com";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

interface Lock {
  client_email: string;
  product: string;
  locked_monthly_price: number;
  locked_since: string;
}

interface ChangelogEntry {
  title: string;
  body: string;
  product: string | null;
  ship_date: string;
}

const PREFS_BASE = `${SUPABASE_URL}/functions/v1/email-preferences`;

function renderEmail(opts: {
  email: string;
  lock: Lock;
  entries: ChangelogEntry[];
  newTilesCount: number;
  unsubscribeToken: string;
  frequencyLabel: string;
}) {
  const { email, lock, entries, newTilesCount, unsubscribeToken, frequencyLabel } = opts;
  const prefsUrl = `${PREFS_BASE}?token=${unsubscribeToken}`;
  const oneClickUrl = `${PREFS_BASE}?token=${unsubscribeToken}&action=off`;
  const monthsLocked = Math.max(
    1,
    Math.floor((Date.now() - new Date(lock.locked_since).getTime()) / (30 * 86400_000)),
  );
  const itemsHtml = entries.length
    ? entries
        .map(
          (e) =>
            `<div style="border-left:3px solid #00d4ff;padding:8px 12px;margin:0 0 12px;background:#0a1628;">
              <p style="color:#fff;font-weight:700;margin:0 0 4px;font-size:14px;">${e.title}</p>
              <p style="color:#94a3b8;margin:0;font-size:13px;line-height:1.5;">${e.body}</p>
              <p style="color:#475569;margin:4px 0 0;font-size:11px;">${e.product || "Platform"} · ${e.ship_date}</p>
            </div>`,
        )
        .join("")
    : `<p style="color:#94a3b8;font-style:italic;margin:0 0 12px;">Building behind the scenes this week — bigger drops next Monday.</p>`;

  return `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,Segoe UI,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0a1628;border:1px solid #00d4ff;border-radius:16px;padding:32px;">
    <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">🔒 FOREVER PRICING · ${frequencyLabel.toUpperCase()} REVIEW</p>
    <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">Here's what you got this ${frequencyLabel === "monthly" ? "month" : "week"}.</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Your locked rate of <strong style="color:#00d4ff;">$${Number(lock.locked_monthly_price).toLocaleString()}/mo</strong> · ${monthsLocked} month${monthsLocked === 1 ? "" : "s"} in.</p>

    <h2 style="color:#fff;font-size:16px;margin:0 0 12px;">📦 Shipped (${entries.length})</h2>
    ${itemsHtml}

    ${newTilesCount > 0 ? `<div style="background:#00d4ff14;border:1px solid #00d4ff;border-radius:8px;padding:12px;margin:16px 0;"><p style="color:#00d4ff;font-size:13px;margin:0;font-weight:700;">+ ${newTilesCount} new Command Center tile${newTilesCount === 1 ? "" : "s"} added to your dashboard</p></div>` : ""}

    <p style="margin:24px 0 0;text-align:center;">
      <a href="https://detroitwebagent.com/owner/login" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:800;font-size:14px;">Open my dashboard →</a>
    </p>

    <p style="color:#475569;font-size:11px;margin:32px 0 0;border-top:1px solid #1e3a5f;padding-top:16px;text-align:center;">
      You're getting this <strong>${frequencyLabel}</strong> because your Forever Pricing is active.<br>
      <a href="${prefsUrl}" style="color:#00d4ff;text-decoration:underline;">Change frequency</a> · <a href="${oneClickUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a><br>
      — Matt · matt@detroitwebagent.com · (313) 992-1219
    </p>
  </div>
</div></body></html>`;
}

async function sendEmail(to: string, subject: string, html: string, unsubscribeToken: string) {
  const oneClickUrl = `${PREFS_BASE}?token=${unsubscribeToken}&action=off`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      bcc: [ADMIN_EMAIL],
      subject,
      html,
      reply_to: "matt@detroitwebagent.com",
      headers: {
        "List-Unsubscribe": `<${oneClickUrl}>, <mailto:matt@detroitwebagent.com?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Resend ${r.status}: ${t}`);
  }
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);
    const sinceDate = sevenDaysAgo.toISOString().slice(0, 10);

    // Pull all active Forever-Pricing clients
    const { data: locks, error: lockErr } = await sb
      .from("client_price_locks")
      .select("client_email, product, locked_monthly_price, locked_since")
      .eq("active", true);
    if (lockErr) throw lockErr;
    if (!locks?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No active locks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull this week's public changelog entries (shared across all clients)
    const { data: entries, error: entryErr } = await sb
      .from("product_changelog")
      .select("title, body, product, ship_date")
      .eq("is_public", true)
      .gte("ship_date", sinceDate)
      .order("ship_date", { ascending: false })
      .limit(10);
    if (entryErr) throw entryErr;

    let sent = 0;
    const errors: string[] = [];
    for (const lock of locks) {
      try {
        // Per-client tile count delta
        const { count: newTiles } = await sb
          .from("command_center_tiles")
          .select("id", { count: "exact", head: true })
          .eq("owner_email", lock.client_email)
          .eq("is_active", true)
          .gte("created_at", sevenDaysAgo.toISOString());

        const html = renderEmail({
          email: lock.client_email,
          lock: lock as Lock,
          entries: (entries || []) as ChangelogEntry[],
          newTilesCount: newTiles || 0,
        });
        const subject = `🔒 Forever Pricing · ${entries?.length || 0} shipped this week`;
        await sendEmail(lock.client_email, subject, html);
        sent++;
      } catch (e: any) {
        errors.push(`${lock.client_email}: ${e?.message || e}`);
      }
    }

    return new Response(
      JSON.stringify({ sent, total: locks.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[djconley-weekly-value-report] FATAL", e);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
