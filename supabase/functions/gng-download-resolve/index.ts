// Resolves a download token (from purchase receipt link) to a one-shot signed file URL.
// GET ?token=...  →  { product_name, file_url, expires_at, download_count }
// Validates: token exists, not expired, increments download_count.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || token.length < 16) throw new Error("bad_token");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: purchase, error } = await sb
      .from("gng_digital_purchases")
      .select("id, product_slug, expires_at, download_count, customer_email")
      .eq("download_token", token).maybeSingle();
    if (error || !purchase) throw new Error("not_found");
    if (new Date(purchase.expires_at) < new Date()) throw new Error("expired");

    const { data: product } = await sb
      .from("gng_digital_products")
      .select("name, file_url")
      .eq("slug", purchase.product_slug).maybeSingle();
    if (!product?.file_url) throw new Error("file_missing");

    await sb.from("gng_digital_purchases")
      .update({ download_count: (purchase.download_count ?? 0) + 1 })
      .eq("id", purchase.id);

    return new Response(JSON.stringify({
      product_name: product.name,
      file_url: product.file_url,
      expires_at: purchase.expires_at,
      download_count: (purchase.download_count ?? 0) + 1,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
