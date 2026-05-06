// prospect-nudge-request-approval — Texts Matt the draft + Y/A/E/N options.
//
// Called by AdminProspectTracker.tsx after inserting a row into sms_reply_drafts.
// Reuses the existing inbound-sms-relay approval flow (Y/A = approve, E … = edit, N = cancel).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // Auth — accept admin JWT or service-role bypass
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token" });
    const token = authHeader.slice(7).trim();

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (token !== SUPABASE_SERVICE_KEY) {
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
    }

    const payload = (await req.json()) as { draft_id?: string };
    if (!payload.draft_id) return json(400, { error: "Missing draft_id" });

    // Fetch the draft + matching prospect for the preview
    const { data: draft, error: dErr } = await sb
      .from("sms_reply_drafts")
      .select("id, phone, draft_body, status, metadata")
      .eq("id", payload.draft_id)
      .maybeSingle();

    if (dErr || !draft) return json(404, { error: "Draft not found" });
    if ((draft as any).status !== "pending") {
      return json(400, { error: `Draft is ${(draft as any).status}, not pending` });
    }

    const meta = (draft as any).metadata ?? {};
    const prospectId = meta.prospect_id as string | undefined;
    let preview = "";
    if (prospectId) {
      const { data: prospect } = await sb
        .from("prospect_nudges")
        .select("phone, city, trade, business")
        .eq("id", prospectId)
        .maybeSingle();
      if (prospect) {
        const p = prospect as any;
        const detail = [p.city, p.trade].filter(Boolean).join(" ");
        preview = `${p.phone}${detail ? ` · ${detail}` : ""}${p.business ? ` (${p.business})` : ""}`;
      }
    }
    if (!preview) preview = (draft as any).phone;

    const body = (draft as any).draft_body as string;
    const trimmed = body.length > 320 ? body.slice(0, 317) + "..." : body;

    const adminMsg =
      `📋 NUDGE DRAFT for ${preview}:\n\n` +
      `"${trimmed}"\n\n` +
      `Reply Y or A to send · E <new text> to edit · N to cancel`;

    const result = await sendSMS(
      ADMIN_PHONE,
      TWILIO_PHONE_NUMBER,
      adminMsg,
      "dwa_admin_reply",
      false,
      { bypassQuietHours: true }
    );

    if (!result.success) {
      return json(500, { error: result.error || "Failed to text Matt" });
    }

    return json(200, { success: true, sid: result.sid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[prospect-nudge-request-approval] error:", msg);
    return json(500, { error: msg });
  }
});
