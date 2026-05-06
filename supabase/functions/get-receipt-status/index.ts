// Returns the current fulfillment status of a Stripe checkout session.
// Hardened (Phase 22+ paranoia sweep + receipt-banner sprint):
//   - Validates session_id format
//   - Authenticated callers only see receipts whose email matches their JWT
//   - Anonymous callers get status only (no email/product/timestamp leakage)
//   - In-memory per-IP rate limit (30 req / 60s) to blunt scraping
//
// Accepts either GET ?session_id=... or POST { session_id } so existing
// callers (supabase.functions.invoke with body) keep working.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{10,}$/;

// --- Tiny in-memory token bucket (per isolate) -----------------------------
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > RATE_LIMIT;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function readSessionId(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("session_id");
  if (fromQuery) return fromQuery;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const v = body?.session_id;
      return typeof v === "string" ? v : null;
    } catch {
      return null;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit (best-effort — restarts reset the bucket)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return jsonResponse({ error: "Rate limit exceeded. Try again in a minute." }, 429);
  }

  try {
    const sessionId = await readSessionId(req);
    if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
      return jsonResponse({ error: "Missing or invalid session_id" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Resolve caller (authenticated or anonymous)
    let userEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const sbUser = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
      const token = authHeader.slice("Bearer ".length);
      const { data } = await sbUser.auth.getUser(token);
      userEmail = data?.user?.email ?? null;
    }

    // Service-role read
    const sb = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data, error } = await sb
      .from("checkout_receipts")
      .select("status, product_type, fulfilled_at, error_message, email, created_at")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (error) {
      console.error("[get-receipt-status] db error:", error.message);
      return jsonResponse({ error: "Lookup failed" }, 500);
    }

    if (!data) {
      // Webhook hasn't created the row yet — safe pending response
      return jsonResponse({
        status: "pending",
        product_type: null,
        fulfilled_at: null,
        message: "Awaiting payment confirmation from Stripe…",
      });
    }

    // Authenticated owner gets full payload
    const isOwner = !!userEmail && !!data.email && userEmail.toLowerCase() === data.email.toLowerCase();
    if (isOwner) {
      return jsonResponse({
        status: data.status,
        product_type: data.product_type,
        fulfilled_at: data.fulfilled_at,
        error_message: data.error_message,
        email: data.email,
      });
    }

    // Anonymous / non-owner: status only, no PII
    return jsonResponse({
      status: data.status,
      product_type: null,
      fulfilled_at: null,
    });
  } catch (e: any) {
    console.error("[get-receipt-status] error:", e?.message || e);
    return jsonResponse({ error: e?.message || "Internal error" }, 500);
  }
});
