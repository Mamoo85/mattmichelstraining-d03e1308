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

// ── M² BRANDED EMAIL TEMPLATE HELPER ─────────────────────────────────────
function m2Email(opts: { greeting: string; headline: string; body: string; cta?: { text: string; url: string }; signature?: string }): string {
  const ctaBlock = opts.cta ? `<div style="text-align:center;margin:24px 0"><a href="${opts.cta.url}" style="display:inline-block;background:#e8621a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;font-family:sans-serif">${opts.cta.text}</a></div>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#1e293b;padding:20px 28px;border-bottom:3px solid #e8621a">
    <p style="color:#e8621a;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">M² Development</p>
    <h1 style="color:#fff;margin:0;font-size:20px;font-family:Georgia,serif">${opts.headline}</h1>
  </div>
  <div style="padding:24px 28px;color:#1e293b;font-size:15px;line-height:1.8">
    <p style="margin:0 0 16px">${opts.greeting}</p>
    ${opts.body}
    ${ctaBlock}
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt" style="width:44px;height:44px;border-radius:50%;object-fit:cover" />
      <div style="font-size:13px;color:#64748b">
        <strong style="color:#1e293b">${opts.signature || "Matt Michels"}</strong><br>Grosse Pointe, MI · <a href="tel:+13138064952" style="color:#e8621a">(313) 806-4952</a>
      </div>
    </div>
  </div>
  <div style="padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
    <p style="margin:0;color:#94a3b8;font-size:11px">M² Development · mattmichelstraining.com · Grosse Pointe, MI</p>
  </div>
</div></body></html>`;
}

async function sendM2Email(to: string, subject: string, html: string, bcc?: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Matt Michels <matt@mattmichelstraining.com>",
      to: Array.isArray(to) ? to : [to],
      bcc: [bcc || "matthewmichels4@gmail.com"],
      subject,
      html,
    }),
  });
}

async function notifyMatt(subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² System <matt@mattmichelstraining.com>",
      to: ["matt@mattmichelstraining.com"],
      bcc: ["matthewmichels4@gmail.com"],
      subject,
      html,
    }),
  });
}

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

          // Fire subscription-activated email (fire-and-forget)
          try {
            const subSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            await subSb.functions.invoke("send-transactional-email", {
              body: {
                templateName: "subscription-activated",
                recipientEmail: email,
                idempotencyKey: `sub-activated-${subscription.id}`,
                templateData: {
                  name: (customer as any).name || undefined,
                  tierName: tierNames,
                },
              },
            });
          } catch (e) { console.error("[WEBHOOK] Subscription email error:", e); }
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

      // Fire order confirmation email (fire-and-forget)
      if (customerEmail) {
        try {
          const orderSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          await orderSb.functions.invoke("send-transactional-email", {
            body: {
              templateName: "order-confirmation",
              recipientEmail: customerEmail,
              idempotencyKey: `order-confirm-${session.id}`,
              templateData: {
                name: customerName || undefined,
                itemName: txItemName,
                amount: sessionAmount ? (sessionAmount / 100).toFixed(2) : undefined,
              },
            },
          });
        } catch (e) { console.error("[WEBHOOK] Order confirmation email error:", e); }
      }

      // ── WEB DESIGN ADD-ON ────────────────────────────────────────────────
      if (meta.type === "web_design_addon" && meta.service_key) {
        try {
          const addonSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          await addonSb.from("client_addons").insert({
            lead_id: meta.lead_id || null,
            user_id: meta.user_id || null,
            service_key: meta.service_key,
            service_name: meta.service_name || meta.service_key,
            price_cents: session.amount_total || 0,
            stripe_subscription_id: (session.subscription as string) || null,
            status: "active",
          });
          console.log(`[WEBHOOK] Web design addon activated: ${meta.service_key} for ${customerEmail}`);
          if (RESEND_API_KEY && customerEmail) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [customerEmail], bcc: ["matthewmichels4@gmail.com"],
                subject: `Add-On Activated: ${meta.service_name || meta.service_key}`,
                html: `<p>Your add-on service <strong>${meta.service_name}</strong> is now active. I'll be in touch within 24 hours to get everything set up.</p><p>— Matt, M² Development<br>(313) 806-4952</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
                subject: `💰 New Add-On: ${meta.service_name} — ${customerEmail}`,
                html: `<p><strong>${meta.service_name}</strong> activated by ${customerEmail}.<br>Lead ID: ${meta.lead_id || "none"}</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] web_design_addon error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── B2B SUBSCRIPTION FULFILLMENT (handbook, grant finder, etc.) ──────
      if (meta.type === "handbook_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("handbook_clients").upsert({ email, business_name: meta.businessName || email, phone: meta.phone || null, industry: meta.industry || null, state: meta.state || "MI", employee_count: parseInt(meta.employeeCount) || null, active: true }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await sendM2Email(email, "Your AI Employee Handbook is Active — Here's What Happens Next", m2Email({
              greeting: `Hey${meta.businessName ? " " + meta.businessName : ""} —`,
              headline: "Your AI Employee Handbook is Active",
              body: `<p style="margin:0 0 12px"><strong>You just made your HR life 10x easier.</strong> Here's exactly what you're getting:</p>
<p style="margin:0 0 8px">📋 <strong>First handbook update</strong> — arrives within 48 hours, customized to your state (${meta.state || "MI"}) labor laws</p>
<p style="margin:0 0 8px">📅 <strong>Monthly compliance updates</strong> — on the 1st of every month, your handbook gets refreshed with any new state regulations</p>
<p style="margin:0 0 8px">🏢 <strong>Employee count-aware</strong> — policies calibrated for your team size (${meta.employeeCount || "your team"})</p>
<p style="margin:0 0 16px">⚡ <strong>Industry-specific</strong> — language tailored to ${meta.industry || "your industry"}</p>
<p style="margin:0 0 8px"><strong>What happens next:</strong></p>
<ol style="margin:0 0 16px;padding-left:20px;color:#475569">
<li>Your first AI-generated handbook section arrives within 48 hours</li>
<li>Review it — if anything needs adjusting, reply to this email</li>
<li>Monthly updates auto-generate on the 1st</li>
</ol>
<p style="margin:0;color:#64748b;font-size:13px">Questions? Hit reply or text me. I read every message.</p>`,
            }));
            await notifyMatt(`💰 New Handbook Client — ${meta.businessName || email} ($99/mo)`, `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>State: ${meta.state || "MI"}<br>Employees: ${meta.employeeCount || "n/a"}</p>`);
          }
        } catch (e) { console.error("[WEBHOOK] handbook_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "grant_finder_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("grant_finder_clients").upsert({ email, business_name: meta.businessName || email, phone: meta.phone || null, industry: meta.industry || null, employee_count: parseInt(meta.employeeCount) || null, annual_revenue: meta.annualRevenue || null, location: meta.location || "Michigan", active: true }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await sendM2Email(email, "Your AI Grant Finder is Active — First Report in 7 Days", m2Email({
              greeting: `Hey${meta.businessName ? " " + meta.businessName : ""} —`,
              headline: "Your AI Grant Finder is Active",
              body: `<p style="margin:0 0 12px"><strong>We're already scanning for money you're leaving on the table.</strong></p>
<p style="margin:0 0 8px">🔍 <strong>What we're looking for:</strong> Federal, state, and local grants matching ${meta.industry || "your industry"} businesses in ${meta.location || "Michigan"}</p>
<p style="margin:0 0 8px">📬 <strong>First curated report</strong> — arrives within 7 days with specific grants you qualify for, amounts, deadlines, and application links</p>
<p style="margin:0 0 8px">📅 <strong>Weekly updates</strong> — every Monday morning, new grants and deadline reminders</p>
<p style="margin:0 0 16px">💡 <strong>Revenue range</strong> — filtered for businesses like yours (${meta.annualRevenue || "your revenue bracket"})</p>
<p style="margin:0;color:#64748b;font-size:13px">Most business owners have no idea how much grant money they're eligible for. That changes now.</p>`,
            }));
            await notifyMatt(`💰 New Grant Finder Client — ${meta.businessName || email} ($149/mo)`, `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>Location: ${meta.location || "Michigan"}</p>`);
          }
        } catch (e) { console.error("[WEBHOOK] grant_finder_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "review_response_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("review_response_clients").upsert({ email, business_name: meta.businessName || email, phone: meta.phone || null, industry: meta.industry || null, google_place_id: meta.googlePlaceId || null, brand_voice: meta.brandVoice || null, active: true }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Review Response Service is Active — Monitoring Starts in 24 Hours", html: m2Email({
              greeting: `Hey${meta.businessName ? " " + meta.businessName : ""} —`,
              headline: "Your AI Review Responder is Active",
              body: `<p style="margin:0 0 12px"><strong>New Google reviews? We handle them.</strong> Here's what's coming:</p>
<p style="margin:0 0 8px">🔍 <strong>24/7 monitoring</strong> — we watch your Google Business Profile for new reviews</p>
<p style="margin:0 0 8px">✍️ <strong>AI-crafted responses</strong> — professional, on-brand replies generated automatically</p>
<p style="margin:0 0 8px">📧 <strong>Daily digest</strong> — new reviews + suggested responses delivered to your inbox</p>
<p style="margin:0 0 16px">🎯 <strong>Brand voice</strong> — responses match your business tone, not generic AI</p>
<p style="margin:0 0 8px"><strong>Next step:</strong> Reply to this email with your Google Business Profile URL so we can start monitoring. Or text Matt at (313) 806-4952.</p>`,
            }) }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Review Response Client — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] review_response_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "battlecard_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            const competitorNames = meta.competitorNames ? meta.competitorNames.split(",") : null;
            const competitorUrls = meta.competitorUrls ? meta.competitorUrls.split(",") : null;
            await (sb.from as any)("battlecard_clients").upsert({ email, business_name: meta.businessName || email, phone: meta.phone || null, industry: meta.industry || null, competitor_names: competitorNames, competitor_urls: competitorUrls, active: true }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Competitive Battlecard is Active — First Battlecard in 48 Hours", html: m2Email({
              greeting: `Hey${meta.businessName ? " " + meta.businessName : ""} —`,
              headline: "Your Competitive Battlecard is Active",
              body: `<p style="margin:0 0 12px"><strong>Know exactly how to beat your competition.</strong></p>
<p style="margin:0 0 8px">📊 <strong>First battlecard</strong> — arrives within 48 hours, analyzing your top competitors</p>
<p style="margin:0 0 8px">📅 <strong>Monthly updates</strong> — refreshed on the 1st with new competitor moves, pricing changes, and market shifts</p>
<p style="margin:0 0 8px">🎯 <strong>Talk tracks</strong> — exact language to use when prospects mention a competitor</p>
<p style="margin:0 0 16px">⚡ <strong>Win/loss insights</strong> — what competitors are doing right and where they're vulnerable</p>
<p style="margin:0;color:#64748b;font-size:13px">Your sales team will never be caught off guard again.</p>`,
            }) }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Battlecard Client — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Competitors: ${meta.competitorNames || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] battlecard_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "market_intel_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            const focusTopics = meta.focusTopics ? meta.focusTopics.split(",") : null;
            const competitors = meta.competitors ? meta.competitors.split(",") : null;
            await (sb.from as any)("market_intel_clients").upsert({ email, business_name: meta.businessName || email, phone: meta.phone || null, industry: meta.industry || null, focus_topics: focusTopics, competitors, location: meta.location || "Michigan", active: true }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Market Intelligence Brief is Active — First Brief Next Monday", html: m2Email({
              greeting: `Hey${meta.businessName ? " " + meta.businessName : ""} —`,
              headline: "Your Weekly Market Intelligence is Active",
              body: `<p style="margin:0 0 12px"><strong>Every Monday morning, you'll know what your market is doing before your competitors do.</strong></p>
<p style="margin:0 0 8px">📰 <strong>Industry trends</strong> — AI-curated news and developments in ${meta.industry || "your industry"}</p>
<p style="margin:0 0 8px">📍 <strong>Local market shifts</strong> — what's changing in ${meta.location || "your area"}</p>
<p style="margin:0 0 8px">🏢 <strong>Competitor moves</strong> — new hires, expansions, pricing changes you should know about</p>
<p style="margin:0 0 16px">💡 <strong>Action items</strong> — 3 specific things to do this week based on the intel</p>
<p style="margin:0;color:#64748b;font-size:13px">First brief arrives next Monday. Knowledge is revenue.</p>`,
            }) }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Market Intel Client — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>Location: ${meta.location || "Michigan"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] market_intel_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── CAPTION PACK — subscription ───────────────────────────────────────
      if (meta.type === "caption_pack_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("caption_pack_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, platforms: meta.platforms || "Facebook, Instagram", active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Caption Pack is Active — 30 Posts Coming Your Way", html: m2Email({
              greeting: `Hey${meta.name ? " " + meta.name : ""} —`,
              headline: "Your AI Caption Pack is Active",
              body: `<p style="margin:0 0 12px"><strong>Never stare at a blank screen wondering what to post again.</strong></p>
<p style="margin:0 0 8px">📱 <strong>30 captions per month</strong> — ready to copy-paste to ${meta.platforms || "Facebook and Instagram"}</p>
<p style="margin:0 0 8px">🎯 <strong>Industry-tailored</strong> — written for ${meta.industry || "your business"}, not generic fluff</p>
<p style="margin:0 0 8px">📅 <strong>Posting schedule included</strong> — we tell you which days to post which caption</p>
<p style="margin:0 0 16px">✨ <strong>7-day free trial</strong> — first batch arrives this week</p>
<p style="margin:0;color:#64748b;font-size:13px">Just copy, paste, post. That's it. Social media done in 5 minutes a day.</p>`,
            }) }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Caption Pack — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Platforms: ${meta.platforms || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] caption_pack_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── GOVERNMENT CONTRACT OPPORTUNITY MONITOR ──────────────────────────
      if (meta.type === "gov_contract_monitor") {
        try {
          const email = meta.customer_email || customerEmail;
          if (email) {
            const govSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            await govSb.from("gov_contract_clients" as any).insert({
              customer_email: email,
              customer_name: meta.customer_name || customerName || null,
              company_name: meta.company_name || null,
              naics_codes: meta.naics_codes || null,
              keywords: meta.keywords || null,
              set_aside_types: meta.set_aside_types || null,
              min_contract_value: meta.min_contract_value ? parseInt(meta.min_contract_value) : null,
              max_contract_value: meta.max_contract_value ? parseInt(meta.max_contract_value) : null,
              preferred_states: meta.preferred_states || null,
              stripe_subscription_id: session.subscription as string || null,
              subscription_status: "active",
            });
            // Fire-and-forget initial scan
            fetch(`${SUPABASE_URL}/functions/v1/gov-contract-monitor`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({ trigger: "new_client", email }),
            }).catch((e) => console.error("[WEBHOOK] gov-contract-monitor initial scan fire failed:", e));
            // Welcome email
            if (RESEND_API_KEY) {
              await sendM2Email(email, "Your Government Contract Monitor is Active", m2Email({
                greeting: `Hey${meta.customer_name ? " " + meta.customer_name : ""} —`,
                headline: "Your Federal Contract Monitor is Live",
                body: `<p style="margin:0 0 12px"><strong>We're now watching SAM.gov for contracts that match ${meta.company_name || "your company"}.</strong></p>
<p style="margin:0 0 8px">&#128269; <strong>What we monitor:</strong> SAM.gov opportunities matching your NAICS codes (${meta.naics_codes || "all"}) and keywords (${meta.keywords || "as configured"})</p>
<p style="margin:0 0 8px">&#129302; <strong>AI scoring (0&#8211;100):</strong> Every opportunity is scored on how well it matches your capabilities, certifications, and set-aside eligibility</p>
<p style="margin:0 0 8px">&#128203; <strong>Bid/Review/No-Bid:</strong> BID = strong fit (70+), REVIEW = worth evaluating (40&#8211;69), NO-BID = not worth your time (&lt;40)</p>
<p style="margin:0 0 8px">&#9200; <strong>72-hour deadline alerts:</strong> Separate urgent email when any matched opportunity closes within 3 days</p>
<p style="margin:0 0 16px">&#128231; <strong>Daily digest:</strong> Opportunities scored 50+ sent each morning with SAM.gov links</p>
<p style="margin:0 0 8px"><strong>Set-aside types:</strong> ${meta.set_aside_types || "All opportunities monitored"}</p>
<p style="margin:0;color:#64748b;font-size:13px">Your first scan is running now. Questions? Reply to this email or text me directly.</p>`,
                cta: { text: "View Your Dashboard", url: "https://www.mattmichelstraining.com/gov-contract-monitor/dashboard" },
              }));
              await notifyMatt(`New Gov Contract Monitor — ${meta.company_name || email} ($299/mo)`, `<p><strong>${meta.company_name || email}</strong><br>Email: ${email}<br>NAICS: ${meta.naics_codes || "n/a"}<br>Keywords: ${meta.keywords || "n/a"}<br>Set-Asides: ${meta.set_aside_types || "n/a"}</p>`);
            }
          }
        } catch (e) { console.error("[WEBHOOK] gov_contract_monitor error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI REGULATORY CHANGE MONITOR — subscription ──────────────────────
      if (meta.type === "regulatory_monitor") {
        try {
          const email = meta.customer_email || customerEmail;
          if (email) {
            const regSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            await regSb.from("regulatory_monitor_clients" as any).insert({
              customer_email: email,
              customer_name: meta.customer_name || customerName || null,
              company_name: meta.company_name || null,
              industry: meta.industry || "general",
              sub_industries: meta.sub_industries || null,
              state_focus: meta.state_focus || null,
              stripe_subscription_id: session.subscription as string || null,
              subscription_status: "active",
            });
            // Fire-and-forget initial scan
            fetch(`${SUPABASE_URL}/functions/v1/regulatory-monitor-scan`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({ trigger: "new_client", email }),
            }).catch((e) => console.error("[WEBHOOK] regulatory-monitor-scan initial fire failed:", e));
            // Welcome email
            if (RESEND_API_KEY) {
              const industryLabel = meta.industry
                ? meta.industry.charAt(0).toUpperCase() + meta.industry.slice(1).replace(/_/g, " / ")
                : "your industry";
              await sendM2Email(email, "Your AI Regulatory Monitor is Active — First Digest Arriving Shortly", m2Email({
                greeting: `Hey${meta.customer_name ? " " + meta.customer_name : ""} —`,
                headline: "Your Regulatory Change Monitor is Live",
                body: `<p style="margin:0 0 12px"><strong>You'll never be blindsided by a regulatory change again.</strong> We're now monitoring the Federal Register for ${meta.company_name || "your company"}.</p>
<p style="margin:0 0 8px">&#128269; <strong>What we watch:</strong> Federal Register documents affecting ${industryLabel}${meta.state_focus ? ` with a focus on ${meta.state_focus}` : ""}</p>
<p style="margin:0 0 8px">&#129302; <strong>AI Plain-English Summaries:</strong> Every regulation translated into what it actually means for your business</p>
<p style="margin:0 0 8px">&#128203; <strong>Impact levels:</strong> HIGH (act now), MEDIUM (review within 30 days), LOW (informational)</p>
<p style="margin:0 0 8px">&#128231; <strong>Weekly digest:</strong> Every Monday morning, your personalized regulatory update</p>
<p style="margin:0 0 16px">&#9200; <strong>First scan:</strong> Running now — you'll receive your first digest within the hour if there are new regulations this week</p>
<p style="margin:0;color:#64748b;font-size:13px">Questions? Reply to this email or text me directly. I read every message.</p>`,
                cta: { text: "View Your Dashboard", url: "https://www.mattmichelstraining.com/regulatory-monitor/dashboard" },
              }));
              await notifyMatt(`New Regulatory Monitor — ${meta.company_name || email} ($197/mo)`, `<p><strong>${meta.company_name || email}</strong><br>Email: ${email}<br>Industry: ${industryLabel}<br>State Focus: ${meta.state_focus || "National"}<br>Sub-industries: ${meta.sub_industries || "n/a"}</p>`);
            }
          }
        } catch (e) { console.error("[WEBHOOK] regulatory_monitor error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI TRADEMARK WATCH — subscription ────────────────────────────────
      if (meta.type === "trademark_watch") {
        try {
          const email = meta.customer_email || customerEmail;
          if (email) {
            const tmSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

            // Resolve user_id by email
            const { data: profiles } = await tmSb.from("profiles").select("user_id").eq("email", email).limit(1);
            const userId = profiles?.[0]?.user_id || null;

            // Insert client record
            const { data: tmClient, error: clientInsertErr } = await tmSb
              .from("trademark_watch_clients" as any)
              .insert({
                user_id: userId,
                customer_email: email,
                customer_name: meta.customer_name || customerName || null,
                company_name: meta.company_name || null,
                stripe_subscription_id: session.subscription as string || null,
                subscription_status: "active",
                marks_count: 1,
              })
              .select()
              .single();

            if (clientInsertErr) throw clientInsertErr;

            // Insert the first mark from signup metadata
            if (tmClient && meta.mark_text) {
              await tmSb.from("trademark_watch_marks" as any).insert({
                client_id: (tmClient as any).id,
                mark_text: meta.mark_text,
                goods_services: meta.goods_services || null,
                nice_classes: meta.nice_classes || null,
              });
            }

            // Fire-and-forget initial scan
            fetch(`${SUPABASE_URL}/functions/v1/trademark-watch-scan`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({ trigger: "new_client", email }),
            }).catch((e) => console.error("[WEBHOOK] trademark-watch-scan initial fire failed:", e));

            // Welcome email
            if (RESEND_API_KEY) {
              const tmEmailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#0f2547;padding:20px 28px;border-bottom:3px solid #c9a227">
    <p style="color:#c9a227;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">M² Development · Trademark Watch</p>
    <h1 style="color:#fff;margin:0;font-size:20px;font-family:Georgia,serif">Your Trademark Watch is Live</h1>
  </div>
  <div style="padding:24px 28px;color:#1e293b;font-size:15px;line-height:1.8">
    <p style="margin:0 0 16px">Hey${meta.customer_name ? " " + meta.customer_name : ""} —</p>
    <p style="margin:0 0 12px"><strong>We're now monitoring the USPTO for marks similar to "${meta.mark_text || "your trademark"}".</strong></p>
    <p style="margin:0 0 8px">&#128269; <strong>What we're watching for:</strong> Newly filed applications that could create a likelihood of confusion with your mark</p>
    <p style="margin:0 0 8px">&#129302; <strong>AI scoring (0&#8211;100):</strong> Every candidate mark is scored on phonetic similarity, visual similarity, and goods/services overlap</p>
    <p style="margin:0 0 8px">&#9878; <strong>Oppose / Monitor / Ignore:</strong> Clear action recommendation so you know exactly what to do</p>
    <p style="margin:0 0 8px">&#128231; <strong>Weekly digest:</strong> Every Sunday morning with all new findings</p>
    <p style="margin:0 0 16px">&#9203; <strong>30-day window:</strong> We flag opposition candidates immediately — never miss a deadline</p>
    <p style="margin:0 0 8px"><strong>Your first scan is running now.</strong> You'll receive your first report within 24 hours.</p>
    <p style="margin:0 0 16px;color:#64748b;font-size:13px">This service is informational. Consult a trademark attorney before filing any opposition.</p>
    <div style="text-align:center;margin:24px 0"><a href="https://www.mattmichelstraining.com/trademark-watch/dashboard" style="display:inline-block;background:#0f2547;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">View Your Dashboard</a></div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt" style="width:44px;height:44px;border-radius:50%;object-fit:cover" />
      <div style="font-size:13px;color:#64748b"><strong style="color:#1e293b">Matt Michels</strong><br>Grosse Pointe, MI · <a href="tel:+13138064952" style="color:#c9a227">(313) 806-4952</a></div>
    </div>
  </div>
  <div style="padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
    <p style="margin:0;color:#94a3b8;font-size:11px">M² Development · mattmichelstraining.com · Grosse Pointe, MI</p>
  </div>
</div></body></html>`;

              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "Matt Michels <matt@mattmichelstraining.com>",
                  to: [email],
                  bcc: ["matthewmichels4@gmail.com"],
                  subject: `Your Trademark Watch is Active — Monitoring "${meta.mark_text || "your mark"}"`,
                  html: tmEmailHtml,
                }),
              });

              await notifyMatt(
                `New Trademark Watch — ${meta.company_name || email} ($49/mo)`,
                `<p><strong>${meta.company_name || meta.customer_name || email}</strong><br>Email: ${email}<br>Mark: <strong>${meta.mark_text || "n/a"}</strong><br>Classes: ${meta.nice_classes || "n/a"}<br>G&S: ${meta.goods_services || "n/a"}</p>`
              );
            }
          }
        } catch (e) { console.error("[WEBHOOK] trademark_watch error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── FAQ REFRESH — subscription ────────────────────────────────────────
      if (meta.type === "faq_refresh_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("faq_refresh_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, website_url: meta.website || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI FAQ Refresh is Active — SEO-Optimized FAQs Monthly", html: m2Email({
              greeting: `Hey${meta.name ? " " + meta.name : ""} —`,
              headline: "Your AI FAQ Refresh is Active",
              body: `<p style="margin:0 0 12px"><strong>Fresh FAQs = fresh Google rankings.</strong> Here's what you're getting:</p>
<p style="margin:0 0 8px">🔄 <strong>Monthly updated FAQs</strong> — SEO-optimized questions and answers for your website</p>
<p style="margin:0 0 8px">🔍 <strong>Keyword-targeted</strong> — written to rank for the searches your customers are actually making</p>
<p style="margin:0 0 8px">📋 <strong>Copy-paste ready</strong> — formatted for your website, no editing needed</p>
<p style="margin:0 0 16px">✨ <strong>7-day free trial</strong> — first refresh arrives this week</p>
<p style="margin:0;color:#64748b;font-size:13px">Google loves fresh content. This is the easiest way to feed it.</p>`,
            }) }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New FAQ Refresh — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] faq_refresh_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── JOB POSTING — subscription ────────────────────────────────────────
      if (meta.type === "job_posting_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("job_posting_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Job Posting Generator is Active — Post Smarter, Hire Faster", html: m2Email({
              greeting: `Hey${meta.name ? " " + meta.name : ""} —`,
              headline: "Your AI Job Posting Generator is Active",
              body: `<p style="margin:0 0 12px"><strong>Stop writing boring job posts that nobody applies to.</strong></p>
<p style="margin:0 0 8px">✍️ <strong>AI-written job posts</strong> — polished, professional, and optimized to attract quality candidates</p>
<p style="margin:0 0 8px">⚡ <strong>Submit details, get posts</strong> — turnaround within 24 hours</p>
<p style="margin:0 0 8px">📋 <strong>Multiple formats</strong> — Indeed, LinkedIn, and general-purpose versions</p>
<p style="margin:0 0 16px">✨ <strong>7-day free trial started</strong></p>
<p style="margin:0;color:#64748b;font-size:13px">Reply with your first job description and we'll have it polished by tomorrow.</p>`,
            }) }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Job Posting — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] job_posting_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── NEWSLETTER SERVICE — subscription ─────────────────────────────────
      if (meta.type === "newsletter_service_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("newsletter_service_clients").upsert({ email, contact_name: meta.name || null, business_name: meta.businessName || email, industry: meta.industry || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Newsletter Service is Active — First Issue Goes Out on the 1st", html: m2Email({
              greeting: `Hey${meta.name ? " " + meta.name : ""} —`,
              headline: "Your AI Newsletter Service is Active",
              body: `<p style="margin:0 0 12px"><strong>A professional newsletter your customers actually want to read.</strong></p>
<p style="margin:0 0 8px">📧 <strong>Monthly custom newsletter</strong> — written for ${meta.industry || "your industry"}, branded to your business</p>
<p style="margin:0 0 8px">🎯 <strong>Industry-relevant content</strong> — tips, trends, and insights your audience cares about</p>
<p style="margin:0 0 8px">📅 <strong>First issue</strong> — goes out on the 1st of next month</p>
<p style="margin:0 0 16px">✨ <strong>7-day free trial started</strong></p>
<p style="margin:0;color:#64748b;font-size:13px">You focus on running your business. We'll keep your customers engaged.</p>`,
            }) }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Newsletter Service — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] newsletter_service_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI REAL ESTATE NEWSLETTER — subscription ─────────────────────────
      if (meta.type === "re_newsletter") {
        try {
          const email = meta.customer_email || customerEmail;
          if (email) {
            const reSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            await (reSb.from as any)("re_newsletter_clients").insert({
              customer_email: email,
              customer_name: meta.customer_name || customerName || null,
              agent_name: meta.agent_name || null,
              brokerage: meta.brokerage || null,
              phone: meta.phone || null,
              website: meta.website || null,
              zip_codes: meta.zip_codes || null,
              brand_color: meta.brand_color || "#1a4a7a",
              stripe_subscription_id: session.subscription as string || null,
              subscription_status: "active",
            });
            if (RESEND_API_KEY && email) {
              await sendM2Email(
                email,
                "Your AI Real Estate Newsletter is Live — Upload Your Contacts",
                m2Email({
                  greeting: `Hey${meta.agent_name ? " " + meta.agent_name : ""} —`,
                  headline: "Your AI Real Estate Newsletter is Active",
                  body: `<p style="margin:0 0 12px"><strong>Every week, your contacts will receive a branded, hyper-local market report with your name on it.</strong> You look like the expert. Zero effort.</p>
<p style="margin:0 0 8px">&#128205; <strong>Zip codes:</strong> ${meta.zip_codes || "as configured"}</p>
<p style="margin:0 0 8px">&#128231; <strong>Delivery:</strong> Weekly market update newsletter to every contact you add</p>
<p style="margin:0 0 16px">&#128279; <strong>Next step:</strong> Log in to your dashboard and upload your contact list</p>
<p style="margin:0;color:#64748b;font-size:13px">The first newsletter goes out next cycle. Upload your contacts today so nobody gets left out.</p>`,
                  cta: {
                    text: "Upload Your Contacts Now",
                    url: "https://www.mattmichelstraining.com/real-estate-newsletter/dashboard",
                  },
                })
              );
              await notifyMatt(
                `New RE Newsletter — ${meta.agent_name || email} ($79/mo)`,
                `<p><strong>${meta.agent_name || email}</strong><br>Email: ${email}<br>Brokerage: ${meta.brokerage || "n/a"}<br>Zips: ${meta.zip_codes || "n/a"}</p>`
              );
            }
          }
        } catch (e) { console.error("[WEBHOOK] re_newsletter error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── PET MEMORIAL — one-time purchase ─────────────────────────────────
      if (meta.type === "pet_memorial") {
        try {
          const petName = meta.pet_name || "Unknown";
          const petEmail = meta.customer_email || customerEmail || "";
          const random4 = Math.floor(1000 + Math.random() * 9000).toString();
          const slugBase = petName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          const slug = `in-memory-of-${slugBase}-${random4}`;

          const { data: memorial } = await sb.from("pet_memorial_submissions").insert({
            pet_name: petName,
            pet_species: meta.pet_species || null,
            pet_breed: meta.pet_breed || null,
            pet_age: meta.pet_age || null,
            personality_traits: meta.personality_traits || null,
            favorite_memories: meta.favorite_memories || null,
            special_message: meta.special_message || null,
            customer_email: petEmail,
            customer_name: meta.customer_name || null,
            payment_status: "paid",
            active: true,
            stripe_session_id: session.id,
            memorial_url_slug: slug,
          }).select().single();

          console.log(`[WEBHOOK] Pet memorial created: ${memorial?.id} — ${petName}`);

          // Fire-and-forget: generate poem, tribute, and send email
          if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
            fetch(`${SUPABASE_URL}/functions/v1/generate-pet-memorial`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              },
              body: JSON.stringify({
                pet_name: petName,
                pet_species: meta.pet_species || "",
                pet_breed: meta.pet_breed || "",
                pet_age: meta.pet_age || "",
                personality_traits: meta.personality_traits || "",
                favorite_memories: meta.favorite_memories || "",
                special_message: meta.special_message || "",
                customer_email: petEmail,
                customer_name: meta.customer_name || "",
                submission_id: memorial?.id || null,
              }),
            }).catch((e) => console.error("[WEBHOOK] generate-pet-memorial fetch error:", e));
          }
        } catch (e) { console.error("[WEBHOOK] pet_memorial error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── INTERACTIVE PROGRAM — one-time purchase ───────────────────────────
      if (meta.type === "interactive_program" && meta.program_id && customerEmail) {
        try {
          const uid = await getUserIdByEmail(sb, customerEmail);
          if (uid && meta.program_id) {
            await sb.from("purchased_programs").insert({
              user_id: uid,
              program_title: meta.program_title || "Custom Program",
              program_type: "interactive",
              stripe_session_id: session.id,
            });
            await awardPts(sb, uid, "program_purchase", 100, `Purchased: ${meta.program_title || "Interactive Program"}`, session.id);
            await sb.from("notifications").insert({
              user_id: uid,
              type: "program_purchased",
              title: "Program Added to Portal",
              body: `Your "${meta.program_title || "Interactive Program"}" is now in your portal.`,
              link: "/dashboard",
            });
          }
          if (RESEND_API_KEY && customerEmail) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [customerEmail], bcc: ["matthewmichels4@gmail.com"], subject: `Your program is ready — ${meta.program_title || "Interactive Program"}`, html: `<p>Your interactive program has been added to your M² Portal. Log in to start training.</p><p>— Matt</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] interactive_program error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

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

      // ── UNIVERSAL B2B FULFILLMENT WRITER ───────────────────────────────────
      // Every agency subscription is written to b2b_clients + service_subscriptions
      // so they instantly appear in the Admin fulfillment CRM
      const AGENCY_SERVICE_LABELS: Record<string, string> = {
        contractor_lead_subscription: "Contractor Leads",
        b2b_database_subscription: "B2B Dental Database",
        gbp_saas_subscription: "GBP Automation",
        field_rep_subscription: "Field Rep AI Tools",
        social_media_subscription: "Social Media AI",
        missed_call_subscription: "Missed Call Text-Back",
        reputation_dashboard_subscription: "Reputation Management",
        ads_copy_subscription: "AI Ads Copy",
        voicemail_transcription_subscription: "Voicemail Transcription",
        contractor_invoicing_subscription: "Contractor Invoicing",
        phone_answering_subscription: "AI Phone Answering",
        text_marketing_subscription: "Text Message Marketing",
        blog_post_subscription: "AI Blog Posts",
        review_request_subscription: "Review Request SMS",
        press_release_subscription: "AI Press Release",
        quote_followup_subscription: "Quote Follow-Up SMS",
        social_captions_subscription: "AI Social Captions",
        caption_pack_subscription: "AI Social Captions",
        winback_sms_subscription: "Win-Back SMS",
        weekly_digest_subscription: "Weekly Business Digest",
        proposal_generator_subscription: "AI Proposal Generator",
        holiday_sms_subscription: "Holiday SMS Blast",
        website_copy_subscription: "AI Website Copy",
        faq_refresh_subscription: "Website Copy Refresh",
        competitor_watch_subscription: "Competitor Watch",
        appointment_reminder_subscription: "Appointment Reminders",
        video_script_subscription: "AI Video Scripts",
        satisfaction_survey_subscription: "Satisfaction Survey",
        thank_you_sms_subscription: "Thank-You SMS",
        estimate_generator_subscription: "AI Estimate Generator",
        local_seo_subscription: "Local SEO Pages",
        payment_chaser_subscription: "Payment Chaser",
        google_qa_subscription: "Google Q&A Manager",
        staff_newsletter_subscription: "Staff Newsletter",
        speed_lead_subscription: "Speed-to-Lead",
        welcome_drip_subscription: "Welcome Drip",
        review_alert_subscription: "Review Alerts",
        promo_planner_subscription: "Promo Planner",
        reactivation_email_subscription: "Reactivation Emails",
        sales_script_subscription: "AI Sales Scripts",
        direct_mail_subscription: "AI Direct Mail",
        warranty_reminder_subscription: "Warranty Reminders",
        hiring_assistant_subscription: "AI Hiring Assistant",
        job_posting_subscription: "AI Hiring Assistant",
        kpi_email_subscription: "KPI Email Dashboard",
        newsletter_service_subscription: "Field Rep Newsletter",
        review_responder_subscription: "Review Responder",
        seo_report_subscription: "SEO Report",
        chatbot_subscription: "AI Chatbot",
        obituary_service_subscription: "AI Obituary Service",
        sermon_prep_subscription: "Sermon Prep",
        hoa_secretary_subscription: "HOA Secretary AI",
        hoa_violation_subscription: "HOA Violation Letters",
        rfp_alerts_subscription: "RFP Alert Service",
        franchise_analyzer_subscription: "Franchise FDD Analyzer",
        insurance_drip_subscription: "Insurance Lead Drip",
        str_reputation_subscription: "STR Reputation Manager",
        grant_discovery_subscription: "Grant Discovery",
        ag_price_alerts_subscription: "Ag Price Alerts",
        landlord_letters_subscription: "Landlord-Tenant Letters",
        regulatory_monitor_subscription: "Regulatory Monitor",
        trade_show_automation_subscription: "Trade Show Follow-Up",
        price_intelligence_subscription: "Competitor Price Intel",
        citation_monitor_subscription: "Citation Monitor",
        menu_engineering_subscription: "Menu Engineering",
        fitness_reports_subscription: "Fitness Progress Reports",
        gov_meeting_tracker_subscription: "Gov Meeting Tracker",
        industrial_newsletter_subscription: "Industrial Newsletter",
        review_monitor_subscription: "Review Monitor",
        sms_blast_subscription: "Weekly SMS Blast",
        noshow_subscription: "No-Show Re-Booker",
        estimate_drip_subscription: "Estimate Follow-Up Drip",
        invoice_chaser_subscription: "Invoice Chaser",
        afterjob_drip_subscription: "After-Job Drip",
        promo_blaster_subscription: "Seasonal Promo Blaster",
        referral_program_subscription: "Referral Program",
        slow_day_subscription: "Slow Day SMS",
        homeowner_campaign_subscription: "New Homeowner Campaign",
        gbp_subscription: "GBP Management",
        social_media_subscription: "Social Media AI",
        web_design_build: "Web Design",
        web_design_retainer: "Web Design Retainer",
        linkedin_outreach_subscription: "AI LinkedIn Outreach",
        abandoned_cart_subscription: "AI Abandoned Cart Recovery",
        client_report_subscription: "AI Client Report Generator",
        restaurant_menu_subscription: "AI Restaurant Menu Copy",
        insurance_drip_subscription: "AI Insurance Follow-Up Drip",
        podcast_pitch_subscription: "AI Podcast Pitch Service",
        trade_show_followup_subscription: "AI Trade Show Follow-Up",
        testimonial_harvester_subscription: "AI Testimonial Harvester",
        new_mover_marketing_subscription: "AI New Mover Marketing",
        annual_review_subscription: "AI Annual Business Review",
        podcast_revenue_machine: "Podcast-to-Revenue Machine",
        gov_contract_monitor: "Government Contract Monitor",
        competitor_pricing: "Competitor Pricing Intelligence",
      };

      // ── COMPETITOR PRICING INTELLIGENCE ───────────────────────────────────
      if (meta.type === "competitor_pricing" && customerEmail) {
        try {
          const cpSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

          // Resolve user_id by email
          const { data: profileRows } = await cpSb
            .from("profiles")
            .select("user_id")
            .eq("email", customerEmail)
            .limit(1);
          const cpUserId = profileRows?.[0]?.user_id || null;

          // Insert client record
          await cpSb.from("competitor_pricing_clients" as any).insert({
            user_id: cpUserId,
            customer_email: customerEmail,
            customer_name: meta.customer_name || customerName || null,
            company_name: meta.company_name || null,
            industry: meta.industry || null,
            own_pricing_notes: meta.own_pricing_notes || null,
            stripe_subscription_id: session.subscription as string || null,
            subscription_status: "active",
          });

          // Welcome email
          if (RESEND_API_KEY) {
            await sendM2Email(
              customerEmail,
              "Your Competitor Pricing Intelligence is Active — Add Your Competitors Now",
              m2Email({
                greeting: `Hey${meta.customer_name ? " " + meta.customer_name : ""} —`,
                headline: "Your Competitor Pricing Monitor is Live",
                body: `<p style="margin:0 0 12px"><strong>We're ready to watch your competitors' pricing pages.</strong> Here's what happens next:</p>
<p style="margin:0 0 8px">&#128279; <strong>Add your competitor URLs</strong> — log into your dashboard and enter 3–10 competitor pricing pages. Takes 2 minutes.</p>
<p style="margin:0 0 8px">&#129302; <strong>AI scans every week</strong> — each URL is fetched and compared to the previous version. Any pricing change is flagged immediately.</p>
<p style="margin:0 0 8px">&#128203; <strong>Monday morning report</strong> — a clean email with what changed, before/after snapshots, and 3 AI recommendations lands in your inbox every week.</p>
<p style="margin:0 0 16px">&#9888;&#65039; <strong>Important:</strong> Scans won't begin until you add at least one competitor URL in your dashboard.</p>
<p style="margin:0;color:#64748b;font-size:13px">Questions? Reply to this email or text me. I read every message.</p>`,
                cta: { text: "Open Your Dashboard", url: "https://www.mattmichelstraining.com/competitor-pricing/dashboard" },
              })
            );
            await notifyMatt(
              `New Competitor Pricing Client — ${meta.company_name || customerEmail} ($149/mo)`,
              `<p><strong>${meta.company_name || customerEmail}</strong><br>Email: ${customerEmail}<br>Name: ${meta.customer_name || "n/a"}<br>Industry: ${meta.industry || "n/a"}<br>Pricing notes: ${meta.own_pricing_notes || "n/a"}</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] competitor_pricing error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── PODCAST REVENUE MACHINE ────────────────────────────────────────────
      if (meta.type === "podcast_revenue_machine" && customerEmail) {
        try {
          const podcastSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

          // Look up user_id by email (may be null if they haven't created an account yet)
          const { data: profileRows } = await podcastSb
            .from("profiles")
            .select("user_id")
            .eq("email", customerEmail)
            .limit(1);
          const podcastUserId = profileRows?.[0]?.user_id || null;

          // Insert client record
          const { data: podcastClient } = await podcastSb
            .from("podcast_clients" as any)
            .insert({
              user_id: podcastUserId,
              customer_email: customerEmail,
              customer_name: meta.customer_name || customerName || null,
              podcast_name: meta.podcast_name || null,
              rss_feed_url: meta.rss_feed_url,
              podcast_niche: meta.podcast_niche || null,
              target_audience: meta.target_audience || null,
              tone: meta.tone || "professional",
              stripe_subscription_id: session.subscription as string || null,
              subscription_status: "active",
            })
            .select()
            .single();

          // Welcome email to customer
          if (RESEND_API_KEY) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [customerEmail],
                bcc: ["matthewmichels4@gmail.com"],
                subject: `🎙️ Welcome to Podcast-to-Revenue Machine — you're all set`,
                html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
  <div style="background:#1a1a2e;padding:20px 28px;border-bottom:3px solid #FF6B35;">
    <p style="color:#FF6B35;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px;">M² Development · Podcast-to-Revenue Machine</p>
    <h1 style="color:#fff;margin:0;font-size:20px;font-family:Georgia,serif;">Welcome! Your RSS feed is connected.</h1>
  </div>
  <div style="padding:24px 28px;color:#1e293b;font-size:15px;line-height:1.8;">
    <p style="margin:0 0 16px;">Hey ${meta.customer_name || "there"} —</p>
    <p style="margin:0 0 16px;">We've connected to your RSS feed for <strong>${meta.podcast_name || "your podcast"}</strong>.</p>
    <p style="margin:0 0 16px;">Here's what happens next:</p>
    <div style="background:#f8fafc;border-left:3px solid #FF6B35;padding:16px 20px;margin:0 0 20px;border-radius:0 6px 6px 0;">
      <p style="margin:0 0 8px;font-size:14px;color:#1e293b;">🎙️ <strong>The next time you publish an episode</strong>, our system will automatically detect it — usually within 6 hours.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#1e293b;">✍️ <strong>Claude generates 5 content pieces</strong> — a blog post, LinkedIn post, email newsletter, YouTube description, and a Twitter/X thread.</p>
      <p style="margin:0;font-size:14px;color:#1e293b;">📬 <strong>Everything lands in your inbox</strong> — copy-paste ready, within hours of going live.</p>
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:#64748b;">You don't need to do anything. Just keep recording. We'll handle the repurposing.</p>
    <p style="margin:0 0 4px;">— Matt</p>
    <p style="margin:0;font-size:13px;color:#64748b;">M² Development · (313) 806-4952</p>
  </div>
  <div style="padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">M² Development · mattmichelstraining.com · Grosse Pointe, MI</p>
  </div>
</div></body></html>`,
              }),
            });

            // Notify Matt
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"],
                bcc: ["matthewmichels4@gmail.com"],
                subject: `🎙️ New Podcast Revenue Machine — ${meta.podcast_name || customerEmail} ($199/mo)`,
                html: `<p><strong>${meta.customer_name || "Unknown"}</strong><br>Email: ${customerEmail}<br>Podcast: ${meta.podcast_name || "n/a"}<br>RSS: ${meta.rss_feed_url}<br>Niche: ${meta.podcast_niche || "n/a"}<br>Tone: ${meta.tone || "professional"}</p>`,
              }),
            });
          }

          // Fire-and-forget initial RSS check
          if (podcastClient?.id) {
            fetch(`${SUPABASE_URL}/functions/v1/podcast-content-generator`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({ client_id: podcastClient.id }),
            }).catch((e) => console.error("[WEBHOOK] podcast initial check fire failed:", e));
          }

        } catch (e) { console.error("[WEBHOOK] podcast_revenue_machine error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (customerEmail && AGENCY_SERVICE_LABELS[meta.type]) {
        try {
          const serviceLabel = AGENCY_SERVICE_LABELS[meta.type];
          const clientRow = {
            business_name: meta.businessName || meta.business_name || customerName || customerEmail,
            owner_name: meta.name || meta.ownerName || customerName || null,
            email: customerEmail,
            phone: meta.phone || null,
            service_type: serviceLabel,
            stripe_customer_id: session.customer as string || null,
            stripe_subscription_id: session.subscription as string || null,
            fulfillment_stage: "New Lead - Action Required",
            active: true,
            metadata: meta,
            updated_at: new Date().toISOString(),
          };
          const { data: upserted } = await (sb.from as any)("b2b_clients")
            .upsert(clientRow, { onConflict: "email,service_type" })
            .select("id")
            .single();
          if (upserted?.id) {
            await (sb.from as any)("service_subscriptions").insert({
              client_id: upserted.id,
              email: customerEmail,
              service_type: serviceLabel,
              stripe_subscription_id: session.subscription as string || null,
              stripe_customer_id: session.customer as string || null,
              status: "active",
            });
          }
        } catch (e) { console.error("[WEBHOOK] b2b_clients fulfillment write error:", e); }
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [customerEmail], bcc: ["matthewmichels4@gmail.com"],
                subject: `Welcome to GBP Management — ${meta.business_name || "your business"}`,
                html: m2Email({
              greeting: "Hey — welcome to M² GBP Management.",
              headline: "Your Google Business Profile Management is Active",
              body: `<p style="margin:0 0 12px"><strong>Your Google presence is about to get a serious upgrade.</strong></p>
<p style="margin:0 0 8px">🗺️ <strong>Profile optimization</strong> — I'll review and optimize your entire GBP within 24 hours</p>
<p style="margin:0 0 8px">📸 <strong>Photo + post management</strong> — regular updates to keep your profile active and ranking</p>
<p style="margin:0 0 8px">⭐ <strong>Review strategy</strong> — help you get more 5-star reviews consistently</p>
<p style="margin:0 0 16px">📊 <strong>Monthly reporting</strong> — see exactly how your profile is performing</p>
<p style="margin:0 0 8px"><strong>What I need from you:</strong></p>
<ol style="margin:0 0 16px;padding-left:20px;color:#475569">
<li>Your Google Business Profile URL or business name as it appears on Google</li>
<li>Admin access to your GBP (I'll walk you through it if needed)</li>
</ol>
<p style="margin:0;color:#64748b;font-size:13px">Reply to this email or text me to get started. I'll have your profile optimized by tomorrow.</p>`,
            }),
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Site <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [customerEmail], bcc: ["matthewmichels4@gmail.com"],
                subject: `Camp Listing Received — ${meta.camp_name || "your camp"}`,
                html: `<p>Your listing for <strong>${meta.camp_name}</strong> has been received and is under review. It will go live within 24 hours.</p><p>— Matt Michels</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Site <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [customerEmail], bcc: ["matthewmichels4@gmail.com"],
                subject: `Payment received — ${meta.business_name || "your website"} is a go`,
                html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:32px;">
                  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
                    <div style="background:#e8621a;height:4px;"></div>
                    <div style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.9;">
                      <p>Hey ${meta.business_name ? `— ${meta.business_name}` : "there"} —</p>
                      <p><strong>Payment received. We're officially locked in.</strong></p>
                      <p>I'll be in touch within a few hours to kick things off. You'll get a quick intake form from me — takes about 5 minutes — so I can build exactly what you need.</p>
                      <p>Timeline: site live in 7 days from when I get your info back.</p>
                      <p>Questions? Email <a href="mailto:matt@mattmichelstraining.com" style="color:#e8621a;">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a> — whichever works best.</p>
                      <p>— Matt Michels</p>
                    </div>
                  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>
                </body></html>`,
              }),
            });
            // Notify Matt
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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

          // Track web design referral — credit $50 to referrer
          if (meta.referral_code && customerEmail) {
            try {
              const { data: refRow } = await sb
                .from("web_design_referrals" as any)
                .select("id, referrer_email, referrer_name, status")
                .eq("referral_code", meta.referral_code)
                .eq("status", "pending")
                .maybeSingle();

              if (refRow) {
                await sb.from("web_design_referrals" as any)
                  .update({
                    status: "credited",
                    stripe_session_id: session.id,
                    referred_email: customerEmail,
                    referred_business_name: meta.business_name || null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", (refRow as any).id);

                // Notify Matt to pay the referrer
                if (RESEND_API_KEY) {
                  await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      from: "M² System <matt@mattmichelstraining.com>",
                      to: ["matt@mattmichelstraining.com"],
                      bcc: ["matthewmichels4@gmail.com"],
                      subject: `💰 PAY $50 REFERRAL — ${(refRow as any).referrer_name || (refRow as any).referrer_email}`,
                      html: `<p><strong>Web design referral converted!</strong></p>
<p><strong>Referrer:</strong> ${(refRow as any).referrer_name || "Unknown"} (${(refRow as any).referrer_email})<br>
<strong>Client:</strong> ${meta.business_name || customerEmail}<br>
<strong>Amount owed:</strong> $50<br>
<strong>Pay via:</strong> Venmo/PayPal/Check to ${(refRow as any).referrer_email}</p>`,
                    }),
                  });

                  // Notify referrer
                  await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      from: "Matt Michels <matt@mattmichelstraining.com>",
                      to: [(refRow as any).referrer_email],
                      bcc: ["matthewmichels4@gmail.com"],
                      subject: "🎉 Your $50 referral bonus is on the way!",
                      html: `<p>Hey ${(refRow as any).referrer_name || "there"} —</p>
<p>Your referral just signed up for web design! Your <strong>$50 cash bonus</strong> will be sent within 7 days.</p>
<p>Keep referring — there's no limit. Every web design signup = another $50.</p>
<p>— Matt<br>(313) 806-4952</p>`,
                    }),
                  });
                }
                console.log(`[WEBHOOK] Web design referral credited: ${meta.referral_code} → $50 to ${(refRow as any).referrer_email}`);
              }
            } catch (refErr) { console.error("[WEBHOOK] web design referral tracking error:", refErr); }
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [customerEmail], bcc: ["matthewmichels4@gmail.com"],
                subject: `Monthly maintenance set up — ${meta.business_name || "your site"}`,
                html: m2Email({
              greeting: `Hey${meta.business_name ? " " + meta.business_name : ""} —`,
              headline: "Your Website Maintenance Plan is Active",
              body: `<p style="margin:0 0 12px"><strong>Your site is now fully covered.</strong> Here's what your $49/mo includes:</p>
<p style="margin:0 0 8px">🔒 <strong>Security monitoring</strong> — SSL, updates, and vulnerability scanning</p>
<p style="margin:0 0 8px">💾 <strong>Daily backups</strong> — your site is backed up every day, restorable anytime</p>
<p style="margin:0 0 8px">🔧 <strong>Content updates</strong> — need text changed, photos swapped, or a new section? Just text me</p>
<p style="margin:0 0 8px">📈 <strong>Uptime monitoring</strong> — if your site goes down, I know before you do</p>
<p style="margin:0 0 16px">📱 <strong>Direct access</strong> — text (313) 806-4952 or email anytime for changes</p>
<p style="margin:0;color:#64748b;font-size:13px">Your site stays live, fast, and looking good. That's the deal.</p>`,
            }),
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
              <p style="font-size:13px;color:#64748b;">Run this 2–3x/week before sport practice or as a standalone session. Master the movement quality before adding load. Questions? Email matt@mattmichelstraining.com or text (313) 806-4952.</p>
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
              <p style="font-size:13px;color:#64748b;">Run 2–3x/week. In-season: reduce volume by 30%, keep intensity. Off-season: push progressive overload on the big lifts (RDL, Split Squat, Trap Bar). Questions? Email matt@mattmichelstraining.com or text (313) 806-4952.</p>
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
              <p style="font-size:13px;color:#64748b;"><strong>Travel-day warmup protocol:</strong> 90/90 → World's Greatest → Wall Rotation → Glute Bridge March → done. Takes 8 minutes. Do it before competing or after a long drive. Questions? Email matt@mattmichelstraining.com or text (313) 806-4952.</p>
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
      <p style="margin-top:24px;">Questions on any of these? Email me at <a href="mailto:matt@mattmichelstraining.com" style="color:#e8621a;">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>
      <p>— Matt Michels</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
      M² Performance Training · <a href="mailto:matt@mattmichelstraining.com" style="color:#e8621a;">matt@mattmichelstraining.com</a> · <a href="tel:+13138064952" style="color:#94a3b8;">(313) 806-4952</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Matt Michels <matt@mattmichelstraining.com>",
              to: [customerEmail], bcc: ["matthewmichels4@gmail.com"],
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
          to: [customerEmail], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [customerEmail], bcc: ["matthewmichels4@gmail.com"],
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
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>
</body></html>`,
              }),
            });
            // Notify Matt
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [customerEmail], bcc: ["matthewmichels4@gmail.com"],
                subject: `Your B2B database is ready — ${nicheLabel}`,
                html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#e8621a;height:4px;"></div>
  <div style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.9;">
    <p>Hey —</p>
    <p>You now have access to the <strong>${nicheLabel}</strong> database. Browse, filter by state/city, and export to CSV anytime.</p>
    <p><a href="https://www.mattmichelstraining.com/b2b-leads" style="background:#e8621a;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Access Your Database →</a></p>
    <p>The database updates daily. You'll always have the freshest contacts. Questions? Email <a href="mailto:matt@mattmichelstraining.com" style="color:#e8621a;">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>
    <p>— Matt Michels</p>
  </div>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>
</body></html>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
                subject: `💰 New B2B database subscriber — ${customerEmail}`,
                html: `<p>New ${nicheLabel} subscriber: <strong>${customerEmail}</strong> at $149/month.</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] b2b_database_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── UNIFIED B2B CLIENT PIPELINE ──────────────────────────────────────
      // All B2B checkout types also feed into the unified b2b_clients + service_subscriptions tables
      const B2B_SERVICE_TYPES: Record<string, { label: string; price: number }> = {
        contractor_lead_subscription: { label: "Contractor Leads", price: 39900 },
        b2b_database_subscription: { label: "B2B Database", price: 14900 },
        gbp_saas_subscription: { label: "GBP Management", price: 4900 },
        social_media_subscription: { label: "Social Media AI", price: 19900 },
        web_design_subscription: { label: "Web Design", price: 49900 },
        blog_post_subscription: { label: "Blog Posts", price: 9900 },
        review_response_subscription: { label: "Review Response", price: 4900 },
        newsletter_service_subscription: { label: "Newsletter Service", price: 9900 },
        handbook_subscription: { label: "Employee Handbook", price: 9900 },
        grant_finder_subscription: { label: "Grant Finder", price: 14900 },
        battlecard_subscription: { label: "Competitive Battlecard", price: 3900 },
        hiring_assistant_subscription: { label: "Hiring Assistant", price: 7900 },
        ads_copy_subscription: { label: "Ads Copy", price: 9900 },
        linkedin_ghostwriting_subscription: { label: "LinkedIn Ghostwriting", price: 14900 },
        local_seo_subscription: { label: "Local SEO", price: 9900 },
        chatbot_subscription: { label: "AI Chatbot", price: 9900 },
        faq_refresh_subscription: { label: "FAQ Refresh", price: 4900 },
        caption_pack_subscription: { label: "Caption Pack", price: 2900 },
        direct_mail_subscription: { label: "Direct Mail", price: 9900 },
        kpi_email_subscription: { label: "KPI Reports", price: 4900 },
        meeting_prep_subscription: { label: "Meeting Prep", price: 7900 },
        market_intel_subscription: { label: "Market Intel", price: 14900 },
        competitor_watch_subscription: { label: "Competitor Watch", price: 9900 },
        google_qa_subscription: { label: "Google Q&A", price: 4900 },
        birthday_campaign_subscription: { label: "Birthday Campaign", price: 4900 },
        holiday_sms_subscription: { label: "Holiday SMS", price: 4900 },
        appointment_reminder_subscription: { label: "Appointment Reminders", price: 4900 },
        inventory_alert_subscription: { label: "Inventory Alerts", price: 4900 },
        directory_submitter_subscription: { label: "Directory Submitter", price: 4900 },
        estimate_generator_subscription: { label: "Estimate Generator", price: 9900 },
      };

      if (meta.type && B2B_SERVICE_TYPES[meta.type]) {
        try {
          const svcInfo = B2B_SERVICE_TYPES[meta.type];
          const clientEmail = meta.email || customerEmail;
          if (clientEmail) {
            // Upsert into unified b2b_clients
            const { data: existingClient } = await sb
              .from("b2b_clients" as any)
              .select("id")
              .eq("email", clientEmail)
              .maybeSingle();

            let clientId: string;
            if (existingClient) {
              clientId = existingClient.id;
              await sb.from("b2b_clients" as any).update({
                stripe_customer_id: (session.customer as string) || null,
                business_name: meta.businessName || meta.business_name || undefined,
                owner_name: meta.customer_name || meta.name || undefined,
                phone: meta.phone || undefined,
                website: meta.website || undefined,
                industry: meta.industry || meta.niche || undefined,
              }).eq("id", clientId);
            } else {
              const { data: newClient } = await sb.from("b2b_clients" as any).insert({
                email: clientEmail,
                business_name: meta.businessName || meta.business_name || clientEmail,
                owner_name: meta.customer_name || meta.name || null,
                phone: meta.phone || null,
                website: meta.website || null,
                industry: meta.industry || meta.niche || null,
                city: meta.city || null,
                state: meta.state || "MI",
                stripe_customer_id: (session.customer as string) || null,
                source: "checkout",
              }).select("id").single();
              clientId = newClient?.id;
            }

            if (clientId) {
              await sb.from("service_subscriptions" as any).insert({
                client_id: clientId,
                service_type: svcInfo.label,
                stripe_subscription_id: (session.subscription as string) || null,
                status: "active",
                fulfillment_stage: "New Lead - Action Required",
                monthly_price: svcInfo.price,
              });
              console.log(`[WEBHOOK] Unified pipeline: ${svcInfo.label} for ${clientEmail} → b2b_clients`);
            }
          }
        } catch (e) { console.error("[WEBHOOK] Unified b2b pipeline error:", e); }
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
            await sendM2Email(customerEmail, `Your Google Business Profile Automation is Live — ${meta.business_name || "your business"}`, m2Email({
              greeting: `Hey${meta.business_name ? " " + meta.business_name : ""} —`,
              headline: isPro ? "GBP Autopilot (Pro) is Active" : "GBP Autopilot (Basic) is Active",
              body: `<p style="margin:0 0 12px"><strong>Here's exactly what you're getting:</strong></p>
<p style="margin:0 0 8px">📅 <strong>${isPro ? "3 posts per week" : "3 posts per week"}</strong> — AI-written content goes live every Monday, Wednesday, and Friday</p>
<p style="margin:0 0 8px">🎯 <strong>Local & relevant</strong> — posts are written for ${meta.business_name || "your business"} in ${meta.city || "your city"}, not generic templates</p>
<p style="margin:0 0 8px">🔄 <strong>Content mix</strong> — seasonal tips, service highlights, community content, customer-focused posts, and soft CTAs</p>
${isPro ? `<p style="margin:0 0 8px">⭐ <strong>Review requests</strong> (Pro) — weekly review request emails to your customer list to grow your Google rating</p>` : ""}
<p style="margin:0 0 20px">📈 <strong>Why this works</strong> — Google rewards consistent activity on your Business Profile. Active profiles rank higher in local search. Most businesses post 0–1x/month. You'll post 12+ times a month automatically.</p>
<p style="margin:0 0 8px"><strong>⚡ One step to get started:</strong></p>
<p style="margin:0 0 4px">I need to connect your Google Business Profile. Takes 5 minutes. Two options:</p>
<ul style="margin:8px 0 16px;padding-left:20px;color:#475569">
<li>Text me at <a href="tel:+13138064952" style="color:#e8621a">(313) 806-4952</a> and I'll send you the connection link</li>
<li>Or reply to this email — I'll get it set up same day</li>
</ul>
<p style="margin:0;background:#f0fdf4;padding:12px;border-radius:6px;border:1px solid #bbf7d0;font-size:13px;color:#166534">✅ Your first post will go live within 24 hours of connecting your profile. You won't have to do anything after that.</p>`,
            }), "matthewmichels4@gmail.com");
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² System <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
                subject: `🔔 NEW — GBP SaaS: ${meta.business_name || customerEmail}`,
                html: `<p><strong>New GBP SaaS subscriber needs setup:</strong><br><strong>${meta.business_name}</strong> — ${customerEmail}<br>Plan: ${meta.plan} at $${meta.plan === "pro" ? "99" : "49"}/month.</p><p><a href="https://www.mattmichelstraining.com/admin" style="display:inline-block;background:#e8621a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">👉 Open Fulfillment Hub — Start Setup</a></p>`,
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your Field Rep AI Tools are ready",
                html: m2Email({
              greeting: `Hey${meta.name ? " " + meta.name : ""} —`,
              headline: "Your Field Rep AI Tools Are Ready",
              body: `<p style="margin:0 0 12px"><strong>4 AI tools built specifically for B2B field reps. Here's what you've got:</strong></p>
<p style="margin:0 0 8px">✉️ <strong>Cold Email Writer</strong> — paste a prospect's LinkedIn or website, get a personalized cold email in 10 seconds</p>
<p style="margin:0 0 8px">📞 <strong>Voicemail Script Builder</strong> — AI-generated voicemail scripts that actually get callbacks</p>
<p style="margin:0 0 8px">🛡️ <strong>Objection Handler</strong> — type the objection, get 3 proven responses instantly</p>
<p style="margin:0 0 16px">🗺️ <strong>Territory Planner</strong> — AI-optimized route and account prioritization</p>
<p style="margin:0 0 8px"><strong>How to access:</strong></p>
<ol style="margin:0 0 16px;padding-left:20px;color:#475569">
<li>Go to <a href="https://www.mattmichelstraining.com/field-rep-tools" style="color:#e8621a">mattmichelstraining.com/field-rep-tools</a></li>
<li>Enter the email you paid with (${meta.email || "this email"})</li>
<li>Start closing more deals</li>
</ol>
<p style="margin:0 0 12px;background:#fff7ed;padding:12px;border-radius:6px;border:1px solid #fed7aa;font-size:13px">💡 <strong>Pro tip from Matt:</strong> Start with the Cold Email Writer. Paste a prospect's LinkedIn URL and you'll have a personalized email ready to send in under 30 seconds. My field reps used this to book 3x more meetings.</p>`,
            }),
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
                subject: `💰 New Field Rep Tools subscriber — ${email}`,
                html: `<p>New $29/mo subscriber: <strong>${email}</strong><br>Subscription ID: ${session.subscription || "n/a"}</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] field_rep_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── LINKEDIN GHOSTWRITING — $299/mo subscription ─────────────────────
      if (meta.type === "linkedin_ghostwriting_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("linkedin_ghostwriting_clients")
              .update({
                active: true,
                stripe_customer_id: session.customer as string || null,
                stripe_subscription_id: session.subscription as string || null,
              })
              .eq("email", email);
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Welcome to LinkedIn Ghostwriting",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p>
<p>You're all set. Every Monday morning, you'll get 5 LinkedIn posts written in your voice and customized to your industry.</p>
<p>Your first batch goes out this Monday. Just copy, paste, and post throughout the week.</p>
<p>Not quite right? Reply to any weekly email with feedback and we'll adjust.</p>
<p>— Matt<br>(313) 806-4952</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
                subject: `💰 New LinkedIn Ghostwriting client — ${email}`,
                html: `<p>New $299/mo subscriber: <strong>${email}</strong><br>Industry: ${meta.industry || "not specified"}<br>Subscription ID: ${session.subscription || "n/a"}</p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] linkedin_ghostwriting_subscription error:", e); }
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
                stripe_customer_id: session.customer as string || null,
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your Social Media AI service is active",
                html: m2Email({
              greeting: `Hey${meta.name ? " " + meta.name : ""} —`,
              headline: "Your Social Media AI Service is Active",
              body: `<p style="margin:0 0 12px"><strong>Your ${meta.plan || "standard"} plan (${planPrice}/mo) is live.</strong> Here's what happens now:</p>
<p style="margin:0 0 8px">📱 <strong>3 platforms</strong> — Facebook, Instagram, and LinkedIn posting</p>
<p style="margin:0 0 8px">📅 <strong>3x per week</strong> — AI-generated posts go live Monday, Wednesday, Friday</p>
<p style="margin:0 0 8px">🎯 <strong>Industry-tailored</strong> — content written for ${meta.business_name || "your business"}, not generic templates</p>
<p style="margin:0 0 8px">📊 <strong>Content calendar</strong> — a mix of tips, behind-the-scenes, promotions, and engagement posts</p>
<p style="margin:0 0 16px">✨ <strong>First post timeline</strong> — within 48 hours of connecting your accounts</p>
<p style="margin:0 0 8px"><strong>⚡ One step needed — connect your accounts (takes 2 minutes):</strong></p>`,
              cta: { text: "Connect Your Social Accounts →", url: onboardingUrl },
            }),
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
                subject: `🔔 NEW — Social Media AI: ${meta.business_name || email} (${planPrice}/mo)`,
                html: `<p><strong>New Social Media AI subscriber needs setup:</strong><br><strong>${meta.business_name || email}</strong> — ${email}<br>Plan: ${meta.plan} at ${planPrice}/month.<br>Client ID: ${clientId || "unknown"}</p><p><a href="https://www.mattmichelstraining.com/admin" style="display:inline-block;background:#e8621a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">👉 Open Fulfillment Hub — Start Setup</a></p>`,
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your Review Responder is Active — One Quick Step to Go Live",
                html: m2Email({
              greeting: `Hey${meta.name ? " " + meta.name : ""} —`,
              headline: "Your Review Responder is Active",
              body: `<p style="margin:0 0 12px"><strong>Here's what this service does for you:</strong></p>
<p style="margin:0 0 8px">⭐ <strong>Monitors Google reviews</strong> — we check your profile multiple times per day for new reviews</p>
<p style="margin:0 0 8px">🤖 <strong>AI-written responses</strong> — every new review (positive or negative) gets a professional, personalized response within hours</p>
<p style="margin:0 0 8px">📊 <strong>Protects your reputation</strong> — fast responses show potential customers you're engaged and care. Google also rewards it with better local rankings.</p>
<p style="margin:0 0 20px">💬 <strong>Negative reviews handled carefully</strong> — AI de-escalates professionally, invites offline resolution, and never argues</p>
<p style="margin:0 0 8px"><strong>⚡ One step needed — connect your Google Business Profile:</strong></p>
<p style="margin:0 0 16px;color:#475569">Text Matt at <a href="tel:+13138064952" style="color:#e8621a">(313) 806-4952</a> or reply to this email — he'll send you the Google connection link within the hour. Setup takes 3 minutes.</p>
<p style="margin:0;background:#f0fdf4;padding:12px;border-radius:6px;border:1px solid #bbf7d0;font-size:13px;color:#166534">✅ Once connected, every new review gets responded to automatically — you never have to think about it again.</p>`,
            }),
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your Monthly SEO Report is Active — First Report Coming Within 24 Hours",
                html: m2Email({
              greeting: `Hey${meta.name ? " " + meta.name : ""} —`,
              headline: "Your SEO Reports Are Active",
              body: `<p style="margin:0 0 12px"><strong>Your first report lands in your inbox within 24 hours. Here's what you'll get every month:</strong></p>
<p style="margin:0 0 8px">🔍 <strong>Keyword Rankings</strong> — see exactly where you rank on Google for your most important local search terms, and whether you're moving up or down</p>
<p style="margin:0 0 8px">📈 <strong>Traffic Trends</strong> — month-over-month comparison of your site visits, where people are coming from, and what's driving the most leads</p>
<p style="margin:0 0 8px">🏆 <strong>Competitor Gap Analysis</strong> — what keywords your top 3 competitors rank for that you don't, with specific pages to create</p>
<p style="margin:0 0 8px">🔗 <strong>Backlink Summary</strong> — new links pointing to your site plus opportunities to build more authority</p>
<p style="margin:0 0 8px">⚡ <strong>Top 3 Priority Actions</strong> — every report ends with exactly what to do this month to move the needle, ranked by impact</p>
<p style="margin:0 0 20px">📅 <strong>Delivery schedule</strong> — your report arrives on the 1st of every month. First report within 24 hours.</p>
<p style="margin:0;background:#f0fdf4;padding:12px;border-radius:6px;border:1px solid #bbf7d0;font-size:13px;color:#166534">✅ No login required — your report comes straight to this email. Reply anytime with questions and I'll walk you through it.</p>`,
            }),
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your AI Chatbot is Active — We'll Have It Live on Your Site Within 48 Hours",
                html: m2Email({
              greeting: `Hey${meta.name ? " " + meta.name : ""} —`,
              headline: "Your AI Chatbot is Active",
              body: `<p style="margin:0 0 12px"><strong>Here's what your chatbot will do for your business:</strong></p>
<p style="margin:0 0 8px">💬 <strong>Answers questions 24/7</strong> — pricing, hours, services, location — instantly, even at 2am when you're asleep</p>
<p style="margin:0 0 8px">📞 <strong>Captures leads</strong> — collects name, phone, and what they need before they leave your site</p>
<p style="margin:0 0 8px">⚡ <strong>Responds in seconds</strong> — 78% of customers buy from the first business that responds. Your chatbot wins that race automatically.</p>
<p style="margin:0 0 20px">🎯 <strong>Trained on your business</strong> — we customize it with your services, hours, service area, and FAQs before going live</p>
<p style="margin:0 0 8px"><strong>What happens next — we handle everything:</strong></p>
<ol style="margin:8px 0 16px;padding-left:20px;color:#475569">
<li>Matt will email or text you within 24 hours to collect your business details (services, hours, FAQs)</li>
<li>We build and configure your chatbot (takes us 1 business day)</li>
<li>We install it on your website — you don't touch any code</li>
<li>We test it, then send you a "you're live" confirmation</li>
</ol>
<p style="margin:0;background:#f0fdf4;padding:12px;border-radius:6px;border:1px solid #bbf7d0;font-size:13px;color:#166534">✅ You don't need to install anything. We take care of setup and installation for you — start to finish.</p>`,
            }),
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
                subject: `🔔 NEW — AI Chatbot: ${meta.business_name || email}`,
                html: `<p><strong>New chatbot subscriber needs setup:</strong><br><strong>${meta.business_name || email}</strong> — ${email}<br>Client ID: <code>${clientId}</code></p><p><a href="https://www.mattmichelstraining.com/admin" style="display:inline-block;background:#e8621a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">👉 Open Fulfillment Hub — Start Setup</a></p>`,
              }),
            });
          }
        } catch (e) { console.error("[WEBHOOK] chatbot_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── REVIEW MONITOR — $29/mo ───────────────────────────────────────────
      if (meta.type === "review_monitor_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("review_monitor_clients" as any).upsert({
              email,
              business_name: meta.business_name || null,
              name: meta.name || null,
              phone: meta.phone || null,
              active: true,
              stripe_customer_id: session.customer as string || null,
            }, { onConflict: "email" });
            await sendM2Email(email, "You're set — Google Review Monitor is live",
              m2Email({
                greeting: `Hi ${meta.name || "there"},`,
                headline: "Your Review Monitor is Active",
                body: `<p>Great news — <strong>${meta.business_name || "your business"}</strong> is now being monitored for new Google reviews.</p>
<p><strong>Here's what happens next:</strong></p>
<ol style="margin:12px 0;padding-left:20px">
  <li style="margin-bottom:8px">Matt will connect your Google Business Profile within <strong>24 hours</strong></li>
  <li style="margin-bottom:8px">We check for new reviews <strong>4 times per day</strong> (every 6 hours)</li>
  <li style="margin-bottom:8px">The moment a new review appears, you get a <strong>text alert with the full review</strong></li>
  <li style="margin-bottom:8px">Every alert includes an <strong>AI-written response</strong> ready to copy and paste</li>
  <li style="margin-bottom:8px">Every Monday, a <strong>weekly digest email</strong> lands in your inbox</li>
</ol>
<p><strong>What you'll get in each alert:</strong></p>
<ul style="margin:12px 0;padding-left:20px">
  <li>Reviewer name + star rating</li>
  <li>Full review text</li>
  <li>Ready-to-post AI response (sounds personal, takes 10 seconds)</li>
</ul>
<p>Questions? Text or call anytime.</p>`,
                cta: { text: "Text Matt to Expedite Setup", url: "sms:+13138064952" },
              })
            );
            await notifyMatt(`💰 New Review Monitor client — ${meta.business_name || email} ($29/mo)`,
              `<p>New review monitor subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Phone: ${meta.phone || "n/a"}<br>Action: connect Google Business Profile.</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] review_monitor_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WEEKLY SMS BLAST — $19/mo ─────────────────────────────────────────
      if (meta.type === "sms_blast_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("sms_blast_clients" as any).upsert({
              email,
              business_name: meta.business_name || null,
              name: meta.name || null,
              phone: meta.phone || null,
              business_type: meta.business_type || null,
              city: meta.city || null,
              state: meta.state || "MI",
              active: true,
              stripe_customer_id: session.customer as string || null,
            }, { onConflict: "email" });
            await sendM2Email(email, "You're in — Weekly SMS Blast setup",
              m2Email({
                greeting: `Hi ${meta.name || "there"},`,
                headline: "Your Weekly SMS Blast is Set Up",
                body: `<p>Welcome aboard! <strong>${meta.business_name || "Your business"}</strong> is set up for weekly AI-written SMS blasts to your customer list.</p>
<p><strong>How it works:</strong></p>
<ol style="margin:12px 0;padding-left:20px">
  <li style="margin-bottom:8px">Reply to this email with your <strong>customer list (name + phone as a CSV or spreadsheet)</strong></li>
  <li style="margin-bottom:8px">Matt will import it securely within 24 hours, handle opt-outs, and stay FCC-compliant</li>
  <li style="margin-bottom:8px">Every <strong>Tuesday morning</strong>, AI generates a fresh 1–2 sentence tip, reminder, or offer tailored to your business and the season</li>
  <li style="margin-bottom:8px">Your entire list gets the text automatically — no logins, no dashboards, no clicking send</li>
</ol>
<p><strong>What makes the texts good:</strong> Every message is written for <em>your specific business type</em> and the current season. It sounds like you, not a robot.</p>
<p>Send your list and we'll get you live by this Tuesday.</p>`,
                cta: { text: "Email Your Customer List", url: "mailto:matt@mattmichelstraining.com?subject=SMS%20Blast%20Customer%20List" },
              })
            );
            await notifyMatt(`💰 New Weekly SMS Blast client — ${meta.business_name || email} ($19/mo)`,
              `<p>New SMS blast subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Business type: ${meta.business_type || "n/a"} · City: ${meta.city || "n/a"}<br>Action: import their customer list when received.</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] sms_blast_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── NO-SHOW RE-BOOKER — $29/mo ────────────────────────────────────────
      if (meta.type === "noshow_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("noshow_clients" as any).upsert({
              email,
              business_name: meta.business_name || null,
              name: meta.name || null,
              phone: meta.phone || null,
              booking_url: meta.booking_url || null,
              active: true,
              stripe_customer_id: session.customer as string || null,
            }, { onConflict: "email" });
            await sendM2Email(email, "7-Day Trial Started — No-Show Re-Booker",
              m2Email({
                greeting: `Hi ${meta.name || "there"},`,
                headline: "Your No-Show Re-Booker is Active",
                body: `<p>Welcome! <strong>${meta.business_name || "Your business"}</strong> is ready to automatically recover no-shows.</p>
<p><strong>Here's how it works:</strong></p>
<ol style="margin:12px 0;padding-left:20px">
  <li style="margin-bottom:8px">Matt will set up the <strong>webhook connection</strong> with your booking system within 24 hours</li>
  <li style="margin-bottom:8px">When a client no-shows or cancels, we wait <strong>30 minutes</strong></li>
  <li style="margin-bottom:8px">Then we send them a text: <em>"We missed you — want to reschedule?"</em></li>
  <li style="margin-bottom:8px">They reply, you get a booking. <strong>47% of no-shows reschedule when asked.</strong></li>
</ol>
<p><strong>The math:</strong> At $75–300 per appointment, recovering 2 no-shows per month more than pays for the subscription for the entire year.</p>
${meta.booking_url ? `<p>Your booking URL on file: <a href="${meta.booking_url}" style="color:#e8621a">${meta.booking_url}</a></p>` : ""}
<p>Matt will reach out within 24 hours to complete setup.</p>`,
              })
            );
            await notifyMatt(`💰 New No-Show Re-Booker client — ${meta.business_name || email} ($29/mo)`,
              `<p>New no-show subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Phone: ${meta.phone || "n/a"} · Booking URL: ${meta.booking_url || "none"}<br>Action: set up webhook with their booking system.</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] noshow_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── ESTIMATE DRIP — $49/mo ────────────────────────────────────────────
      if (meta.type === "estimate_drip_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("estimate_drip_clients" as any).upsert({
              email,
              business_name: meta.business_name || null,
              name: meta.name || null,
              phone: meta.phone || null,
              business_type: meta.business_type || null,
              active: true,
              stripe_customer_id: session.customer as string || null,
            }, { onConflict: "email" });
            await sendM2Email(email, "14-Day Trial Started — Estimate Follow-Up Drip",
              m2Email({
                greeting: `Hi ${meta.name || "there"},`,
                headline: "Your Estimate Follow-Up Drip is Live",
                body: `<p>Welcome! <strong>${meta.business_name || "Your business"}</strong> will now automatically follow up on every estimate you give.</p>
<p><strong>The 5-text sequence (per estimate logged):</strong></p>
<ul style="margin:12px 0;padding-left:20px">
  <li style="margin-bottom:6px"><strong>2 hours after:</strong> Warm thank-you + quick summary</li>
  <li style="margin-bottom:6px"><strong>Day 3:</strong> Value reminder, offer to answer questions</li>
  <li style="margin-bottom:6px"><strong>Day 7:</strong> Urgency nudge — "slot opening up next week"</li>
  <li style="margin-bottom:6px"><strong>Day 10:</strong> Objection handle — "if price is a concern..."</li>
  <li style="margin-bottom:6px"><strong>Day 14:</strong> Final check-in, low pressure</li>
</ul>
<p><strong>How to log an estimate:</strong> Matt will set up a simple intake form or webhook within 24 hours. You enter a name, phone number, and job type — the sequence fires automatically.</p>
<p>Every message is AI-written for your specific business type. If they book, the sequence stops automatically.</p>`,
              })
            );
            await notifyMatt(`💰 New Estimate Drip client — ${meta.business_name || email} ($49/mo)`,
              `<p>New estimate drip subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Business type: ${meta.business_type || "n/a"}<br>Action: set up intake webhook/form.</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] estimate_drip_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── INVOICE CHASER — $49/mo ───────────────────────────────────────────
      if (meta.type === "invoice_chaser_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("invoice_chaser_clients" as any).upsert({
              email,
              business_name: meta.business_name || null,
              name: meta.name || null,
              phone: meta.phone || null,
              active: true,
              stripe_customer_id: session.customer as string || null,
            }, { onConflict: "email" });
            await sendM2Email(email, "7-Day Trial Started — Invoice Chaser",
              m2Email({
                greeting: `Hi ${meta.name || "there"},`,
                headline: "Your Invoice Chaser is Ready",
                body: `<p>Welcome! <strong>${meta.business_name || "Your business"}</strong> will now automatically follow up on unpaid invoices.</p>
<p><strong>The 3-text sequence (per invoice logged):</strong></p>
<ul style="margin:12px 0;padding-left:20px">
  <li style="margin-bottom:6px"><strong>Day 7 past due:</strong> Friendly reminder — "just a quick heads up"</li>
  <li style="margin-bottom:6px"><strong>Day 14 past due:</strong> Firm second notice</li>
  <li style="margin-bottom:6px"><strong>Day 21 past due:</strong> Final notice with urgency</li>
</ul>
<p><strong>How to log an invoice:</strong> Matt will set up your intake form within 24 hours. You enter the customer name, phone, invoice amount, and due date — the sequence fires automatically on the right days.</p>
<p>When a customer pays (or you mark it paid), the sequence stops. No chasing required from you.</p>`,
              })
            );
            await notifyMatt(`💰 New Invoice Chaser client — ${meta.business_name || email} ($49/mo)`,
              `<p>New invoice chaser subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Action: set up intake form/webhook.</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] invoice_chaser_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AFTER-JOB DRIP — $39/mo ───────────────────────────────────────────
      if (meta.type === "afterjob_drip_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("afterjob_drip_clients" as any).upsert({
              email,
              business_name: meta.business_name || null,
              name: meta.name || null,
              phone: meta.phone || null,
              business_type: meta.business_type || null,
              active: true,
              stripe_customer_id: session.customer as string || null,
            }, { onConflict: "email" });
            await sendM2Email(email, "7-Day Trial Started — After-Job Follow-Up",
              m2Email({
                greeting: `Hi ${meta.name || "there"},`,
                headline: "Your After-Job Drip is Active",
                body: `<p>Welcome! Every completed job at <strong>${meta.business_name || "your business"}</strong> will now trigger a 3-text follow-up sequence automatically.</p>
<p><strong>The 3-text sequence (per job logged):</strong></p>
<ul style="margin:12px 0;padding-left:20px">
  <li style="margin-bottom:6px"><strong>Day 1:</strong> Warm, genuine thank-you text — customers remember this</li>
  <li style="margin-bottom:6px"><strong>Day 3:</strong> Friendly Google review ask — "takes 30 seconds, means a lot"</li>
  <li style="margin-bottom:6px"><strong>Day 30:</strong> Light upsell check-in — "any maintenance? Another project?"</li>
</ul>
<p><strong>How to log a completed job:</strong> Matt will set up a simple intake webhook within 24 hours. Log a job with the customer name, phone, and job type — the sequence fires automatically.</p>
<p>Every message is AI-written to sound like <em>you</em> — warm, local, human. Not corporate.</p>`,
              })
            );
            await notifyMatt(`💰 New After-Job Drip client — ${meta.business_name || email} ($39/mo)`,
              `<p>New after-job drip subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Business type: ${meta.business_type || "n/a"}<br>Action: set up job intake webhook.</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] afterjob_drip_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── PROMO BLASTER (Seasonal) — $29/mo ────────────────────────────────
      if (meta.type === "promo_blaster_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("promo_blaster_clients" as any).upsert({
              email,
              business_name: meta.business_name || null,
              name: meta.name || null,
              phone: meta.phone || null,
              business_type: meta.business_type || null,
              city: meta.city || null,
              state: meta.state || "MI",
              active: true,
              stripe_customer_id: session.customer as string || null,
            }, { onConflict: "email" });
            await sendM2Email(email, "14-Day Trial Started — Seasonal Promo Blasts",
              m2Email({
                greeting: `Hi ${meta.name || "there"},`,
                headline: "Your Seasonal Promos Are Scheduled",
                body: `<p>Welcome! <strong>${meta.business_name || "Your business"}</strong> is set up for 6 seasonal SMS promo blasts per year — fully automated.</p>
<p><strong>Your 6 campaigns:</strong></p>
<ul style="margin:12px 0;padding-left:20px">
  <li style="margin-bottom:6px">January — New Year Special</li>
  <li style="margin-bottom:6px">March — Spring Kickoff</li>
  <li style="margin-bottom:6px">May — Mother's Day</li>
  <li style="margin-bottom:6px">July — Summer Push</li>
  <li style="margin-bottom:6px">September — Fall Prep</li>
  <li style="margin-bottom:6px">November — Holiday Special</li>
</ul>
<p><strong>Next step:</strong> Reply to this email with your <strong>customer list (name + phone)</strong> and Matt will import it within 24 hours. Your first campaign fires at the next scheduled date automatically.</p>
<p>AI tailors each message to your specific business and location — sounds local, not generic.</p>`,
                cta: { text: "Send Your Customer List", url: "mailto:matt@mattmichelstraining.com?subject=Seasonal%20Promo%20Customer%20List" },
              })
            );
            await notifyMatt(`💰 New Seasonal Promo client — ${meta.business_name || email} ($29/mo)`,
              `<p>New promo blaster subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Business type: ${meta.business_type || "n/a"} · City: ${meta.city || "n/a"}<br>Action: import customer list when received.</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] promo_blaster_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── REFERRAL PROGRAM — $39/mo ─────────────────────────────────────────
      if (meta.type === "referral_program_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("referral_program_clients" as any).upsert({
              email,
              business_name: meta.business_name || null,
              name: meta.name || null,
              phone: meta.phone || null,
              business_type: meta.business_type || null,
              reward_description: meta.reward_description || null,
              active: true,
              stripe_customer_id: session.customer as string || null,
            }, { onConflict: "email" });
            await sendM2Email(email, "30-Day Trial Started — Referral Program",
              m2Email({
                greeting: `Hi ${meta.name || "there"},`,
                headline: "Your Referral Program is Live",
                body: `<p>Welcome! <strong>${meta.business_name || "Your business"}</strong> now has a fully automated referral program.</p>
<p><strong>Here's what Matt will set up within 24 hours:</strong></p>
<ol style="margin:12px 0;padding-left:20px">
  <li style="margin-bottom:8px">A unique referral link for your business</li>
  <li style="margin-bottom:8px">Automatic thank-you texts when a referral is logged</li>
  <li style="margin-bottom:8px">Reward notification texts when a referral converts</li>
  <li style="margin-bottom:8px">Monthly summary email: who referred who, top referrers, total referrals</li>
</ol>
${meta.reward_description ? `<p><strong>Your referral reward:</strong> ${meta.reward_description}</p>` : "<p><strong>Tip:</strong> The best referral rewards are simple — \"$25 off your next service for both of you\" works great.</p>"}
<p>83% of satisfied customers will refer someone — they just need to be asked and given an easy way to do it. We handle both.</p>`,
              })
            );
            await notifyMatt(`💰 New Referral Program client — ${meta.business_name || email} ($39/mo)`,
              `<p>New referral program subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Reward: ${meta.reward_description || "not set"}<br>Action: set up referral link and tracking.</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] referral_program_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── SLOW DAY SMS — $19/mo ─────────────────────────────────────────────
      if (meta.type === "slow_day_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("slow_day_clients" as any).upsert({
              email,
              business_name: meta.business_name || null,
              name: meta.name || null,
              phone: meta.phone || null,
              business_type: meta.business_type || null,
              promo_offer: meta.promo_offer || null,
              trigger_keyword: "SLOW",
              active: true,
              stripe_customer_id: session.customer as string || null,
            }, { onConflict: "email" });
            await sendM2Email(email, "7-Day Trial Started — Slow Day SMS Blast",
              m2Email({
                greeting: `Hi ${meta.name || "there"},`,
                headline: "Your Slow Day Blast is Ready",
                body: `<p>Welcome! <strong>${meta.business_name || "Your business"}</strong> is set up and ready to blast promos on demand.</p>
<p><strong>How to use it:</strong></p>
<ol style="margin:12px 0;padding-left:20px">
  <li style="margin-bottom:8px">Matt will set up your trigger number and import your contact list within 24 hours</li>
  <li style="margin-bottom:8px">Whenever business is slow, text <strong>"SLOW"</strong> to your M² number</li>
  <li style="margin-bottom:8px">AI generates a promo based on your business, the season, and your default offer</li>
  <li style="margin-bottom:8px">Your entire customer list gets the text within minutes</li>
  <li style="margin-bottom:8px">You get a confirmation: "✅ Blast sent to X customers"</li>
</ol>
${meta.promo_offer ? `<p><strong>Your default offer on file:</strong> "${meta.promo_offer}"</p>` : ""}
<p><strong>Next step:</strong> Reply with your <strong>customer list (name + phone)</strong> and Matt will get you live.</p>`,
                cta: { text: "Send Your Customer List", url: "mailto:matt@mattmichelstraining.com?subject=Slow%20Day%20Customer%20List" },
              })
            );
            await notifyMatt(`💰 New Slow Day SMS client — ${meta.business_name || email} ($19/mo)`,
              `<p>New slow day subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Phone: ${meta.phone || "n/a"} · Default offer: ${meta.promo_offer || "none"}<br>Action: set up trigger number, import contact list.</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] slow_day_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── NEW HOMEOWNER CAMPAIGN — $79/mo ───────────────────────────────────
      if (meta.type === "homeowner_campaign_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("homeowner_campaign_clients" as any).upsert({
              email,
              business_name: meta.business_name || null,
              name: meta.name || null,
              phone: meta.phone || null,
              business_type: meta.business_type || null,
              service_area: meta.service_area || null,
              active: true,
              stripe_customer_id: session.customer as string || null,
            }, { onConflict: "email" });
            await sendM2Email(email, "14-Day Trial Started — New Homeowner Campaign",
              m2Email({
                greeting: `Hi ${meta.name || "there"},`,
                headline: "Your New Homeowner Campaign is Live",
                body: `<p>Welcome! <strong>${meta.business_name || "Your business"}</strong> will now reach new homeowners in your service area every month — automatically.</p>
<p><strong>Here's what happens:</strong></p>
<ol style="margin:12px 0;padding-left:20px">
  <li style="margin-bottom:8px">Matt will configure your service area${meta.service_area ? ` (${meta.service_area})` : ""} within 24–48 hours</li>
  <li style="margin-bottom:8px">Each month, we pull recent property sale records in your zip codes</li>
  <li style="margin-bottom:8px">New homeowners receive a <strong>personalized welcome text</strong> from your business</li>
  <li style="margin-bottom:8px">You're first in their phone before they've picked any service providers</li>
</ol>
<p><strong>Why this works:</strong> New homeowners spend $10,000–$15,000 in their first year on home services. They haven't established relationships yet. Reaching them in the first 30 days means you're their go-to provider for the next 10+ years.</p>
<p>Matt will reach out within 48 hours to finalize your service area and first campaign.</p>`,
              })
            );
            await notifyMatt(`💰 New Homeowner Campaign client — ${meta.business_name || email} ($79/mo)`,
              `<p>New homeowner campaign subscriber: <strong>${meta.business_name || email}</strong> — ${email}<br>Business type: ${meta.business_type || "n/a"} · Service area: ${meta.service_area || "not set"}<br>Action: configure service area, pull new mover data.</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] homeowner_campaign_subscription error:", e); }

      // ── 18 New Autonomous Products ──────────────────────────────────
      const newProductHandlers: Array<[string, string, string, number]> = [
        ["obituary_service_subscription", "obituary_clients", "funeral_home_name", 19900],
        ["sermon_prep_subscription", "sermon_prep_clients", "church_name", 7900],
        ["hoa_secretary_subscription", "hoa_secretary_clients", "hoa_name", 14900],
        ["hoa_violation_subscription", "hoa_violation_clients", "hoa_name", 14900],
        ["rfp_alerts_subscription", "rfp_alert_clients", "business_name", 14900],
        ["franchise_analyzer_subscription", "franchise_analyzer_clients", "business_name", 29900],
        ["insurance_drip_subscription", "insurance_drip_clients", "business_name", 14900],
        ["str_reputation_subscription", "str_reputation_clients", "contact_name", 7900],
        ["grant_discovery_subscription", "grant_discovery_clients", "org_name", 19900],
        ["ag_price_alerts_subscription", "ag_price_alert_clients", "business_name", 7900],
        ["landlord_letters_subscription", "landlord_letter_clients", "contact_name", 14900],
        ["regulatory_monitor_subscription", "regulatory_monitor_clients", "business_name", 29900],
        ["trade_show_automation_subscription", "trade_show_clients", "business_name", 9900],
        ["price_intelligence_subscription", "price_intelligence_clients", "business_name", 19900],
        ["citation_monitor_subscription", "citation_monitor_clients", "business_name", 9900],
        ["menu_engineering_subscription", "menu_engineering_clients", "restaurant_name", 9900],
        ["fitness_reports_subscription", "fitness_report_clients", "business_name", 7900],
        ["gov_meeting_tracker_subscription", "gov_meeting_tracker_clients", "business_name", 19900],
      ];

      for (const [metaType, tableName, nameField, price] of newProductHandlers) {
        if (meta.type === metaType) {
          try {
            const upsertData: Record<string, unknown> = {
              email: customerEmail,
              contact_name: meta.name || null,
              phone: meta.phone || null,
              active: true,
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: customerId,
            };
            upsertData[nameField] = meta.businessName || meta.orgName || meta.funeralHomeName || meta.hoaName || meta.churchName || meta.restaurantName || meta.name || null;
            await sb.from(tableName).upsert(upsertData, { onConflict: "email" });
            const label = AGENCY_SERVICE_LABELS[metaType] || metaType;
            const priceStr = `$${(price/100).toFixed(0)}/mo`;
            await sendM2Email(
              customerEmail,
              `Welcome to M² ${label}`,
              m2Email(
                `You're in — ${label} is active.`,
                `Matt will reach out within 24 hours to complete your setup. Everything runs automatically from there.`,
                customerEmail
              )
            );
            await notifyMatt(
              `New ${label} Subscriber`,
              `<p>${customerEmail} (${meta.name || "—"}) subscribed to ${label} at ${priceStr}.</p>`
            );
          } catch (e) { console.error(`[WEBHOOK] ${metaType} error:`, e); }
        }
      }

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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "You're subscribed to the Industrial Sales Newsletter",
                html: m2Email({
              greeting: `Hey${meta.name ? " " + meta.name : ""} —`,
              headline: "Welcome to the Industrial Sales Newsletter",
              body: `<p style="margin:0 0 12px"><strong>Real B2B sales intel. No fluff. Every Monday.</strong></p>
<p style="margin:0 0 8px">📰 <strong>Weekly issue</strong> — drops every Monday at 8am ET</p>
<p style="margin:0 0 8px">🏭 <strong>Industrial focus</strong> — strategies specific to manufacturing, industrial, and B2B markets</p>
<p style="margin:0 0 8px">🛠️ <strong>Tool spotlights</strong> — the best AI and sales tools to close more deals</p>
<p style="margin:0 0 16px">💡 <strong>Matt's field notes</strong> — 10 years of B2B door-knocking distilled into actionable tips</p>
<p style="margin:0;color:#64748b;font-size:13px">First issue arrives this Monday. Reply anytime — I read every response.</p>`,
            }),
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your Missed Call Text-Back is being set up",
                html: m2Email({
              greeting: `Hey${meta.name ? " " + meta.name : ""} —`,
              headline: "Your Missed Call Text-Back is Being Set Up",
              body: `<p style="margin:0 0 12px"><strong>Every missed call is a potential customer walking away. Not anymore.</strong></p>
<p style="margin:0 0 8px">📱 <strong>How it works:</strong> Someone calls your business and you can't answer → they instantly get a text: <em>"Hey, sorry I missed your call! I'll get right back to you."</em></p>
<p style="margin:0 0 8px">⚡ <strong>Instant response</strong> — text fires within seconds of the missed call</p>
<p style="margin:0 0 8px">🔄 <strong>24/7 coverage</strong> — works nights, weekends, holidays</p>
<p style="margin:0 0 8px">📊 <strong>Lead capture</strong> — every missed call + text is logged for follow-up</p>
<p style="margin:0 0 16px">✨ <strong>7-day free trial</strong> — your trial has started</p>
<p style="margin:0 0 8px"><strong>Setup (5 minutes):</strong></p>
<ol style="margin:0 0 16px;padding-left:20px;color:#475569">
<li>Matt will text you within 24 hours to set up call forwarding</li>
<li>You forward missed calls to your new M² number</li>
<li>That's it — missed calls now get instant texts, automatically</li>
</ol>`,
            }),
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
                subject: `🔔 NEW — Missed Call SMS: ${meta.businessName || email}`,
                html: `<p><strong>New Missed Call subscriber needs setup:</strong><br><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p><p><a href="https://www.mattmichelstraining.com/admin" style="display:inline-block;background:#e8621a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">👉 Open Fulfillment Hub — Start Setup</a></p>`,
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your AI Reputation Dashboard is being set up",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for the AI Reputation Dashboard ($79/mo). Your 7-day free trial has started.</p><p>Within 24 hours you'll receive your first weekly report covering your Google, Yelp, Facebook, and BBB reviews — with AI-generated response suggestions for anything that needs attention.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your AI Google Ads Copy is being generated",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Google Ads Copy Generator ($39/mo). Your 7-day free trial has started.</p><p>Within 24 hours you'll receive your first batch of 10 AI-generated Google Ads copy variations for <strong>${meta.businessName || "your business"}</strong> in ${meta.city || "your area"} — ready to paste straight into Google Ads.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your AI Voicemail Transcription is being set up",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Voicemail Transcription ($49/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to complete the setup — it takes about 10 minutes. After that, every voicemail left on your business line gets instantly transcribed and summarized via text and email.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your Automated Invoicing is ready",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Automated Contractor Invoicing ($29/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to get your first invoice template set up. After that, creating and sending a professional invoice with a Stripe payment link takes about 30 seconds.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your AI Phone Answering service is being set up",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Phone Answering ($149/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to get your custom greeting and call script set up. After that, every call to your business number gets answered by AI — 24/7, never misses a lead.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email], bcc: ["matthewmichels4@gmail.com"],
                subject: "Your Text Message Marketing is being set up",
                html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Text Message Marketing ($79/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to set up your dedicated SMS number and import your first contact list. Your first AI-written campaign will go out within the week.</p><p>Questions? Reply here or text (313) 806-4952.</p><p>— Matt</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M² Notifications <matt@mattmichelstraining.com>",
                to: ["matthewmichels@mattmichelstraining.com", "matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Blog Posts are being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Blog Post Service ($79/mo). Your 7-day free trial has started.</p><p>Your first 4 blog posts will be emailed to you this Monday — ready to publish, no editing needed.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Blog Post client — ${meta.businessName || email} ($79/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>Website: ${meta.website || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Review Request SMS is being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Review Request SMS ($39/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to get your Twilio number assigned. After setup, submit a customer's phone number after each job and they'll automatically get a review request text.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Review Request client — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Google Review URL: ${meta.googleReviewUrl || "n/a"}</p><p>Setup: assign Twilio number → update review_request_clients row → activate.</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your first AI Press Release is being written", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Press Release Service ($39/mo). Your 7-day free trial has started.</p><p>Your first press release will arrive in your inbox on the 1st of next month — formatted and ready to submit to local media and PR sites.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Press Release client — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>City: ${meta.city || "n/a"}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Quote Follow-Up SMS is being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Quote Follow-Up SMS ($49/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to assign your Twilio number. After setup, submit a prospect's name and phone to your portal and our AI sends a 3-text follow-up sequence automatically.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Quote Follow-Up client — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p><p>Setup: assign Twilio number → update quote_followup_clients row → activate.</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your first Social Caption Pack is being written", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Social Caption Pack ($29/mo). Your 7-day free trial has started.</p><p>Your first pack of 30 captions will arrive on the 1st of next month. All you have to do is copy, paste, and post.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Social Captions client — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>Platforms: ${meta.platforms || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Win-Back SMS campaign is being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Customer Win-Back SMS ($49/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to get your Twilio number assigned and import your first customer list. Your first campaign goes out on the 5th of next month.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Win-Back SMS client — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p><p>Setup: assign Twilio number → import contacts into winback_sms_contacts → update winback_sms_clients row → activate.</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your first Weekly Business Digest arrives Monday", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Weekly Business Digest ($29/mo). Your 7-day free trial has started.</p><p>Every Monday morning you'll get 3 actionable tips specific to the ${meta.industry || "your"} industry — ready to implement that week.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Weekly Digest client — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Proposal Generator is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Proposal Generator ($49/mo). Your 7-day free trial has started.</p><p>To generate your first proposal: go to mattmichelstraining.com/ai-proposal-portal, fill in your project details, and your polished proposal arrives by email in under 2 minutes.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Proposal Generator client — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Holiday SMS Blasts are being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Holiday SMS Blast ($39/mo). Your 7-day free trial has started.</p><p>Matt will reach out within 24 hours to assign your SMS number and import your customer list. Your first holiday blast will go out automatically on the next upcoming holiday.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Holiday SMS client — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p><p>Setup: assign Twilio number → import contacts into holiday_sms_contacts → update holiday_sms_clients row → activate.</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your first Website Copy Refresh arrives the 1st", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Website Copy Refresh ($49/mo). Your 7-day free trial has started.</p><p>On the 1st of every month you'll receive a fresh homepage hero, 3 value props, and 6 updated FAQs — ready to paste into your website.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Website Copy client — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>Website: ${meta.website || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Competitor Watch is active", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Competitor Watch ($69/mo). 7-day trial started.</p><p>Your first weekly competitor report arrives within 7 days — covering pricing changes, new reviews, and online moves from your top competitors.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Competitor Watch — ${meta.businessName || email} ($69/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Appointment Reminders are being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Appointment Reminder SMS ($39/mo). 7-day trial started.</p><p>Matt will reach out within 24 hours to connect your scheduling system. After that, every appointment gets a 24hr + 1hr SMS reminder automatically.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Appointment Reminders — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p><p>Buy a Twilio number, update appointment_reminder_clients row.</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your first 8 video scripts are on the way", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Video Script Writer ($39/mo). 7-day trial started.</p><p>Your first batch of 8 short-form video scripts optimized for TikTok and Reels will arrive within a week.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Video Script client — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Customer Satisfaction Surveys are live", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Customer Satisfaction Surveys ($29/mo). 7-day trial started.</p><p>After each job, submit the customer's phone and we auto-text them a quick satisfaction check. Monthly NPS report emailed to you.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Satisfaction Survey — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Thank You texts are ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Thank You Text ($19/mo). 7-day trial started.</p><p>After each customer visit, submit their phone number and our AI writes and sends a personalized thank-you text instantly.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Thank You SMS — ${meta.businessName || email} ($19/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Estimate Generator is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Estimate Generator ($49/mo). 7-day trial started.</p><p>Submit project details through your portal and get a professional estimate emailed to you and your prospect in minutes.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Estimate Generator — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your first Local SEO page is being written", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Local SEO Pages ($59/mo). 7-day trial started.</p><p>On the 1st of every month you'll get a city-specific landing page with H1, sections, FAQ, and meta description — ready to add to your site.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Local SEO — ${meta.businessName || email} ($59/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}<br>Website: ${meta.website || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Late Payment Chaser is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Late Payment Chaser ($29/mo). 7-day trial started.</p><p>Submit overdue invoices and we auto-send professional reminders at 3, 7, 14, and 30 days via SMS and email.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Payment Chaser — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Google Q&A Manager is live", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Google Q&A Manager ($29/mo). 7-day trial started.</p><p>Every week you'll get 5 AI-written Q&A pairs optimized for your Google Business Profile. Post them and watch your ranking improve.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Google Q&A — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Staff Newsletter starts Monday", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Staff Internal Newsletter ($29/mo). 7-day trial started.</p><p>Every Monday you'll get a ready-to-forward newsletter for your team: industry news, safety tips, motivational content.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Staff Newsletter — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Speed-to-Lead SMS is being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Speed-to-Lead SMS ($39/mo). 7-day trial started.</p><p>Matt will reach out within 24 hours to connect your website forms. After that, every form fill gets an instant SMS within 60 seconds.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Speed-to-Lead — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p><p>Buy Twilio number, add webhook to their site forms.</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Welcome Drip sequence is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Email Welcome Drip ($49/mo). 7-day trial started.</p><p>Add new customers to the system and they'll automatically receive a 5-email welcome sequence over 15 days — building trust and driving referrals.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Welcome Drip — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Review Alerts are active", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Review Alert SMS ($19/mo). 7-day trial started.</p><p>Every time a new review is posted on your Google profile, you'll get an instant text so you can respond fast.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Review Alert — ${meta.businessName || email} ($19/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your first Promo Calendar is on the way", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Seasonal Promo Planner ($39/mo). 7-day trial started.</p><p>On the 1st of every month you'll get a full promotional calendar: 4 weeks of campaigns tied to real holidays and seasons, with copy ready to go.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Promo Planner — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Customer Reactivation emails are set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Customer Reactivation ($39/mo). 7-day trial started.</p><p>Upload your lapsed customer list and every month we send personalized "we miss you" emails to bring them back.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Reactivation Email — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your first Sales Scripts are being written", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Sales Script Generator ($29/mo). 7-day trial started.</p><p>Every month you'll get 3 updated phone scripts: cold call opener, follow-up, and objection handling — tailored to your industry.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Sales Scripts — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your first Direct Mail postcard is being designed", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Direct Mail Copy ($49/mo). 7-day trial started.</p><p>Every month you'll get a print-ready postcard design with headline, body copy, and CTA. Just send it to your printer and you're done.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Direct Mail — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your Warranty Reminders are being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Warranty Reminder SMS ($29/mo). 7-day trial started.</p><p>Upload your customer warranty list and we'll auto-text them 30 days before expiry — turning warranty expirations into booked service calls.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Warranty Reminder — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Hiring Assistant is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Hiring Assistant ($49/mo). 7-day trial started.</p><p>Submit resumes and job descriptions. AI scores each candidate 1-10, lists strengths/weaknesses, and auto-emails qualified applicants to schedule interviews.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Hiring Assistant — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>City: ${meta.city || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your weekly KPI emails start Monday", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for Business KPI Weekly Email ($49/mo). 7-day trial started.</p><p>Every Monday you'll get a performance snapshot with AI-recommended actions for the week based on your industry benchmarks.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New KPI Email — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}<br>Website: ${meta.website || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] kpi_email_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // caption_pack_subscription (create-caption-pack-checkout)
      if (meta.type === "caption_pack_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("social_captions_clients").upsert({
              email, business_name: meta.businessName || email,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "matt@mattmichelstraining.com", to: email, subject: "Welcome to AI Social Captions!", html: `<p>You're all set! Your AI social captions service is active.</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "matt@mattmichelstraining.com", to: "matt@mattmichelstraining.com", subject: "New Social Captions Client", html: `<p>New caption_pack_subscription: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] caption_pack_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // faq_refresh_subscription (create-faq-refresh-checkout)
      if (meta.type === "faq_refresh_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("website_copy_clients").upsert({
              email, business_name: meta.businessName || email,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "matt@mattmichelstraining.com", to: email, subject: "Welcome — Website Copy Refresh!", html: `<p>Your AI website copy refresh service is active.</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "matt@mattmichelstraining.com", to: "matt@mattmichelstraining.com", subject: "New FAQ/Copy Refresh Client", html: `<p>New faq_refresh_subscription: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] faq_refresh_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // job_posting_subscription (create-job-posting-checkout)
      if (meta.type === "job_posting_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("hiring_assistant_clients").upsert({
              email, business_name: meta.businessName || email,
              active: true, stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "matt@mattmichelstraining.com", to: email, subject: "Welcome — AI Hiring Assistant!", html: `<p>Your AI hiring assistant service is active.</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "matt@mattmichelstraining.com", to: "matt@mattmichelstraining.com", subject: "New Hiring Assistant Client", html: `<p>New job_posting_subscription: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] job_posting_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // newsletter_service_subscription (create-newsletter-service-checkout)
      if (meta.type === "newsletter_service_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("newsletter_subscribers").upsert({
              email, active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "matt@mattmichelstraining.com", to: email, subject: "Welcome to the Field Rep Newsletter!", html: `<p>You're subscribed! Your first digest arrives Monday morning.</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "matt@mattmichelstraining.com", to: "matt@mattmichelstraining.com", subject: "New Newsletter Subscriber", html: `<p>New newsletter_service_subscription: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] newsletter_service_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // interactive_program (create-program-checkout)
      if (meta.type === "interactive_program") {
        try {
          const email = meta.email || customerEmail;
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "matt@mattmichelstraining.com", to: "matt@mattmichelstraining.com", subject: "New Interactive Program Purchase", html: `<p>New interactive_program purchase: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] interactive_program error:", e); }
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Onboarding Agent is being configured", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Customer Onboarding Agent ($59/mo). 7-day trial started.</p><p>Matt will reach out within 24 hours to connect your customer intake system. After that, every new customer gets a personalized welcome sequence automatically.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Onboarding Agent — ${meta.businessName || email} ($59/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Social Proof Collector is being set up", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Social Proof Collector ($39/mo). 7-day trial started.</p><p>Matt will reach out within 24 hours to configure your SMS number. After that, every completed job triggers an automatic review request.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Social Proof — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Price Monitor is active", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Competitor Price Monitor ($49/mo). 7-day trial started.</p><p>Your first competitor pricing report will arrive within 7 days. Weekly reports every Monday after that.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Price Monitor — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Meeting Prep Agent is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Meeting Prep ($29/mo). 7-day trial started.</p><p>Submit a prospect company name anytime and get a one-page briefing within minutes — talking points, pain points, and a custom opener.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Meeting Prep — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Industry: ${meta.industry || "n/a"}</p>` }) });
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
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your first Directory Audit is on the way", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Directory Submitter ($39/mo). 7-day trial started.</p><p>Your first audit of 20+ directories will arrive within 7 days. Monthly audits on the 1st after that.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Directory Submitter — ${meta.businessName || email} ($39/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Address: ${meta.address || "n/a"}<br>Phone: ${meta.phone || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] directory_submitter_subscription error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── PERMIT MONITOR — subscription ────────────────────────────────────
      if (meta.type === "permit_monitor_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("permit_monitor_clients").upsert({ email, business_name: meta.businessName || email, industry: meta.industry || null, city: meta.city || null, active: true }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Permit Monitor is active", html: `<p>Hey,</p><p>You're signed up for AI Permit & License Monitor ($79/mo). 7-day trial started.</p><p>Your first permit compliance digest arrives within 7 days.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Permit Monitor — ${meta.businessName || email} ($79/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] permit_monitor error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── OSHA COMPLIANCE — subscription ────────────────────────────────────
      if (meta.type === "osha_compliance_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("osha_compliance_clients").upsert({ email, business_name: meta.businessName || email, industry: meta.industry || null, employee_count: parseInt(meta.employeeCount) || null, active: true }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Safety Compliance Checker is active", html: `<p>Hey,</p><p>You're signed up for AI OSHA/Safety Compliance ($99/mo). 7-day trial started.</p><p>Your first monthly safety checklist arrives within 7 days.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New OSHA Compliance — ${meta.businessName || email} ($99/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] osha_compliance error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── COLLECTIONS — subscription ────────────────────────────────────────
      if (meta.type === "collections_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("collections_clients").upsert({ email, business_name: meta.businessName || email, industry: meta.industry || null, active: true }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Late Payment Collector is active", html: `<p>Hey,</p><p>You're signed up for AI Late Payment Collector ($49/mo). 7-day trial started.</p><p>Upload your overdue accounts and we'll start generating collection letters immediately.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Collections — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] collections error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── INVENTORY ALERT — subscription ────────────────────────────────────
      if (meta.type === "inventory_alert_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("inventory_alert_clients").upsert({ email, business_name: meta.businessName || email, industry: meta.industry || null, active: true }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Inventory Alerts are active", html: `<p>Hey,</p><p>You're signed up for AI Inventory Reorder Alerts ($49/mo). 7-day trial started.</p><p>Add your inventory items and par levels to start receiving alerts.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Inventory Alerts — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] inventory_alert error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── BIRTHDAY CAMPAIGN — subscription ──────────────────────────────────
      if (meta.type === "birthday_campaign_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("birthday_campaign_clients").upsert({ email, business_name: meta.businessName || email, industry: meta.industry || null, active: true }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Birthday Campaign is active", html: `<p>Hey,</p><p>You're signed up for AI Birthday/Anniversary Campaign ($29/mo). 7-day trial started.</p><p>Upload your customer list with birthdays and we'll handle the rest.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Birthday Campaign — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] birthday_campaign error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── MED SPA MARKETING — subscription ─────────────────────────────────
      if (meta.type === "med_spa_marketing") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("med_spa_marketing_clients").upsert({ email, business_name: meta.businessName || email, contact_name: meta.name || null, city: meta.city || null, services: meta.services || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Med Spa Marketing is live", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Med Spa Marketing ($149/mo). Your 7-day free trial has started.</p><p>We'll reach out within 24 hours to get your brand info. Your first week of content goes out soon.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Med Spa Marketing — ${meta.businessName || email} ($149/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>City: ${meta.city || "n/a"}<br>Services: ${meta.services || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] med_spa_marketing error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── REAL ESTATE DRIP — subscription ──────────────────────────────────
      if (meta.type === "real_estate_drip") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("real_estate_drip_clients").upsert({ email, business_name: meta.businessName || email, contact_name: meta.name || null, city: meta.city || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Real Estate Drip is live", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Real Estate Drip Email ($79/mo). Your 7-day free trial has started.</p><p>Your first market update email goes out this month. We'll reach out to get your leads list.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Real Estate Drip — ${meta.businessName || email} ($79/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Market: ${meta.city || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] real_estate_drip error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── PODCAST SHOW NOTES — subscription ────────────────────────────────
      if (meta.type === "podcast_show_notes") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("podcast_show_notes_clients").upsert({ email, business_name: meta.businessName || email, contact_name: meta.name || null, podcast_url: meta.podcastUrl || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Podcast Show Notes are ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Podcast Show Notes ($49/mo). Trial started.</p><p>Send your first episode link to matt@mattmichelstraining.com and show notes will be back within 24 hours.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Podcast Show Notes — ${meta.businessName || email} ($49/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Podcast: ${meta.podcastUrl || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] podcast_show_notes error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── CHURCH NEWSLETTER — subscription ─────────────────────────────────
      if (meta.type === "church_newsletter") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("church_newsletter_clients").upsert({ email, business_name: meta.businessName || email, contact_name: meta.name || null, denomination: meta.denomination || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Church Newsletter is ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Church & Nonprofit Newsletter ($29/mo). Trial started.</p><p>We'll reach out within 24 hours to learn about your church and get your first newsletter going.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Church Newsletter — ${meta.businessName || email} ($29/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Denomination: ${meta.denomination || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] church_newsletter error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── PROPERTY MANAGEMENT — subscription ───────────────────────────────
      if (meta.type === "property_management") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("property_mgmt_clients").upsert({ email, business_name: meta.businessName || email, contact_name: meta.name || null, units: meta.units || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Property Management Docs are live", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Property Management Automation ($99/mo). Trial started.</p><p>We'll reach out within 24 hours to learn about your properties and set up your templates.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Property Mgmt — ${meta.businessName || email} ($99/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Units: ${meta.units || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] property_management error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── FRANCHISE OPS — subscription ──────────────────────────────────────
      if (meta.type === "franchise_ops") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("franchise_ops_clients").upsert({ email, business_name: meta.businessName || email, contact_name: meta.name || null, locations: meta.locations || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Franchise Ops Toolkit is live", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Franchise Operations Toolkit ($199/mo). Trial started.</p><p>We'll reach out within 24 hours to get your brand standards and location details.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Franchise Ops — ${meta.businessName || email} ($199/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Locations: ${meta.locations || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] franchise_ops error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── ECOMMERCE LISTINGS — subscription ────────────────────────────────
      if (meta.type === "ecommerce_listings") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("ecommerce_listings_clients").upsert({ email, business_name: meta.businessName || email, contact_name: meta.name || null, platform: meta.platform || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Product Listings are ready", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI E-commerce Product Listings ($79/mo). Trial started.</p><p>Send your product list (name, category, key features) and we'll have your first listings written within 48 hours.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New E-commerce Listings — ${meta.businessName || email} ($79/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Platform: ${meta.platform || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] ecommerce_listings error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── FINANCIAL ADVISOR CONTENT — subscription ──────────────────────────
      if (meta.type === "financial_advisor_content") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("financial_advisor_clients").upsert({ email, business_name: meta.businessName || email, contact_name: meta.name || null, designation: meta.firm || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Financial Advisor Content is live", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Financial Advisor Content ($149/mo). Trial started.</p><p>We'll reach out within 24 hours to understand your brand voice and compliance preferences.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Financial Advisor Content — ${meta.businessName || email} ($149/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Designation: ${meta.firm || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] financial_advisor_content error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── VET MARKETING — subscription ──────────────────────────────────────
      if (meta.type === "vet_marketing") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("vet_marketing_clients").upsert({ email, business_name: meta.businessName || email, contact_name: meta.name || null, business_type: meta.businessType || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Vet & Pet Care Marketing is live", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Vet & Pet Care Marketing ($79/mo). Trial started.</p><p>We'll reach out within 24 hours to get your practice info and start creating content.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Vet Marketing — ${meta.businessName || email} ($79/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Type: ${meta.businessType || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] vet_marketing error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── TRUCKING DOCS — subscription ──────────────────────────────────────
      if (meta.type === "trucking_docs") {
        try {
          const email = meta.email || customerEmail;
          if (email) await (sb.from as any)("trucking_docs_clients").upsert({ email, business_name: meta.businessName || email, contact_name: meta.name || null, trucks: meta.trucks || null, active: true, stripe_subscription_id: session.subscription as string || null }, { onConflict: "email" });
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Matt Michels <matt@mattmichelstraining.com>", to: [email], bcc: ["matthewmichels4@gmail.com"], subject: "Your AI Trucking & Fleet Docs are live", html: `<p>Hey${meta.name ? " " + meta.name : ""},</p><p>You're signed up for AI Trucking & Fleet Documents ($99/mo). Trial started.</p><p>We'll reach out within 24 hours to get your fleet details and set up your document templates.</p><p>— Matt</p>` }) });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "M² Notifications <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"], subject: `💰 New Trucking Docs — ${meta.businessName || email} ($99/mo)`, html: `<p><strong>${meta.businessName || email}</strong><br>Email: ${email}<br>Trucks: ${meta.trucks || "n/a"}</p>` }) });
          }
        } catch (e) { console.error("[WEBHOOK] trucking_docs error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── 10 NEW GLOBAL BUSINESSES ──────────────────────────────────────────
      const NEW_BUSINESS_TABLES: Record<string, { table: string; label: string; price: string }> = {
        linkedin_outreach_subscription: { table: "linkedin_outreach_clients", label: "AI LinkedIn Outreach", price: "$79/mo" },
        abandoned_cart_subscription: { table: "abandoned_cart_clients", label: "AI Abandoned Cart Recovery", price: "$69/mo" },
        client_report_subscription: { table: "client_report_clients", label: "AI Client Report Generator", price: "$59/mo" },
        restaurant_menu_subscription: { table: "restaurant_menu_clients", label: "AI Restaurant Menu Copy", price: "$39/mo" },
        insurance_drip_subscription: { table: "insurance_drip_clients", label: "AI Insurance Follow-Up Drip", price: "$69/mo" },
        podcast_pitch_subscription: { table: "podcast_pitch_clients", label: "AI Podcast Pitch Service", price: "$49/mo" },
        trade_show_followup_subscription: { table: "trade_show_followup_clients", label: "AI Trade Show Follow-Up", price: "$49/mo" },
        testimonial_harvester_subscription: { table: "testimonial_harvester_clients", label: "AI Testimonial Harvester", price: "$39/mo" },
        new_mover_marketing_subscription: { table: "new_mover_marketing_clients", label: "AI New Mover Marketing", price: "$59/mo" },
        annual_review_subscription: { table: "annual_review_clients", label: "AI Annual Business Review", price: "$79/mo" },
      };
      if (NEW_BUSINESS_TABLES[meta.type]) {
        const { table, label, price } = NEW_BUSINESS_TABLES[meta.type];
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from(table).upsert({
              email,
              business_name: meta.businessName || meta.business_name || customerName || email,
              contact_name: meta.contactName || meta.name || customerName || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@mattmichelstraining.com>",
                to: [email],
                subject: `Welcome to ${label}`,
                html: `<p>Hey${meta.contactName || meta.name ? " " + (meta.contactName || meta.name) : ""},</p><p>You're all set with <strong>${label}</strong> (${price}). We'll be in touch shortly to get everything running.</p><p>— Matt<br>(313) 806-4952</p>`,
              }),
            });
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "M\u00b2 Notifications <matt@mattmichelstraining.com>",
                to: ["matt@mattmichelstraining.com"],
                subject: `\ud83d\udcb0 New ${label} subscriber \u2014 ${email}`,
                html: `<p>New ${price} subscriber: <strong>${email}</strong><br>Business: ${meta.businessName || meta.business_name || "n/a"}<br>Sub ID: ${session.subscription || "n/a"}</p>`,
              }),
            });
          }
        } catch (e) { console.error(`[WEBHOOK] ${meta.type} error:`, e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI WEBSITE AUDIT — $29 one-time ─────────────────────────────────────
      if (meta.type === "website_audit") {
        try {
          const email = meta.email || customerEmail;
          if (email && meta.business_url) {
            // Fire and forget — call instant-audit function
            fetch(`${SUPABASE_URL}/functions/v1/instant-audit`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({
                email,
                business_name: meta.business_name || "",
                business_url: meta.business_url,
                order_id: meta.order_id || null,
              }),
            }).catch((e) => console.error("[WEBHOOK] instant-audit call failed:", e));
            console.log(`[WEBHOOK] website_audit triggered for ${email} — ${meta.business_url}`);
          }
        } catch (e) { console.error("[WEBHOOK] website_audit error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI GBP POST PACK — $19 one-time ─────────────────────────────────────
      if (meta.type === "gbp_post_pack") {
        try {
          const email = meta.email || customerEmail;
          if (email && meta.business_name) {
            let businessInfo: Record<string, string> = {};
            try { businessInfo = JSON.parse(meta.business_info || "{}"); } catch {}
            fetch(`${SUPABASE_URL}/functions/v1/gbp-post-pack`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({
                email,
                business_name: meta.business_name,
                business_type: businessInfo.industry || meta.industry || "",
                city: businessInfo.city || meta.city || "",
                differentiators: businessInfo.business_info || "",
                order_id: meta.order_id || null,
              }),
            }).catch((e) => console.error("[WEBHOOK] gbp-post-pack call failed:", e));
            console.log(`[WEBHOOK] gbp_post_pack triggered for ${email} — ${meta.business_name}`);
          }
        } catch (e) { console.error("[WEBHOOK] gbp_post_pack error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI COMPETITOR REPORT — $49 one-time ─────────────────────────────────
      if (meta.type === "competitor_report") {
        try {
          const email = meta.email || customerEmail;
          if (email && meta.city && meta.industry) {
            fetch(`${SUPABASE_URL}/functions/v1/competitor-report`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({
                email,
                business_name: meta.business_name || "",
                city: meta.city,
                industry: meta.industry,
                order_id: meta.order_id || null,
              }),
            }).catch((e) => console.error("[WEBHOOK] competitor-report call failed:", e));
            console.log(`[WEBHOOK] competitor_report triggered for ${email} — ${meta.industry} in ${meta.city}`);
          }
        } catch (e) { console.error("[WEBHOOK] competitor_report error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── LUKE — Mark cart as recovered when any instant product purchase completes ──
      const instantProducts = ["website_audit", "gbp_post_pack", "competitor_report"];
      if (instantProducts.includes(meta.type || "") && meta.email) {
        try {
          await sb.from("cart_abandonments")
            .update({ recovered: true, recovered_at: new Date().toISOString() })
            .eq("email", meta.email)
            .eq("product_type", meta.type)
            .eq("recovered", false);
        } catch { /* non-critical */ }
      }

      // ── LEIA — Seed onboarding sequence for new subscriptions ──────────────
      const subscriptionProducts: Record<string, string> = {
        gbp_subscription: "gbp_saas",
        social_media_subscription: "social_media_ai",
        field_rep_subscription: "field_rep_tools",
        contractor_lead_subscription: "contractor_leads",
      };
      if (subscriptionProducts[meta.type || ""] && (meta.email || customerEmail)) {
        try {
          const onboardEmail = meta.email || customerEmail;
          const product = subscriptionProducts[meta.type!];
          const { count } = await sb.from("onboarding_sequences")
            .select("*", { count: "exact", head: true })
            .eq("email", onboardEmail)
            .eq("product", product);
          if (!count) {
            await sb.from("onboarding_sequences").insert({ email: onboardEmail, product, current_step: 0, status: "active" });
          }
        } catch { /* non-critical */ }
      }

      // ── REFERRAL TRACKING (B2B + Session) ──────────────────────────────────
      try {
        const refCode = meta.referral_code || meta.ref || "";
        if (refCode) {
          // B2B referral partner conversion
          const { data: partner } = await sb
            .from("b2b_referral_partners")
            .select("id, commission_value, email")
            .eq("referral_code", refCode)
            .eq("status", "active")
            .maybeSingle();

          if (partner) {
            const clientEmail = meta.email || customerEmail || session.customer_email || "";
            // Fraud check: partner can't refer themselves
            if (clientEmail && clientEmail.toLowerCase() !== partner.email.toLowerCase()) {
              // 30-day duplicate check
              const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
              const { data: existing } = await sb
                .from("b2b_referral_conversions")
                .select("id")
                .eq("partner_id", partner.id)
                .eq("client_email", clientEmail)
                .gte("created_at", thirtyDaysAgo)
                .limit(1);

              if (!existing || existing.length === 0) {
                await sb.from("b2b_referral_conversions").insert({
                  partner_id: partner.id,
                  client_email: clientEmail,
                  service_type: meta.type || "unknown",
                  stripe_session_id: session.id,
                  commission_amount: partner.commission_value,
                  status: "pending",
                });
                // Update total earned
                await sb.from("b2b_referral_partners")
                  .update({ total_earned: (partner as any).total_earned + partner.commission_value })
                  .eq("id", partner.id);
                console.log(`[WEBHOOK] B2B referral conversion recorded for partner ${partner.id}`);
              }
            }
          }
        }

        // Session referral — check if a training session purchase has referredBy
        if (meta.type === "training_session" && meta.referredBy) {
          const referrerId = meta.referredBy;
          const friendEmail = meta.user_email || customerEmail || "";
          if (referrerId && friendEmail) {
            await sb.from("session_referral_rewards").insert({
              referrer_user_id: referrerId,
              referred_friend_email: friendEmail,
              session_type: meta.duration_minutes === "60" ? "60_min" : "30_min",
              status: "credited",
              stripe_session_id: session.id,
              credited_at: new Date().toISOString(),
            });
            console.log(`[WEBHOOK] Session referral reward credited to ${referrerId}`);
            // Notify referrer
            if (RESEND_API_KEY) {
              const { data: referrerProfile } = await sb.from("profiles").select("email, athlete_name, full_name").eq("user_id", referrerId).maybeSingle();
              if (referrerProfile?.email) {
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    from: "Matt Michels <matt@mattmichelstraining.com>",
                    to: [referrerProfile.email],
                    bcc: ["matthewmichels4@gmail.com"],
                    subject: "🎉 You earned a free training session!",
                    html: `<p>Hey ${referrerProfile.athlete_name || referrerProfile.full_name || ""},</p><p>Your friend just booked a session at M² Performance Training — and that means you earned a <strong>free session</strong>!</p><p>Head to <a href="https://www.mattmichelstraining.com/schedule">Schedule</a> to book yours.</p><p>— Matt</p>`,
                  }),
                }).catch(() => {});
              }
            }
          }
        }
      } catch (refErr) {
        console.error("[WEBHOOK] Referral tracking error:", refErr);
      }

      // ── DARK WEB MONITOR — direct ($49/mo) ────────────────────────────────
      if (meta.type === "dark_web_monitor") {
        try {
          const email = meta.customer_email || customerEmail;
          if (email) {
            await (sb.from as any)("dark_web_monitor_clients").insert({
              customer_email:         email,
              customer_name:          meta.customer_name || customerName || null,
              company_name:           meta.company_name || null,
              monitored_domain:       meta.monitored_domain || "",
              plan_type:              "direct",
              domains_allowed:        1,
              stripe_subscription_id: session.subscription as string || null,
              subscription_status:    "active",
            });

            // Fire-and-forget initial scan
            fetch(`${SUPABASE_URL}/functions/v1/dark-web-domain-scan`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({ trigger: "initial", client_email: email }),
            }).catch((e: unknown) => console.error("[WEBHOOK] dark-web initial scan error:", e));

            // Welcome email
            await sendM2Email(email, "Your Dark Web Monitor is Active — First Scan Starting Now", m2Email({
              greeting: `Hey${meta.customer_name ? " " + meta.customer_name : ""} —`,
              headline: "Your Dark Web Monitor is Active",
              body: `<p style="margin:0 0 12px"><strong>We're scanning the dark web for your domain credentials right now.</strong></p>
<p style="margin:0 0 8px">🔍 <strong>Domain monitored:</strong> ${meta.monitored_domain}</p>
<p style="margin:0 0 8px">📬 <strong>Weekly reports</strong> — every week you'll get a full breach report sent to this email</p>
<p style="margin:0 0 8px">⚠️ <strong>Instant alerts</strong> — if a new breach is found, you'll hear from us immediately</p>
<p style="margin:0 0 8px">🤖 <strong>AI remediation</strong> — every breach includes specific steps your team should take</p>
<p style="margin:0 0 16px">🔐 <strong>Powered by HaveIBeenPwned</strong> — the most trusted breach database on the internet</p>
<p style="margin:0;color:#64748b;font-size:13px">Your first scan report will arrive within the hour. If we find anything, you'll get an immediate alert.</p>`,
              cta: { text: "View Your Dashboard", url: "https://www.mattmichelstraining.com/dark-web-monitor/dashboard" },
            }));
            await notifyMatt(
              `💰 New Dark Web Monitor — ${meta.company_name || email} ($49/mo)`,
              `<p><strong>${meta.company_name || email}</strong><br>Email: ${email}<br>Domain: ${meta.monitored_domain || "n/a"}<br>Plan: Direct</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] dark_web_monitor error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── DARK WEB MONITOR RESELLER — MSP ($199/mo, 10 domains) ─────────────
      if (meta.type === "dark_web_monitor_reseller") {
        try {
          const email = meta.customer_email || customerEmail;
          if (email) {
            await (sb.from as any)("dark_web_monitor_clients").insert({
              customer_email:         email,
              customer_name:          meta.customer_name || customerName || null,
              company_name:           meta.company_name || null,
              monitored_domain:       meta.monitored_domain || "",
              plan_type:              "reseller",
              domains_allowed:        10,
              stripe_subscription_id: session.subscription as string || null,
              subscription_status:    "active",
            });

            // Fire-and-forget initial scan
            fetch(`${SUPABASE_URL}/functions/v1/dark-web-domain-scan`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({ trigger: "initial", client_email: email }),
            }).catch((e: unknown) => console.error("[WEBHOOK] dark-web-reseller initial scan error:", e));

            // Welcome email
            await sendM2Email(email, "Your Dark Web Monitor MSP Plan is Active — Up to 10 Domains", m2Email({
              greeting: `Hey${meta.customer_name ? " " + meta.customer_name : ""} —`,
              headline: "Your MSP Dark Web Monitor is Active",
              body: `<p style="margin:0 0 12px"><strong>Your reseller account is live. You can now monitor up to 10 client domains.</strong></p>
<p style="margin:0 0 8px">🔍 <strong>First domain:</strong> ${meta.monitored_domain}</p>
<p style="margin:0 0 8px">📊 <strong>10 domains included</strong> — add client domains through your dashboard</p>
<p style="margin:0 0 8px">📬 <strong>Weekly reports</strong> per domain — each client gets a branded breach report</p>
<p style="margin:0 0 8px">⚠️ <strong>Instant alerts</strong> on new findings — you and the client both get notified</p>
<p style="margin:0 0 16px">🤖 <strong>AI remediation steps</strong> — every breach includes specific recommended actions</p>
<p style="margin:0;color:#64748b;font-size:13px">Add more domains any time from your dashboard. White-label reports available — reply to this email to discuss.</p>`,
              cta: { text: "View Your Dashboard", url: "https://www.mattmichelstraining.com/dark-web-monitor/dashboard" },
            }));
            await notifyMatt(
              `💰 New Dark Web Monitor RESELLER — ${meta.company_name || email} ($199/mo)`,
              `<p><strong>${meta.company_name || email}</strong><br>Email: ${email}<br>Domain: ${meta.monitored_domain || "n/a"}<br>Plan: MSP Reseller (10 domains)</p>`
            );
          }
        } catch (e) { console.error("[WEBHOOK] dark_web_monitor_reseller error:", e); }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

    // ── LUKE — Capture abandoned checkouts for recovery emails ────────────────
    if (event.type === "checkout.session.expired") {
      try {
        const expiredSession = event.data.object as Record<string, unknown>;
        const expMeta = (expiredSession.metadata as Record<string, string>) || {};
        const expEmail = expMeta.email || (expiredSession.customer_details as Record<string, string>)?.email || null;
        const instantProductTypes = ["website_audit", "gbp_post_pack", "competitor_report"];
        if (expMeta.type && instantProductTypes.includes(expMeta.type) && expEmail) {
          const { count: exists } = await sb.from("cart_abandonments")
            .select("*", { count: "exact", head: true })
            .eq("stripe_session_id", expiredSession.id as string);
          if (!exists) {
            await sb.from("cart_abandonments").insert({
              email: expEmail,
              product_type: expMeta.type,
              stripe_session_id: expiredSession.id as string,
              cart_value: expMeta.price ? parseFloat(expMeta.price) : 49,
              metadata: expMeta,
            });
            console.log(`[LUKE] Cart abandonment captured: ${expEmail} — ${expMeta.type}`);
          }
        }
      } catch (e) { console.error("[LUKE] cart_abandonment capture error:", e); }
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
