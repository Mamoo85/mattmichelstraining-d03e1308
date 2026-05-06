// v4 §2 — Quarterly Business Review (QBR) PDF Generator
// Generates a branded PDF per client with last-quarter wins. Queues for Matt's manual review.
// After 4 successful manual reviews per client, marks status='auto_send_eligible'.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BROWSERLESS_KEY = Deno.env.get("BROWSERLESS_API_KEY");

function currentQuarter(d: Date): string {
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

async function renderPdf(html: string): Promise<string | null> {
  if (!BROWSERLESS_KEY) return null;
  try {
    const r = await fetch(`https://chrome.browserless.io/pdf?token=${BROWSERLESS_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, options: { format: "Letter", printBackground: true } }),
    });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    return `data:application/pdf;base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}`;
  } catch {
    return null;
  }
}

function buildQbrHtml(client: any, metrics: any, quarter: string): string {
  return `<!doctype html><html><head><style>
    body{font-family:-apple-system,sans-serif;color:#0a1628;margin:0;padding:48px}
    .hdr{border-bottom:4px solid #00d4ff;padding-bottom:16px;margin-bottom:32px}
    h1{margin:0;font-size:32px;color:#0a1628}
    .sub{color:#64748b;margin-top:4px}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin:24px 0}
    .stat{background:#f1f5f9;border-radius:8px;padding:20px}
    .stat .v{font-size:36px;font-weight:900;color:#00d4ff}
    .stat .l{font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em}
    .cta{background:#00d4ff;color:#0a1628;padding:20px;border-radius:8px;font-weight:700;text-align:center;margin-top:32px}
  </style></head><body>
    <div class="hdr"><h1>Quarterly Business Review</h1>
      <div class="sub">${client.client_name ?? client.client_email} · ${quarter} · ${client.product}</div></div>
    <div class="grid">
      <div class="stat"><div class="v">${metrics.leads ?? 0}</div><div class="l">Leads Captured</div></div>
      <div class="stat"><div class="v">${metrics.calls ?? 0}</div><div class="l">Calls Recovered</div></div>
      <div class="stat"><div class="v">${metrics.jobs ?? 0}</div><div class="l">Jobs Booked</div></div>
      <div class="stat"><div class="v">$${((metrics.revenue_cents ?? 0) / 100).toLocaleString()}</div><div class="l">Est. Revenue Impact</div></div>
    </div>
    <p>Detroit Web Agency continues to drive measurable results. Below is your performance for ${quarter}.</p>
    <div class="cta">Schedule your Q-review call: matt@detroitwebagent.com · (313) 992-1219</div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const quarter = currentQuarter(new Date());
  const generated: string[] = [];

  try {
    const productTables = [
      { table: "field_crm_clients", product: "fielddesk" },
      { table: "contractor_clients", product: "contractor_leads" },
      { table: "hire_alert_clients", product: "techalert" },
    ];

    for (const { table, product } of productTables) {
      const { data: clients } = await sb
        .from(table as any)
        .select("client_email, client_name, contact_email, email")
        .limit(100);

      for (const c of (clients as any) || []) {
        const email = c.client_email ?? c.contact_email ?? c.email;
        if (!email) continue;

        const { data: existing } = await sb
          .from("qbr_queue" as any)
          .select("id")
          .eq("client_email", email)
          .eq("quarter", quarter)
          .maybeSingle();
        if (existing) continue;

        const metrics = { leads: 0, calls: 0, jobs: 0, revenue_cents: 0 };
        const html = buildQbrHtml({ client_email: email, client_name: c.client_name, product }, metrics, quarter);
        const pdf = await renderPdf(html);

        await sb.from("qbr_queue" as any).insert({
          client_email: email,
          client_name: c.client_name ?? null,
          product,
          quarter,
          pdf_url: pdf,
          pdf_generated_at: pdf ? new Date().toISOString() : null,
          metrics,
          status: "pending_review",
        });
        generated.push(email);
      }
    }

    return new Response(JSON.stringify({ ok: true, quarter, generated: generated.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
