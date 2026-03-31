import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Helper: award M² Points via the award_points RPC
async function awardPts(sb: any, userId: string, action: string, points: number, description: string, referenceId?: string) {
  try {
    await sb.rpc("award_points", {
      _user_id: userId,
      _action: action,
      _points: points,
      _description: description,
      _reference_id: referenceId || null,
    });
    console.log(`[WEBHOOK] Awarded ${points} pts to ${userId} for ${action}`);
  } catch (e) {
    console.error(`[WEBHOOK] Points award failed: ${e}`);
  }
}

// Helper: resolve email to user_id
async function getUserIdByEmail(sb: any, email: string): Promise<string | null> {
  const { data } = await sb.from("profiles").select("user_id").eq("email", email).limit(1).single();
  return data?.user_id || null;
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Product ID → tier key mapping
const PRODUCT_TIER_MAP: Record<string, string> = {
  // ── Current monthly (prod_UBI*) ──────────────────────────────────────────
  "prod_UBI78IQsBpyfNw": "basic",        // Foundation $19.99/mo
  "prod_UEfNKQVnbRcu1F": "guided",       // M² Guided $59.99/mo  ← was missing
  "prod_UBI7Wdb3liTxiF": "foundation",   // Pro $149.99/mo
  "prod_UBI8SV9Fa6CibX": "custom",       // Elite $349.99/mo
  "prod_UBI8mP9jA5rV3U": "team_elite",   // Team Elite

  // ── Current annual (prod_UC3* / prod_UEf*) ───────────────────────────────
  "prod_UC3NyJRutYTL87": "basic",        // Foundation annual ← was missing
  "prod_UEfQGAQMjysPqV": "guided",       // Guided annual     ← was missing
  "prod_UC3OvNMcgtPafc": "foundation",   // Pro annual        ← was missing
  "prod_UC3ONcP6ZoWtdM": "custom",       // Elite annual      ← was missing

  // ── Previous generation (prod_UAl*) ─────────────────────────────────────
  "prod_UAlStH84vrByST": "basic",
  "prod_UAlTgNGJWmREZL": "foundation",
  "prod_UAlTkDlrDfDije": "custom",
  "prod_UAlUIuvjHBjtNL": "team_elite",

  // ── Legacy (prod_U9p*) ───────────────────────────────────────────────────
  "prod_U9ppSReG0j0RIr": "basic",
  "prod_U9pqrtuc44EE4A": "foundation",
  "prod_U9pqNqVuxYD6kl": "custom",
  "prod_U9pq1sVSh9nOQi": "team_elite",
};

// Map Stripe price IDs to guide info
const GUIDE_MAP: Record<string, { title: string; filename: string; content: string }> = {
  "price_1TBWRjD52tPWee464JrSieCi": {
    title: "Top 5 Exercises for Baseball Players",
    filename: "M2-Baseball-Guide.pdf",
    content: `
      <h2 style="color:#e85d04;margin-bottom:8px;">Top 5 Exercises for Baseball Players</h2>
      <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M² Performance Training</p>
      <hr style="border:1px solid #e85d04;margin:20px 0;">
      <h3>1. Med Ball Rotational Slam</h3>
      <p><strong>Sets/Reps:</strong> 3×8 each side | <strong>Rest:</strong> 60s</p>
      <p><strong>WHY:</strong> Baseball is a rotational sport. This builds explosive hip-to-hand power transfer — the same chain that drives a swing or throw.</p>
      <h3>2. Half-Kneeling Cable Chop</h3>
      <p><strong>Sets/Reps:</strong> 3×10 each side | <strong>Rest:</strong> 45s</p>
      <p><strong>WHY:</strong> Teaches the core to resist and produce rotation from a stable base. Protects the lower back during high-velocity movements.</p>
      <h3>3. Single-Leg RDL</h3>
      <p><strong>Sets/Reps:</strong> 3×8 each leg | <strong>Rest:</strong> 60s</p>
      <p><strong>WHY:</strong> Posterior chain strength on one leg. Pitchers and hitters live on one leg — this builds the stability and hamstring strength to do it safely.</p>
      <h3>4. Band Pull-Apart</h3>
      <p><strong>Sets/Reps:</strong> 3×15 | <strong>Rest:</strong> 30s</p>
      <p><strong>WHY:</strong> Arm health starts with the upper back. This strengthens the rear delts and rotator cuff — the muscles that decelerate the arm after a throw.</p>
      <h3>5. Goblet Squat with Pause</h3>
      <p><strong>Sets/Reps:</strong> 3×10 (2s pause) | <strong>Rest:</strong> 60s</p>
      <p><strong>WHY:</strong> Builds leg drive and hip mobility. The pause eliminates the bounce and forces real strength through the full range.</p>
    `,
  },
  "price_1TBWRzD52tPWee46IQxgPosm": {
    title: "Top 5 Exercises for Football",
    filename: "M2-Football-Guide.pdf",
    content: `
      <h2 style="color:#e85d04;">Top 5 Exercises for Football</h2>
      <p style="font-size:14px;color:#666;">By Matt Michels · M² Performance Training</p>
      <h3>1. Trap Bar Deadlift</h3><p>4×5 · Explosive hip extension for blocks, tackles, sprints.</p>
      <h3>2. Box Jump</h3><p>4×4 · Rate of force development. Football is won in the first 3 steps.</p>
      <h3>3. Bench Press</h3><p>4×6 · Upper body pressing for hand fighting and blocking.</p>
      <h3>4. Farmer's Carry</h3><p>3×40 yards · Grip, core bracing, full-body stability.</p>
      <h3>5. Bulgarian Split Squat</h3><p>3×8 each · Single-leg strength for cutting and acceleration.</p>
    `,
  },
  "price_1TBWSgD52tPWee46vmwnXiHe": {
    title: "Top 5 Exercises for Basketball",
    filename: "M2-Basketball-Guide.pdf",
    content: `<h2 style="color:#e85d04;">Top 5 Exercises for Basketball</h2><p>By Matt Michels</p>
      <h3>1. Depth Drop to Vertical Jump</h3><p>4×4 · Reactive strength for jumping higher.</p>
      <h3>2. Lateral Lunge</h3><p>3×8 each · Hip mobility for defensive slides.</p>
      <h3>3. Nordic Hamstring Curl</h3><p>3×5 · #1 exercise for ACL/hamstring injury prevention.</p>
      <h3>4. Pallof Press</h3><p>3×10 each · Anti-rotation core for contact.</p>
      <h3>5. Single-Leg Calf Raise</h3><p>3×12 each · Achilles and calf durability.</p>`,
  },
  "price_1TBWSxD52tPWee465QPmHaTK": {
    title: "Hockey Strength Essentials",
    filename: "M2-Hockey-Guide.pdf",
    content: `<h2 style="color:#e85d04;">Hockey Strength Essentials</h2><p>By Matt Michels</p>
      <h3>1. Sumo Deadlift</h3><p>4×5 · Mimics skating stance.</p>
      <h3>2. Copenhagen Plank</h3><p>3×20s each · Groin injury prevention.</p>
      <h3>3. Single-Leg Hip Thrust</h3><p>3×10 each · Push-off power on ice.</p>
      <h3>4. Landmine Press</h3><p>3×8 each · Shoulder stability for stick work.</p>
      <h3>5. Lateral Bound</h3><p>4×5 each · Explosive lateral power.</p>`,
  },
  "price_1TBWTFD52tPWee46fh1GttaO": {
    title: "Top 5 Exercises for Soccer",
    filename: "M2-Soccer-Guide.pdf",
    content: `<h2 style="color:#e85d04;">Top 5 Exercises for Soccer</h2><p>By Matt Michels</p>
      <h3>1. Single-Leg Squat to Box</h3><p>3×8 each · Quad and glute strength.</p>
      <h3>2. Hip Flexor March</h3><p>3×12 each · Sprint speed and knee drive.</p>
      <h3>3. Glute Bridge Walkout</h3><p>3×8 · Hamstring endurance.</p>
      <h3>4. Side Plank with Hip Abduction</h3><p>3×10 each · Lateral hip stability.</p>
      <h3>5. A-Skip Progression</h3><p>3×20 yards · Sprint mechanics.</p>`,
  },
  "price_1TBWTVD52tPWee46MSdo6gXX": {
    title: "Top 5 Exercises for Lacrosse",
    filename: "M2-Lacrosse-Guide.pdf",
    content: `<h2 style="color:#e85d04;">Top 5 Exercises for Lacrosse</h2><p>By Matt Michels</p>
      <h3>1. Push-Up to Rotation</h3><p>3×8 each · Pressing with rotational control.</p>
      <h3>2. Rear-Foot Elevated Split Squat</h3><p>3×8 each · Single-leg strength.</p>
      <h3>3. Face Pull</h3><p>3×15 · Shoulder health.</p>
      <h3>4. Sled Push</h3><p>4×20 yards · Acceleration power.</p>
      <h3>5. Dead Bug</h3><p>3×10 each · Core stability for contact.</p>`,
  },
  "price_1TBWTmD52tPWee46FaB1wcFz": {
    title: "Top 10 Exercises: Pre & Post Pregnancy",
    filename: "M2-Pregnancy-Guide.pdf",
    content: `<h2 style="color:#e85d04;">Top 10 Exercises: Pre & Post Pregnancy</h2><p>By Matt Michels</p>
      <h3>1. Diaphragmatic Breathing</h3><p>Foundation of core recovery.</p>
      <h3>2. Glute Bridge</h3><p>Safe glute activation.</p>
      <h3>3. Bird Dog</h3><p>Core stability without abdominal pressure.</p>
      <h3>4. Wall Sit</h3><p>Isometric leg strength.</p>
      <h3>5. Side-Lying Hip Abduction</h3><p>Pelvic stability.</p>
      <h3>6. Modified Push-Up</h3><p>Upper body maintenance.</p>
      <h3>7. Squat to Box</h3><p>Functional movement.</p>
      <h3>8. Pallof Press</h3><p>Safe anti-rotation core work.</p>
      <h3>9. Cat-Cow</h3><p>Spinal mobility.</p>
      <h3>10. Farmer's Walk</h3><p>Full-body carry strength.</p>`,
  },
  "price_1TBWU1D52tPWee46qnvE9Zrv": {
    title: "Youth Athlete Starter Guide",
    filename: "M2-Youth-Starter-Guide.pdf",
    content: `<h2 style="color:#e85d04;">Youth Athlete Starter Guide — 4 Week Program</h2><p>By Matt Michels</p>
      <h3>Week 1-2: Movement Quality</h3><p>Bodyweight squat, push-up, hip hinge, lunge, plank.</p>
      <h3>Week 3: Work Capacity</h3><p>Circuit training: 3 rounds of 6 exercises.</p>
      <h3>Week 4: Introduction to Strength</h3><p>Goblet squat, DB press, band pull-apart, RDL.</p>`,
  },
};

// Helper: sync subscription tier to profiles table
async function syncTierToProfile(sb: any, email: string, tier: string, stripeCustomerId: string) {
  const { data: profiles } = await sb
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .limit(1);

  if (profiles && profiles.length > 0) {
    await sb
      .from("profiles")
      .update({ subscription_tier: tier, stripe_customer_id: stripeCustomerId })
      .eq("user_id", profiles[0].user_id);
    console.log(`[WEBHOOK] Synced tier '${tier}' for user ${profiles[0].user_id}`);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;
    if (!webhookSecret || !sig) {
      console.error("Missing STRIPE_WEBHOOK_SECRET or stripe-signature header");
      return new Response("Webhook signature verification failed", { status: 400 });
    }
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Helper: log transaction to the transactions table
    async function logTransaction(opts: {
      userId?: string | null;
      stripeChargeId?: string | null;
      stripeSubscriptionId?: string | null;
      amount: number;
      itemName: string;
      itemType: string;
      status: string;
      customerEmail?: string | null;
      customerName?: string | null;
    }) {
      try {
        await sb.from("transactions").insert({
          user_id: opts.userId || null,
          stripe_charge_id: opts.stripeChargeId || null,
          stripe_subscription_id: opts.stripeSubscriptionId || null,
          amount: opts.amount,
          item_name: opts.itemName,
          item_type: opts.itemType,
          status: opts.status,
          customer_email: opts.customerEmail || null,
          customer_name: opts.customerName || null,
        });
        console.log(`[WEBHOOK] Transaction logged: ${opts.itemName} - $${(opts.amount / 100).toFixed(2)}`);
      } catch (e) {
        console.error(`[WEBHOOK] Transaction log failed:`, e);
      }
    }

    // Handle subscription lifecycle events
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const customer = await stripe.customers.retrieve(customerId);
      const email = (customer as any).email;

      if (email && (subscription.status === "active" || subscription.status === "trialing")) {
        // Multi-item subscription: sync each item's tier to the mapped member
        for (const item of subscription.items.data) {
          const productId = item.price.product as string;
          const tier = PRODUCT_TIER_MAP[productId] || "basic";

          // Check if this item is mapped to a specific family member
          const { data: familyItem } = await sb
            .from("family_subscription_items")
            .select("member_user_id")
            .eq("stripe_subscription_item_id", item.id)
            .maybeSingle();

          if (familyItem) {
            // Sync tier to the specific family member
            await sb.from("profiles")
              .update({ subscription_tier: tier, stripe_customer_id: customerId })
              .eq("user_id", familyItem.member_user_id);
            console.log(`[WEBHOOK] Synced tier '${tier}' for family member ${familyItem.member_user_id}`);
          } else {
            // Fallback: sync to the account owner (first item = parent)
            await syncTierToProfile(sb, email, tier, customerId);
          }
        }

        // Log subscription transaction
        if (event.type === "customer.subscription.created") {
          const uid = await getUserIdByEmail(sb, email);
          const totalAmount = subscription.items.data.reduce(
            (sum: number, item: any) => sum + (item.price?.unit_amount || 0), 0
          );
          const tierNames = subscription.items.data.map((item: any) => {
            const pid = item.price.product as string;
            return PRODUCT_TIER_MAP[pid] || "basic";
          }).join(", ");
          await logTransaction({
            userId: uid,
            stripeSubscriptionId: subscription.id,
            amount: totalAmount,
            itemName: `Family Membership (${tierNames})`,
            itemType: "subscription",
            status: "completed",
            customerEmail: email,
            customerName: (customer as any).name || null,
          });

          if (uid) {
            await awardPts(sb, uid, "membership", 50, `Subscribed: ${tierNames}`, subscription.id);
          }
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const customer = await stripe.customers.retrieve(customerId);
      const email = (customer as any).email;

      if (email) {
        // Reset all family members tied to this subscription
        const { data: familyItems } = await sb
          .from("family_subscription_items")
          .select("member_user_id")
          .eq("stripe_subscription_id", subscription.id);

        if (familyItems && familyItems.length > 0) {
          const memberIds = familyItems.map((fi: any) => fi.member_user_id);
          await sb.from("profiles").update({ subscription_tier: "free" }).in("user_id", memberIds);
          await sb.from("family_subscription_items").delete().eq("stripe_subscription_id", subscription.id);
          console.log(`[WEBHOOK] Reset ${memberIds.length} family members to free`);
        } else {
          await syncTierToProfile(sb, email, "free", customerId);
        }
      }
    }

    // Handle charge refunds
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const refundedAmount = charge.amount_refunded || 0;
      // Update existing transaction to refunded
      const { data: existing } = await sb
        .from("transactions")
        .select("id")
        .eq("stripe_charge_id", charge.id)
        .limit(1);
      if (existing && existing.length > 0) {
        await sb.from("transactions").update({ status: "refunded" }).eq("id", existing[0].id);
      } else {
        // Log it as a new refund entry
        await logTransaction({
          userId: null,
          stripeChargeId: charge.id,
          amount: refundedAmount,
          itemName: "Refund",
          itemType: "refund",
          status: "refunded",
          customerEmail: charge.billing_details?.email || null,
          customerName: charge.billing_details?.name || null,
        });
      }
      console.log(`[WEBHOOK] Charge refunded: ${charge.id} — $${(refundedAmount / 100).toFixed(2)}`);
    }


    // Handle guide purchases (existing logic)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      const priceId = (session.line_items?.data?.[0] as any)?.price?.id as string | null;

      // ── TRAINING SESSION BOOKING FALLBACK ──
      // If user closes browser before verify-session-booking runs, the webhook ensures the booking is created
      if (meta.type === "training_session" && meta.user_id && meta.slot_ids) {
        const { data: existingBooking } = await sb
          .from("session_bookings")
          .select("id")
          .eq("stripe_session_id", session.id)
          .maybeSingle();

        if (!existingBooking) {
          const slotIds: string[] = JSON.parse(meta.slot_ids);
          const durationMinutes = parseInt(meta.duration_minutes || "30");
          const amountCents = durationMinutes === 60 ? 9000 : 5000;

          const { data: booking, error: bookingError } = await sb
            .from("session_bookings")
            .insert({
              user_id: meta.user_id,
              slot_date: meta.slot_date,
              start_time: meta.start_time,
              duration_minutes: durationMinutes,
              amount_cents: amountCents,
              session_type: meta.session_type || "in_person",
              stripe_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent as string,
              user_email: meta.user_email,
              user_name: meta.user_name,
              status: "confirmed",
            })
            .select()
            .single();

          if (!bookingError && booking) {
            for (const slotId of slotIds) {
              await sb.from("schedule_slots")
                .update({ booked_by: meta.user_id, booking_id: booking.id })
                .eq("id", slotId);
            }
            console.log(`[WEBHOOK] Training session booking created as fallback: ${booking.id}`);

            // Fire-and-forget GCal sync
            try {
              const gcalUrl = `${SUPABASE_URL}/functions/v1/google-calendar-sync`;
              await fetch(gcalUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                },
                body: JSON.stringify({ action: "create_event", booking_id: booking.id }),
              });
            } catch (e) { console.error("GCal sync error:", e); }
          }
        } else {
          console.log(`[WEBHOOK] Training session already verified: ${existingBooking.id}`);
        }
      }

      // Activate gift card if this was a gift card purchase
      if (meta.type === "gift_card" && meta.gift_code) {
        await sb.from("gift_cards")
          .update({ is_active: true })
          .eq("code", meta.gift_code)
          .eq("stripe_session_id", session.id);
        console.log(`[WEBHOOK] Gift card activated: ${meta.gift_code}`);
      }

      // Increment promo usage after successful subscription checkout
      if (meta.promo_id) {
        const { data: currentPromo } = await sb
          .from("promotions")
          .select("current_uses")
          .eq("id", meta.promo_id)
          .single();
        if (currentPromo) {
          await sb.from("promotions")
            .update({ current_uses: (currentPromo.current_uses || 0) + 1 })
            .eq("id", meta.promo_id);
          console.log(`[WEBHOOK] Promo usage incremented: ${meta.promo_id}`);
        }
      }

      // Process referral conversion — credit the referrer with a free month
      if (meta.referral_code && session.customer_details?.email) {
        const refCode = meta.referral_code;
        const referredEmail = session.customer_details.email;

        // Look up referrer
        const { data: refRow } = await sb
          .from("referral_codes")
          .select("user_id, total_referrals, credits_earned")
          .eq("code", refCode)
          .single();

        // Look up referred user
        const { data: referredProfile } = await sb
          .from("profiles")
          .select("user_id")
          .eq("email", referredEmail)
          .limit(1)
          .single();

        if (refRow && referredProfile) {
          // Determine subscription tier from price
          const lineItems = session.line_items?.data || [];
          let tier = "unknown";
          if (lineItems.length > 0) {
            const productId = (lineItems[0] as any)?.price?.product;
            tier = PRODUCT_TIER_MAP[productId] || "unknown";
          }

          // Record conversion
          await sb.from("referral_conversions").insert({
            referrer_user_id: refRow.user_id,
            referred_user_id: referredProfile.user_id,
            referral_code: refCode,
            subscription_tier: tier,
            credited: true,
          });

          // Update referrer stats
          await sb.from("referral_codes").update({
            total_referrals: (refRow.total_referrals || 0) + 1,
            credits_earned: (refRow.credits_earned || 0) + 1,
          }).eq("code", refCode);

          // Notify referrer
          await sb.from("notifications").insert({
            user_id: refRow.user_id,
            type: "referral",
            title: "Referral Earned! 🎉",
            body: "Someone subscribed with your code! You earned a free month credit.",
            link: "/dashboard",
          });

          console.log(`[WEBHOOK] Referral conversion recorded: ${refCode} → ${referredProfile.user_id}`);

          // Award referral points to the referrer
          await awardPts(sb, refRow.user_id, "referral", 200, `Referral: ${referredEmail} subscribed`, refCode);
        }
      }

      // Deduct gift card balance for guide/custom program purchases
      // create-guide-payment passes gift_card_applied_cents (cents)
      // create-program-checkout passes gift_card_applied (dollars)
      const giftCardId = meta.gift_card_id;
      let giftDeductionDollars = 0;

      if (giftCardId && meta.gift_card_applied_cents) {
        giftDeductionDollars = parseInt(meta.gift_card_applied_cents) / 100;
      } else if (giftCardId && meta.gift_card_applied) {
        giftDeductionDollars = parseFloat(meta.gift_card_applied);
      }

      if (giftCardId && giftDeductionDollars > 0) {
        const { data: currentCard } = await sb
          .from("gift_cards")
          .select("remaining_balance")
          .eq("id", giftCardId)
          .single();
        if (currentCard) {
          const newBalance = Math.max(0, currentCard.remaining_balance - giftDeductionDollars);
          await sb.from("gift_cards").update({
            remaining_balance: newBalance,
            is_active: newBalance > 0,
            redeemed_at: new Date().toISOString(),
          }).eq("id", giftCardId);
          console.log(`[WEBHOOK] Gift card deducted: $${giftDeductionDollars}, remaining: $${newBalance}`);
        }
      }

      // Log the payment transaction
      const sessionAmount = session.amount_total || 0;
      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerName = session.customer_details?.name || null;
      const userId = customerEmail ? await getUserIdByEmail(sb, customerEmail) : null;
      const guide = priceId ? GUIDE_MAP[priceId] : null;
      const txItemName = guide?.title || meta.item_name || "Purchase";
      const txItemType = meta.type === "gift_card" ? "gift_card" : guide ? "pdf" : (meta.item_type || "purchase");

      // Get the Stripe charge ID from the payment intent
      let chargeId: string | null = null;
      if (session.payment_intent) {
        try {
          const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
          chargeId = pi.latest_charge as string || null;
        } catch (_) { /* ignore */ }
      }

      await logTransaction({
        userId,
        stripeChargeId: chargeId,
        amount: sessionAmount,
        itemName: txItemName,
        itemType: txItemType,
        status: "completed",
        customerEmail,
        customerName,
      });

      if (session.mode !== "payment") {
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const priceIdFinal = priceId;

      if (!customerEmail) {
        console.error("[WEBHOOK] No customer email found on session", session.id);
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Auto-add purchased guide/program to user's portal
      if (priceId && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        const { data: profiles } = await sb
          .from("profiles")
          .select("user_id")
          .eq("email", customerEmail)
          .limit(1);

        if (profiles && profiles.length > 0) {
          const userId = profiles[0].user_id;
          const guide = GUIDE_MAP[priceId];

          if (guide) {
            const exercises = parseGuideExercises(guide.content);

            await sb.from("purchased_programs").insert({
              user_id: userId,
              program_title: guide.title,
              program_type: guide.title.includes("Youth") ? "starter" : "sport_guide",
              sport: extractSport(guide.title),
              exercises: JSON.stringify(exercises),
              stripe_session_id: session.id,
            });

            // Award program purchase points
            await awardPts(sb, userId, "program_purchase", 100, `Purchased: ${guide.title}`, session.id);

            await sb.from("notifications").insert({
              user_id: userId,
              type: "program_purchased",
              title: "Program Added to Portal",
              body: `Your "${guide.title}" is now in your portal. Log lifts and ask Matt questions on any exercise.`,
              link: "/dashboard",
            });
          }
        }
      }

      // ── SPORT GUIDE (AI-generated, DB-driven) ──────────────────────────────
      if (meta.type === "sport_guide" && meta.guide_id && customerEmail) {
        try {
          const guideUrl = `${SUPABASE_URL}/functions/v1/generate-sport-guide`;
          fetch(guideUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({
              guide_id: meta.guide_id,
              customer_email: customerEmail,
              stripe_session_id: session.id,
              user_id: userId,
            }),
          }).catch((e) => console.error("[WEBHOOK] generate-sport-guide fire failed:", e));
        } catch (e) {
          console.error("[WEBHOOK] generate-sport-guide error:", e);
        }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── NUTRITION PLAN ──────────────────────────────────────────────────────
      if (meta.type === "nutrition_plan" && customerEmail) {
        try {
          const nutritionUrl = `${SUPABASE_URL}/functions/v1/generate-nutrition-plan`;
          fetch(nutritionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({
              stripe_session_id: session.id,
              customer_email: customerEmail,
              plan: meta.plan || "basic",
              sport: meta.sport || "",
              weight_lbs: meta.weight_lbs || "",
              goal: meta.goal || "maintain",
              dietary_restrictions: meta.dietary_restrictions || "",
              position: meta.position || "",
            }),
          }).catch((e) => console.error("[WEBHOOK] generate-nutrition-plan fire failed:", e));
        } catch (e) {
          console.error("[WEBHOOK] generate-nutrition-plan error:", e);
        }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── SEO PACKAGE ────────────────────────────────────────────────────────
      if (meta.type === "seo_package" && customerEmail) {
        try {
          fetch(`${SUPABASE_URL}/functions/v1/deliver-seo-package`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              stripe_session_id: session.id,
              customer_email: customerEmail,
              business_name: meta.business_name || "",
              city: meta.city || "",
              industry: meta.industry || "",
            }),
          }).catch((e) => console.error("[WEBHOOK] deliver-seo-package fire failed:", e));
        } catch (e) { console.error("[WEBHOOK] deliver-seo-package error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AUDIT REPORT ───────────────────────────────────────────────────────
      if (meta.type === "audit_report" && customerEmail) {
        try {
          fetch(`${SUPABASE_URL}/functions/v1/deliver-audit-report`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              stripe_session_id: session.id,
              customer_email: customerEmail,
              business_name: meta.business_name || "",
              city: meta.city || "",
              website_url: meta.website_url || "",
            }),
          }).catch((e) => console.error("[WEBHOOK] deliver-audit-report fire failed:", e));
        } catch (e) { console.error("[WEBHOOK] deliver-audit-report error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── GBP SUBSCRIPTION ───────────────────────────────────────────────────
      if (meta.type === "gbp_subscription" && customerEmail) {
        try {
          // Insert client row + send onboarding email
          const gbpSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          await gbpSb.from("gbp_management_clients" as any).insert({
            customer_email: customerEmail,
            business_name: meta.business_name || "",
            contact_name: meta.contact_name || "",
            phone: meta.phone || "",
            current_gbp_url: meta.current_gbp_url || "",
            stripe_subscription_id: session.subscription as string || null,
            status: "active",
          });
          if (RESEND_API_KEY) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [customerEmail],
                subject: `Welcome to GBP Management — ${meta.business_name || "your business"}`,
                html: `<p>You're all set! I'll review your Google Business Profile within 24 hours and reach out to get started. Questions? Reply here or text me at (313) 806-4952.</p><p>— Matt Michels</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Site <matt@notify.m2training.com>",
                to: ["matt@m2training.com"],
                subject: `New GBP Client: ${meta.business_name || customerEmail}`,
                html: `<p>New GBP management client: <strong>${meta.business_name}</strong> — ${customerEmail} — ${meta.phone || "no phone"}<br>GBP URL: ${meta.current_gbp_url || "not provided"}</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] gbp_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── CAMP LISTING ───────────────────────────────────────────────────────
      if (meta.type === "camp_listing" && customerEmail) {
        try {
          const campSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          await campSb.from("camp_directory_listings" as any).insert({
            camp_name: meta.camp_name || "",
            sport: meta.sport || "",
            age_range: meta.age_range || "",
            start_date: meta.start_date || null,
            end_date: meta.end_date || null,
            location: meta.location || "",
            price_description: meta.price_description || "",
            website_url: meta.website_url || "",
            contact_email: customerEmail,
            stripe_subscription_id: session.subscription as string || null,
            is_active: false, // pending review
          });
          if (RESEND_API_KEY) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [customerEmail],
                subject: `Camp Listing Received — ${meta.camp_name || "your camp"}`,
                html: `<p>Your listing for <strong>${meta.camp_name}</strong> has been received and is under review. It will go live within 24 hours.</p><p>— Matt Michels</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Site <matt@notify.m2training.com>",
                to: ["matt@m2training.com"],
                subject: `New Camp Listing: ${meta.camp_name}`,
                html: `<p>New camp listing: <strong>${meta.camp_name}</strong> — ${meta.sport} — ${customerEmail}<br>Location: ${meta.location}<br>Ages: ${meta.age_range}<br>Dates: ${meta.start_date} to ${meta.end_date}</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] camp_listing error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WEB DESIGN BUILD — $499 one-time ─────────────────────────────────
      if (meta.type === "web_design_build") {
        try {
          const wdSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          if (meta.lead_id) {
            await wdSb
              .from("web_design_leads" as any)
              .update({ build_fee_paid: true, status: "building" })
              .eq("id", meta.lead_id);
          }
          if (RESEND_API_KEY && customerEmail) {
            // Confirm payment to client
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [customerEmail],
                subject: `Payment received — ${meta.business_name || "your website"} is a go`,
                html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:32px;">
                  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
                    <div style="background:#e8621a;height:4px;"></div>
                    <div style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.9;">
                      <p>Hey ${meta.business_name ? `— ${meta.business_name}` : "there"} —</p>
                      <p><strong>Payment received. We're officially locked in.</strong></p>
                      <p>I'll be in touch within a few hours to kick things off. You'll get a quick intake form from me — takes about 5 minutes — so I can build exactly what you need.</p>
                      <p>Timeline: site live in 7 days from when I get your info back.</p>
                      <p>Questions? Email <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a> — whichever works best.</p>
                      <p>— Matt Michels</p>
                    </div>
                  </div>
                </body></html>`,
              }),
            });
            // Notify Matt
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@notify.m2training.com>",
                to: ["matt@m2training.com"],
                subject: `💰 $499 PAID — ${meta.business_name || customerEmail}`,
                html: `<p><strong>New web design build payment received!</strong><br>
                  Business: ${meta.business_name || "unknown"}<br>
                  Client email: ${customerEmail}<br>
                  Lead ID: ${meta.lead_id || "none"}<br>
                  Status updated to "building" in CRM.<br>
                  <a href="https://www.mattmichelstraining.com/admin">Open Admin Panel →</a></p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] web_design_build error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WEB DESIGN RETAINER — $49/mo subscription ─────────────────────────
      if (meta.type === "web_design_retainer") {
        try {
          const wdSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          if (meta.lead_id) {
            await wdSb
              .from("web_design_leads" as any)
              .update({
                monthly_retainer: true,
                stripe_subscription_id: session.subscription as string || null,
              })
              .eq("id", meta.lead_id);
          }
          if (RESEND_API_KEY && customerEmail) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [customerEmail],
                subject: `Monthly maintenance set up — ${meta.business_name || "your site"}`,
                html: `<p>You're all set on the $49/mo maintenance plan. Your site stays live, secure, and backed up — and you've got my direct cell for any changes you need. Text me at (313) 806-4952 or email matt@m2training.com anytime. — Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@notify.m2training.com>",
                to: ["matt@m2training.com"],
                subject: `$49/mo retainer started — ${meta.business_name || customerEmail}`,
                html: `<p>New web maintenance subscriber: <strong>${meta.business_name}</strong> — ${customerEmail}<br>Subscription ID: ${session.subscription || "n/a"}</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] web_design_retainer error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── PDF GUIDE (static content, email delivery) ────────────────────────
      if (meta.type === "pdf_guide" && meta.guide_id && customerEmail) {
        const PDF_GUIDE_CONTENT: Record<string, { name: string; html: string }> = {
          "middle-school-foundation": {
            name: "The Middle School Foundation (Top 10)",
            html: `
              <h2 style="color:#e85d04;margin-bottom:8px;">The Middle School Foundation — Top 10 Exercises</h2>
              <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M² Performance Training</p>
              <hr style="border:1px solid #e2e8f0;margin:20px 0;">
              <p style="font-size:14px;line-height:1.8;">Before your athlete lifts heavy, runs fast, or competes hard — they need a foundation. These 10 movements build movement quality, joint integrity, and the base that prevents injuries for years.</p>
              <h3 style="color:#1e293b;">1. Goblet Squat</h3><p><strong>Sets/Reps:</strong> 3×10 | <strong>Why:</strong> Teaches hip hinge, builds quad and glute strength, forces upright torso. The safest first squat for any athlete.</p>
              <h3 style="color:#1e293b;">2. Hip Hinge (Dowel Drill)</h3><p><strong>Sets/Reps:</strong> 3×8 | <strong>Why:</strong> Most middle schoolers have never loaded a hip hinge. This pattern protects the lower back in every sport.</p>
              <h3 style="color:#1e293b;">3. Push-Up (Strict)</h3><p><strong>Sets/Reps:</strong> 3×8–12 | <strong>Why:</strong> Full-body tension, scapular control, wrist stability. No sagging hips, no craned neck.</p>
              <h3 style="color:#1e293b;">4. Inverted Row</h3><p><strong>Sets/Reps:</strong> 3×10 | <strong>Why:</strong> Balances pushing with pulling. Strengthens the rear delts and upper back that every young thrower needs.</p>
              <h3 style="color:#1e293b;">5. Dead Bug</h3><p><strong>Sets/Reps:</strong> 3×8 each side | <strong>Why:</strong> Anti-extension core stability. Teaches the spine to stay neutral under load — the foundation of every athletic movement.</p>
              <h3 style="color:#1e293b;">6. Side-Lying Hip Abduction</h3><p><strong>Sets/Reps:</strong> 3×12 each | <strong>Why:</strong> The glute med is the most undertrained muscle in youth athletes. Weak hip abductors = knee valgus = ACL risk.</p>
              <h3 style="color:#1e293b;">7. Single-Leg Balance (Eyes Closed)</h3><p><strong>Sets/Reps:</strong> 3×20s each | <strong>Why:</strong> Proprioception training. Ankle and knee stability that reduces sprain risk in any sport.</p>
              <h3 style="color:#1e293b;">8. Scapular Wall Slide</h3><p><strong>Sets/Reps:</strong> 3×10 | <strong>Why:</strong> Upper back mobility and scapular control. Fixes the rounded posture middle schoolers develop from screens.</p>
              <h3 style="color:#1e293b;">9. Reverse Lunge</h3><p><strong>Sets/Reps:</strong> 3×8 each leg | <strong>Why:</strong> Safer than forward lunge at this age. Builds single-leg strength and hip flexor flexibility simultaneously.</p>
              <h3 style="color:#1e293b;">10. Plank (With Breathing)</h3><p><strong>Sets/Reps:</strong> 3×30s | <strong>Why:</strong> Core brace under time tension. The breath cue — exhale fully at the top — teaches intra-abdominal pressure that carries into all lifting.</p>
              <hr style="border:1px solid #e2e8f0;margin:24px 0;">
              <p style="font-size:13px;color:#64748b;">Run this 2–3x/week before sport practice or as a standalone session. Master the movement quality before adding load. Questions? Email matt@m2training.com or text (313) 806-4952.</p>
            `,
          },
          "high-school-armor": {
            name: "High School Armor (Top 10)",
            html: `
              <h2 style="color:#e85d04;margin-bottom:8px;">High School Armor — Top 10 Exercises</h2>
              <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M² Performance Training</p>
              <hr style="border:1px solid #e2e8f0;margin:20px 0;">
              <p style="font-size:14px;line-height:1.8;">High school is where injuries spike — because athletes increase intensity without building structural integrity first. These 10 exercises build the durability, explosive power, and connective tissue strength that keeps varsity athletes on the field.</p>
              <h3 style="color:#1e293b;">1. Romanian Deadlift (RDL)</h3><p><strong>Sets/Reps:</strong> 3×8 | <strong>Why:</strong> Posterior chain development. The hamstrings and glutes are the body's shock absorbers — this is how you build them.</p>
              <h3 style="color:#1e293b;">2. Bulgarian Split Squat</h3><p><strong>Sets/Reps:</strong> 3×8 each | <strong>Why:</strong> Single-leg strength that transfers directly to cutting, sprinting, and landing. Exposes and fixes asymmetries.</p>
              <h3 style="color:#1e293b;">3. Trap Bar Deadlift (or Hex Bar)</h3><p><strong>Sets/Reps:</strong> 4×5 | <strong>Why:</strong> Full-body strength in a spine-safe position. The most transferable strength movement in high school training.</p>
              <h3 style="color:#1e293b;">4. Nordic Hamstring Curl</h3><p><strong>Sets/Reps:</strong> 3×5 | <strong>Why:</strong> The #1 evidence-based exercise for ACL and hamstring injury prevention. Non-negotiable for every high school athlete.</p>
              <h3 style="color:#1e293b;">5. Push-Up to Row (DB)</h3><p><strong>Sets/Reps:</strong> 3×8 each | <strong>Why:</strong> Pressing + horizontal pulling in one movement. Builds the shoulder armor that contact athletes need.</p>
              <h3 style="color:#1e293b;">6. Copenhagen Plank</h3><p><strong>Sets/Reps:</strong> 3×20s each | <strong>Why:</strong> Groin and adductor strength. Prevents the groin strains and hip flexor injuries that sideline athletes mid-season.</p>
              <h3 style="color:#1e293b;">7. Pallof Press</h3><p><strong>Sets/Reps:</strong> 3×10 each | <strong>Why:</strong> Anti-rotation core stability. Teaches the core to resist — not just flex — which is how it actually works in sport.</p>
              <h3 style="color:#1e293b;">8. Hip Thrust</h3><p><strong>Sets/Reps:</strong> 3×10 | <strong>Why:</strong> Glute activation at hip extension. Directly builds the push-off power used in every sprint and jump.</p>
              <h3 style="color:#1e293b;">9. Face Pull</h3><p><strong>Sets/Reps:</strong> 3×15 | <strong>Why:</strong> Rear delt and external rotator health. Counters the internal rotation stress of throwing, swimming, and racket sports.</p>
              <h3 style="color:#1e293b;">10. Box Jump (Stick Landing)</h3><p><strong>Sets/Reps:</strong> 4×4 | <strong>Why:</strong> Rate of force development AND landing mechanics. The stick-landing cue trains the deceleration control that prevents ACL injuries.</p>
              <hr style="border:1px solid #e2e8f0;margin:24px 0;">
              <p style="font-size:13px;color:#64748b;">Run 2–3x/week. In-season: reduce volume by 30%, keep intensity. Off-season: push progressive overload on the big lifts (RDL, Split Squat, Trap Bar). Questions? Email matt@m2training.com or text (313) 806-4952.</p>
            `,
          },
          "road-warrior": {
            name: "The Road Warrior (Top 10 Travel Fixes)",
            html: `
              <h2 style="color:#e85d04;margin-bottom:8px;">The Road Warrior — Top 10 Travel Fixes</h2>
              <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M² Performance Training</p>
              <hr style="border:1px solid #e2e8f0;margin:20px 0;">
              <p style="font-size:14px;line-height:1.8;">Hotel room. Tournament weekend. No equipment. No excuses. These 10 movements keep your body functioning when travel takes you away from training. Use them as a warmup, a maintenance session, or a recovery day circuit.</p>
              <h3 style="color:#1e293b;">1. 90/90 Hip Switch</h3><p><strong>Sets/Reps:</strong> 2×5 each | <strong>Why:</strong> Restores hip internal/external rotation lost from sitting in a car or plane. Do this first — everything else works better after it.</p>
              <h3 style="color:#1e293b;">2. World's Greatest Stretch</h3><p><strong>Sets/Reps:</strong> 2×5 each | <strong>Why:</strong> One movement that hits hip flexor, T-spine, hamstring, and ankle. Best single mobility drill in existence for travel-stiff athletes.</p>
              <h3 style="color:#1e293b;">3. Glute Bridge March</h3><p><strong>Sets/Reps:</strong> 3×10 each | <strong>Why:</strong> Activates glutes and hammers anti-pelvic-tilt core stability. Reverses the dead-butt syndrome from hours of sitting.</p>
              <h3 style="color:#1e293b;">4. Wall Thoracic Rotation</h3><p><strong>Sets/Reps:</strong> 2×8 each | <strong>Why:</strong> Unlocks the T-spine that compresses during long car rides. Directly improves shoulder mobility and reduces neck tension.</p>
              <h3 style="color:#1e293b;">5. Push-Up (Slow Eccentric)</h3><p><strong>Sets/Reps:</strong> 3×8 (3-second down) | <strong>Why:</strong> Maintains upper body strength with zero equipment. The slow eccentric builds connective tissue resilience that hotel gym machines can't.</p>
              <h3 style="color:#1e293b;">6. Single-Leg RDL (Bodyweight)</h3><p><strong>Sets/Reps:</strong> 3×8 each | <strong>Why:</strong> Posterior chain + balance + proprioception. One movement that hits everything the lower body needs when you can't load.</p>
              <h3 style="color:#1e293b;">7. Lateral Band Walk (or Lateral Lunge if no band)</h3><p><strong>Sets/Reps:</strong> 3×12 each | <strong>Why:</strong> Glute med activation that protects the knee. Travel without this and your hips tighten up, your knee tracks wrong, and your ankle gets stressed.</p>
              <h3 style="color:#1e293b;">8. Dead Bug</h3><p><strong>Sets/Reps:</strong> 3×8 each | <strong>Why:</strong> Core stability that doesn't require a single piece of equipment. Every hotel room has a floor.</p>
              <h3 style="color:#1e293b;">9. Calf Raise + Ankle Circle</h3><p><strong>Sets/Reps:</strong> 3×15 each direction | <strong>Why:</strong> Achilles and ankle health after travel compression. Athletes who skip this are one landing away from a sprain on tournament day.</p>
              <h3 style="color:#1e293b;">10. Foam Roll or Tennis Ball — Feet, Calves, T-Spine</h3><p><strong>Sets/Reps:</strong> 60s each area | <strong>Why:</strong> Tissue quality maintenance. Travel compresses fascia. Roll what aches before it becomes what doesn't work.</p>
              <hr style="border:1px solid #e2e8f0;margin:24px 0;">
              <p style="font-size:13px;color:#64748b;"><strong>Travel-day warmup protocol:</strong> 90/90 → World's Greatest → Wall Rotation → Glute Bridge March → done. Takes 8 minutes. Do it before competing or after a long drive. Questions? Email matt@m2training.com or text (313) 806-4952.</p>
            `,
          },
        };

        const guideContent = PDF_GUIDE_CONTENT[meta.guide_id];
        if (guideContent && RESEND_API_KEY) {
          const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <tr><td style="background:#e8621a;padding:4px 0;"></td></tr>
    <tr><td style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.8;">
      <p>Hey —</p>
      <p>Your guide is below. This is the exact blueprint I use with my athletes. Print it, save it, or screenshot it — it's yours forever.</p>
      ${guideContent.html}
      <p style="margin-top:24px;">Questions on any of these? Email me at <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>
      <p>— Matt Michels</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
      M² Performance Training · <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> · <a href="tel:+13138064952" style="color:#94a3b8;">(313) 806-4952</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Matt Michels <matt@notify.m2training.com>",
              to: [customerEmail],
              subject: `Your guide: ${guideContent.name}`,
              html: emailHtml,
            }),
          });
          console.log(`[WEBHOOK] PDF guide emailed: ${meta.guide_id} → ${customerEmail}`);
        }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (!priceId || !GUIDE_MAP[priceId]) {
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const guide = GUIDE_MAP[priceId];

      if (!RESEND_API_KEY) {
        console.error("[WEBHOOK] RESEND_API_KEY not set");
        return new Response(JSON.stringify({ error: "Email not configured" }), { status: 500 });
      }

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1a1a1a;color:#e0e0e0;">
          <div style="text-align:center;margin-bottom:30px;">
            <h1 style="color:#e85d04;font-size:24px;margin:0;">M² PERFORMANCE TRAINING</h1>
            <p style="color:#999;font-size:12px;letter-spacing:2px;margin-top:4px;">YOUR GUIDE IS READY</p>
          </div>
          <div style="background:#222;padding:24px;border-left:3px solid #e85d04;margin-bottom:20px;">
            <p style="color:#ccc;font-size:14px;">Thanks for your purchase. Here's your guide — <strong style="color:#e85d04;">${guide.title}</strong>. It's also been added to your M² Portal.</p>
            <p style="color:#e85d04;font-size:14px;margin:16px 0 0;font-weight:bold;">— Matt Michels</p>
          </div>
          <div style="background:#222;padding:24px;margin-bottom:20px;">${guide.content}</div>
          <div style="text-align:center;padding:20px;border-top:1px solid #333;">
            <p style="color:#666;font-size:11px;">M² Performance Training · Detroit, MI</p>
          </div>
        </div>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "M² Training <onboarding@resend.dev>",
          to: [customerEmail],
          subject: `Your Guide: ${guide.title} — M² Training`,
          html: emailHtml,
        }),
      });
    }

      // ── CONTRACTOR LEAD SUBSCRIPTION ─────────────────────────────────────
      if (meta.type === "contractor_lead_subscription") {
        try {
          const wdSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          // Activate contractor client
          if (meta.contractor_id) {
            await wdSb.from("contractor_clients" as any)
              .update({
                active: true,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: session.subscription as string || null,
                onboarded_at: new Date().toISOString(),
              })
              .eq("id", meta.contractor_id);

            // Assign contractor to the matching lead site
            const { data: site } = await wdSb
              .from("contractor_lead_sites" as any)
              .select("id, active_contractor_id")
              .eq("trade", meta.trade || "")
              .ilike("city", `%${(meta.city || "").split(",")[0]}%`)
              .limit(1)
              .single();

            if (site && !(site as any).active_contractor_id) {
              await wdSb.from("contractor_lead_sites" as any)
                .update({ active_contractor_id: meta.contractor_id })
                .eq("id", (site as any).id);
            }
          }

          if (RESEND_API_KEY && customerEmail) {
            const tradeLabel = (meta.trade || "service").charAt(0).toUpperCase() + (meta.trade || "service").slice(1);
            // Welcome email to contractor
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [customerEmail],
                subject: `You're locked in — exclusive ${tradeLabel} leads in ${meta.city || "your area"}`,
                html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#e8621a;height:4px;"></div>
  <div style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.9;">
    <p>Hey ${meta.business_name || "there"} —</p>
    <p><strong>You're in.</strong> Every exclusive ${tradeLabel.toLowerCase()} lead that comes through ${meta.city || "your area"} goes directly to you. No sharing, no competing bids.</p>
    <p>When a lead comes in, you'll get an email immediately with their name, phone, and project details. Call them fast — speed wins jobs.</p>
    <p>Questions? Reply to this email or text me directly at <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-family-cornfield.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</div>
    </div>
  </div>
</div>
</body></html>`,
              }),
            });
            // Notify Matt
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@notify.m2training.com>",
                to: ["matt@m2training.com"],
                subject: `💰 New contractor client — ${meta.business_name || customerEmail}`,
                html: `<p>New contractor lead subscription:<br><strong>${meta.business_name}</strong> — ${customerEmail}<br>Trade: ${meta.trade} | City: ${meta.city}, ${meta.state || "MI"}<br>Subscription: ${session.subscription || "n/a"}</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] contractor_lead_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── B2B DATABASE SUBSCRIPTION ─────────────────────────────────────────
      if (meta.type === "b2b_database_subscription") {
        try {
          const b2bSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          // Activate subscriber
          if (customerEmail) {
            await b2bSb.from("b2b_subscribers" as any)
              .upsert({
                email: customerEmail,
                name: meta.customer_name || null,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: session.subscription as string || null,
                niche: meta.niche || "dental",
                active: true,
              }, { onConflict: "email" });
          }

          if (RESEND_API_KEY && customerEmail) {
            const nicheLabels: Record<string, string> = {
              dental: "Dental & Orthodontic Practices",
              hvac: "HVAC & Mechanical Contractors",
              pt: "Physical Therapy & Chiro Offices",
              auto: "Independent Auto Repair Shops",
            };
            const nicheLabel = nicheLabels[meta.niche || "dental"] || "Business Contacts";
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [customerEmail],
                subject: `Your B2B database is ready — ${nicheLabel}`,
                html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#e8621a;height:4px;"></div>
  <div style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.9;">
    <p>Hey —</p>
    <p>You now have access to the <strong>${nicheLabel}</strong> database. Browse, filter by state/city, and export to CSV anytime.</p>
    <p><a href="https://www.mattmichelstraining.com/b2b-leads" style="background:#e8621a;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Access Your Database →</a></p>
    <p>The database updates daily. You'll always have the freshest contacts. Questions? Email <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>
    <p>— Matt Michels</p>
  </div>
</div>
</body></html>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@notify.m2training.com>",
                to: ["matt@m2training.com"],
                subject: `💰 New B2B database subscriber — ${customerEmail}`,
                html: `<p>New ${nicheLabel} subscriber: <strong>${customerEmail}</strong> at $149/month.</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] b2b_database_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── GBP SAAS SUBSCRIPTION ─────────────────────────────────────────────
      if (meta.type === "gbp_saas_subscription") {
        try {
          const gbpSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          if (meta.client_id) {
            await gbpSb.from("gbp_saas_clients" as any)
              .update({
                active: true,
                stripe_subscription_id: session.subscription as string || null,
              })
              .eq("id", meta.client_id);
          }

          if (RESEND_API_KEY && customerEmail) {
            const isPro = meta.plan === "pro";
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [customerEmail],
                subject: `Welcome to M² Local Marketing — ${meta.business_name || "your business"}`,
                html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#e8621a;height:4px;"></div>
  <div style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.9;">
    <p>Hey ${meta.business_name || "there"} —</p>
    <p>You're all set on the ${isPro ? "Pro" : "Basic"} plan. I'll start posting to your Google Business Profile ${isPro ? "3x a week, plus sending review requests to your customers" : "3x a week"}.</p>
    <p><strong>Next step:</strong> I need a couple things to get started. I'll reach out within 24 hours to collect your Google Business Profile info. If you want to speed it up, email <a href="mailto:matt@m2training.com" style="color:#e8621a;">matt@m2training.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-family-cornfield.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</div>
    </div>
  </div>
</div>
</body></html>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@notify.m2training.com>",
                to: ["matt@m2training.com"],
                subject: `💰 New GBP client — ${meta.business_name || customerEmail} (${meta.plan})`,
                html: `<p>New GBP SaaS subscriber: <strong>${meta.business_name}</strong> — ${customerEmail}<br>Plan: ${meta.plan} at $${meta.plan === "pro" ? "99" : "49"}/month.<br>Action needed: collect their GBP location ID to start posting.</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] gbp_saas_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── FIELD REP TOOLS — $29/mo AI subscription ─────────────────────────
      if (meta.type === "field_rep_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("b2b_subscribers")
              .upsert({
                email,
                name: meta.name || null,
                niche: "field_rep_tools",
                active: true,
                stripe_customer_id: session.customer as string || null,
                stripe_subscription_id: session.subscription as string || null,
              }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your Field Rep AI Tools are ready",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're in. Head to <a href="https://www.mattmichelstraining.com/field-rep-tools">mattmichelstraining.com/field-rep-tools</a> and log in to start using all 4 tools — cold email writer, voicemail builder, objection handler, and territory planner.</p><p>Reply to this email if you have questions.</p><p>— Matt<br>(313) 806-4952</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matt@m2training.com"],
                subject: `💰 New Field Rep Tools subscriber — ${email}`,
                html: `<p>New $29/mo subscriber: <strong>${email}</strong><br>Subscription ID: ${session.subscription || "n/a"}</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] field_rep_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── SOCIAL MEDIA AI — $149/$199/$299/mo subscription ─────────────────
      if (meta.type === "social_media_subscription") {
        try {
          const email = meta.email || customerEmail;
          let clientId: string | null = null;
          if (email) {
            await sb.from("social_media_clients")
              .upsert({
                email,
                business_name: meta.business_name || email,
                contact_name: meta.name || null,
                plan: meta.plan || "standard",
                active: true,
                stripe_subscription_id: session.subscription as string || null,
              }, { onConflict: "email" });
            // Fetch the id back so we can include it in the onboarding link
            const { data: clientRow } = await sb
              .from("social_media_clients")
              .select("id")
              .eq("email", email)
              .single();
            clientId = clientRow?.id || null;
          }
          const planPrice = meta.plan === "pro" ? "$299" : meta.plan === "trainer" ? "$149" : "$199";
          const onboardingUrl = clientId
            ? `https://www.mattmichelstraining.com/social-connect?client_id=${clientId}`
            : "https://www.mattmichelstraining.com/social-connect";
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your Social Media AI service is active",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>Your Social Media AI (${meta.plan || "standard"} plan) is now active. AI posts will start going out Monday, Wednesday, and Friday once your accounts are connected.</p><p><strong>Step 2 — Connect your accounts (2 min):</strong><br><a href="${onboardingUrl}" style="color:#e8621a;">Set up your social accounts →</a></p><p>Questions? Reply here or text Matt at (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matt@m2training.com"],
                subject: `💰 New Social Media AI client — ${meta.business_name || email} (${meta.plan}, ${planPrice}/mo)`,
                html: `<p>New social media subscriber:<br><strong>${meta.business_name || email}</strong> — ${email}<br>Plan: ${meta.plan} at ${planPrice}/month.<br>Client ID: ${clientId || "unknown"}<br>Onboarding link sent to client. They still need to complete account setup.</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] social_media_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── REVIEW RESPONDER — $99/mo subscription ───────────────────────────
      if (meta.type === "review_responder_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("review_responder_clients" as any).upsert({
              email,
              business_name: meta.business_name || email,
              contact_name: meta.name || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your Review Response Automation is active",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>Your Google review automation is live. We'll start monitoring and responding to new reviews within 24 hours.</p><p>One step needed: connect your Google Business Profile. Reply to this email or text Matt at (313) 806-4952 and he'll send you the connection link.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
                subject: `💰 New Review Responder client — ${meta.business_name || email} ($99/mo)`,
                html: `<p>New review responder subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Action needed: connect their Google Business Profile token.</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] review_responder_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── SEO REPORT — subscription ─────────────────────────────────────────
      if (meta.type === "seo_report_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("seo_report_clients" as any).upsert({
              email,
              business_name: meta.business_name || email,
              contact_name: meta.name || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your SEO Reports are active",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>Your monthly SEO report subscription is live. Your first report will be delivered within 24 hours — it covers rankings, traffic trends, competitor gaps, and recommended actions.</p><p>Questions? Reply here or text Matt at (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
                subject: `💰 New SEO Report client — ${meta.business_name || email}`,
                html: `<p>New SEO report subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Subscription ID: ${session.subscription || "n/a"}</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] seo_report_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── CHATBOT — subscription ────────────────────────────────────────────
      if (meta.type === "chatbot_subscription") {
        try {
          const email = meta.email || customerEmail;
          const clientId = (session.subscription as string || email || "").replace(/[^a-z0-9]/gi, "").toLowerCase().substring(0, 24);
          if (email) {
            await sb.from("chatbot_clients" as any).upsert({
              email,
              business_name: meta.business_name || email,
              contact_name: meta.name || null,
              client_id: clientId,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your AI Chatbot is ready to install",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>Your chatbot subscription is active. Add this snippet to your website before the closing <code>&lt;/body&gt;</code> tag:</p><pre style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:13px;">&lt;script src="https://www.mattmichelstraining.com/chatbot.js" data-client-id="${clientId}"&gt;&lt;/script&gt;</pre><p>That's it — the chatbot will appear automatically. Reply to this email or text (313) 806-4952 if you need help installing it.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
                subject: `💰 New Chatbot client — ${meta.business_name || email}`,
                html: `<p>New chatbot subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Client ID: <code>${clientId}</code><br>Subscription ID: ${session.subscription || "n/a"}</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] chatbot_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── INDUSTRIAL NEWSLETTER — subscription ──────────────────────────────
      if (meta.type === "industrial_newsletter_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("b2b_subscribers").upsert({
              email,
              name: meta.name || null,
              niche: "industrial_newsletter",
              active: true,
              stripe_customer_id: session.customer as string || null,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "You're subscribed to the Industrial Sales Newsletter",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>Welcome aboard. You'll get your first issue next Monday morning — practical B2B sales intel for industrial and manufacturing markets, no fluff.</p><p>Reply any time if you have questions or want to connect.</p><p>— Matt<br>(313) 806-4952</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
                subject: `💰 New Industrial Newsletter subscriber — ${email}`,
                html: `<p>New industrial newsletter subscriber: <strong>${email}</strong><br>Name: ${meta.name || "n/a"}</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] industrial_newsletter_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── MISSED CALL TEXT-BACK — subscription ──────────────────────────────
      if (meta.type === "missed_call_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("missed_call_clients").upsert({
              email,
              contact_name: meta.name || null,
              business_name: meta.businessName || email,
              business_phone: meta.phone || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your Missed Call Text-Back is being set up",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Missed Call Text-Back. Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to complete the forwarding setup — it takes about 5 minutes. After that, every missed call to your business gets an instant text-back automatically.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
                subject: `💰 New Missed Call client — ${meta.businessName || email} ($99/mo)`,
                html: `<p>💰 New missed-call text-back subscriber:</p><p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p><hr/><p><strong>⚡ Your 4-step setup checklist for this client:</strong></p><ol><li>Go to <a href="https://www.twilio.com/console/phone-numbers/search">Twilio → Buy a Number</a> — pick a local number matching their area code (~$1.15/mo)</li><li>On that number's config page, set both webhook fields to:<br><code>https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/missed-call-handler</code></li><li>Go to <a href="https://supabase.com/dashboard/project/zmyczlfuufhngzovkjdh/editor">Supabase → Table Editor → missed_call_clients</a> → find their row → fill in <strong>twilio_number</strong> (format: +1XXXXXXXXXX) → flip <strong>active</strong> to true</li><li>Text the client: "To activate your missed-call text-back, forward unanswered calls to [their Twilio number]. On iPhone dial: **61*+1XXXXXXXXXX# — takes 30 seconds."</li></ol><p>Once step 4 is done, it's 100% automatic.</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] missed_call_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── REPUTATION DASHBOARD — subscription ───────────────────────────────
      if (meta.type === "reputation_dashboard_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("reputation_clients").upsert({
              email,
              contact_name: meta.name || null,
              business_name: meta.businessName || email,
              website: meta.website || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your AI Reputation Dashboard is being set up",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for the AI Reputation Dashboard ($79/mo). Your 7-day free trial has started.</p><p>Within 24 hours you'll receive your first weekly report covering your Google, Yelp, Facebook, and BBB reviews — with AI-generated response suggestions for anything that needs attention.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
                subject: `💰 New Reputation Dashboard client — ${meta.businessName || email} ($79/mo)`,
                html: `<p>New reputation dashboard subscriber:</p><p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Website: ${meta.website || "n/a"}</p><p>They're active in reputation_clients. First report will go out on the next weekly cron run.</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] reputation_dashboard_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── ADS COPY GENERATOR — subscription ─────────────────────────────────
      if (meta.type === "ads_copy_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("ads_copy_clients").upsert({
              email,
              contact_name: meta.name || null,
              business_name: meta.businessName || email,
              city: meta.city || null,
              services: meta.services || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your AI Google Ads Copy is being generated",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Google Ads Copy Generator ($39/mo). Your 7-day free trial has started.</p><p>Within 24 hours you'll receive your first batch of 10 AI-generated Google Ads copy variations for <strong>${meta.businessName || "your business"}</strong> in ${meta.city || "your area"} — ready to paste straight into Google Ads.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
                subject: `💰 New Ads Copy client — ${meta.businessName || email} ($39/mo)`,
                html: `<p>New ads copy subscriber:</p><p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>City: ${meta.city || "n/a"}<br>Services: ${meta.services || "n/a"}</p><p>They're active in ads_copy_clients. First copy batch goes out on next monthly cron.</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] ads_copy_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── VOICEMAIL TRANSCRIPTION — subscription ─────────────────────────────
      if (meta.type === "voicemail_transcription_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("voicemail_clients").upsert({
              email,
              contact_name: meta.name || null,
              business_name: meta.businessName || email,
              phone: meta.phone || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your AI Voicemail Transcription is being set up",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Voicemail Transcription ($49/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to complete the setup — it takes about 10 minutes. After that, every voicemail left on your business line gets instantly transcribed and summarized via text and email.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
                subject: `💰 New Voicemail client — ${meta.businessName || email} ($49/mo)`,
                html: `<p>New voicemail transcription subscriber:</p><p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p><p>Setup steps:<ol><li>Buy a Twilio number matching their area code</li><li>Configure the Twilio number's voicemail webhook to: <code>https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/voicemail-transcriber</code></li><li>Update <strong>voicemail_clients</strong> row: add twilio_number, set active=true</li><li>Have them forward voicemail to the Twilio number</li></ol></p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] voicemail_transcription_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── CONTRACTOR INVOICING — subscription ───────────────────────────────
      if (meta.type === "contractor_invoicing_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("invoicing_clients").upsert({
              email,
              contact_name: meta.name || null,
              business_name: meta.businessName || email,
              phone: meta.phone || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your Automated Invoicing is ready",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Automated Contractor Invoicing ($29/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to get your first invoice template set up. After that, creating and sending a professional invoice with a Stripe payment link takes about 30 seconds.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
                subject: `💰 New Invoicing client — ${meta.businessName || email} ($29/mo)`,
                html: `<p>New contractor invoicing subscriber:</p><p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p><p>They're active in invoicing_clients. Set up their invoice template and walk them through the workflow.</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] contractor_invoicing_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI PHONE ANSWERING — subscription ─────────────────────────────────
      if (meta.type === "phone_answering_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("phone_answering_clients").upsert({
              email,
              contact_name: meta.name || null,
              business_name: meta.businessName || email,
              phone: meta.phone || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your AI Phone Answering service is being set up",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Phone Answering ($149/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to get your custom greeting and call script set up. After that, every call to your business number gets answered by AI — 24/7, never misses a lead.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
                subject: `💰 New AI Phone Answering client — ${meta.businessName || email} ($149/mo)`,
                html: `<p>New phone answering subscriber:</p><p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p><p>Setup steps:<ol><li>Buy a Twilio number matching their area code</li><li>Configure the Twilio number's voice webhook: <code>https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ai-phone-answering</code></li><li>Update <strong>phone_answering_clients</strong> row: add twilio_number + greeting_script, set active=true</li><li>Have them forward calls to the Twilio number</li></ol></p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] phone_answering_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── TEXT MESSAGE MARKETING — subscription ─────────────────────────────
      if (meta.type === "text_marketing_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("text_marketing_clients").upsert({
              email,
              contact_name: meta.name || null,
              business_name: meta.businessName || email,
              phone: meta.phone || null,
              industry: meta.industry || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [email],
                subject: "Your Text Message Marketing is being set up",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Text Message Marketing ($79/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to set up your dedicated SMS number and import your first contact list. Your first AI-written campaign will go out within the week.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@notify.m2training.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@m2training.com"],
                subject: `💰 New Text Marketing client — ${meta.businessName || email} ($79/mo)`,
                html: `<p>New text marketing subscriber:</p><p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p><p>Setup steps:<ol><li>Buy a Twilio number (A2P 10DLC registered)</li><li>Update <strong>text_marketing_clients</strong>: add twilio_number, set active=true</li><li>Import their contact list into text_marketing_contacts</li><li>Schedule first campaign</li></ol></p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] text_marketing_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── BLOG POST SERVICE — subscription ──────────────────────────────────
      if (meta.type === "blog_post_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("blog_post_clients").upsert({
              email, contact_name: meta.name || null,
              business_name: meta.businessName || email,
              website: meta.website || null, industry: meta.industry || null,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your AI Blog Posts are being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Blog Post Service ($79/mo). Your 7-day free trial has started.</p><p>Your first 4 blog posts will be emailed to you this Monday — ready to publish, no editing needed.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Blog Post client — ${meta.businessName || email} ($79/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>Website: ${meta.website || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] blog_post_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── REVIEW REQUEST SMS — subscription ─────────────────────────────────
      if (meta.type === "review_request_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("review_request_clients").upsert({
              email, contact_name: meta.name || null,
              business_name: meta.businessName || email,
              google_review_url: meta.googleReviewUrl || null,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Review Request SMS is being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Review Request SMS ($39/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to get your Twilio number assigned. After setup, submit a customer's phone number after each job and they'll automatically get a review request text.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Review Request client — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Google Review URL: ${meta.googleReviewUrl || "n/a"}</p><p>Setup: assign Twilio number → update review_request_clients row → activate.</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] review_request_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── PRESS RELEASE SERVICE — subscription ──────────────────────────────
      if (meta.type === "press_release_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("press_release_clients").upsert({
              email, contact_name: meta.name || null,
              business_name: meta.businessName || email,
              city: meta.city || null, industry: meta.industry || null,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your first AI Press Release is being written", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Press Release Service ($39/mo). Your 7-day free trial has started.</p><p>Your first press release will arrive in your inbox on the 1st of next month — formatted and ready to submit to local media and PR sites.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Press Release client — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>City: ${meta.city || "n/a"}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] press_release_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── QUOTE FOLLOW-UP SMS — subscription ────────────────────────────────
      if (meta.type === "quote_followup_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("quote_followup_clients").upsert({
              email, contact_name: meta.name || null,
              business_name: meta.businessName || email,
              phone: meta.phone || null,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Quote Follow-Up SMS is being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Quote Follow-Up SMS ($49/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to assign your Twilio number. After setup, submit a prospect's name and phone to your portal and our AI sends a 3-text follow-up sequence automatically.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Quote Follow-Up client — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p><p>Setup: assign Twilio number → update quote_followup_clients row → activate.</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] quote_followup_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── SOCIAL CAPTION PACK — subscription ────────────────────────────────
      if (meta.type === "social_captions_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("social_captions_clients").upsert({
              email, contact_name: meta.name || null,
              business_name: meta.businessName || email,
              industry: meta.industry || null, platforms: meta.platforms || "Facebook, Instagram, LinkedIn",
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your first Social Caption Pack is being written", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Social Caption Pack ($29/mo). Your 7-day free trial has started.</p><p>Your first pack of 30 captions will arrive on the 1st of next month. All you have to do is copy, paste, and post.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Social Captions client — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>Platforms: ${meta.platforms || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] social_captions_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WIN-BACK SMS — subscription ────────────────────────────────────────
      if (meta.type === "winback_sms_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("winback_sms_clients").upsert({
              email, contact_name: meta.name || null,
              business_name: meta.businessName || email,
              phone: meta.phone || null, industry: meta.industry || null,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Win-Back SMS campaign is being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Customer Win-Back SMS ($49/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to get your Twilio number assigned and import your first customer list. Your first campaign goes out on the 5th of next month.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Win-Back SMS client — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p><p>Setup: assign Twilio number → import contacts into winback_sms_contacts → update winback_sms_clients row → activate.</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] winback_sms_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WEEKLY BUSINESS DIGEST — subscription ─────────────────────────────
      if (meta.type === "weekly_digest_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("weekly_digest_clients").upsert({
              email, contact_name: meta.name || null,
              business_name: meta.businessName || email,
              industry: meta.industry || null,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your first Weekly Business Digest arrives Monday", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Weekly Business Digest ($29/mo). Your 7-day free trial has started.</p><p>Every Monday morning you'll get 3 actionable tips specific to the ${meta.industry || "your"} industry — ready to implement that week.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Weekly Digest client — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] weekly_digest_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI PROPOSAL GENERATOR — subscription ──────────────────────────────
      if (meta.type === "proposal_generator_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("proposal_clients").upsert({
              email, contact_name: meta.name || null,
              business_name: meta.businessName || email,
              industry: meta.industry || null,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your AI Proposal Generator is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Proposal Generator ($49/mo). Your 7-day free trial has started.</p><p>To generate your first proposal: go to mattmichelstraining.com/ai-proposal-portal, fill in your project details, and your polished proposal arrives by email in under 2 minutes.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Proposal Generator client — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] proposal_generator_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── HOLIDAY SMS BLAST — subscription ──────────────────────────────────
      if (meta.type === "holiday_sms_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("holiday_sms_clients").upsert({
              email, contact_name: meta.name || null,
              business_name: meta.businessName || email,
              industry: meta.industry || null,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Holiday SMS Blasts are being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Holiday SMS Blast ($39/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to assign your SMS number and import your customer list. Your first holiday blast will go out automatically on the next upcoming holiday.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Holiday SMS client — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p><p>Setup: assign Twilio number → import contacts into holiday_sms_contacts → update holiday_sms_clients row → activate.</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] holiday_sms_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WEBSITE COPY REFRESH — subscription ───────────────────────────────
      if (meta.type === "website_copy_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("website_copy_clients").upsert({
              email, contact_name: meta.name || null,
              business_name: meta.businessName || email,
              website: meta.website || null, industry: meta.industry || null, city: meta.city || null,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your first Website Copy Refresh arrives the 1st", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Website Copy Refresh ($49/mo). Your 7-day free trial has started.</p><p>On the 1st of every month you'll receive a fresh homepage hero, 3 value props, and 6 updated FAQs — ready to paste into your website.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Website Copy client — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>Website: ${meta.website || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] website_copy_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI COMPETITOR WATCH — subscription ────────────────────────────────
      if (meta.type === "competitor_watch_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("competitor_watch_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, city: meta.city || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your AI Competitor Watch is active", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Competitor Watch ($69/mo). 7-day trial started.</p><p>Your first weekly competitor report arrives within 7 days — covering pricing changes, new reviews, and online moves from your top competitors.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Competitor Watch — ${meta.businessName || email} ($69/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] competitor_watch_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── APPOINTMENT REMINDER SMS — subscription ───────────────────────────
      if (meta.type === "appointment_reminder_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("appointment_reminder_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, phone: meta.phone || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Appointment Reminders are being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Appointment Reminder SMS ($39/mo). 7-day trial started.</p><p>Matt will reach out within 24 hours to connect your scheduling system. After that, every appointment gets a 24hr + 1hr SMS reminder automatically.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Appointment Reminders — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p><p>Buy a Twilio number, update appointment_reminder_clients row.</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] appointment_reminder_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI VIDEO SCRIPT WRITER — subscription ─────────────────────────────
      if (meta.type === "video_script_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("video_script_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your first 8 video scripts are on the way", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Video Script Writer ($39/mo). 7-day trial started.</p><p>Your first batch of 8 short-form video scripts optimized for TikTok and Reels will arrive within a week.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Video Script client — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] video_script_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── CUSTOMER SATISFACTION SURVEY — subscription ────────────────────────
      if (meta.type === "satisfaction_survey_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("satisfaction_survey_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, phone: meta.phone || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Customer Satisfaction Surveys are live", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Customer Satisfaction Surveys ($29/mo). 7-day trial started.</p><p>After each job, submit the customer's phone and we auto-text them a quick satisfaction check. Monthly NPS report emailed to you.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Satisfaction Survey — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] satisfaction_survey_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI THANK YOU TEXT — subscription ───────────────────────────────────
      if (meta.type === "thank_you_sms_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("thank_you_sms_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, phone: meta.phone || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your AI Thank You texts are ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Thank You Text ($19/mo). 7-day trial started.</p><p>After each customer visit, submit their phone number and our AI writes and sends a personalized thank-you text instantly.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Thank You SMS — ${meta.businessName || email} ($19/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] thank_you_sms_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI ESTIMATE GENERATOR — subscription ──────────────────────────────
      if (meta.type === "estimate_generator_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("estimate_generator_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, city: meta.city || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your AI Estimate Generator is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Estimate Generator ($49/mo). 7-day trial started.</p><p>Submit project details through your portal and get a professional estimate emailed to you and your prospect in minutes.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Estimate Generator — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] estimate_generator_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI LOCAL SEO PAGES — subscription ─────────────────────────────────
      if (meta.type === "local_seo_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("local_seo_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, city: meta.city || null, website: meta.website || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your first Local SEO page is being written", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Local SEO Pages ($59/mo). 7-day trial started.</p><p>On the 1st of every month you'll get a city-specific landing page with H1, sections, FAQ, and meta description — ready to add to your site.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Local SEO — ${meta.businessName || email} ($59/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}<br>Website: ${meta.website || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] local_seo_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── LATE PAYMENT CHASER — subscription ────────────────────────────────
      if (meta.type === "payment_chaser_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("payment_chaser_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, phone: meta.phone || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Late Payment Chaser is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Late Payment Chaser ($29/mo). 7-day trial started.</p><p>Submit overdue invoices and we auto-send professional reminders at 3, 7, 14, and 30 days via SMS and email.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Payment Chaser — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] payment_chaser_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI GOOGLE Q&A MANAGER — subscription ──────────────────────────────
      if (meta.type === "google_qa_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("google_qa_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your AI Google Q&A Manager is live", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Google Q&A Manager ($29/mo). 7-day trial started.</p><p>Every week you'll get 5 AI-written Q&A pairs optimized for your Google Business Profile. Post them and watch your ranking improve.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Google Q&A — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] google_qa_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── STAFF INTERNAL NEWSLETTER — subscription ──────────────────────────
      if (meta.type === "staff_newsletter_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("staff_newsletter_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Staff Newsletter starts Monday", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Staff Internal Newsletter ($29/mo). 7-day trial started.</p><p>Every Monday you'll get a ready-to-forward newsletter for your team: industry news, safety tips, motivational content.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Staff Newsletter — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] staff_newsletter_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── SPEED-TO-LEAD SMS — subscription ──────────────────────────────────
      if (meta.type === "speed_lead_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("speed_lead_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, phone: meta.phone || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Speed-to-Lead SMS is being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Speed-to-Lead SMS ($39/mo). 7-day trial started.</p><p>Matt will reach out within 24 hours to connect your website forms. After that, every form fill gets an instant SMS within 60 seconds.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Speed-to-Lead — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p><p>Buy Twilio number, add webhook to their site forms.</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] speed_lead_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI EMAIL WELCOME DRIP — subscription ──────────────────────────────
      if (meta.type === "welcome_drip_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("welcome_drip_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Welcome Drip sequence is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Email Welcome Drip ($49/mo). 7-day trial started.</p><p>Add new customers to the system and they'll automatically receive a 5-email welcome sequence over 15 days — building trust and driving referrals.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Welcome Drip — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] welcome_drip_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── REVIEW ALERT SMS — subscription ───────────────────────────────────
      if (meta.type === "review_alert_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("review_alert_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, phone: meta.phone || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Review Alerts are active", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Review Alert SMS ($19/mo). 7-day trial started.</p><p>Every time a new review is posted on your Google profile, you'll get an instant text so you can respond fast.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Review Alert — ${meta.businessName || email} ($19/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] review_alert_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── SEASONAL PROMO PLANNER — subscription ─────────────────────────────
      if (meta.type === "promo_planner_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("promo_planner_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, city: meta.city || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your first Promo Calendar is on the way", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Seasonal Promo Planner ($39/mo). 7-day trial started.</p><p>On the 1st of every month you'll get a full promotional calendar: 4 weeks of campaigns tied to real holidays and seasons, with copy ready to go.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Promo Planner — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] promo_planner_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI CUSTOMER REACTIVATION EMAIL — subscription ─────────────────────
      if (meta.type === "reactivation_email_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("reactivation_email_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Customer Reactivation emails are set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Customer Reactivation ($39/mo). 7-day trial started.</p><p>Upload your lapsed customer list and every month we send personalized "we miss you" emails to bring them back.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Reactivation Email — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] reactivation_email_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI SALES SCRIPT GENERATOR — subscription ──────────────────────────
      if (meta.type === "sales_script_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("sales_script_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your first Sales Scripts are being written", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Sales Script Generator ($29/mo). 7-day trial started.</p><p>Every month you'll get 3 updated phone scripts: cold call opener, follow-up, and objection handling — tailored to your industry.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Sales Scripts — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] sales_script_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI DIRECT MAIL COPY — subscription ────────────────────────────────
      if (meta.type === "direct_mail_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("direct_mail_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, city: meta.city || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your first Direct Mail postcard is being designed", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Direct Mail Copy ($49/mo). 7-day trial started.</p><p>Every month you'll get a print-ready postcard design with headline, body copy, and CTA. Just send it to your printer and you're done.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Direct Mail — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] direct_mail_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WARRANTY REMINDER SMS — subscription ──────────────────────────────
      if (meta.type === "warranty_reminder_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("warranty_reminder_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, phone: meta.phone || null, industry: meta.industry || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your Warranty Reminders are being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Warranty Reminder SMS ($29/mo). 7-day trial started.</p><p>Upload your customer warranty list and we'll auto-text them 30 days before expiry — turning warranty expirations into booked service calls.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Warranty Reminder — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] warranty_reminder_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI HIRING ASSISTANT — subscription ────────────────────────────────
      if (meta.type === "hiring_assistant_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("hiring_assistant_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, city: meta.city || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your AI Hiring Assistant is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Hiring Assistant ($49/mo). 7-day trial started.</p><p>Submit resumes and job descriptions. AI scores each candidate 1-10, lists strengths/weaknesses, and auto-emails qualified applicants to schedule interviews.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Hiring Assistant — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] hiring_assistant_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── BUSINESS KPI WEEKLY EMAIL — subscription ──────────────────────────
      if (meta.type === "kpi_email_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("kpi_email_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, website: meta.website || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your weekly KPI emails start Monday", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Business KPI Weekly Email ($49/mo). 7-day trial started.</p><p>Every Monday you'll get a performance snapshot with AI-recommended actions for the week based on your industry benchmarks.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New KPI Email — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>Website: ${meta.website || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] kpi_email_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI ONBOARDING AGENT — subscription ────────────────────────────────
      if (meta.type === "onboarding_agent_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("onboarding_agent_clients").upsert({ email, business_name: meta.businessName || email, industry: meta.industry || null, active: true }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your AI Onboarding Agent is being configured", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Customer Onboarding Agent ($59/mo). 7-day trial started.</p><p>Matt will reach out within 24 hours to connect your customer intake system. After that, every new customer gets a personalized welcome sequence automatically.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Onboarding Agent — ${meta.businessName || email} ($59/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] onboarding_agent_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI SOCIAL PROOF COLLECTOR — subscription ──────────────────────────
      if (meta.type === "social_proof_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("social_proof_clients").upsert({ email, business_name: meta.businessName || email, phone: meta.phone || null, active: true }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your AI Social Proof Collector is being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Social Proof Collector ($39/mo). 7-day trial started.</p><p>Matt will reach out within 24 hours to configure your SMS number. After that, every completed job triggers an automatic review request.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Social Proof — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] social_proof_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI COMPETITOR PRICE MONITOR — subscription ────────────────────────
      if (meta.type === "price_monitor_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("price_monitor_clients").upsert({ email, business_name: meta.businessName || email, industry: meta.industry || null, competitor_urls: meta.competitorUrls ? meta.competitorUrls.split(",").map((u: string) => u.trim()) : null, active: true }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your AI Price Monitor is active", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Competitor Price Monitor ($49/mo). 7-day trial started.</p><p>Your first competitor pricing report will arrive within 7 days. Weekly reports every Monday after that.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Price Monitor — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] price_monitor_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI MEETING PREP — subscription ────────────────────────────────────
      if (meta.type === "meeting_prep_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("meeting_prep_clients").upsert({ email, business_name: meta.businessName || email, industry: meta.industry || null, active: true }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your AI Meeting Prep Agent is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Meeting Prep ($29/mo). 7-day trial started.</p><p>Submit a prospect company name anytime and get a one-page briefing within minutes — talking points, pain points, and a custom opener.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Meeting Prep — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] meeting_prep_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI DIRECTORY SUBMITTER — subscription ─────────────────────────────
      if (meta.type === "directory_submitter_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("directory_submitter_clients").upsert({ email, business_name: meta.businessName || email, address: meta.address || null, phone: meta.phone || null, active: true }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@notify.m2training.com>", to: [email], subject: "Your first Directory Audit is on the way", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Directory Submitter ($39/mo). 7-day trial started.</p><p>Your first audit of 20+ directories will arrive within 7 days. Monthly audits on the 1st after that.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@notify.m2training.com>", to: ["matt@m2training.com"], subject: `💰 New Directory Submitter — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Address: ${meta.address || "n/a"}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] directory_submitter_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[STRIPE-WEBHOOK] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }
});

function parseGuideExercises(html: string): { name: string; sets: string; reps: string; notes: string }[] {
  const exercises: { name: string; sets: string; reps: string; notes: string }[] = [];
  const h3Regex = /<h3>(.*?)<\/h3>/g;
  const setsRepsRegex = /Sets\/Reps:<\/strong>\s*([\d]+)[×x]([\d]+)/;
  const whyRegex = /WHY:<\/strong>\s*(.*?)<\/p>/;

  let match;
  while ((match = h3Regex.exec(html)) !== null) {
    const exerciseName = match[1].replace(/^\d+\.\s*/, "").trim();
    const afterH3 = html.substring(match.index, match.index + 500);
    const setsMatch = afterH3.match(setsRepsRegex);
    const whyMatch = afterH3.match(whyRegex);
    exercises.push({
      name: exerciseName,
      sets: setsMatch ? setsMatch[1] : "3",
      reps: setsMatch ? setsMatch[2] : "10",
      notes: whyMatch ? whyMatch[1].trim() : "",
    });
  }
  return exercises;
}

function extractSport(title: string): string | null {
  const sports = ["Baseball", "Football", "Basketball", "Hockey", "Soccer", "Lacrosse"];
  for (const sport of sports) {
    if (title.toLowerCase().includes(sport.toLowerCase())) return sport;
  }
  if (title.toLowerCase().includes("youth")) return "General";
  return null;
}
