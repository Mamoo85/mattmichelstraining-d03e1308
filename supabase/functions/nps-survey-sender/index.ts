// nps-survey-sender — daily cron, sends NPS survey at 30/60/90 day milestones per product client.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const PRODUCTS = [
  { table: "hire_alert_clients", emailCol: "owner_email", product: "TechAlert", question: "Did you hire anyone using TechAlert this month? Reply YES or NO — it helps us improve." },
  { table: "field_crm_clients", emailCol: "email", product: "FieldDesk", question: "How likely are you to recommend FieldDesk to another field service business? Reply 1–10." },
  { table: "missed_call_clients", emailCol: "email", product: "Missed-Call Catch", question: "How likely are you to recommend Missed-Call Catch to another local business? Reply 1–10." },
  { table: "mortgage_radar_clients", emailCol: "email", product: "Mortgage Radar", question: "How likely are you to recommend Mortgage Radar to another loan officer? Reply 1–10." },
];

const MILESTONES = [30, 60, 90];

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let sent = 0;

  for (const product of PRODUCTS) {
    const { data: clients } = await (sb as any)
      .from(product.table)
      .select(`id, ${product.emailCol}, created_at`)
      .eq("active", true);

    for (const client of ((clients as any[]) || []) as Array<{ id: string; [k: string]: string }>) {
      const email = client[product.emailCol];
      if (!email) continue;
      const daysSince = Math.floor((Date.now() - new Date(client.created_at).getTime()) / 86400000);

      for (const milestone of MILESTONES) {
        if (daysSince < milestone || daysSince > milestone + 1) continue;

        // Check if already sent for this milestone
        const { data: existing } = await sb
          .from("client_nps_scores")
          .select("id")
          .eq("client_email", email)
          .eq("product", product.product)
          .eq("milestone", milestone)
          .maybeSingle();
        if (existing) continue;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt @ Detroit Web Agency <matt@detroitwebagent.com>",
            to: [email],
            subject: `Quick question about your ${product.product} experience`,
            html: `<div style="font-family:sans-serif;max-width:480px;background:#0a1628;color:#fff;padding:32px;border-radius:8px;"><p style="margin:0 0 16px;">Hey — it's been ${milestone} days since you started with <strong>${product.product}</strong>. Quick question:</p><p style="font-size:18px;color:#00d4ff;margin:0 0 24px;">${product.question}</p><p style="color:#94a3b8;font-size:13px;">Just reply to this email. Takes 5 seconds and helps me make ${product.product} better. — Matt</p></div>`,
          }),
        });

        // Insert placeholder row so we don't re-send
        await sb.from("client_nps_scores").insert({
          client_email: email,
          product: product.product,
          milestone,
          raw_reply: null,
          score: null,
        }).then(({ error }) => { if (error && !error.message.includes("unique")) console.error(error.message); });

        sent++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
});
