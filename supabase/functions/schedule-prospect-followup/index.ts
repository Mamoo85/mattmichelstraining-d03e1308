// schedule-prospect-followup — Admin endpoint.
//
// Body: { phone: string, hours: number (24-72), business?: string }
// 1. Normalizes the phone to digits-only (loose match against prospect_nudges).
// 2. If a prospect_nudges row exists for that phone (digits-only compare):
//    - sets scheduled_follow_up_at = now() + hours
//    - sets follow_up_status = 'pending'
//    - clears any previous follow_up_sent_at so it can re-fire
// 3. If none exists, creates a new prospect_nudges row from the provided fields.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeToE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^\+?1?\d{10}$/.test(digits) || /^1\d{10}$/.test(digits)) {
    return `+1${digits.slice(-10)}`;
  }
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token" });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await sbAuth.auth.getUser();
    if (userError || !userData?.user) return json(401, { error: "Invalid session" });

    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "agency_admin"])
      .maybeSingle();
    if (!roleRow) return json(403, { error: "Admin role required" });

    const payload = (await req.json()) as {
      phone?: string;
      hours?: number;
      business?: string;
      city?: string;
      trade?: string;
    };

    if (!payload.phone) return json(400, { error: "Missing phone" });
    const e164 = normalizeToE164(payload.phone);
    if (!e164) return json(400, { error: `Invalid phone: ${payload.phone}` });

    const hours = Math.max(1, Math.min(168, Math.round(payload.hours ?? 24)));
    const scheduledAt = new Date(Date.now() + hours * 60 * 60_000).toISOString();

    // Find existing nudge row by digits-only match
    const digits = e164.replace(/\D/g, "");
    const { data: existing } = await sb
      .from("prospect_nudges")
      .select("id, link_token, status")
      .filter("phone", "eq", e164)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let row = existing;

    if (!row) {
      // Try a broader digits-only match in case phone formatting differs
      const { data: loose } = await sb
        .rpc("noop_unused_placeholder", {})
        .then(() => ({ data: null }))
        .catch(() => ({ data: null }));
      void loose;

      const { data: list } = await sb
        .from("prospect_nudges")
        .select("id, link_token, status, phone")
        .order("created_at", { ascending: false })
        .limit(200);
      const match = (list ?? []).find(
        (r: any) => (r.phone || "").replace(/\D/g, "").endsWith(digits.slice(-10))
      );
      if (match) row = match as any;
    }

    if (row) {
      const { error: updErr } = await sb
        .from("prospect_nudges")
        .update({
          scheduled_follow_up_at: scheduledAt,
          follow_up_status: "pending",
          follow_up_sent_at: null,
          status: row.status === "dead" ? "active" : row.status,
        })
        .eq("id", row.id);
      if (updErr) return json(500, { error: updErr.message });

      return json(200, {
        success: true,
        nudge_id: row.id,
        link_token: row.link_token,
        scheduled_for: scheduledAt,
        action: "rescheduled",
      });
    }

    // No existing row — create one so the runner can pick it up
    const { data: created, error: insErr } = await sb
      .from("prospect_nudges")
      .insert({
        phone: e164,
        business: payload.business ?? null,
        city: payload.city ?? null,
        trade: payload.trade ?? null,
        scheduled_follow_up_at: scheduledAt,
        follow_up_status: "pending",
        notes: "Created via Schedule follow-up action",
      })
      .select("id, link_token")
      .maybeSingle();

    if (insErr) return json(500, { error: insErr.message });

    return json(200, {
      success: true,
      nudge_id: created?.id,
      link_token: created?.link_token,
      scheduled_for: scheduledAt,
      action: "created",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[schedule-prospect-followup] error:", msg);
    return json(500, { error: msg });
  }
});
