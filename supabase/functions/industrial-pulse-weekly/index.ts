// industrial-pulse-weekly (Channel 3 — cron)
// Runs Tuesdays 7am ET via pg_cron.
// Sends a weekly digest to all confirmed industrial_pulse_subscribers.
// Each digest shows 3 redacted signals + CTA: "Unlock all N this week — $50 one-time, $199/mo for the firehose."

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const FROM_EMAIL = "Matt Michels <matt@detroitwebagent.com>";
const REPLY_TO = "matt@detroitwebagent.com";
const SITE_URL = "https://www.detroitwebagent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function redactCompany(name: string): string {
  if (!name) return "[REDACTED]";
  return name.split(" ").map(word => {
    if (word.length <= 1) return word;
    return word[0] + "•".repeat(Math.min(word.length - 1, 6));
  }).join(" ");
}

function buildEmailHtml(teasers: any[], totalCount: number, unsubscribeUrl: string): string {
  const teaserCards = teasers.map(s => `
    <div style="border:1px solid #1e3a5f;background:#0a1628;padding:16px;margin-bottom:12px;border-radius:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-family:monospace;font-size:18px;color:#00d4ff;font-weight:600;letter-spacing:1px;">${s.redacted_company}</div>
        <div style="background:#00d4ff;color:#0a1628;font-size:11px;font-weight:700;padding:3px 8px;border-radius:3px;">${s.confidence}/10</div>
      </div>
      <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">
        📍 ${s.location || "Metro Detroit"} ${s.industry ? "· " + s.industry : ""}
      </div>
      <div style="font-size:13px;color:#cbd5e1;margin-bottom:8px;">
        Hiring <strong style="color:#fff;">${s.hiring_count || "multiple"}× ${(s.hiring_roles || []).join(", ") || "trades"}</strong>
      </div>
      <div style="font-size:12px;color:#64748b;">
        Predicted spend: ${(s.predicted_needs || []).slice(0, 3).join(" · ") || "supply orders"}
      </div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;background:#020617;color:#e2e8f0;">

    <!-- Header -->
    <div style="border-bottom:2px solid #00d4ff;padding-bottom:16px;margin-bottom:24px;">
      <div style="font-size:11px;letter-spacing:3px;color:#00d4ff;text-transform:uppercase;font-weight:700;margin-bottom:4px;">DETROIT INDUSTRIAL PULSE</div>
      <div style="font-size:22px;color:#fff;font-weight:600;">${totalCount} Metro Detroit manufacturers hired this week</div>
      <div style="font-size:13px;color:#64748b;margin-top:4px;">Weekly intelligence brief · ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
    </div>

    <!-- Intro -->
    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;margin-bottom:20px;">
      Here are 3 of the ${totalCount} hiring signals our radar caught in Metro Detroit this week.
      Each one means a manufacturer about to spend on consumables, equipment, or services.
    </p>

    <!-- Redacted teasers -->
    ${teaserCards}

    <!-- CTA -->
    <div style="background:#0a1628;border:2px solid #00d4ff;padding:20px;margin:24px 0;border-radius:8px;text-align:center;">
      <div style="font-size:18px;color:#fff;font-weight:600;margin-bottom:8px;">Want the company names?</div>
      <div style="font-size:14px;color:#94a3b8;margin-bottom:16px;line-height:1.6;">
        Unlock all ${totalCount} signals from this week with full company name, address, and predicted spend window.
      </div>
      <a href="${SITE_URL}/industrial-pulse?unlock=1" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px;">UNLOCK THIS WEEK · $50</a>
      <div style="font-size:12px;color:#64748b;margin-top:12px;">Or $199/mo for the daily firehose — every signal, every vertical.</div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1e3a5f;padding-top:16px;margin-top:32px;font-size:12px;color:#64748b;line-height:1.6;">
      <strong style="color:#94a3b8;">Matt Michels</strong> · Detroit Web Agency · Grosse Pointe, MI<br>
      (313) 992-1219 · <a href="mailto:matt@detroitwebagent.com" style="color:#00d4ff;text-decoration:none;">matt@detroitwebagent.com</a><br><br>
      <a href="${unsubscribeUrl}" style="color:#64748b;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Pull this week's high-confidence signals
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: signals, count: totalCount } = await sb
      .from("industry_pulse_signals")
      .select("id, company_name, location, industry, hiring_roles, hiring_count, predicted_needs, confidence, detected_at", { count: "exact" })
      .gte("detected_at", sevenDaysAgo)
      .gte("confidence", 7)
      .order("confidence", { ascending: false })
      .order("detected_at", { ascending: false })
      .limit(3);

    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no signals to send" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const teasers = signals.map(s => ({
      redacted_company: redactCompany(s.company_name || ""),
      location: s.location,
      industry: s.industry,
      hiring_roles: s.hiring_roles?.slice(0, 2) || [],
      hiring_count: s.hiring_count,
      predicted_needs: s.predicted_needs?.slice(0, 3) || [],
      confidence: s.confidence,
    }));

    // 2. Pull active subscribers
    const { data: subs, error: subErr } = await sb
      .from("industrial_pulse_subscribers")
      .select("id, email")
      .eq("unsubscribed", false)
      .limit(2000);

    if (subErr) throw subErr;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no subscribers" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Send to each (pace at 5/sec to respect Resend limits)
    let sentCount = 0;
    const errors: string[] = [];
    const subject = `${totalCount} Metro Detroit manufacturers hired this week — 3 free teasers inside`;

    for (const sub of subs) {
      try {
        const unsubUrl = `${SUPABASE_URL}/functions/v1/industrial-pulse-unsubscribe?email=${encodeURIComponent(sub.email)}`;
        const html = buildEmailHtml(teasers, totalCount || 3, unsubUrl);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [sub.email],
            reply_to: REPLY_TO,
            subject,
            html,
          }),
        });

        if (res.ok) {
          sentCount++;
          await sb.from("industrial_pulse_subscribers")
            .update({ last_sent_at: new Date().toISOString(), send_count: 1 })
            .eq("id", sub.id);
        } else {
          const t = await res.text();
          errors.push(`${sub.email}: ${t.slice(0, 100)}`);
        }

        // Pace: 200ms between sends
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        errors.push(`${sub.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      sent: sentCount,
      total_subs: subs.length,
      errors: errors.slice(0, 5),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[industrial-pulse-weekly]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
