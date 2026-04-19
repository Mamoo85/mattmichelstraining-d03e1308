// Weekly digest worker — runs every Monday 7am ET
// Aggregates BSEED/permit signals for each active client and emails their digest
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

interface BuyerRow {
  company_name: string;
  permit_count: number;
  total_value: number;
  trades: string[];
  contact_emails: string[];
  recent_addresses: string[];
}

async function fetchBuyersForClient(
  sb: any,
  trades: string[],
  counties: string[],
  minPermits: number
): Promise<BuyerRow[]> {
  // Pull from industry_pulse_signals where signal_type = 'permit_surge' or company appears 5+ times in last 30d
  // Falls back to grouping by company_name if permit_surge signals don't yet exist (Claude Code's E22 work)
  const { data: signals } = await sb
    .from("industry_pulse_signals")
    .select("company_name, signal_type, recommended_pitch, raw_data, confidence, created_at")
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .gte("confidence", 6)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!signals || signals.length === 0) return [];

  // Aggregate by company_name
  const grouped = new Map<string, BuyerRow>();
  for (const s of signals) {
    const company = (s.company_name || "").trim();
    if (!company) continue;
    const raw = (s.raw_data as any) || {};
    const tradeMatch = trades.length === 0 || trades.some(
      (t) =>
        JSON.stringify(raw).toLowerCase().includes(t.toLowerCase()) ||
        (s.recommended_pitch || "").toLowerCase().includes(t.toLowerCase())
    );
    if (!tradeMatch) continue;

    const existing = grouped.get(company) || {
      company_name: company,
      permit_count: 0,
      total_value: 0,
      trades: [],
      contact_emails: [],
      recent_addresses: [],
    };
    existing.permit_count += raw.permit_count || 1;
    existing.total_value += Number(raw.total_value || raw.estimated_value || 0);
    if (raw.trade && !existing.trades.includes(raw.trade)) existing.trades.push(raw.trade);
    if (Array.isArray(raw.contact_emails)) {
      for (const e of raw.contact_emails) {
        if (!existing.contact_emails.includes(e)) existing.contact_emails.push(e);
      }
    }
    if (raw.address && !existing.recent_addresses.includes(raw.address)) {
      existing.recent_addresses.push(raw.address);
    }
    grouped.set(company, existing);
  }

  return Array.from(grouped.values())
    .filter((b) => b.permit_count >= minPermits)
    .sort((a, b) => b.permit_count - a.permit_count)
    .slice(0, 25);
}

function buildDigestHtml(client: any, buyers: BuyerRow[]): string {
  const totalSpend = buyers.reduce((sum, b) => sum + (b.total_value || 0), 0);
  const formatMoney = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  const buyerCards = buyers
    .map(
      (b) => `
    <tr><td style="padding:16px;background:#0a162808;border-radius:12px;border-left:4px solid #00d4ff;">
      <p style="margin:0 0 6px;font-size:16px;font-weight:800;color:#0a1628;">${b.company_name}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#475569;line-height:1.5;">
        <strong style="color:#00a3c4;">${b.permit_count} active permits</strong>
        ${b.total_value > 0 ? ` · Est. material spend: <strong>${formatMoney(b.total_value * 0.35)}</strong>` : ""}
        ${b.trades.length > 0 ? ` · ${b.trades.join(", ")}` : ""}
      </p>
      ${
        b.contact_emails.length > 0
          ? `<p style="margin:0 0 6px;font-size:12px;color:#1e293b;"><strong>📧 Contacts:</strong> ${b.contact_emails.slice(0, 3).join(", ")}</p>`
          : ""
      }
      ${
        b.recent_addresses.length > 0
          ? `<p style="margin:0;font-size:11px;color:#64748b;"><strong>📍 Recent projects:</strong> ${b.recent_addresses.slice(0, 2).join(" · ")}</p>`
          : ""
      }
    </td></tr>
    <tr><td style="height:10px;"></td></tr>
  `
    )
    .join("");

  return `<!DOCTYPE html><html><body style="margin:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
<tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1e293b 100%);padding:32px 28px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;">
    <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">📦 High-Volume Buyer Alerts</p>
    <p style="margin:10px 0 0;color:#fff;font-size:24px;font-weight:800;">${buyers.length} Active Buyers This Week</p>
    <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${client.business_name} · Est. total project value: ${formatMoney(totalSpend)}</p>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 24px 8px;">
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">Contractors below pulled <strong>${buyers[0]?.permit_count || 0}+ permits in the last 30 days</strong> in your target trades. They're scaling and need supply relationships now.</p>
  </td></tr>
  <tr><td style="background:#fff;padding:0 24px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">${buyerCards}</table>
  </td></tr>
  <tr><td style="background:#0a1628;padding:20px 24px;border-radius:0 0 16px 16px;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">Detroit Web Agency · High-Volume Buyer Permit Package</p>
    <p style="margin:6px 0 0;color:#64748b;font-size:10px;">Data sourced from public BSEED permit filings · matt@detroitwebagent.com</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: clients, error } = await sb
      .from("high_volume_buyer_clients")
      .select("*")
      .eq("active", true);

    if (error) throw error;

    let sentCount = 0;
    let skippedCount = 0;

    for (const client of clients || []) {
      const buyers = await fetchBuyersForClient(
        sb,
        client.target_trades || [],
        client.target_counties || [],
        client.min_permit_count || 5
      );

      if (buyers.length === 0) {
        skippedCount++;
        console.log(`[hvb-digest] Skipped ${client.email} — 0 buyers`);
        continue;
      }

      const html = buildDigestHtml(client, buyers);
      const totalValue = buyers.reduce((s, b) => s + b.total_value, 0);

      if (RESEND_API_KEY) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: [client.email],
            subject: `📦 ${buyers.length} active buyers this week — ${buyers[0].company_name} pulled ${buyers[0].permit_count} permits`,
            html,
          }),
        });
        if (!r.ok) {
          console.error(`[hvb-digest] Resend failed for ${client.email}:`, await r.text());
          continue;
        }
      }

      // Log digest send
      await sb.from("high_volume_buyer_digests").insert({
        client_id: client.id,
        buyer_count: buyers.length,
        total_permit_value: totalValue,
        payload: { buyers: buyers.slice(0, 25) },
      });

      // Update client tracking
      await sb
        .from("high_volume_buyer_clients")
        .update({
          last_digest_sent_at: new Date().toISOString(),
          digest_count: (client.digest_count || 0) + 1,
        })
        .eq("id", client.id);

      sentCount++;
    }

    return new Response(
      JSON.stringify({ ok: true, sent: sentCount, skipped: skippedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[hvb-digest] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
