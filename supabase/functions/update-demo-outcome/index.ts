import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const Body = z.object({
  booking_id: z.string().uuid(),
  outcome: z.enum(["scheduled", "showed", "no_show", "won", "lost", "follow_up"]).optional(),
  outcome_notes: z.string().max(4000).optional(),
  offer_pitched: z.string().max(80).optional(),
  deal_value_usd: z.number().min(0).max(1000000).optional(),
  next_action_at: z.string().datetime().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Auth gate: caller must be an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const b = parsed.data;

    const update: Record<string, unknown> = { outcome_set_at: new Date().toISOString() };
    if (b.outcome !== undefined) update.outcome = b.outcome;
    if (b.outcome_notes !== undefined) update.outcome_notes = b.outcome_notes;
    if (b.offer_pitched !== undefined) update.offer_pitched = b.offer_pitched;
    if (b.deal_value_usd !== undefined) update.deal_value_usd = b.deal_value_usd;
    if (b.next_action_at !== undefined) update.next_action_at = b.next_action_at;
    // Mirror outcome to status enum where it maps cleanly
    if (b.outcome === "no_show") update.status = "no_show";
    else if (b.outcome === "won" || b.outcome === "lost" || b.outcome === "showed" || b.outcome === "follow_up") update.status = "completed";

    const { error: upErr } = await sb.from("demo_bookings").update(update).eq("id", b.booking_id);
    if (upErr) throw upErr;

    const { error: logErr } = await sb.from("demo_outcome_log").insert({
      booking_id: b.booking_id,
      outcome: b.outcome ?? null,
      notes: b.outcome_notes ?? null,
      offer_pitched: b.offer_pitched ?? null,
      deal_value_usd: b.deal_value_usd ?? null,
      actor: user.email ?? "matt",
    });
    if (logErr) throw logErr;

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
