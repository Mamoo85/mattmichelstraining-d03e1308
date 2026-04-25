// marketplace-generate-dossier-pdf — Browserless.io renders the live unlocked dossier to PDF,
// uploads to Storage, returns a 30-day signed URL. Caches per (lead_id + buyer_email).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BROWSERLESS = Deno.env.get("BROWSERLESS_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id, product, buyer_email } = await req.json();
    if (!lead_id || !product || !buyer_email) {
      return new Response(JSON.stringify({ error: "lead_id, product, buyer_email required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!BROWSERLESS) {
      return new Response(JSON.stringify({ error: "BROWSERLESS_API_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // SECURITY: Verify caller holds a sold lock before generating any dossier.
    // Prevents unauthenticated callers from rendering paid content via a known lead_id.
    const { data: lock } = await sb
      .from("marketplace_lead_locks")
      .select("status")
      .eq("lead_id", lead_id)
      .eq("product", product)
      .eq("buyer_email", buyer_email)
      .eq("status", "sold")
      .maybeSingle();
    if (!lock) {
      return new Response(JSON.stringify({ error: "purchase_not_found" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache check
    const { data: cached } = await sb.from("marketplace_lead_pdfs")
      .select("storage_path, signed_url, signed_url_expires_at")
      .eq("lead_id", lead_id).eq("buyer_email", buyer_email)
      .maybeSingle();
    if (cached?.storage_path) {
      const fresh = cached.signed_url_expires_at && new Date(cached.signed_url_expires_at) > new Date();
      if (fresh && cached.signed_url) {
        return new Response(JSON.stringify({ url: cached.signed_url, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Refresh signed URL
      const { data: signed } = await sb.storage.from("lead-dossier-pdfs")
        .createSignedUrl(cached.storage_path, 60 * 60 * 24 * 30);
      if (signed?.signedUrl) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await sb.from("marketplace_lead_pdfs")
          .update({ signed_url: signed.signedUrl, signed_url_expires_at: expiresAt })
          .eq("lead_id", lead_id).eq("buyer_email", buyer_email);
        return new Response(JSON.stringify({ url: signed.signedUrl, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Render the public lead detail page (which shows the unlocked card after the
    // user completes purchase — for the PDF we pass an internal token so the page
    // renders the unlocked variant for screenshot purposes)
    const renderUrl = `https://detroitwebagent.com/lead/${lead_id}?print=1&buyer=${encodeURIComponent(buyer_email)}`;

    // Browserless /pdf endpoint (v2 API)
    const pdfRes = await fetch(`https://chrome.browserless.io/pdf?token=${BROWSERLESS}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: renderUrl,
        options: { format: "A4", printBackground: true, margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" } },
        gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
      }),
    });
    if (!pdfRes.ok) {
      const txt = await pdfRes.text();
      throw new Error(`browserless ${pdfRes.status}: ${txt.slice(0, 200)}`);
    }
    const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());

    const path = `${product}/${lead_id}/${buyer_email.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.pdf`;
    const { error: upErr } = await sb.storage.from("lead-dossier-pdfs")
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`upload: ${upErr.message}`);

    const { data: signed } = await sb.storage.from("lead-dossier-pdfs")
      .createSignedUrl(path, 60 * 60 * 24 * 30);
    const url = signed?.signedUrl || "";
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await sb.from("marketplace_lead_pdfs").upsert({
      lead_id, product, buyer_email,
      storage_path: path, signed_url: url, signed_url_expires_at: expiresAt,
    }, { onConflict: "lead_id,buyer_email" });

    return new Response(JSON.stringify({ url, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[marketplace-generate-dossier-pdf]", e);
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
