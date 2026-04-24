// marketplace-buyer-receipts — return all dossiers a buyer has purchased.
// POST { buyer_email } → { purchases: [...] } with fresh 30-day signed PDF URLs.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { buyer_email } = await req.json();
    const email = String(buyer_email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "buyer_email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Pull all sold locks for this buyer
    const { data: locks, error: locksErr } = await sb
      .from("marketplace_lead_locks")
      .select("lead_id, product, buyer_email, status, sold_at, amount_cents, stripe_session_id")
      .eq("buyer_email", email)
      .eq("status", "sold")
      .order("sold_at", { ascending: false });

    if (locksErr) throw locksErr;
    if (!locks?.length) {
      return new Response(JSON.stringify({ purchases: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadIds = locks.map((l: any) => l.lead_id);
    const { data: leads } = await sb
      .from("unified_lead_marketplace_view" as any)
      .select("id, product, score, signal_strength_tier, signal_type, city, zip, human_summary, buyer_type, suggested_opener, provenance_source_urls, created_at")
      .in("id", leadIds);

    const leadMap = new Map<string, any>((leads || []).map((l: any) => [l.id, l]));

    // Generate / refresh signed PDF URL per purchase (cached by edge function itself)
    const purchases = await Promise.all(locks.map(async (lock: any) => {
      let pdf_url: string | null = null;
      try {
        const { data: pdfRes } = await sb.functions.invoke("marketplace-generate-dossier-pdf", {
          body: { lead_id: lock.lead_id, product: lock.product, buyer_email: email },
        });
        pdf_url = (pdfRes as any)?.url || null;
      } catch (_e) { /* PDF render is best-effort */ }

      const lead = leadMap.get(lock.lead_id) || {};
      return {
        lead_id: lock.lead_id,
        product: lock.product,
        purchased_at: lock.sold_at,
        amount_cents: lock.amount_cents,
        pdf_url,
        lead_summary: {
          score: lead.score,
          signal_strength_tier: lead.signal_strength_tier,
          signal_type: lead.signal_type,
          city: lead.city,
          zip: lead.zip,
          human_summary: lead.human_summary,
          buyer_type: lead.buyer_type,
          suggested_opener: lead.suggested_opener,
        },
        provenance: Array.isArray(lead.provenance_source_urls) ? lead.provenance_source_urls : [],
      };
    }));

    return new Response(JSON.stringify({ purchases }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[marketplace-buyer-receipts]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
