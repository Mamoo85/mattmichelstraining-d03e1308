// Contractor Outreach: cold-email an unclaimed lead to N matched contractor prospects.
// CAN-SPAM compliant + suppression check + audit log + daily cap.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const DAILY_EMAIL_CAP = 100;

function dwaEmailWrap(bodyHtml: string, unsubUrl: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#0a1628">
  <div style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid #00d4ff">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:3px">DETROIT <span style="color:#00d4ff">WEB AGENCY</span></div>
    <div style="color:#00d4ff;font-size:10px;letter-spacing:4px;margin-top:5px;font-weight:600">LOCAL HOMEOWNER LEADS · METRO DETROIT</div>
  </div>
  <div style="padding:32px;color:#e2e8f0;font-size:15px;line-height:1.7">${bodyHtml}</div>
  <div style="padding:20px 32px;border-top:1px solid #1e3a5f;text-align:center">
    <p style="margin:0;color:#4a6fa5;font-size:11px">Detroit Web Agency · Grosse Pointe Park, MI 48230 · (313) 992-1219</p>
    <p style="margin:6px 0 0;font-size:11px"><a href="${unsubUrl}" style="color:#4a6fa5;text-decoration:underline">Unsubscribe</a> — one click, instant removal</p>
  </div>
</div></body></html>`;
}

function buildBody(opts: { businessName: string; trade: string; city: string; projectType: string; price: number; claimUrl: string }) {
  const greeting = opts.businessName ? `Hi ${opts.businessName} team,` : "Hi there,";
  return `
    <p style="margin:0 0 16px"><strong style="color:#00d4ff">${greeting}</strong></p>
    <p style="margin:0 0 16px">A homeowner in <strong>${opts.city}, MI</strong> just submitted a lead for:</p>
    <div style="background:#0f2540;border-left:3px solid #00d4ff;padding:14px 18px;margin:0 0 18px;border-radius:4px">
      <div style="color:#00d4ff;font-size:11px;letter-spacing:2px;font-weight:700;margin-bottom:6px">JOB</div>
      <div style="color:#ffffff;font-size:16px;font-weight:600;line-height:1.4">${opts.projectType || opts.trade + " work"}</div>
    </div>
    <p style="margin:0 0 16px">First contractor to claim gets the homeowner's name, phone, email, and full project details — exclusive, not shared.</p>
    <p style="margin:0 0 22px"><strong style="color:#ffffff">$${opts.price}</strong> · One-time · No subscription · Refunded if it's a duplicate or junk</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${opts.claimUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 32px;border-radius:6px;font-weight:800;text-decoration:none;letter-spacing:1px;font-size:14px">CLAIM THIS LEAD →</a>
    </div>
    <p style="margin:18px 0 0;font-size:13px;color:#94a3b8">Reply "INTERESTED" if you want first dibs on future ${opts.trade} leads in ${opts.city} (no obligation, just gets you on my shortlist).</p>
    <p style="margin:14px 0 0;font-size:12px;color:#64748b">— Matt Michels<br>Detroit Web Agency</p>
  `;
}

async function logAudit(supabase: any, row: Record<string, unknown>) {
  try { await supabase.from("contractor_outreach_audit_log").insert(row); }
  catch (e) { console.error("audit log insert failed", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id, price = 59, max_contractors = 10 } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Global kill-switch + min quality
    const { data: gs } = await supabase
      .from("outreach_global_settings").select("*").eq("id", 1).single();
    if (gs && gs.cold_email_enabled === false) {
      await logAudit(supabase, { lead_id, channel: "email", event: "quiet_hours_blocked", reason: "Global kill switch: cold email disabled" });
      return new Response(JSON.stringify({ ok: false, error: "Cold email is globally disabled (admin kill switch)." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const minQuality: number = gs?.min_quality_score_to_send ?? 0;

    // Daily cap check (fail-closed)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: sentToday, error: capErr } = await supabase
      .from("contractor_outreach_audit_log")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email")
      .eq("event", "sent")
      .gte("created_at", since);
    if (capErr) {
      return new Response(JSON.stringify({ error: `Cap check failed: ${capErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const remaining = DAILY_EMAIL_CAP - (sentToday || 0);
    if (remaining <= 0) {
      return new Response(JSON.stringify({ ok: false, error: `Daily cap reached (${DAILY_EMAIL_CAP}/day). Try again tomorrow.` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const effectiveMax = Math.min(max_contractors, remaining);

    // Load lead + territory
    const { data: lead, error: lErr } = await supabase
      .from("contractor_leads")
      .select("*, contractor_lead_sites(trade, city, state)")
      .eq("id", lead_id)
      .single();
    if (lErr || !lead) {
      return new Response(JSON.stringify({ error: "lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trade = (lead as any).contractor_lead_sites?.trade || "Contractor";
    const city = (lead as any).contractor_lead_sites?.city || "Detroit";

    // Find matched contractor prospects
    const { data: prospects } = await supabase
      .from("contractor_outreach_prospects")
      .select("*")
      .ilike("trade", trade)
      .ilike("city", city)
      .not("email", "is", null)
      .is("unsubscribed_at", null)
      .order("last_emailed_at", { ascending: true, nullsFirst: true })
      .limit(effectiveMax);

    if (!prospects || prospects.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: `No ${trade} prospects in ${city} with email. Scrape + enrich first.` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Suppression check (batch)
    const emails = prospects.map((p: any) => p.email).filter(Boolean);
    const { data: suppressed, error: sErr } = await supabase
      .from("contractor_outreach_suppression")
      .select("contact")
      .eq("contact_type", "email")
      .in("contact", emails);
    if (sErr) {
      return new Response(JSON.stringify({ error: `Suppression check failed: ${sErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const suppressedSet = new Set((suppressed || []).map((s: any) => s.contact.toLowerCase()));

    const claimUrl = `https://detroitwebagent.com/contractor-marketplace?lead=${lead.id}`;
    const projectType = lead.project_type || lead.message || `${trade} project`;

    let sent = 0;
    let skippedSuppressed = 0;
    const failures: string[] = [];

    for (const p of prospects) {
      // Suppression gate
      if (suppressedSet.has((p.email || "").toLowerCase())) {
        skippedSuppressed++;
        await logAudit(supabase, {
          prospect_id: p.id, lead_id, channel: "email", event: "suppressed",
          reason: "Email on global suppression list",
        });
        continue;
      }

      try {
        const unsubUrl = `${SUPABASE_URL}/functions/v1/contractor-outreach-unsubscribe?id=${p.id}`;
        const html = dwaEmailWrap(
          buildBody({ businessName: p.business_name, trade, city, projectType, price, claimUrl }),
          unsubUrl
        );
        const subject = `${city} homeowner needs ${trade.toLowerCase()} — claim for $${price}?`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Matt Michels <matt@detroitwebagent.com>",
            to: [p.email],
            subject,
            html,
            headers: {
              "List-Unsubscribe": `<${unsubUrl}>, <mailto:matt@detroitwebagent.com?subject=Unsubscribe>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          failures.push(`${p.email}: ${t.slice(0, 120)}`);
          await logAudit(supabase, {
            prospect_id: p.id, lead_id, channel: "email", event: "bounce",
            reason: t.slice(0, 240),
          });
          continue;
        }
        await supabase
          .from("contractor_outreach_prospects")
          .update({
            last_emailed_at: new Date().toISOString(),
            email_send_count: (p.email_send_count || 0) + 1,
          })
          .eq("id", p.id);
        await logAudit(supabase, {
          prospect_id: p.id, lead_id, channel: "email", event: "sent",
          reason: subject,
          metadata: { price, claim_url: claimUrl },
        });
        sent++;
      } catch (e: any) {
        failures.push(`${p.email}: ${e?.message || "err"}`);
        await logAudit(supabase, {
          prospect_id: p.id, lead_id, channel: "email", event: "bounce",
          reason: e?.message || "send error",
        });
      }
    }

    // Best-effort comms log
    try {
      await supabase.from("system_comms_log").insert({
        channel: "email",
        direction: "outbound",
        recipient: `${sent} contractors`,
        subject: `Lead blast: ${trade} / ${city}`,
        body: `Lead ${lead.id} — ${projectType} — $${price}`,
        status: sent > 0 ? "sent" : "failed",
        meta: { lead_id, sent, suppressed: skippedSuppressed, failures: failures.slice(0, 5) },
      });
    } catch (_e) { /* table may differ across envs */ }

    return new Response(JSON.stringify({
      ok: true,
      sent,
      attempted: prospects.length,
      skipped_suppressed: skippedSuppressed,
      daily_remaining: remaining - sent,
      failures,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("contractor-outreach-email-blast error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
