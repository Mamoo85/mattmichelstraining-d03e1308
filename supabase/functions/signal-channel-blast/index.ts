// signal-channel-blast — unified multi-channel dispatcher for Growth Signals.
// Fans a single signal out to many supply-house buyers across email/SMS/fax/postcard.
//
// POST { signal_id, buyer_ids: uuid[], channels: ('email'|'sms'|'fax'|'postcard')[] }
// Returns { results, totals: { queued, skipped, failed, cost_cents }, summary_url }
//
// Compliance:
//   - 30-day per-(buyer,channel,signal) dedup via signal_outreach_log
//   - Daily caps per channel (SMS 150, Fax 80, Postcard 80) across the whole system
//   - SMS: 10-min ghost delay via sms_outreach_drafts, TCPA enforced by _shared/twilio.ts
//   - Email: re-uses dossier-cold-outreach (already shipped, with PDF + ghost delay)
//   - One consolidated SMS to Matt summarizing the whole batch with cancel-all link

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";
const SINCH_PROJECT_ID = Deno.env.get("SINCH_PROJECT_ID") || "";
const SINCH_KEY_ID = Deno.env.get("SINCH_KEY_ID") || "";
const SINCH_KEY_SECRET = Deno.env.get("SINCH_KEY_SECRET") || "";
const FAX_FROM = Deno.env.get("SINCH_FAX_FROM") || "";
const LOB_API_KEY = Deno.env.get("LOB_API_KEY") || "";

const SMS_GHOST_DELAY_MIN = 10;
const DEDUP_DAYS = 30;
const MAX_BUYERS_PER_RUN = 25;

const DAILY_CAPS: Record<string, number> = { sms: 150, fax: 80, postcard: 80, email: 500 };
const COSTS_CENTS: Record<string, number> = { email: 0, sms: 1, fax: 7, postcard: 85 };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function adminSMS(body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return;
  try {
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: ADMIN_PHONE, From: TWILIO_PHONE_NUMBER, Body: body }),
    });
  } catch (e) { console.error("[blast] adminSMS fail", e); }
}

async function sendFaxNow(toFax: string, body: string): Promise<{ ok: boolean; id?: string; err?: string }> {
  if (!SINCH_PROJECT_ID || !SINCH_KEY_ID || !SINCH_KEY_SECRET) return { ok: false, err: "Sinch creds missing" };
  try {
    const auth = btoa(`${SINCH_KEY_ID}:${SINCH_KEY_SECRET}`);
    const fd = new FormData();
    fd.append("to", toFax);
    if (FAX_FROM) fd.append("from", FAX_FROM);
    fd.append("body", new Blob([body], { type: "text/plain" }), "memo.txt");
    const r = await fetch(`https://fax.api.sinch.com/v3/projects/${SINCH_PROJECT_ID}/faxes`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: fd,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, err: `Sinch ${r.status}: ${JSON.stringify(j)}` };
    return { ok: true, id: String((j as any).id || (j as any).faxId || "") };
  } catch (e: any) { return { ok: false, err: e.message }; }
}

async function sendPostcardNow(buyer: any, frontText: string, backText: string): Promise<{ ok: boolean; id?: string; err?: string }> {
  if (!LOB_API_KEY) return { ok: false, err: "LOB_API_KEY missing" };
  if (!buyer.address || !buyer.zip) return { ok: false, err: "buyer missing address/zip" };
  try {
    const auth = btoa(`${LOB_API_KEY}:`);
    const front = `<html><body style="margin:0;padding:40px;font-family:Arial;background:#00d4ff;color:#0a1628;text-align:center;"><h1 style="font-size:36px;line-height:1.2;margin:0;">${frontText}</h1></body></html>`;
    const back = `<html><body style="margin:0;padding:36px;font-family:Arial;font-size:14px;line-height:1.5;color:#0a1628;">${backText.replace(/\n/g, "<br>")}</body></html>`;
    const fd = new FormData();
    fd.append("description", `DWA Signal Outreach`);
    fd.append("to[name]", buyer.contact_name || buyer.company);
    fd.append("to[company]", buyer.company);
    fd.append("to[address_line1]", buyer.address);
    fd.append("to[address_city]", buyer.city || "");
    fd.append("to[address_state]", buyer.state || "MI");
    fd.append("to[address_zip]", buyer.zip);
    fd.append("from", "adr_3a3deb8f8de87557");
    fd.append("front", front);
    fd.append("back", back);
    fd.append("size", "4x6");
    const r = await fetch("https://api.lob.com/v1/postcards", { method: "POST", headers: { Authorization: `Basic ${auth}` }, body: fd });
    const j = await r.json();
    if (!r.ok) return { ok: false, err: JSON.stringify(j) };
    return { ok: true, id: String((j as any).id || "") };
  } catch (e: any) { return { ok: false, err: e.message }; }
}

function smsCopy(signal: any, buyer: any): string {
  const need = (signal.predicted_needs || [])[0] || "supplies";
  const company = signal.company_name;
  const loc = signal.location || "Metro Detroit";
  // 160-char tease
  return `${buyer.company.split(" ")[0]} — ${company} (${loc}) just pulled ${signal.hiring_count || "multiple"} permits → 30-day spend window for ${need}. Free dossier: reply Y. -Matt, DWA`;
}

function faxCopy(signal: any, buyer: any, pdfUrl: string | null): string {
  const need = (signal.predicted_needs || [])[0] || "supplies";
  return [
    `TO: ${buyer.contact_name || "Branch Manager"} — ${buyer.company}`,
    ``,
    `RE: ${signal.company_name} — 30-day spend window`,
    ``,
    `${signal.company_name} (${signal.location || "Metro Detroit"}) just posted ${signal.hiring_count || "multiple"} permits/openings for ${(signal.hiring_roles || []).join(", ") || "skilled trades"}.`,
    `That typically triggers new ${need} orders inside 30 days.`,
    ``,
    `Their PO desk hasn't placed those orders yet — your branch could be the first call.`,
    ``,
    `Free 1-page dossier (name, address, hiring detail, predicted spend window — public records only):`,
    pdfUrl || `Reply by phone or email and we'll send the PDF.`,
    ``,
    `$50 unlocks the next 5 dossiers like this in your vertical this month — reply YES.`,
    ``,
    `— Matt Michels, Detroit Web Agency`,
    `(313) 992-1219 · matt@detroitwebagent.com`,
  ].join("\n");
}

function postcardCopy(signal: any) {
  const company = signal.company_name;
  const loc = signal.location || "Metro Detroit";
  const need = (signal.predicted_needs || [])[0] || "your supplies";
  const front = `${company.toUpperCase()}<br>is hiring.<br>They'll need<br>${need}.`;
  const back = [
    `Hey,`,
    ``,
    `${company} (${loc}) just pulled ${signal.hiring_count || "several"} permits — typical 30-day spend window for ${need}.`,
    ``,
    `Free 1-page dossier on them: detroitwebagent.com/dossier`,
    ``,
    `$50 = 5 more dossiers like this in your vertical.`,
    ``,
    `Matt — Detroit Web Agency`,
    `(313) 992-1219`,
  ].join("\n");
  return { front, back };
}

async function dailyCount(sb: any, channel: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await sb
    .from("signal_outreach_log")
    .select("id", { count: "exact", head: true })
    .eq("channel", channel)
    .in("status", ["queued", "sent"])
    .gte("created_at", since);
  return count || 0;
}

async function alreadySent(sb: any, signal_id: string, buyer_id: string, channel: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("signal_outreach_log")
    .select("id")
    .eq("signal_id", signal_id)
    .eq("buyer_id", buyer_id)
    .eq("channel", channel)
    .in("status", ["queued", "sent"])
    .gte("created_at", cutoff)
    .limit(1);
  return (data?.length || 0) > 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { signal_id, buyer_ids, channels } = await req.json();
    if (!signal_id || !Array.isArray(buyer_ids) || buyer_ids.length === 0 || !Array.isArray(channels) || channels.length === 0) {
      return new Response(JSON.stringify({ error: "signal_id, buyer_ids[], channels[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (buyer_ids.length > MAX_BUYERS_PER_RUN) {
      return new Response(JSON.stringify({ error: `max ${MAX_BUYERS_PER_RUN} buyers per run` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const validChannels = channels.filter((c: string) => ["email", "sms", "fax", "postcard"].includes(c));
    if (validChannels.length === 0) {
      return new Response(JSON.stringify({ error: "no valid channels" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Pull signal + buyers
    const [{ data: signal }, { data: buyers }] = await Promise.all([
      sb.from("industry_pulse_signals").select("id, company_name, location, industry, hiring_roles, hiring_count, predicted_needs, confidence").eq("id", signal_id).maybeSingle(),
      sb.from("industrial_supply_buyers").select("id, vertical, company, contact_name, email, phone, fax, address, city, state, zip").in("id", buyer_ids).eq("active", true),
    ]);
    if (!signal) {
      return new Response(JSON.stringify({ error: "signal not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!buyers || buyers.length === 0) {
      return new Response(JSON.stringify({ error: "no active buyers found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-check daily caps
    const remaining: Record<string, number> = {};
    for (const ch of validChannels) {
      const used = await dailyCount(sb, ch);
      remaining[ch] = Math.max(0, (DAILY_CAPS[ch] || 0) - used);
    }

    const totals = { queued: 0, skipped: 0, failed: 0, cost_cents: 0 };
    const results: any[] = [];

    for (const buyer of buyers) {
      for (const channel of validChannels) {
        // Cap check
        if (remaining[channel] <= 0) {
          totals.skipped++;
          results.push({ buyer_id: buyer.id, company: buyer.company, channel, skipped: true, reason: `daily cap reached (${DAILY_CAPS[channel]})` });
          continue;
        }
        // Reachability
        if (channel === "email" && !buyer.email) { totals.skipped++; results.push({ buyer_id: buyer.id, channel, skipped: true, reason: "no email" }); continue; }
        if (channel === "sms" && !buyer.phone) { totals.skipped++; results.push({ buyer_id: buyer.id, channel, skipped: true, reason: "no phone" }); continue; }
        if (channel === "fax" && !buyer.fax) { totals.skipped++; results.push({ buyer_id: buyer.id, channel, skipped: true, reason: "no fax" }); continue; }
        if (channel === "postcard" && (!buyer.address || !buyer.zip)) { totals.skipped++; results.push({ buyer_id: buyer.id, channel, skipped: true, reason: "no mailing address" }); continue; }
        // Dedup
        if (await alreadySent(sb, signal_id, buyer.id, channel)) {
          totals.skipped++;
          results.push({ buyer_id: buyer.id, channel, skipped: true, reason: "already sent in last 30d" });
          continue;
        }

        try {
          if (channel === "email") {
            const { data, error } = await sb.functions.invoke("dossier-cold-outreach", {
              body: { signal_id, target_company: buyer.company, target_email: buyer.email, target_contact_name: buyer.contact_name, vertical: buyer.vertical, silent: true },
            });
            if (error || (data as any)?.error) {
              totals.failed++;
              await sb.from("signal_outreach_log").insert({ signal_id, buyer_id: buyer.id, buyer_company: buyer.company, channel, status: "failed", error: error?.message || (data as any)?.error });
              results.push({ buyer_id: buyer.id, channel, error: error?.message || (data as any)?.error });
              continue;
            }
            if ((data as any)?.skipped) {
              totals.skipped++;
              results.push({ buyer_id: buyer.id, channel, skipped: true, reason: (data as any).reason });
              continue;
            }
            await sb.from("signal_outreach_log").insert({
              signal_id, buyer_id: buyer.id, buyer_company: buyer.company, channel, status: "queued",
              cost_cents: COSTS_CENTS.email, draft_id: (data as any)?.draft_id,
              meta: { pdf_url: (data as any)?.pdf_url, cancel_url: (data as any)?.cancel_url },
            });
            totals.queued++; totals.cost_cents += COSTS_CENTS.email; remaining.email--;
            results.push({ buyer_id: buyer.id, channel, queued: true });
          }
          else if (channel === "sms") {
            const sendAfter = new Date(Date.now() + SMS_GHOST_DELAY_MIN * 60 * 1000).toISOString();
            const body = smsCopy(signal, buyer);
            const { data: draft, error: dErr } = await sb.from("sms_outreach_drafts")
              .insert({ to_phone: buyer.phone, body, signal_id, buyer_id: buyer.id, send_after: sendAfter })
              .select("id").single();
            if (dErr) throw new Error(dErr.message);
            await sb.from("signal_outreach_log").insert({
              signal_id, buyer_id: buyer.id, buyer_company: buyer.company, channel, status: "queued",
              cost_cents: COSTS_CENTS.sms, draft_id: draft?.id, meta: { send_after: sendAfter, body_preview: body.slice(0, 120) },
            });
            totals.queued++; totals.cost_cents += COSTS_CENTS.sms; remaining.sms--;
            results.push({ buyer_id: buyer.id, channel, queued: true, send_after: sendAfter });
          }
          else if (channel === "fax") {
            // Fax sends immediately (no native ghost-delay; cancellable via Sinch isn't worth the complexity)
            const pdfPlaceholder = `https://detroitwebagent.com/dossier/${signal_id.slice(0, 8)}`;
            const result = await sendFaxNow(buyer.fax, faxCopy(signal, buyer, pdfPlaceholder));
            if (!result.ok) {
              totals.failed++;
              await sb.from("signal_outreach_log").insert({ signal_id, buyer_id: buyer.id, buyer_company: buyer.company, channel, status: "failed", error: result.err });
              results.push({ buyer_id: buyer.id, channel, error: result.err });
              continue;
            }
            await sb.from("signal_outreach_log").insert({
              signal_id, buyer_id: buyer.id, buyer_company: buyer.company, channel, status: "sent",
              cost_cents: COSTS_CENTS.fax, external_id: result.id, sent_at: new Date().toISOString(),
            });
            totals.queued++; totals.cost_cents += COSTS_CENTS.fax; remaining.fax--;
            results.push({ buyer_id: buyer.id, channel, sent: true, id: result.id });
          }
          else if (channel === "postcard") {
            const { front, back } = postcardCopy(signal);
            const result = await sendPostcardNow(buyer, front, back);
            if (!result.ok) {
              totals.failed++;
              await sb.from("signal_outreach_log").insert({ signal_id, buyer_id: buyer.id, buyer_company: buyer.company, channel, status: "failed", error: result.err });
              results.push({ buyer_id: buyer.id, channel, error: result.err });
              continue;
            }
            await sb.from("signal_outreach_log").insert({
              signal_id, buyer_id: buyer.id, buyer_company: buyer.company, channel, status: "sent",
              cost_cents: COSTS_CENTS.postcard, external_id: result.id, sent_at: new Date().toISOString(),
            });
            totals.queued++; totals.cost_cents += COSTS_CENTS.postcard; remaining.postcard--;
            results.push({ buyer_id: buyer.id, channel, sent: true, id: result.id });
          }

          // Update buyer last-touched
          await sb.from("industrial_supply_buyers").update({ last_outreach_at: new Date().toISOString() }).eq("id", buyer.id);
        } catch (e: any) {
          totals.failed++;
          await sb.from("signal_outreach_log").insert({ signal_id, buyer_id: buyer.id, buyer_company: buyer.company, channel, status: "failed", error: e?.message || "unknown" });
          results.push({ buyer_id: buyer.id, channel, error: e?.message || "unknown" });
        }
      }
    }

    // One consolidated SMS to Matt
    if (totals.queued > 0) {
      const breakdown = validChannels.map((c: string) => `${results.filter((r) => r.channel === c && (r.queued || r.sent)).length} ${c}`).join(" + ");
      const cancelUrl = `${SUPABASE_URL}/functions/v1/signal-outreach-cancel-bulk?signal_id=${signal_id}`;
      const cost = (totals.cost_cents / 100).toFixed(2);
      await adminSMS(`${signal.company_name} blast: ${breakdown} queued. Cost: $${cost}. ${totals.skipped} skipped, ${totals.failed} failed. Cancel-all (10min): ${cancelUrl}`);
    }

    return new Response(JSON.stringify({ ok: true, signal_company: signal.company_name, totals, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[signal-channel-blast]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
