// Forever-Pricing Anniversary Notice — sends each DWA client a recap 30 days
// before their renewal anniversary, reinforcing the locked-in pricing moat.
// Idempotent via anniversary_notices table (unique product+client+year).
// Runs daily at 9am ET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { dwaEmail } from "../_shared/dwa-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// Tables to scan: { table, productSlug, productLabel, emailField, nameField }
const PRODUCTS = [
  { table: "hire_alert_clients", slug: "techalert", label: "TechAlert", emailField: "owner_email", nameField: "company_name", price: "$149/mo" },
  { table: "field_crm_clients", slug: "fielddesk", label: "FieldDesk + SiteRadar", emailField: "owner_email", nameField: "company_name", price: "$199/mo" },
  { table: "contractor_clients", slug: "contractor_leads", label: "Contractor Leads", emailField: "owner_email", nameField: "company_name", price: "$399/mo" },
  { table: "missed_call_clients", slug: "missed_call", label: "Missed-Call Catch", emailField: "owner_email", nameField: "company_name", price: "$99/mo" },
  { table: "mortgage_radar_clients", slug: "mortgage_radar", label: "Mortgage Radar", emailField: "owner_email", nameField: "company_name", price: "$149/mo" },
  { table: "trade_radar_clients", slug: "trade_radar", label: "Trade Radar", emailField: "owner_email", nameField: "company_name", price: "$149/mo" },
  { table: "phone_answering_clients", slug: "ai_phone", label: "AI Phone Answering", emailField: "owner_email", nameField: "company_name", price: "$199/mo" },
];

function buildEmail(label: string, price: string, name: string, year: number, days: number) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f7fa;padding:24px;color:#0a1628">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#0a1628,#0f2847);padding:24px;color:#00d4ff">
    <div style="font-size:12px;letter-spacing:2px;opacity:.7">DETROIT WEB AGENCY</div>
    <h1 style="margin:8px 0 0;font-size:22px;color:#fff">Year ${year} on us. Same price. Forever.</h1>
  </div>
  <div style="padding:28px;line-height:1.55;font-size:15px">
    <p>Hey ${name || "there"},</p>
    <p>You're <strong>${days} days</strong> away from your ${label} anniversary.</p>
    <p>Quick reminder of the deal we shook on: <strong>${price}, locked forever.</strong> Not "until we raise prices." Not "until your renewal." <em>Forever.</em></p>
    <p>While competitors raised their rates 18–40% this year, your number doesn't move. That's the moat — and it's yours as long as you stay subscribed.</p>
    <div style="background:#f0fdfa;border-left:4px solid #00d4ff;padding:16px;margin:20px 0;border-radius:6px">
      <strong>What you've gotten this year:</strong> Continuous data refreshes, every new feature shipped, full access to the ${label} pipeline, and direct line to me if anything breaks.
    </div>
    <p>No action needed. Your subscription auto-renews at the same rate. Just wanted you to know I notice — and I appreciate you sticking with us.</p>
    <p>If you ever want to add another product to your stack, your forever-rate carries to bundles too. Just reply to this email.</p>
    <p style="margin-top:28px">— Matt Michels<br/>Detroit Web Agency<br/><a href="tel:+13139921219" style="color:#0a1628">(313) 992-1219</a></p>
  </div>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date();
  const targetMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  const tolerance = 24 * 60 * 60 * 1000; // ±1 day

  const results: Record<string, { scanned: number; sent: number; skipped: number; errors: string[] }> = {};

  for (const p of PRODUCTS) {
    const r = { scanned: 0, sent: 0, skipped: 0, errors: [] as string[] };
    try {
      const { data, error } = await sb
        .from(p.table)
        .select(`id, ${p.emailField}, ${p.nameField}, created_at, active`)
        .eq("active", true);

      if (error) { r.errors.push(error.message); results[p.slug] = r; continue; }
      r.scanned = data?.length || 0;

      for (const row of data || []) {
        const email = (row as any)[p.emailField];
        const name = (row as any)[p.nameField];
        const created = (row as any).created_at;
        if (!email || !created) { r.skipped++; continue; }

        const createdDate = new Date(created);
        const yearsSince = now.getFullYear() - createdDate.getFullYear();
        if (yearsSince < 1) { r.skipped++; continue; }

        // Next anniversary date
        const nextAnniv = new Date(createdDate);
        nextAnniv.setFullYear(now.getFullYear());
        if (nextAnniv.getTime() < now.getTime()) nextAnniv.setFullYear(now.getFullYear() + 1);

        const msUntil = nextAnniv.getTime() - now.getTime();
        if (Math.abs(msUntil - targetMs) > tolerance) { r.skipped++; continue; }

        const annivYear = nextAnniv.getFullYear();
        // Idempotency
        const { data: existing } = await sb
          .from("anniversary_notices")
          .select("id")
          .eq("product", p.slug)
          .eq("client_id", row.id)
          .eq("anniversary_year", annivYear)
          .maybeSingle();
        if (existing) { r.skipped++; continue; }

        const days = Math.round(msUntil / (24 * 60 * 60 * 1000));
        const send = await dwaEmail({
          to: email,
          subject: `Year ${yearsSince + 1} — your forever-price is locked`,
          html: buildEmail(p.label, p.price, name || "", yearsSince + 1, days),
        });

        if (!send.ok) { r.errors.push(`${email}: ${send.error}`); continue; }

        await sb.from("anniversary_notices").insert({
          product: p.slug,
          client_id: row.id,
          client_email: email,
          anniversary_year: annivYear,
          wins_summary: { years_since: yearsSince, label: p.label, price: p.price },
        });
        r.sent++;
      }
    } catch (e) {
      r.errors.push(e instanceof Error ? e.message : String(e));
    }
    results[p.slug] = r;
  }

  return new Response(JSON.stringify({ ok: true, results, timestamp: now.toISOString() }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
