// endpoint-drift-detector — runs weekly Sunday 3am ET
// HEAD-probes every primary URL in data_source_endpoints.
// On 404, promotes backup_url to primary, demotes old primary to backup, SMS Matt.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function probeUrl(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    // 4xx except 404/410 = server reachable (auth/billing/method issue), not broken
    return { ok: res.ok || (res.status >= 401 && res.status < 500 && res.status !== 404 && res.status !== 410), status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: endpoints, error } = await (sb.from as any)("data_source_endpoints").select("*");
  if (error || !endpoints) {
    return new Response(JSON.stringify({ error: error?.message || "no endpoints" }), { status: 500 });
  }

  const swaps: string[] = [];
  const dead: string[] = [];

  for (const ep of endpoints) {
    const primary = await probeUrl(ep.primary_url);

    if (primary.ok) {
      await (sb.from as any)("data_source_endpoints").update({
        last_verified_at: new Date().toISOString(),
        status: "active",
      }).eq("id", ep.id);
      continue;
    }

    // Primary is dead. Try backup.
    if (ep.backup_url) {
      const backup = await probeUrl(ep.backup_url);
      if (backup.ok) {
        // Swap: backup becomes primary, old primary becomes backup
        await (sb.from as any)("data_source_endpoints").update({
          primary_url: ep.backup_url,
          backup_url: ep.primary_url,
          last_verified_at: new Date().toISOString(),
          last_drift_at: new Date().toISOString(),
          status: "active",
          notes: `Auto-swapped: old primary returned ${primary.status} on ${new Date().toISOString().split("T")[0]}. ${ep.notes || ""}`.slice(0, 500),
        }).eq("id", ep.id);
        swaps.push(`${ep.source_name}: swapped (old primary ${primary.status})`);
        continue;
      }
    }

    // Both primary and backup dead
    await (sb.from as any)("data_source_endpoints").update({
      last_drift_at: new Date().toISOString(),
      status: "broken",
    }).eq("id", ep.id);
    dead.push(`${ep.source_name}: primary ${primary.status}, no working backup`);
  }

  // SMS Matt with summary
  const alerts = [
    ...swaps.map(s => `🔄 ${s}`),
    ...dead.map(d => `🔴 ${d}`),
  ];
  if (alerts.length > 0 && TWILIO_PHONE) {
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_PHONE,
      `🛰️ Endpoint Drift: ${alerts.join(" | ").slice(0, 1400)}`,
      "endpoint_drift_detector"
    ).catch((e) => console.error("[DRIFT] SMS failed:", e));
  }

  console.log(`[DRIFT] checked=${endpoints.length} swaps=${swaps.length} dead=${dead.length}`);
  return new Response(JSON.stringify({ ok: true, checked: endpoints.length, swaps, dead }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
