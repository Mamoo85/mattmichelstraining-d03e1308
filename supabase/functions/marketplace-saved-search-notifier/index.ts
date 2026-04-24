// marketplace-saved-search-notifier — every 15 min cron.
// Match new leads to active saved searches, fire SMS within 5 min of match.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Only consider leads created in last 30 min (covers two cron windows)
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: searches } = await sb.from("marketplace_saved_searches")
    .select("*").eq("active", true);
  if (!searches?.length) {
    return new Response(JSON.stringify({ ok: true, searches: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let notified = 0;
  const trace: any[] = [];

  for (const s of searches as any[]) {
    if (!s.phone) continue;
    let q = sb.from("unified_lead_marketplace_view" as any)
      .select("id, score, city, zip, signal_type, signal_strength_tier, human_summary")
      .eq("product", s.product)
      .gte("score", s.min_score || 6)
      .gte("created_at", since)
      .limit(3);

    if (Array.isArray(s.zips) && s.zips.length) q = q.in("zip", s.zips);
    if (Array.isArray(s.signal_types) && s.signal_types.length) q = q.in("signal_type", s.signal_types);
    if (Array.isArray(s.tiers) && s.tiers.length) q = q.in("signal_strength_tier", s.tiers);

    const { data: matches } = await q;
    if (!matches?.length) continue;

    // Dedup against last_notified_lead_ids
    const already = new Set<string>(Array.isArray(s.last_notified_lead_ids) ? s.last_notified_lead_ids : []);
    const fresh = (matches as any[]).filter(m => !already.has(m.id));
    if (!fresh.length) continue;

    const top = fresh[0];
    const productSlug = `${s.product}-leads`;
    const body = `🎟 New ${s.product} lead: ${top.city || top.zip || "Metro Detroit"} · score ${top.score}/10 · ${top.signal_strength_tier?.toUpperCase() || "WARM"}. View: https://detroitwebagent.com/${productSlug}?h=${top.id.slice(0,8)} — Reply STOP to mute.`;

    try {
      await sendSMS(s.phone, FROM, body, "marketplace_saved_search");
      notified++;
      const updatedIds = [...fresh.map((m: any) => m.id), ...already].slice(0, 50);
      await sb.from("marketplace_saved_searches")
        .update({ last_notified_at: new Date().toISOString(), last_notified_lead_ids: updatedIds })
        .eq("id", s.id);
      trace.push({ search_id: s.id, sent: 1, lead_id: top.id });
    } catch (e) {
      trace.push({ search_id: s.id, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ ok: true, notified, trace }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
