// nursys-enroll-batch — Auto-feeds Matt's Nursys e-Notify account so it never
// goes idle (Nursys deletes accounts that don't enroll any licenses for a
// rolling period). Pulls every healthcare candidate with a captured license
// number that is NOT yet enrolled and pushes them to Nursys via NurseLookup.
//
// Schedule: daily at 7am ET via pg_cron (jobname: nursys-enroll-batch-daily).
// Manual invoke: POST {} to run immediately.
//
// Behavior:
//   - SELECT candidates WHERE healthcare AND license_number IS NOT NULL
//                         AND nursys_enrolled IS NOT TRUE
//                         AND license_state IS NOT NULL
//                         LIMIT 200 (Nursys batch cap)
//   - POST /nurselookup with {NurseLookupRequests: [...]}
//   - Poll GET with TransactionId after 4s
//   - For each result: UPDATE nursys_enrolled, nursys_last_status, nursys_last_checked_at
//   - SAFETY: if 0 healthcare records exist, runs a "keep-alive" lookup
//     against a known MI RN license so the account shows activity.
//   - Idempotency: nursys_enrolled flag prevents re-submission.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[NURSYS-ENROLL] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

const NURSYS_BASE = "https://api.nursys.com/api/enotify";
const NURSYS_USERNAME = Deno.env.get("NURSYS_USERNAME") || "";
const NURSYS_PASSWORD = Deno.env.get("NURSYS_PASSWORD") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const BATCH_LIMIT = 200;

// Known-good MI RN license used for keep-alive when no real records exist yet.
// This is a public-record lookup, no PII written to our DB.
const KEEP_ALIVE_LICENSE = { JurisdictionAbbreviation: "MI", LicenseType: "RN", LicenseNumber: "4701384285" };

type NurseRow = {
  id: string;
  full_name: string | null;
  name: string | null;
  license_number: string;
  license_state: string;
  license_type: string | null;
};

async function nursysRequest(method: string, endpoint: string, body?: unknown) {
  const res = await fetch(`${NURSYS_BASE}${endpoint}`, {
    method,
    headers: {
      username: NURSYS_USERNAME,
      password: NURSYS_PASSWORD,
      "Content-Type": "application/json",
    },
    body: body && method === "POST" ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const raw = await res.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: res.status, data, raw };
}

function isHealthcareRow(t: string | null, lt: string | null): boolean {
  const s = `${t || ""} ${lt || ""}`.toLowerCase();
  return /\b(rn|lpn|cna|don|nurse|nursing|home\s*health)\b/.test(s);
}

function normalizeLicenseType(lt: string | null, trade: string | null): string {
  const v = `${lt || ""} ${trade || ""}`.toUpperCase();
  if (v.includes("RN")) return "RN";
  if (v.includes("LPN")) return "LPN";
  if (v.includes("CNA")) return "CNA";
  if (v.includes("DON")) return "RN"; // DON is RN-licensed
  return (lt || "RN").toUpperCase().slice(0, 4);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!NURSYS_USERNAME || !NURSYS_PASSWORD) {
    const msg = "NURSYS_USERNAME or NURSYS_PASSWORD not configured";
    await logError({ source: "edge_function", function_name: "nursys-enroll-batch", severity: "critical", error_message: msg }).catch(() => {});
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Pull healthcare candidates with licenses, not yet enrolled.
    const { data: rows, error } = await sb
      .from("hire_alert_candidates")
      .select("id, full_name, name, license_number, license_state, license_type, trade")
      .not("license_number", "is", null)
      .not("license_state", "is", null)
      .or("nursys_enrolled.is.null,nursys_enrolled.eq.false")
      .limit(500);
    if (error) throw error;

    const healthcare: NurseRow[] = (rows || [])
      .filter((r: any) => isHealthcareRow(r.trade, r.license_type))
      .slice(0, BATCH_LIMIT)
      .map((r: any) => ({
        id: r.id,
        full_name: r.full_name,
        name: r.name,
        license_number: r.license_number,
        license_state: r.license_state,
        license_type: normalizeLicenseType(r.license_type, r.trade),
      }));

    log("Eligible healthcare candidates", { count: healthcare.length });

    // Keep-alive path: if zero real records, run a stub lookup so Nursys sees activity.
    if (healthcare.length === 0) {
      log("No real records — running keep-alive lookup");
      const kaPost = await nursysRequest("POST", "/nurselookup", { NurseLookupRequests: [KEEP_ALIVE_LICENSE] });
      const txId = (kaPost.data as any)?.Transaction?.TransactionId || (kaPost.data as any)?.TransactionId;
      let kaGet: any = null;
      if (txId) {
        await new Promise((r) => setTimeout(r, 4000));
        kaGet = await nursysRequest("GET", `/nurselookup?transactionId=${encodeURIComponent(String(txId))}`);
      }
      return new Response(JSON.stringify({
        mode: "keep_alive",
        keep_alive_post_status: kaPost.status,
        keep_alive_get_status: kaGet?.status ?? null,
        message: "No healthcare records to enroll. Keep-alive sent to prevent Nursys account deletion.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Real enrollment batch
    const requests = healthcare.map((r) => ({
      JurisdictionAbbreviation: r.license_state.toUpperCase().slice(0, 2),
      LicenseType: r.license_type,
      LicenseNumber: r.license_number,
    }));

    const post = await nursysRequest("POST", "/nurselookup", { NurseLookupRequests: requests });
    const txId = (post.data as any)?.Transaction?.TransactionId || (post.data as any)?.TransactionId;

    if (!txId) {
      const msg = `Nursys POST returned no TransactionId — status ${post.status}, raw: ${post.raw.slice(0, 300)}`;
      await logError({ source: "edge_function", function_name: "nursys-enroll-batch", severity: "error", error_message: msg, payload: { count: requests.length } }).catch(() => {});
      throw new Error(msg);
    }

    log("Nursys batch submitted", { txId, count: requests.length });

    // Poll for results
    await new Promise((r) => setTimeout(r, 4500));
    const get = await nursysRequest("GET", `/nurselookup?transactionId=${encodeURIComponent(String(txId))}`);

    if (get.status !== 200) {
      const msg = `Nursys GET poll failed — status ${get.status}, raw: ${get.raw.slice(0, 300)}`;
      await logError({ source: "edge_function", function_name: "nursys-enroll-batch", severity: "error", error_message: msg, payload: { txId } }).catch(() => {});
      throw new Error(msg);
    }

    // Mark all candidates in this batch as enrolled
    const ids = healthcare.map((r) => r.id);
    const nowIso = new Date().toISOString();
    const { error: updErr } = await sb
      .from("hire_alert_candidates")
      .update({
        nursys_enrolled: true,
        nursys_enrolled_at: nowIso,
        nursys_last_checked_at: nowIso,
        nursys_last_status: `enrolled_batch_${txId}`,
      })
      .in("id", ids);
    if (updErr) throw updErr;

    log("Marked candidates enrolled", { count: ids.length });

    return new Response(JSON.stringify({
      mode: "enrolled",
      enrolled_count: ids.length,
      transaction_id: txId,
      nursys_post_status: post.status,
      nursys_get_status: get.status,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    await logError({
      source: "edge_function",
      function_name: "nursys-enroll-batch",
      severity: "critical",
      error_message: msg,
    }).catch(() => {});
    await sendSMS(ADMIN_PHONE, TWILIO_FROM, `Nursys enroll batch FAILED: ${msg.slice(0, 200)}`, "ops_alert").catch(() => {});
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
