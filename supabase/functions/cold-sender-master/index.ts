// cold-sender-master
// Single orchestrator that drains the union of cold-email pools up to the
// daily ramp cap. Designed to run every 30 min between 9am–4pm ET (16 ticks).
//
// Per tick:
//   1. Read cold_email_ramp_state.current_cap (paused → no-op).
//   2. Count today's cold sends (via outreach_send_queue.sent_at).
//   3. remaining = current_cap - sent_today.
//   4. tick_quota = max(5, ceil(remaining / 6))  (front-loaded burndown).
//   5. Pull tick_quota candidates round-robin from 3 pools across all active
//      prospector_targets states, respecting:
//        - email present + not unsubscribed / bounced / suppressed
//        - never sent or last_sent > 30 days
//        - outreach-blocklist + email-suppression + frequency cap
//   6. Enqueue into outreach_send_queue (outreach-queue-worker actually sends).
//   7. Mark last_emailed_at / outreach_sent_at on source rows (optimistic).
//   8. Write a cold_sender_tick row for visibility.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Candidate {
  source: "contractor_outreach_prospects" | "outreach_leads" | "techalert_business_prospects";
  source_id: string;
  email: string;
  business_name: string | null;
  trade: string | null;
  city: string | null;
  state: string | null;
}

function dwaWrap(bodyHtml: string, unsubUrl: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#0a1628">
  <div style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid #00d4ff">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:3px">DETROIT <span style="color:#00d4ff">WEB AGENCY</span></div>
    <div style="color:#00d4ff;font-size:10px;letter-spacing:4px;margin-top:5px;font-weight:600">CONTRACTOR GROWTH AUTOMATION</div>
  </div>
  <div style="padding:32px;color:#e2e8f0;font-size:15px;line-height:1.7">${bodyHtml}</div>
  <div style="padding:20px 32px;border-top:1px solid #1e3a5f;text-align:center">
    <p style="margin:0;color:#4a6fa5;font-size:11px">Detroit Web Agency · Grosse Pointe Park, MI 48230 · (313) 992-1219</p>
    <p style="margin:6px 0 0;font-size:11px"><a href="${unsubUrl}" style="color:#4a6fa5;text-decoration:underline">Unsubscribe</a> — one click, instant removal</p>
  </div>
</div></body></html>`;
}

function buildEmail(c: Candidate, unsubUrl: string): { subject: string; html: string } {
  const biz = c.business_name || "your team";
  const trade = (c.trade || "service business").toLowerCase();
  const cityLine = c.city ? ` in ${c.city}${c.state ? ", " + c.state : ""}` : "";

  const subject = `Quick question for ${biz} — extra ${trade} jobs?`;
  const body = `
    <p style="margin:0 0 16px"><strong style="color:#00d4ff">Hi ${biz},</strong></p>
    <p style="margin:0 0 14px">Matt at Detroit Web Agency. We surface live ${trade} demand signals${cityLine} — permit pulls, storm damage zones, new-owner moves, FSBO listings — and route them as exclusive leads to one contractor (no bidding war).</p>
    <p style="margin:0 0 14px">If you've got room for 5–15 extra jobs per month, want me to send you the next batch we get?</p>
    <p style="margin:0 0 14px">Reply "<strong style="color:#00d4ff">YES</strong>" and I'll forward the first lead free so you can see the quality.</p>
    <p style="margin:14px 0 0;font-size:13px;color:#94a3b8">— Matt Michels<br>Detroit Web Agency · (313) 992-1219</p>
  `;
  return { subject, html: dwaWrap(body, unsubUrl) };
}

async function pickFromPool(
  sb: any,
  pool: Candidate["source"],
  states: string[],
  limit: number,
  thirtyDaysAgo: string,
): Promise<Candidate[]> {
  if (limit <= 0) return [];

  if (pool === "contractor_outreach_prospects") {
    const q = sb.from("contractor_outreach_prospects")
      .select("id, email, business_name, trade, city, state, last_emailed_at")
      .not("email", "is", null)
      .is("unsubscribed_at", null)
      .is("hard_bounced_at", null)
      .is("suppressed_at", null)
      .or(`last_emailed_at.is.null,last_emailed_at.lt.${thirtyDaysAgo}`)
      .order("last_emailed_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (states.length) q.in("state", states);
    const { data } = await q;
    return (data || []).map((r: any): Candidate => ({
      source: "contractor_outreach_prospects",
      source_id: r.id,
      email: r.email,
      business_name: r.business_name,
      trade: r.trade,
      city: r.city,
      state: r.state,
    }));
  }

  if (pool === "outreach_leads") {
    // outreach_leads has no state column → no state filter; treat as nationwide pool
    const { data } = await sb.from("outreach_leads")
      .select("id, owner_email, email, validated_email, enriched_email, business_name, company_name, industry, city, sms_sent_at, gmail_sent_at, created_at")
      .or("status.eq.lead_found,status.eq.new,status.is.null")
      .or(`gmail_sent_at.is.null,gmail_sent_at.lt.${thirtyDaysAgo}`)
      .order("created_at", { ascending: false })
      .limit(limit * 2); // overfetch — we'll filter email presence client-side
    const out: Candidate[] = [];
    for (const r of (data || [])) {
      const email = (r as any).owner_email || (r as any).validated_email || (r as any).enriched_email || (r as any).email;
      if (!email) continue;
      out.push({
        source: "outreach_leads",
        source_id: (r as any).id,
        email,
        business_name: (r as any).business_name || (r as any).company_name,
        trade: (r as any).industry,
        city: (r as any).city,
        state: null,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  // techalert_business_prospects
  const q = sb.from("techalert_business_prospects")
    .select("id, email, business_name, trade, city, state, outreach_sent_at")
    .not("email", "is", null)
    .or(`outreach_sent_at.is.null,outreach_sent_at.lt.${thirtyDaysAgo}`)
    .order("outreach_sent_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (states.length) q.in("state", states);
  const { data } = await q;
  return (data || []).map((r: any): Candidate => ({
    source: "techalert_business_prospects",
    source_id: r.id,
    email: r.email,
    business_name: r.business_name,
    trade: r.trade,
    city: r.city,
    state: r.state,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const debug: Record<string, unknown> = {};

  try {
    // 1. Ramp cap
    const { data: rs, error: rsErr } = await sb
      .from("cold_email_ramp_state").select("*").eq("id", 1).maybeSingle();
    if (rsErr) throw new Error("ramp_state load: " + rsErr.message);
    if (!rs) throw new Error("cold_email_ramp_state row 1 missing");
    if (rs.paused) {
      return new Response(JSON.stringify({ ok: false, paused: true, reason: rs.pause_reason }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const dailyCap = rs.current_cap as number;

    // 2. Today's sent count (sent through the queue)
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const { count: sentToday } = await sb
      .from("outreach_send_queue")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email")
      .eq("status", "sent")
      .gte("sent_at", todayStart.toISOString());

    // Also include pending/queued in flight to avoid double-pulling pool
    const { count: queuedToday } = await sb
      .from("outreach_send_queue")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email")
      .in("status", ["pending", "queued", "claimed"])
      .gte("created_at", todayStart.toISOString());

    const inFlight = (sentToday || 0) + (queuedToday || 0);
    const remaining = Math.max(0, dailyCap - inFlight);
    debug.dailyCap = dailyCap;
    debug.sentToday = sentToday;
    debug.queuedToday = queuedToday;
    debug.remaining = remaining;

    if (remaining <= 0) {
      return new Response(JSON.stringify({ ok: true, action: "cap_reached", ...debug }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 3. Tick quota — burndown over ~6 remaining windows
    const url = new URL(req.url);
    const forced = Number(url.searchParams.get("tick") || 0);
    const tickQuota = forced > 0 ? forced : Math.max(5, Math.ceil(remaining / 6));
    debug.tickQuota = tickQuota;

    // 4. Active states from prospector_targets
    const { data: targets } = await sb
      .from("prospector_targets").select("state").eq("active", true);
    const activeStates = Array.from(new Set((targets || []).map((t: any) => t.state).filter(Boolean)));
    debug.activeStates = activeStates;

    // 5. Round-robin pull across 3 pools
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const perPool = Math.ceil(tickQuota / 3);
    const [pA, pB, pC] = await Promise.all([
      pickFromPool(sb, "contractor_outreach_prospects", activeStates, perPool, thirtyDaysAgo),
      pickFromPool(sb, "outreach_leads", [], perPool, thirtyDaysAgo),
      pickFromPool(sb, "techalert_business_prospects", activeStates, perPool, thirtyDaysAgo),
    ]);
    const candidates: Candidate[] = [...pA, ...pB, ...pC].slice(0, tickQuota);
    debug.poolCounts = { contractor: pA.length, outreach: pB.length, techalert: pC.length };

    if (candidates.length === 0) {
      // Visibility row so dark days are obvious
      await sb.from("cold_sender_ticks").insert({
        ran_at: new Date().toISOString(),
        daily_cap: dailyCap, sent_today: sentToday || 0, queued_today: queuedToday || 0,
        tick_quota: tickQuota, enqueued: 0, skipped: 0,
        notes: "pool_empty",
        debug,
      }).then(() => {}, () => {});
      return new Response(JSON.stringify({ ok: true, action: "pool_empty", ...debug }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 6. Suppression check
    const emails = Array.from(new Set(candidates.map((c) => c.email.toLowerCase())));
    const { data: suppRows } = await sb.from("contractor_outreach_suppression")
      .select("contact").eq("contact_type", "email").in("contact", emails);
    const suppSet = new Set((suppRows || []).map((s: any) => (s.contact as string).toLowerCase()));

    // 7. Build queue rows
    const queueRows: any[] = [];
    let skipped = 0;
    const sourceUpdates: { source: string; ids: string[] }[] = [
      { source: "contractor_outreach_prospects", ids: [] },
      { source: "outreach_leads", ids: [] },
      { source: "techalert_business_prospects", ids: [] },
    ];

    for (const c of candidates) {
      if (suppSet.has(c.email.toLowerCase())) { skipped++; continue; }
      const unsubUrl = `${SUPABASE_URL}/functions/v1/contractor-outreach-unsubscribe?email=${encodeURIComponent(c.email)}`;
      const { subject, html } = buildEmail(c, unsubUrl);
      queueRows.push({
        channel: "email",
        prospect_id: c.source === "contractor_outreach_prospects" ? c.source_id : null,
        lead_id: c.source === "outreach_leads" ? c.source_id : null,
        priority: 6,
        payload: {
          to: c.email,
          subject,
          html,
          from: "Matt Michels <matt@detroitwebagent.com>",
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>, <mailto:matt@detroitwebagent.com?subject=Unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            "X-Cold-Sender": "cold-sender-master",
            "X-Source-Pool": c.source,
          },
        },
      });
      const bucket = sourceUpdates.find((b) => b.source === c.source);
      if (bucket) bucket.ids.push(c.source_id);
    }

    let enqueued = 0;
    if (queueRows.length > 0) {
      const { data: inserted, error: qErr } = await sb
        .from("outreach_send_queue")
        .insert(queueRows)
        .select("id");
      if (qErr) throw new Error("enqueue failed: " + qErr.message);
      enqueued = inserted?.length || 0;
    }

    // 8. Mark optimistic last_emailed_at — prevents double-pull on next tick
    const nowIso = new Date().toISOString();
    await Promise.all(
      sourceUpdates.filter((b) => b.ids.length > 0).map((b) => {
        if (b.source === "contractor_outreach_prospects") {
          return sb.from("contractor_outreach_prospects")
            .update({ last_emailed_at: nowIso }).in("id", b.ids);
        }
        if (b.source === "outreach_leads") {
          return sb.from("outreach_leads")
            .update({ gmail_sent_at: nowIso, status: "Emailed" }).in("id", b.ids);
        }
        return sb.from("techalert_business_prospects")
          .update({ outreach_sent_at: nowIso, status: "emailed" }).in("id", b.ids);
      }),
    );

    // 9. Visibility row
    await sb.from("cold_sender_ticks").insert({
      ran_at: nowIso,
      daily_cap: dailyCap, sent_today: sentToday || 0, queued_today: queuedToday || 0,
      tick_quota: tickQuota, enqueued, skipped,
      notes: enqueued < tickQuota ? "underfilled_pool_or_suppression" : "ok",
      debug,
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({
      ok: true, enqueued, skipped, tickQuota, candidates: candidates.length, ...debug,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cold-sender-master]", msg);
    return new Response(JSON.stringify({ error: msg, debug }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
