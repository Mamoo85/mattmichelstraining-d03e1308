// test-nursys — Quick connectivity test for Nursys e-Notify JSON API
// Tests: auth, NotificationLookup (recent license changes), NurseLookup (by jurisdiction)
// NOT a cron — manual invoke only.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const NURSYS_BASE = "https://api.nursys.com/api/enotify";
const NURSYS_USERNAME = Deno.env.get("NURSYS_USERNAME") || "";
const NURSYS_PASSWORD = Deno.env.get("NURSYS_PASSWORD") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function nursysRequest(method: string, endpoint: string, body?: unknown): Promise<{ status: number; data: unknown; raw: string }> {
  const url = `${NURSYS_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    "username": NURSYS_USERNAME,
    "password": NURSYS_PASSWORD,
    "Content-Type": "application/json",
  };

  const opts: RequestInit = { method, headers, signal: AbortSignal.timeout(15_000) };
  if (body && method === "POST") {
    opts.body = JSON.stringify(body);
  }

  console.log(`[Nursys] ${method} ${url}`);
  const res = await fetch(url, opts);
  const raw = await res.text();
  let data: unknown;
  try { data = JSON.parse(raw); } catch { data = raw; }
  console.log(`[Nursys] ${res.status} — ${raw.slice(0, 500)}`);
  return { status: res.status, data, raw };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!NURSYS_USERNAME || !NURSYS_PASSWORD) {
      return new Response(JSON.stringify({ error: "NURSYS_USERNAME or NURSYS_PASSWORD not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, unknown> = {
      credentials: { username: NURSYS_USERNAME, passwordSet: !!NURSYS_PASSWORD },
    };

    // Test 1: NotificationLookup — get recent license changes (last 7 days)
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    console.log(`[Test 1] NotificationLookup ${startDate} to ${endDate}`);

    const notifPost = await nursysRequest("POST", "/notificationlookup", {
      StartDate: startDate,
      EndDate: endDate,
    });
    results.notificationLookup_POST = { status: notifPost.status, data: notifPost.data };

    // If we got a TransactionId, poll for results
    const txId = (notifPost.data as any)?.Transaction?.TransactionId ||
                 (notifPost.data as any)?.TransactionId;
    if (txId) {
      console.log(`[Test 1b] Polling NotificationLookup GET with txId=${txId}`);
      // Wait 3 seconds for processing
      await new Promise(r => setTimeout(r, 3000));
      const notifGet = await nursysRequest("GET", `/notificationlookup?transactionId=${encodeURIComponent(txId)}`);
      results.notificationLookup_GET = { status: notifGet.status, data: notifGet.data };
    }

    // Test 2: NurseLookup — look up a known Michigan RN license
    console.log(`[Test 2] NurseLookup — Michigan RN`);
    const lookupPost = await nursysRequest("POST", "/nurselookup", {
      NurseLookupRequests: [
        {
          JurisdictionAbbreviation: "MI",
          LicenseType: "RN",
          LicenseNumber: "4701384285", // Example MI RN license format
        },
      ],
    });
    results.nurseLookup_POST = { status: lookupPost.status, data: lookupPost.data };

    const lookupTxId = (lookupPost.data as any)?.Transaction?.TransactionId ||
                       (lookupPost.data as any)?.TransactionId;
    if (lookupTxId) {
      console.log(`[Test 2b] Polling NurseLookup GET with txId=${lookupTxId}`);
      await new Promise(r => setTimeout(r, 3000));
      const lookupGet = await nursysRequest("GET", `/nurselookup?transactionId=${encodeURIComponent(lookupTxId)}`);
      results.nurseLookup_GET = { status: lookupGet.status, data: lookupGet.data };
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[test-nursys] Error: ${msg}`);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
