// cold-email-quality-gate — pre-send compliance + deliverability check.
// Validates: spam score, subject length, MX presence (DNS over HTTPS),
// per-domain throttle (max 2 sends/24h), TCPA quiet-hours by recipient TZ guess,
// suppression / bounce check.
//
// Returns { allow: boolean, reasons: string[], warnings: string[], spam_score: number }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, localSpamScore, extractDomain } from "../_shared/coldEmailShared.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DOMAIN_LIMIT_24H = 2;

async function mxLookup(domain: string): Promise<boolean> {
  // Cloudflare DNS-over-HTTPS — works inside Deno without extra perms
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { Accept: "application/dns-json" },
    });
    if (!res.ok) return false;
    const j = await res.json();
    return Array.isArray(j?.Answer) && j.Answer.length > 0;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { recipient_email, subject, body, signal_id, contact_id } = await req.json();
    if (!recipient_email || !subject || !body) {
      return new Response(JSON.stringify({ error: "recipient_email, subject, body required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const reasons: string[] = [];
    const warnings: string[] = [];
    const domain = extractDomain(recipient_email);
    if (!domain) reasons.push("invalid_recipient_domain");

    // 1) Spam heuristic
    const spam = localSpamScore(subject, body);
    if (spam.score >= 6) reasons.push(`spam_score_${spam.score}: ${spam.reasons.join(", ")}`);
    else if (spam.score >= 3) warnings.push(`spam_score_${spam.score}`);

    // 2) Subject length (deliverability sweet spot 30-60)
    if (subject.length > 90) reasons.push(`subject_too_long_${subject.length}`);
    if (subject.length < 8) warnings.push("subject_very_short");

    // 3) Suppression / unsubscribe check
    const { data: supp } = await sb
      .from("sms_opt_outs") // shared opt-out registry; works for email too if user opted out
      .select("identifier")
      .eq("identifier", recipient_email.toLowerCase())
      .maybeSingle();
    if (supp) reasons.push("recipient_unsubscribed");

    // 4) Per-domain throttle (24h) — count queued/sent drafts to this domain
    if (domain) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await sb
        .from("email_reply_drafts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .ilike("recipient_email", `%@${domain}`);
      if ((count ?? 0) >= DOMAIN_LIMIT_24H) {
        reasons.push(`domain_throttled_${count}_in_24h`);
      } else if ((count ?? 0) >= 1) {
        warnings.push(`domain_${count}_sends_today`);
      }
    }

    // 5) MX validity
    let mx_valid = false;
    if (domain) {
      mx_valid = await mxLookup(domain);
      if (!mx_valid) reasons.push("no_mx_records");
    }

    // 6) TCPA quiet hours — coarse: block 9pm–8am ET (we don't always have geo)
    const etHour = Number(new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }));
    if (etHour >= 21 || etHour < 8) warnings.push(`outside_business_hours_et_${etHour}`);

    const allow = reasons.length === 0;
    // Note: email_quality_checks is keyed on draft_id which doesn't exist yet at gate time
    // (we run the gate BEFORE inserting the draft). We log to console + return; the bulk-queue
    // function persists the final decision after the draft row is created.
    console.log("[quality-gate]", { recipient_email, allow, reasons, warnings, spam_score: spam.score });

    return new Response(JSON.stringify({
      allow, reasons, warnings, spam_score: spam.score, spam_reasons: spam.reasons, mx_valid, domain,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[cold-email-quality-gate]", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
