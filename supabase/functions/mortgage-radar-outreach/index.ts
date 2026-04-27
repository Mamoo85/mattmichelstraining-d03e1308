// Mortgage Radar — Outreach approval queue
// LO drafts an outreach (sms/email/call_note) → status='pending_approval'
// LO reviews + approves → status='approved' → auto-send via Twilio/Resend → 'sent'
// All sends are logged. Nothing leaves the building without LO approval.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const DWA_PHONE = "+13139921219";

interface CreateBody {
  action: "create";
  lead_id: string;
  client_id: string;
  channel: "sms" | "email" | "call_note";
  draft_subject?: string;
  draft_body: string;
}
interface ApproveBody {
  action: "approve";
  outreach_id: string;
  approved_body?: string;
  approved_subject?: string;
  send_now?: boolean;
}
interface RejectBody {
  action: "reject";
  outreach_id: string;
}
interface ListBody {
  action: "list";
  client_id: string;
  status?: string;
}
type Body = CreateBody | ApproveBody | RejectBody | ListBody;


async function sendEmail(to: string, subject: string, body: string, fromName: string): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "Resend not configured" };
  try {
    const html = body.split("\n").map(l => l.trim() === "" ? "<br>" : `<p style="margin:0 0 8px 0;font-family:Arial,sans-serif;font-size:14px;color:#333;">${l}</p>`).join("\n");
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${fromName} via Mortgage Radar <matt@detroitwebagent.com>`,
        to: [to],
        bcc: ["matt@detroitwebagent.com"],
        subject,
        html,
      }),
    });
    if (!r.ok) return { ok: false, error: `Resend ${r.status}: ${await r.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const body: Body = await req.json();

    if (body.action === "create") {
      const { lead_id, client_id, channel, draft_subject, draft_body } = body;
      if (!lead_id || !client_id || !channel || !draft_body) {
        return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await (sb.from as any)("mortgage_radar_outreach")
        .insert({ lead_id, client_id, channel, draft_subject: draft_subject || null, draft_body, status: "pending_approval" })
        .select("id, status, draft_body, draft_subject, channel, created_at")
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, outreach: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "list") {
      let q = (sb.from as any)("mortgage_radar_outreach")
        .select("id, lead_id, channel, draft_subject, draft_body, approved_body, status, created_at, approved_at, sent_at, send_error")
        .eq("client_id", body.client_id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (body.status) q = q.eq("status", body.status);
      const { data, error } = await q;
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, outreach: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "reject") {
      const { error } = await (sb.from as any)("mortgage_radar_outreach")
        .update({ status: "rejected" }).eq("id", body.outreach_id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "approve") {
      const { data: row, error: fetchErr } = await (sb.from as any)("mortgage_radar_outreach")
        .select("id, lead_id, client_id, channel, draft_body, draft_subject, status")
        .eq("id", body.outreach_id).single();
      if (fetchErr || !row) throw new Error(fetchErr?.message || "Outreach not found");
      if (row.status === "sent") {
        return new Response(JSON.stringify({ error: "Already sent" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const finalBody = body.approved_body || row.draft_body;
      const finalSubject = body.approved_subject || row.draft_subject || "Quick question";

      // Mark approved
      await (sb.from as any)("mortgage_radar_outreach")
        .update({ status: "approved", approved_body: finalBody, approved_at: new Date().toISOString() })
        .eq("id", row.id);

      if (!body.send_now) {
        return new Response(JSON.stringify({ ok: true, status: "approved" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Resolve recipient from lead
      const { data: lead } = await (sb.from as any)("mortgage_radar_leads")
        .select("phone, email, full_name").eq("id", row.lead_id).single();
      const { data: client } = await (sb.from as any)("mortgage_radar_clients")
        .select("contact_name, business_name").eq("id", row.client_id).single();
      const fromName = client?.business_name || client?.contact_name || "Your Loan Officer";

      let result: { ok: boolean; error?: string } = { ok: false, error: "No send" };
      if (row.channel === "sms" && lead?.phone) {
        const sms = await sendSMS(lead.phone, DWA_PHONE, finalBody, "mortgage_radar_outreach");
        result = { ok: sms.success, error: sms.error };
      } else if (row.channel === "email" && lead?.email) {
        result = await sendEmail(lead.email, finalSubject, finalBody, fromName);
      } else if (row.channel === "call_note") {
        result = { ok: true }; // Call notes don't actually send anywhere — they're logged for the LO's record.
      } else {
        result = { ok: false, error: `No ${row.channel} contact on lead` };
      }

      await (sb.from as any)("mortgage_radar_outreach")
        .update({
          status: result.ok ? "sent" : "failed",
          sent_at: result.ok ? new Date().toISOString() : null,
          send_error: result.ok ? null : result.error,
        })
        .eq("id", row.id);

      return new Response(JSON.stringify({ ok: result.ok, error: result.error }), {
        status: result.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[mortgage-radar-outreach]", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
