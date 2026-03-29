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
  // Current (prod_UBI* — latest Stripe products)
  "prod_UBI78IQsBpyfNw": "basic",
  "prod_UBI7Wdb3liTxiF": "foundation",
  "prod_UBI8SV9Fa6CibX": "custom",
  "prod_UBI8mP9jA5rV3U": "team_elite",
  // Previous generation (prod_UAl*)
  "prod_UAlStH84vrByST": "basic",
  "prod_UAlTgNGJWmREZL": "foundation",
  "prod_UAlTkDlrDfDije": "custom",
  "prod_UAlUIuvjHBjtNL": "team_elite",
  // Legacy (prod_U9p*)
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

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
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
