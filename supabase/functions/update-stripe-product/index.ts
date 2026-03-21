import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    // Verify admin role
    const { data: isAdmin } = await supabaseClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin access required");

    const { action, product_id, name, description } = await req.json();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    if (action === "list") {
      const products = await stripe.products.list({ limit: 20, active: true });
      const result = products.data.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
      }));
      return new Response(JSON.stringify({ products: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      if (!product_id) throw new Error("product_id required");
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      const updated = await stripe.products.update(product_id, updateData);
      console.log(`[UPDATE-STRIPE-PRODUCT] Updated ${product_id}: ${JSON.stringify(updateData)}`);

      return new Response(JSON.stringify({
        success: true,
        product: { id: updated.id, name: updated.name, description: updated.description },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "archive") {
      if (!product_id) throw new Error("product_id required");
      // Archive (deactivate) the product in Stripe
      await stripe.products.update(product_id, { active: false });
      console.log(`[UPDATE-STRIPE-PRODUCT] Archived ${product_id}`);
      return new Response(JSON.stringify({ success: true, archived: product_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action. Use 'list', 'update', or 'archive'.");
  } catch (error: any) {
    console.error("[UPDATE-STRIPE-PRODUCT] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
