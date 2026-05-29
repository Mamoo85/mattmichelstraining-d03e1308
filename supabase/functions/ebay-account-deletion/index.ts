/**
 * ebay-account-deletion
 * Handles eBay Marketplace Account Deletion notifications.
 *
 * eBay requires every developer app to either:
 *   a) provide this endpoint so they can notify you when a buyer deletes their account, or
 *   b) apply for exemption
 *
 * GET  ?challenge_code=XXX  → returns SHA-256(challengeCode + verificationToken + endpointUrl)
 * POST body=notification    → logs the deletion event and returns 200
 *
 * Verification token (paste into eBay Developer Portal):
 *   GnGstoreEbayAcctDel2026xM2T8k9Pv
 *
 * Endpoint URL (paste into eBay Developer Portal):
 *   https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ebay-account-deletion
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFICATION_TOKEN = "GnGstoreEbayAcctDel2026xM2T8k9Pv";
const ENDPOINT_URL =
  "https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ebay-account-deletion";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── GET: eBay challenge verification ──────────────────────────────────────
  if (req.method === "GET") {
    const challengeCode = url.searchParams.get("challenge_code");
    if (!challengeCode) {
      return new Response(
        JSON.stringify({ error: "Missing challenge_code param" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // eBay spec: SHA-256(challengeCode + verificationToken + endpointUrl)
    const challengeResponse = await sha256Hex(
      challengeCode + VERIFICATION_TOKEN + ENDPOINT_URL
    );

    return new Response(JSON.stringify({ challengeResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── POST: account deletion notification ───────────────────────────────────
  if (req.method === "POST") {
    let payload: unknown = null;
    try {
      payload = await req.json();
    } catch {
      // malformed body — still return 200 so eBay doesn't retry forever
    }

    // Log to Supabase (best-effort — never let DB errors block the 200)
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("ebay_deletion_log").insert({
        payload,
        received_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("ebay-account-deletion: DB log failed", err);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── anything else ─────────────────────────────────────────────────────────
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
