// Contractor Leads Portal API
// GET  ?token=<roi_token>                              — fetch contractor + leads + stats
// POST body { token, lead_id, feedback }               — update contractor_feedback
// "bad_lead" feedback notifies Matt for review

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const DWA_FROM = "+13139921219";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // ── POST: update contractor feedback on a lead ──────────────────────────
    if (req.method === "POST") {
      const { token, lead_id, feedback } = await req.json();

      if (!token || !lead_id || !feedback) {
        return new Response(JSON.stringify({ error: "Missing token, lead_id, or feedback" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const validFeedback = ["called", "hired", "bad_lead"];
      if (!validFeedback.includes(feedback)) {
        return new Response(JSON.stringify({ error: `Invalid feedback. Must be: ${validFeedback.join(", ")}` }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Validate token → get contractor
      const { data: contractor } = await sb.from("contractor_clients")
        .select("id, business_name, email, trade, city")
        .eq("roi_token", token)
        .maybeSingle();

      if (!contractor) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Verify lead belongs to this contractor
      const { data: lead } = await sb.from("contractor_leads")
        .select("id, name, phone, contractor_feedback")
        .eq("id", lead_id)
        .eq("client_id", contractor.id)
        .maybeSingle();

      if (!lead) {
        return new Response(JSON.stringify({ error: "Lead not found" }), {
          status: 404, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const updates: Record<string, unknown> = { contractor_feedback: feedback };
      if (feedback === "bad_lead") updates.bad_lead_flagged_at = new Date().toISOString();

      const { error: updateErr } = await sb.from("contractor_leads")
        .update(updates)
        .eq("id", lead_id);

      if (updateErr) throw new Error(updateErr.message);

      // Notify Matt on bad lead flag
      if (feedback === "bad_lead") {
        const msg = `⚠️ Bad lead flagged — ${contractor.business_name || contractor.email}: "${lead.name}" (${lead.phone}). Review in admin.`;
        await Promise.all([
          sendSMS(ADMIN_PHONE, DWA_FROM, msg, "bad_lead_alert").catch(() => {}),
          RESEND_API_KEY ? fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Detroit Web Agency <matt@detroitwebagent.com>",
              to: ["matt@detroitwebagent.com"],
              subject: `⚠️ Bad Lead Dispute — ${contractor.business_name || contractor.email}`,
              html: `<p><strong>Contractor:</strong> ${contractor.business_name || contractor.email} (${contractor.trade}, ${contractor.city})</p>
<p><strong>Lead name:</strong> ${lead.name}</p><p><strong>Lead phone:</strong> ${lead.phone}</p>
<p><strong>Action needed:</strong> Review lead quality and either refund or confirm valid.</p>`,
            }),
          }).catch(() => {}) : Promise.resolve(),
        ]);
      }

      return new Response(JSON.stringify({ ok: true, feedback }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── GET: fetch dashboard data ───────────────────────────────────────────
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: contractor } = await sb.from("contractor_clients")
      .select("id, name, business_name, email, phone, trade, city, state, active, created_at, roi_token, free_dead_leads_used, free_dead_leads_quota")
      .eq("roi_token", token)
      .maybeSingle();

    if (!contractor) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Fetch all leads for this contractor, newest first
    const { data: leads } = await sb.from("contractor_leads")
      .select("id, name, phone, email, message, project_type, source, status, contractor_feedback, bad_lead_flagged_at, created_at")
      .eq("client_id", contractor.id)
      .order("created_at", { ascending: false })
      .limit(100);

    const allLeads = leads || [];

    // Monthly stats (current calendar month)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const thisMonth = allLeads.filter((l) => l.created_at >= monthStart);
    const stats = {
      total: allLeads.length,
      this_month: thisMonth.length,
      called: allLeads.filter((l) => l.contractor_feedback === "called").length,
      hired: allLeads.filter((l) => l.contractor_feedback === "hired").length,
      bad_lead: allLeads.filter((l) => l.contractor_feedback === "bad_lead").length,
      pending_feedback: allLeads.filter((l) => !l.contractor_feedback).length,
    };

    // Check which free bundled services are active for this contractor
    const [missedCallRow, reviewRow, afterjobRow] = await Promise.all([
      sb.from("missed_call_clients").select("id, active").eq("email", contractor.email).maybeSingle(),
      sb.from("review_alert_clients").select("id, active").eq("email", contractor.email).maybeSingle(),
      sb.from("quote_followup_clients").select("id, active").eq("email", contractor.email).maybeSingle(),
    ]);

    const bundled_services = {
      missed_call: !!missedCallRow.data && (missedCallRow.data as any).active !== false,
      reviews: !!reviewRow.data && (reviewRow.data as any).active !== false,
      afterjob: !!afterjobRow.data && (afterjobRow.data as any).active !== false,
    };

    // Static upgrade shop — 30% off bundled discount for active lead-network clients
    const available_upgrades = [
      { key: "techalert",  name: "TechAlert",         tagline: "Hiring monitor — get alerted when licensed pros come available", standalone: 149, bundled: 104, checkout_path: "/hire-alert" },
      { key: "fielddesk",  name: "FieldDesk",         tagline: "Dispatch CRM + mobile tech app — replace eWay/FieldServio",     standalone: 199, bundled: 139, checkout_path: "/field-service" },
      { key: "siteradar",  name: "SiteRadar",         tagline: "See which businesses visit your website (real-time intel)",     standalone: 49,  bundled: 34,  checkout_path: "/visitor-intel" },
      { key: "promo",      name: "Seasonal Promo Blaster", tagline: "Auto-text past customers when seasons change",             standalone: 29,  bundled: 20,  checkout_path: "/seasonal-promo" },
      { key: "estimate",   name: "Estimate Follow-Up Drip", tagline: "Auto-text quotes that didn't book — pull deals back in",  standalone: 39,  bundled: 27,  checkout_path: "/estimate-followup" },
      { key: "smsblast",   name: "Weekly SMS Blast",  tagline: "One opt-in customer list, one tap, weekly promotion",           standalone: 19,  bundled: 13,  checkout_path: "/weekly-sms" },
    ];

    return new Response(JSON.stringify({
      contractor: {
        id: contractor.id,
        email: contractor.email,
        business_name: contractor.business_name || contractor.name,
        trade: contractor.trade,
        city: contractor.city,
        state: contractor.state || "MI",
        active: contractor.active,
        member_since: contractor.created_at,
        free_dead_leads_used: (contractor as any).free_dead_leads_used ?? 0,
        free_dead_leads_quota: (contractor as any).free_dead_leads_quota ?? 40,
      },
      stats,
      bundled_services,
      available_upgrades,
      leads: allLeads.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        message: l.message,
        project_type: l.project_type,
        source: l.source,
        status: l.status,
        contractor_feedback: l.contractor_feedback,
        bad_lead_flagged_at: l.bad_lead_flagged_at,
        created_at: l.created_at,
      })),
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[contractor-leads-dashboard]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
