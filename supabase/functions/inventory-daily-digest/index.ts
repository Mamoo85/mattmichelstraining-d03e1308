// Inventory Daily Digest — runs every day at 8am ET (13:00 UTC)
// Sends Matt one email summarizing inventory health across all watchlist products.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaEmail } from "../_shared/dwa-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = "matt@detroitwebagent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: watches } = await sb.from("inventory_watchlist").select("*").eq("active", true);

  const rows: string[] = [];
  let red = 0, yellow = 0, green = 0;

  for (const w of (watches || [])) {
    // latest alert for this product
    const { data: latest } = await sb
      .from("inventory_alerts")
      .select("*")
      .eq("product_slug", w.product_slug)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const status = latest?.status || "unknown";
    const dot = status === "green" ? "🟢" : status === "yellow" ? "🟡" : status === "red" ? "🔴" : "⚪";
    if (status === "red") red++; else if (status === "yellow") yellow++; else if (status === "green") green++;

    rows.push(`<tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${dot} <strong>${w.display_name}</strong></td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${latest?.row_count ?? "?"} rows</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${latest?.fresh_row_count ?? "?"} fresh</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#888">min ${w.min_rows}</td>
    </tr>`);
  }

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;color:#0a1628">
    <h2 style="color:#00d4ff">📦 Inventory Health — Daily Digest</h2>
    <p>${green} green · ${yellow} yellow · ${red} red</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows.join("")}</table>
    <p style="margin-top:20px;font-size:12px;color:#666">Backfills auto-triggered for any non-green product. Full history at <a href="https://detroitwebagent.com/dwa-admin">/dwa-admin → Inventory Health</a>.</p>
  </div>`;

  await dwaEmail({
    to: ADMIN_EMAIL,
    subject: `📦 Inventory: ${green}🟢 ${yellow}🟡 ${red}🔴`,
    html,
    text: `Inventory: ${green} green, ${yellow} yellow, ${red} red. See dwa-admin.`,
  });

  return new Response(JSON.stringify({ ok: true, green, yellow, red }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
