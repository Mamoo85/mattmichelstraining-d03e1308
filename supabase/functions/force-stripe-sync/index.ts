import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_TO_TIER: Record<string, string> = {
  // These will be matched dynamically by product metadata or price lookup
};

// Map price amount (cents) to tier as fallback
const AMOUNT_TO_TIER: Record<number, string> = {
  1499: "basic",
  3999: "foundation",
  9999: "custom",
  14999: "team_elite",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Auth check — admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    const { data: roleCheck } = await supabaseClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!roleCheck) throw new Error("Admin access required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch all active subscriptions from Stripe (paginated)
    const stripeSubscriptions: Stripe.Subscription[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: Stripe.SubscriptionListParams = {
        status: "active",
        limit: 100,
        expand: ["data.items.data.price"],
      };
      if (startingAfter) params.starting_after = startingAfter;

      const batch = await stripe.subscriptions.list(params);
      stripeSubscriptions.push(...batch.data);
      hasMore = batch.has_more;
      if (batch.data.length > 0) {
        startingAfter = batch.data[batch.data.length - 1].id;
      }
    }

    console.log(`[FORCE-SYNC] Found ${stripeSubscriptions.length} active Stripe subscriptions`);

    // Build a map: customer_email -> highest tier from Stripe
    const emailTierMap: Record<string, string> = {};

    for (const sub of stripeSubscriptions) {
      // Get customer email
      let email: string | null = null;
      if (typeof sub.customer === "string") {
        const customer = await stripe.customers.retrieve(sub.customer);
        if (!customer.deleted) email = customer.email;
      } else if (sub.customer && !sub.customer.deleted) {
        email = sub.customer.email;
      }

      if (!email) continue;
      email = email.toLowerCase();

      // Determine tier from subscription items
      for (const item of sub.items.data) {
        const price = item.price;
        const amountCents = price.unit_amount || 0;

        // Try amount-based mapping
        let tier = AMOUNT_TO_TIER[amountCents];

        // Try metadata
        if (!tier && price.metadata?.tier) {
          tier = price.metadata.tier;
        }

        // Try product metadata
        if (!tier && typeof price.product === "string") {
          try {
            const product = await stripe.products.retrieve(price.product);
            if (product.metadata?.tier) tier = product.metadata.tier;
          } catch { /* ignore */ }
        }

        if (!tier) tier = "basic"; // fallback

        // Keep the highest tier per email
        const tierRank: Record<string, number> = { basic: 1, foundation: 2, custom: 3, team_elite: 4 };
        const currentRank = tierRank[emailTierMap[email]] || 0;
        const newRank = tierRank[tier] || 0;
        if (newRank > currentRank) {
          emailTierMap[email] = tier;
        }
      }
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("user_id, email, subscription_tier");
    if (profilesError) throw new Error(profilesError.message);

    let updated = 0;
    let verified = 0;

    for (const profile of (profiles || [])) {
      if (!profile.email) continue;
      const email = profile.email.toLowerCase();
      const stripeTier = emailTierMap[email];

      if (stripeTier) {
        if (profile.subscription_tier !== stripeTier) {
          // Discrepancy — update to match Stripe
          const { error: updateError } = await supabaseClient
            .from("profiles")
            .update({ subscription_tier: stripeTier })
            .eq("user_id", profile.user_id);

          if (!updateError) {
            console.log(`[FORCE-SYNC] Updated ${email}: ${profile.subscription_tier} → ${stripeTier}`);
            updated++;
          }
        } else {
          verified++;
        }
        // Remove from map so we can track unmatched Stripe customers
        delete emailTierMap[email];
      } else {
        // No active Stripe sub — if they have a paid tier, downgrade to free
        if (profile.subscription_tier && profile.subscription_tier !== "free") {
          const { error: downgradeError } = await supabaseClient
            .from("profiles")
            .update({ subscription_tier: "free" })
            .eq("user_id", profile.user_id);

          if (!downgradeError) {
            console.log(`[FORCE-SYNC] Downgraded ${email}: ${profile.subscription_tier} → free (no active Stripe sub)`);
            updated++;
          }
        } else {
          verified++;
        }
      }
    }

    const syncedAt = new Date().toISOString();
    console.log(`[FORCE-SYNC] Complete: ${updated} updated, ${verified} verified`);

    return new Response(JSON.stringify({
      updated,
      verified,
      synced_at: syncedAt,
      stripe_subscriptions: stripeSubscriptions.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[FORCE-SYNC] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
