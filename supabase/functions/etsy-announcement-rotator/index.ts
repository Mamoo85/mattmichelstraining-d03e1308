// Daily rotator: picks the highest-priority active announcement
// (sale > new_drop > featured > evergreen) and pushes it to Etsy.
// Honors the etsy_automation site_content toggle.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const KIND_PRIORITY: Record<string, number> = { sale: 100, new_drop: 80, featured: 60, manual: 50, evergreen: 10 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: toggle } = await sb.from("site_content")
    .select("content_value").eq("section","etsy_automation").eq("content_key","enabled").maybeSingle();
  if (toggle?.content_value === "false") {
    return new Response(JSON.stringify({ ok: true, skipped: "automation_paused" }), { headers: corsHeaders });
  }

  const now = new Date().toISOString();
  const { data: candidates } = await sb.from("etsy_announcement_schedule")
    .select("*")
    .eq("active", true)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`);

  if (!candidates?.length) return new Response(JSON.stringify({ ok: true, skipped: "no_candidates" }), { headers: corsHeaders });

  // Sort by kind weight desc, then explicit priority desc, then most recent
  candidates.sort((a, b) => {
    const kw = (KIND_PRIORITY[b.kind] ?? 0) - (KIND_PRIORITY[a.kind] ?? 0);
    if (kw !== 0) return kw;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // For evergreen pool with rotate flag, avoid repeating the last-pushed copy
  let pick = candidates[0];
  if (pick.kind === "evergreen") {
    const { data: last } = await sb.from("etsy_announcement_log")
      .select("copy").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const pool = candidates.filter((c) => c.kind === "evergreen");
    const fresh = pool.filter((c) => c.copy !== last?.copy);
    if (fresh.length) pick = fresh[Math.floor(Math.random() * fresh.length)];
  }

  // Push via etsy-shop-update
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/etsy-shop-update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      announcement: pick.copy,
      trigger: `rotator:${pick.kind}`,
      schedule_id: pick.id,
    }),
  });
  const result = await r.json();

  // Auto-expire one-off triggers (new_drop, featured) after they fire
  if (result.ok && (pick.kind === "new_drop" || pick.kind === "featured")) {
    await sb.from("etsy_announcement_schedule").update({ active: false }).eq("id", pick.id);
  }

  return new Response(JSON.stringify({ ok: result.ok, picked: pick.kind, copy: pick.copy }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
