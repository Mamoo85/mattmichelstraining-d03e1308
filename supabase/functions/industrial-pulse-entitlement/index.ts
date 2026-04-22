// industrial-pulse-entitlement (public)
// POST { email } → returns the caller's current Industrial Pulse entitlement.
// Used by the /industrial-pulse page to align CTAs/messaging with what the user actually has.
//
// Response shape:
// {
//   ok: true,
//   status: "active_snapshot" | "active_firehose" | "expired_snapshot" | "pending" | "none",
//   plan: "snapshot_50" | "firehose_199" | null,
//   week_start: "YYYY-MM-DD" | null,
//   days_remaining: number,           // for active snapshots; 0 if expired/none
//   expires_on: "YYYY-MM-DD" | null,  // snapshot week_start + 7 days
//   message: string                   // human-readable banner copy
// }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = (body?.email || "").toString().trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({
        ok: true,
        status: "none",
        plan: null,
        week_start: null,
        days_remaining: 0,
        expires_on: null,
        message: "",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Pull all unlock rows for this email, newest first.
    const { data: rows, error } = await sb
      .from("industrial_pulse_unlocks")
      .select("id, plan, status, week_start, activated_at, created_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    // 1. Active firehose subscription wins.
    const firehose = (rows || []).find(
      (r: any) => r.plan === "firehose_199" && r.status === "active",
    );
    if (firehose) {
      return new Response(JSON.stringify({
        ok: true,
        status: "active_firehose",
        plan: "firehose_199",
        week_start: null,
        days_remaining: -1,
        expires_on: null,
        message: "You have full firehose access — every signal across every vertical.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Active snapshot — and verify it's still inside its week window
    //    (defense-in-depth in case the daily expiry cron hasn't fired yet today).
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const activeSnapshot = (rows || []).find((r: any) => {
      if (r.plan !== "snapshot_50" || r.status !== "active" || !r.week_start) return false;
      const ws = new Date(r.week_start + "T00:00:00Z");
      return daysBetween(today, ws) < 7;
    });

    if (activeSnapshot) {
      const ws = new Date(activeSnapshot.week_start + "T00:00:00Z");
      const daysIn = daysBetween(today, ws);
      const daysRemaining = Math.max(0, 7 - daysIn);
      const expiresOn = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10);
      return new Response(JSON.stringify({
        ok: true,
        status: "active_snapshot",
        plan: "snapshot_50",
        week_start: activeSnapshot.week_start,
        days_remaining: daysRemaining,
        expires_on: expiresOn,
        message: `Your weekly snapshot is active for ${daysRemaining} more day${daysRemaining === 1 ? "" : "s"}.`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Most recent snapshot exists but expired (or status already flipped).
    const expiredSnapshot = (rows || []).find(
      (r: any) => r.plan === "snapshot_50" &&
        (r.status === "expired" ||
         (r.status === "active" && r.week_start &&
          daysBetween(today, new Date(r.week_start + "T00:00:00Z")) >= 7)),
    );
    if (expiredSnapshot) {
      return new Response(JSON.stringify({
        ok: true,
        status: "expired_snapshot",
        plan: "snapshot_50",
        week_start: expiredSnapshot.week_start,
        days_remaining: 0,
        expires_on: expiredSnapshot.week_start
          ? new Date(new Date(expiredSnapshot.week_start + "T00:00:00Z").getTime() + 7 * 24 * 60 * 60 * 1000)
              .toISOString().slice(0, 10)
          : null,
        message: "Your last weekly snapshot has expired. Unlock this week's signals to keep going.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Pending checkout
    const pending = (rows || []).find((r: any) => r.status === "pending");
    if (pending) {
      return new Response(JSON.stringify({
        ok: true,
        status: "pending",
        plan: pending.plan,
        week_start: pending.week_start,
        days_remaining: 0,
        expires_on: null,
        message: "We have a pending checkout for this email — finish payment to unlock.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: true,
      status: "none",
      plan: null,
      week_start: null,
      days_remaining: 0,
      expires_on: null,
      message: "",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[industrial-pulse-entitlement]", msg);
    return new Response(JSON.stringify({
      ok: false,
      error: msg,
      status: "none",
      plan: null,
      week_start: null,
      days_remaining: 0,
      expires_on: null,
      message: "",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
