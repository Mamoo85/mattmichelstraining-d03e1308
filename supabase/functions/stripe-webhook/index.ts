import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { encode as base64url } from "https://deno.land/std@0.190.0/encoding/base64url.ts";
import { getStripeSecretKey, getStripeWebhookSecret, isStripeTestMode } from "../_shared/stripe-key.ts";

const STRIPE_SECRET_KEY = getStripeSecretKey();
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
});
if (isStripeTestMode()) console.warn("[stripe-webhook] 🧪 TEST MODE");
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

async function signMortgageToken(email: string): Promise<string> {
  const payload = JSON.stringify({ email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const tokenB64 = base64url(new TextEncoder().encode(payload));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SUPABASE_SERVICE_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(tokenB64));
  return `${tokenB64}.${base64url(new Uint8Array(sig))}`;
}
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

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
        <strong style="color:#1e293b">${opts.signature || "Matt Michels"}</strong><br>Grosse Pointe, MI · <a href="tel:+13139921219" style="color:#e8621a">(313) 992-1219</a>
      </div>
    </div>
  </div>
  <div style="padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
    <p style="margin:0;color:#94a3b8;font-size:11px">M² Development · Grosse Pointe, MI 48230</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:10px"><a href="https://mattmichelstraining.com" style="color:#94a3b8">mattmichelstraining.com</a> · <a href="mailto:matt@mattmichelstraining.com?subject=Unsubscribe" style="color:#94a3b8">Unsubscribe</a></p>
  </div>
</div></body></html>`;
}

// ── DWA BRANDED EMAIL TEMPLATE HELPER (Detroit Web Agency products) ────────
function dwaEmailHtml(opts: { greeting: string; headline: string; body: string; cta?: { text: string; url: string }; signature?: string }): string {
  const ctaBlock = opts.cta ? `<div style="text-align:center;margin:24px 0"><a href="${opts.cta.url}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;font-family:sans-serif">${opts.cta.text}</a></div>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#0f1f3a;border-radius:10px;overflow:hidden;border:1px solid #1e3a5f">
  <div style="background:#0a1628;padding:20px 28px;border-bottom:3px solid #00d4ff">
    <p style="color:#00d4ff;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">Detroit Web Agency</p>
    <h1 style="color:#fff;margin:0;font-size:20px;font-family:-apple-system,sans-serif">${opts.headline}</h1>
  </div>
  <div style="padding:24px 28px;color:#e6f1ff;font-size:15px;line-height:1.8">
    <p style="margin:0 0 16px">${opts.greeting}</p>
    ${opts.body}
    ${ctaBlock}
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1e3a5f">
      <div style="font-size:13px;color:#7a8aa0">
        <strong style="color:#e6f1ff">${opts.signature || "Matt Michels"}</strong><br>Detroit Web Agency · Grosse Pointe, MI · <a href="tel:+13139921219" style="color:#00d4ff">(313) 992-1219</a>
      </div>
    </div>
  </div>
  <div style="padding:12px 28px;background:#0a1628;border-top:1px solid #1e3a5f;text-align:center">
    <p style="margin:0;color:#7a8aa0;font-size:11px">Detroit Web Agency · Grosse Pointe, MI 48230</p>
    <p style="margin:4px 0 0;color:#7a8aa0;font-size:10px"><a href="https://detroitwebagent.com" style="color:#7a8aa0">detroitwebagent.com</a> · <a href="mailto:matt@detroitwebagent.com?subject=Unsubscribe" style="color:#7a8aa0">Unsubscribe</a></p>
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

async function dwaEmail(to: string, subject: string, html: string, bcc?: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>",
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
      <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M2 Development</p>
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
      <p style="font-size:14px;color:#666;">By Matt Michels · M2 Development</p>
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
    const webhookSecret = getStripeWebhookSecret();

    if (!webhookSecret || !sig) {
      console.error("Missing webhook secret or stripe-signature header");
      return new Response("Webhook signature verification failed", { status: 400 });
    }
    const event: Stripe.Event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ─── IDEMPOTENCY GUARD (PARTIAL-1 + PARTIAL-3 fix) ────────────────────
    // Stripe retries webhooks on 5xx or timeout. The row is inserted with
    // fulfillment_status='pending' on first entry. Branches that succeed
    // call markFulfilled(true). The global catch calls markFulfilled(false).
    // On retry: if the row exists but is still 'pending' AND >180s old (i.e.,
    // the previous run failed mid-flight), we ALLOW re-entry. If it's
    // 'completed', we skip. If 'pending' but recent (<180s), assume another
    // worker is still running and skip too.
    // (Window bumped from 60s → 180s to cover slow PDF/email fulfillments.)
    const { error: dedupeError } = await sb
      .from("processed_stripe_events")
      .insert({ event_id: event.id, event_type: event.type, fulfillment_status: "pending" });

    if (dedupeError) {
      if ((dedupeError as any).code === "23505") {
        // Row already exists — check its fulfillment_status
        const { data: existing } = await sb
          .from("processed_stripe_events")
          .select("fulfillment_status, processed_at")
          .eq("event_id", event.id)
          .maybeSingle();
        const status = existing?.fulfillment_status ?? "completed";
        const ageMs = existing?.processed_at
          ? Date.now() - new Date(existing.processed_at).getTime()
          : Infinity;

        if (status === "completed") {
          console.log(`[WEBHOOK] Duplicate event ${event.id} (${event.type}) — already completed, skipping`);
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (status === "pending" && ageMs < 180_000) {
          console.log(`[WEBHOOK] Event ${event.id} still in-flight (${Math.round(ageMs / 1000)}s) — skipping retry`);
          return new Response(JSON.stringify({ received: true, in_flight: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // status === 'failed' OR ('pending' AND >180s old) → allow re-entry to recover
        console.log(`[WEBHOOK] Re-entering event ${event.id} (status=${status}, age=${Math.round(ageMs / 1000)}s) for recovery`);
        await sb
          .from("processed_stripe_events")
          .update({ fulfillment_status: "pending", fulfillment_error: null, processed_at: new Date().toISOString() })
          .eq("event_id", event.id);
      } else {
        console.error(`[WEBHOOK] Idempotency insert failed:`, dedupeError);
        return new Response("Idempotency check failed", { status: 500 });
      }
    }

    // Helper: mark the current Stripe event as completed/failed.
    // Called by the success path at the end + by the global catch on failure.
    // `productType` (optional) records which product fulfilled this event so the
    // admin Checkout Events dashboard can filter by product (e.g. site_radar_subscription)
    // instead of only by raw Stripe event name.
    async function markFulfilled(success: boolean, errMsgOrProductType?: string, maybeProductType?: string) {
      // Back-compat: existing call sites pass (true) or (false, "error msg").
      // New call sites can pass (true, undefined, "site_radar_subscription").
      const errMsg = success ? undefined : errMsgOrProductType;
      const productType = success ? errMsgOrProductType : maybeProductType;
      try {
        const update: Record<string, unknown> = {
          fulfillment_status: success ? "completed" : "failed",
          fulfillment_completed_at: success ? new Date().toISOString() : null,
          fulfillment_error: success ? null : (errMsg || "unknown error").slice(0, 500),
        };
        if (productType) update.product_type = productType;
        await sb
          .from("processed_stripe_events")
          .update(update)
          .eq("event_id", event.id);
      } catch (e) {
        console.error(`[WEBHOOK] markFulfilled(${success}) failed for ${event.id}:`, e);
      }
    }
    // ─────────────────────────────────────────────────────────────────────

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

        // Deactivate B2B product clients on cancellation
        // Get contractor_clients ID before deactivation so we can clear territory
        const { data: cancelledContractor } = await sb
          .from("contractor_clients")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        await Promise.all([
          sb.from("hire_alert_clients").update({ active: false }).eq("stripe_subscription_id", subscription.id),
          sb.from("field_crm_clients").update({ active: false }).eq("stripe_subscription_id", subscription.id),
          sb.from("social_media_clients").update({ active: false }).eq("stripe_subscription_id", subscription.id),
          sb.from("gbp_saas_clients").update({ active: false }).eq("stripe_subscription_id", subscription.id),
          sb.from("contractor_clients").update({ active: false, stripe_subscription_id: null }).eq("stripe_subscription_id", subscription.id),
        ]);

        // Clear territory assignment so another contractor can buy it
        if (cancelledContractor?.id) {
          await sb.from("contractor_lead_sites")
            .update({ active_contractor_id: null })
            .eq("active_contractor_id", cancelledContractor.id);
          console.log(`[WEBHOOK] Cleared territory for contractor ${cancelledContractor.id}`);
        }

        console.log(`[WEBHOOK] Deactivated B2B clients for subscription ${subscription.id}`);

        // Trigger Shield win-back sequence
        const productName = (subscription.items?.data?.[0]?.price?.nickname) || "M² subscription";
        await fetch(`${SUPABASE_URL}/functions/v1/shield-winback`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_email: email,
            product: productName,
            stripe_subscription_id: subscription.id,
          }),
        });
        console.log(`[WEBHOOK] Shield win-back triggered for ${email}`);
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

      // Revoke any marketplace dossier purchased with this charge / payment_intent
      try {
        const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        const { data: revokeCount } = await (sb.rpc as any)("revoke_marketplace_access_by_stripe", {
          p_payment_intent_id: piId,
          p_charge_id: charge.id,
          p_reason: "charge.refunded",
        });
        if (revokeCount && Number(revokeCount) > 0) {
          console.log(`[WEBHOOK] Revoked ${revokeCount} marketplace lock(s) due to refund ${charge.id}`);
          await notifyMatt(
            `🚫 Marketplace dossier revoked — refund ${charge.id}`,
            `<p>${revokeCount} lock(s) revoked after Stripe refund. Buyer email: ${charge.billing_details?.email || "?"}</p>`
          ).catch(() => {});
        }
      } catch (e) {
        console.error("[WEBHOOK] revoke on refund failed:", e);
      }

      console.log(`[WEBHOOK] Charge refunded: ${charge.id} — $${(refundedAmount / 100).toFixed(2)}`);
    }

    // Handle disputes (chargebacks) — relock dossier and notify
    if (event.type === "charge.dispute.created" || event.type === "charge.dispute.funds_withdrawn") {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id || null;
      try {
        let piId: string | null = null;
        if (chargeId) {
          const ch = await stripe.charges.retrieve(chargeId);
          piId = typeof ch.payment_intent === "string" ? ch.payment_intent : null;
        }
        const { data: revokeCount } = await (sb.rpc as any)("revoke_marketplace_access_by_stripe", {
          p_payment_intent_id: piId,
          p_charge_id: chargeId,
          p_reason: `dispute.${dispute.reason || "chargeback"}`,
        });
        if (revokeCount && Number(revokeCount) > 0) {
          await notifyMatt(
            `⚠️ Chargeback — marketplace lock revoked (${dispute.id})`,
            `<p>${revokeCount} marketplace lock(s) revoked after dispute ${dispute.id} (reason: ${dispute.reason}).</p>`
          ).catch(() => {});
        }
      } catch (e) {
        console.error("[WEBHOOK] dispute revoke failed:", e);
      }
    }

    // Belt-and-suspenders: sync agency interview charges that succeed asynchronously
    // (e.g. 3DS retries). Inline write happens in agency-fast-track-interview, but
    // off-session intents can confirm later — this catches that case.
    if (event.type === "payment_intent.succeeded") {
      try {
        const intent = event.data.object as Stripe.PaymentIntent;
        const meta = intent.metadata || {};
        if (meta.type === "agency_interview_charge" && meta.assignment_id) {
          await sb.from("agency_candidate_assignments").update({
            charged_at: new Date().toISOString(),
            stripe_charge_id: intent.id,
            charge_amount_cents: intent.amount,
          }).eq("id", meta.assignment_id);
          console.log(`[WEBHOOK] agency_interview_charge synced: assignment=${meta.assignment_id} intent=${intent.id}`);
        }
      } catch (e) {
        console.error("[WEBHOOK] agency_interview_charge sync error:", e);
      }
    }

    // Handle guide purchases (existing logic)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      const priceId = (session.line_items?.data?.[0] as any)?.price?.id as string | null;

      // ── RECEIPT TRACKING (checkout hardening) ──
      // Upsert a receipt row so the success page can poll fulfillment status.
      // Status will be flipped to 'fulfilled' at the end of this handler.
      try {
        await sb.from("checkout_receipts").upsert({
          stripe_session_id: session.id,
          stripe_payment_intent_id: (session.payment_intent as string) || null,
          customer_email: session.customer_details?.email || meta.email || null,
          amount_total: session.amount_total ?? null,
          currency: session.currency ?? null,
          product_type: meta.type || "unknown",
          status: "paid",
          metadata: meta as any,
        }, { onConflict: "stripe_session_id" });
      } catch (e) {
        console.error("[WEBHOOK] checkout_receipts upsert failed:", e);
      }

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

          // Idempotency guard — if webhook fires twice, skip duplicate conversion
          const { data: existingConversion } = await sb
            .from("referral_conversions")
            .select("id")
            .eq("referral_code", refCode)
            .eq("referred_user_id", referredProfile.user_id)
            .maybeSingle();

          if (existingConversion) {
            console.log(`[WEBHOOK] Referral conversion already recorded for ${refCode} → ${referredProfile.user_id}, skipping`);
          } else {
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
          } // end else (not duplicate)
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
                html: `<p>Your add-on service <strong>${meta.service_name}</strong> is now active. I'll be in touch within 24 hours to get everything set up.</p><p>— Matt, M² Development<br>(313) 992-1219</p>`,
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
        } catch (e) {
          console.error("[WEBHOOK] web_design_addon error:", e);
          return new Response(JSON.stringify({ error: "web_design_addon failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // handbook_subscription branch removed 2026-04-25: AIHandbook page delisted, create-handbook-checkout deleted.
      // `handbook_clients` table left in schema for any historical rows; safe to drop in a future cleanup migration.

      // ── THE WIRE — contractor leads $99/mo ────────────────────────────────
      if (meta.type === "wire_subscription") {
        const email = meta.email || customerEmail;
        try {
          if (email) {
            let trades: string[] = [];
            let cities: string[] = [];
            try { trades = JSON.parse(meta.trades || "[]"); } catch {}
            try { cities = JSON.parse(meta.cities || "[]"); } catch {}
            const { error: wErr } = await (sb.from as any)("wire_subscribers").upsert({
              email,
              business_name: meta.business_name || null,
              contact_name: meta.contact_name || null,
              phone: meta.phone || null,
              trades, cities,
              active: true,
              digest_enabled: true,
              stripe_customer_id: session.customer as string || null,
              stripe_subscription_id: session.subscription as string || null,
              subscription_status: "active",
            }, { onConflict: "email" });
            if (wErr) throw new Error(`wire_subscribers upsert: ${wErr.message}`);
          }
          if (RESEND_API_KEY && email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "The Wire <matt@detroitwebagent.com>",
                to: [email],
                subject: "📡 You're on The Wire — first digest tomorrow 7am ET",
                html: `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#0a1628;color:#fff;padding:32px;border-radius:12px;">
                  <div style="color:#00d4ff;font-size:11px;letter-spacing:3px;font-weight:700;">📡 THE WIRE</div>
                  <h1 style="font-size:24px;margin:8px 0 12px;">You're in${meta.business_name ? `, ${meta.business_name}` : ""}.</h1>
                  <p style="color:#94a3b8;font-size:14px;line-height:1.6;">Your first morning digest hits tomorrow at 7am ET. Fresh contractor leads filtered to your trades and cities, ready to claim.</p>
                  <p style="color:#94a3b8;font-size:13px;margin-top:16px;">Trades: ${(trades||[]).join(", ") || "all"}<br/>Cities: ${(cities||[]).join(", ") || "all"}</p>
                  <a href="https://detroitwebagent.com/the-wire" style="display:inline-block;margin-top:20px;background:#00d4ff;color:#0a1628;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">View The Wire →</a>
                  <p style="color:#475569;font-size:11px;margin-top:24px;">Detroit Web Agency · (313) 992-1219</p>
                </div>`,
              }),
            }).catch(e => console.error("[wire welcome email]", e));
          }
          await notifyMatt(`📡 New Wire subscriber: ${meta.business_name || email} ($99/mo)`);
        } catch (err: any) {
          console.error("[WEBHOOK wire_subscription]", err);
          await notifyMatt(`⚠️ Wire signup failed: ${email} — ${err.message}`);
          return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        }
      }

      if (meta.type === "hire_alert_subscription") {
        const email = meta.email || customerEmail;
        // Hoisted so it's accessible in the welcome-email block below
        let dashboardToken: string | null = null;
        try {
          if (email) {
            // Parse target_roles from comma-separated string back to array
            const targetRoles = meta.target_roles
              ? meta.target_roles.split(",").map((r: string) => r.trim()).filter(Boolean)
              : ["boiler_operator", "hvac_tech"];
            // CRITICAL: upsert so repeat checkouts by same email update instead of duplicate-key failing
            const targetZipPrefixes = meta.target_zip_prefixes
              ? meta.target_zip_prefixes.split(",").map((z: string) => z.trim()).filter(Boolean)
              : null;
            const { data: insertedClient, error: insertErr } = await (sb.from as any)("hire_alert_clients").upsert({
              company_name: meta.company_name || email,
              owner_email: email,
              owner_phone: meta.owner_phone || null,
              stripe_customer_id: session.customer as string || null,
              stripe_subscription_id: session.subscription as string || null,
              active: true,
              plan: meta.plan || "standalone",
              target_roles: targetRoles,
              target_state: (meta.target_state || "MI").toUpperCase(),
              target_metro: (meta.target_metro || "detroit").toLowerCase(),
              target_zip_prefixes: targetZipPrefixes,
              tos_accepted_at: meta.tos_accepted === "true" ? new Date().toISOString() : null,
            }, { onConflict: "owner_email" }).select("dashboard_token").single();
            if (insertErr) throw new Error(`hire_alert_clients upsert: ${insertErr.message}`);
            dashboardToken = insertedClient?.dashboard_token ?? null;

            // Track postcard conversion if ref=postcard
            if (meta.ref === "postcard") {
              await (sb.from as any)("postcard_conversions").insert({
                event: "paid",
                stripe_session_id: session.id,
                county: meta.county || null,
                prospect_id: null,
                campaign_id: null,
              }).then(() => console.log("[WEBHOOK] Postcard conversion tracked"));
            }
          }
          if (RESEND_API_KEY && email) {
            const companyGreet = meta.company_name ? ` ${meta.company_name}` : "";
            const welcomeHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
<tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1e293b 100%);padding:36px 28px 28px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;text-align:center;">
    <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">⚡ TechAlert</p>
    <p style="margin:12px 0 0;color:#fff;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">You're In.</p>
    <p style="margin:6px 0 0;color:#94a3b8;font-size:14px;">Your hiring advantage starts tomorrow morning.</p>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="color:#1e293b;font-size:15px;line-height:1.8;margin:0 0 20px;">Hey${companyGreet} —</p>
    <p style="color:#475569;font-size:15px;line-height:1.8;margin:0 0 20px;">Welcome to TechAlert. Starting tomorrow at 7am, we scan <strong>three sources every single day</strong> looking for licensed tradespeople in your area — and alert you before anyone else knows they're available.</p>

    <!-- SOURCE CARDS -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="padding:14px 16px;background:#0a162808;border-radius:12px;border-left:4px solid #00d4ff;margin-bottom:8px;">
        <p style="margin:0;font-size:14px;color:#1e293b;font-weight:700;">🏛️ Licensing Signal Engine</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;line-height:1.5;">Proprietary monitoring of state licensing records for boiler operators, steam engineers, and pressure vessel inspectors. <strong>New license issued = new talent entering the market.</strong> No other tool monitors this.</p>
      </td></tr>
      <tr><td style="height:8px;"></td></tr>
      <tr><td style="padding:14px 16px;background:#0a162808;border-radius:12px;border-left:4px solid #8b5cf6;">
        <p style="margin:0;font-size:14px;color:#1e293b;font-weight:700;">🔍 Professional Network Signals</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;line-height:1.5;">HVAC techs, plumbers, pipefitters, and electricians surfaced by location and title across Metro Detroit through proprietary multi-source enrichment.</p>
      </td></tr>
      <tr><td style="height:8px;"></td></tr>
      <tr><td style="padding:14px 16px;background:#0a162808;border-radius:12px;border-left:4px solid #f59e0b;">
        <p style="margin:0;font-size:14px;color:#1e293b;font-weight:700;">📋 Live Intent Monitoring</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;line-height:1.5;">Tradespeople actively signaling availability across professional networks and job boards.</p>
      </td></tr>
    </table>

    <!-- HOW ALERTS WORK -->
    <p style="margin:0 0 12px;font-size:14px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">How Your Alerts Work</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="padding:10px 14px;background:#dc262610;border-radius:10px;">
          <p style="margin:0;font-size:13px;color:#1e293b;"><span style="font-weight:800;color:#dc2626;">🔥 Score 8-10</span> — Instant SMS + email. Active job seeker, fresh license, local.</p>
        </td>
      </tr>
      <tr><td style="height:6px;"></td></tr>
      <tr>
        <td style="padding:10px 14px;background:#e8621a10;border-radius:10px;">
          <p style="margin:0;font-size:13px;color:#1e293b;"><span style="font-weight:800;color:#e8621a;">⚡ Score 7</span> — Instant SMS + email. Likely available, recent license or job board appearance.</p>
        </td>
      </tr>
      <tr><td style="height:6px;"></td></tr>
      <tr>
        <td style="padding:10px 14px;background:#f59e0b10;border-radius:10px;">
          <p style="margin:0;font-size:13px;color:#1e293b;"><span style="font-weight:800;color:#f59e0b;">📋 Score 5-6</span> — Daily email digest. Professional profile matches your criteria.</p>
        </td>
      </tr>
    </table>

    <p style="color:#475569;font-size:15px;line-height:1.8;margin:0 0 8px;">Each candidate alert includes their <strong>name, trade, city, license info, contact details</strong> (when available), and our proprietary availability score.</p>
    <p style="color:#475569;font-size:15px;line-height:1.8;margin:0 0 8px;">Candidate profiles include verified phone and email data from industry databases. Staffing alerts use public CMS data to identify hiring opportunities.</p>
    <p style="color:#475569;font-size:14px;line-height:1.8;margin:0 0 20px;">Want to adjust your target roles or zip codes? Just reply to this email.</p>
    ${dashboardToken ? `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:0 0 8px;"><a href="https://detroitwebagent.com/talent-radar/dashboard?token=${dashboardToken}" style="display:inline-block;padding:14px 32px;background:#00d4ff;color:#0a1628;font-weight:800;font-size:15px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">Open Your Dashboard →</a></td></tr><tr><td align="center" style="padding:14px 0 0;"><p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">📲 <strong>Open this link on your phone</strong> and tap "Install" when it appears — your TechAlert dashboard lives on your home screen, one tap away from every new candidate alert.</p></td></tr></table>` : ""}
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:20px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;background:#0a1628;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #00d4ff30;" alt="Matt"></td>
          <td style="padding-left:12px;vertical-align:middle;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#fff;">Matt Michels</p>
            <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;text-decoration:none;">(313) 992-1219</a></p>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <p style="margin:0;font-size:10px;color:#64748b;"><a href="mailto:matt@detroitwebagent.com?subject=Unsubscribe%20TechAlert" style="color:#64748b;text-decoration:none;">Unsubscribe</a></p>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
            await dwaEmail(email, `⚡ TechAlert is Live — Your Hiring Advantage Starts Tomorrow`, welcomeHtml);
            if (meta.owner_phone) {
              sendSMS(
                meta.owner_phone,
                Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219",
                `TechAlert is live! You'll get a text the moment a licensed candidate shows up in Metro Detroit. Questions? (313) 992-1219 — Matt`,
                "hire_alert_onboard"
              ).catch(() => {});
            }
            await notifyMatt(
              `💰 New TechAlert Client — ${meta.company_name || email} ($${meta.plan === "bundle" ? "49" : "99"}/mo)`,
              `<p><strong>${meta.company_name || email}</strong><br>Email: ${email}<br>Phone: ${meta.owner_phone || "n/a"}<br>Plan: ${meta.plan || "standalone"}</p>`
            );
          }
        } catch (e) {
          console.error("[WEBHOOK] hire_alert_subscription error:", e);
          await notifyMatt(
            `🚨 TechAlert provision FAILED — ${email || "unknown"} paid but not activated`,
            `<p>Error: ${e instanceof Error ? e.message : String(e)}</p><p>Stripe session: ${session.id}</p><p>Manual fix: insert row in hire_alert_clients for ${email}</p>`
          ).catch(() => {});
          return new Response(JSON.stringify({ error: "provisioning failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "techalert_pay_per_hire") {
        const email = meta.email || customerEmail;
        try {
          // Retrieve SetupIntent to get the saved PaymentMethod
          const setupIntentId = session.setup_intent as string;
          const setupIntent = setupIntentId
            ? await stripe.setupIntents.retrieve(setupIntentId)
            : null;
          const paymentMethodId = setupIntent?.payment_method as string | null;

          if (email) {
            await (sb.from as any)("hire_alert_clients").upsert({
              company_name: meta.company_name || email,
              owner_email: email,
              owner_phone: meta.owner_phone || null,
              stripe_customer_id: session.customer as string || null,
              stripe_payment_method_id: paymentMethodId || null,
              active: true,
              plan: "pay_per_hire",
              target_roles: meta.target_roles ? meta.target_roles.split(",").map((r: string) => r.trim()) : ["boiler_operator", "hvac_tech"],
              target_state: (meta.target_state || "MI").toUpperCase(),
              target_metro: (meta.target_metro || "detroit").toLowerCase(),
            }, { onConflict: "owner_email" });
          }

          await notifyMatt(
            `🎯 New TechAlert Pay-Per-Hire signup: ${meta.company_name || email}`,
            `<p>Card saved. They pay $499 per confirmed hire. No monthly fee.</p><p>Email: ${email}</p><p>Company: ${meta.company_name || "—"}</p>`
          ).catch(() => {});
        } catch (e) {
          console.error("[WEBHOOK] techalert_pay_per_hire error:", e);
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "agency_whitelabel_subscription") {
        const email = meta.email || customerEmail;
        try {
          if (email) {
            await (sb.from as any)("agency_whitelabel_clients").upsert({
              agency_name: meta.agency_name || email,
              contact_name: meta.contact_name || null,
              email,
              phone: meta.phone || null,
              stripe_customer_id: session.customer as string || null,
              stripe_subscription_id: session.subscription as string || null,
              active: true,
            }, { onConflict: "email" }).catch(() => {});
          }
          await notifyMatt(
            `🏢 New Agency White-Label: ${meta.agency_name || email}`,
            `<p>$999/mo white-label access activated. They can now blast candidates under their own brand.</p><p>Email: ${email}</p><p>Agency: ${meta.agency_name || "—"}</p>`
          ).catch(() => {});
        } catch (e) {
          console.error("[WEBHOOK] agency_whitelabel_subscription error:", e);
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "high_volume_buyer_subscription") {
        const email = meta.email || customerEmail;
        try {
          if (email) {
            const targetTrades = meta.target_trades
              ? meta.target_trades.split(",").map((t: string) => t.trim()).filter(Boolean)
              : ["hvac", "plumbing", "electrical"];
            const targetCounties = meta.target_counties
              ? meta.target_counties.split(",").map((c: string) => c.trim()).filter(Boolean)
              : ["Wayne", "Oakland", "Macomb"];
            const minPermits = parseInt(meta.min_permit_count || "5", 10);

            const { error: insertErr } = await (sb.from as any)("high_volume_buyer_clients").upsert({
              business_name: meta.business_name || email,
              email,
              phone: meta.phone || null,
              contact_name: meta.contact_name || null,
              target_trades: targetTrades,
              target_counties: targetCounties,
              min_permit_count: minPermits,
              stripe_customer_id: session.customer as string || null,
              stripe_subscription_id: session.subscription as string || null,
              active: true,
            }, { onConflict: "email" });
            if (insertErr) throw new Error(`high_volume_buyer_clients upsert: ${insertErr.message}`);

            if (RESEND_API_KEY) {
              await dwaEmail(email, "📦 High-Volume Buyer Alerts is Live — First Digest Monday 7am", `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;">
    <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0;">📦 HIGH-VOLUME BUYER ALERTS</p>
    <h1 style="color:#fff;font-size:24px;margin:12px 0 8px;">You're In, ${meta.business_name || "team"}.</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6;">Your first weekly digest hits your inbox <strong style="color:#00d4ff;">this Monday at 7am ET</strong> — every Metro Detroit contractor pulling ${minPermits}+ permits in <strong style="color:#fff;">${targetTrades.join(", ")}</strong> across <strong style="color:#fff;">${targetCounties.join(", ")}</strong>.</p>
    <div style="background:#0f172a;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin:0 0 20px;">
      <p style="color:#cbd5e1;font-size:13px;line-height:1.7;margin:0;">Each entry includes:<br>• Contractor name + ${minPermits}+ active permits<br>• Estimated material spend<br>• Decision-maker contact emails<br>• Recent project addresses</p>
    </div>
    <p style="color:#64748b;font-size:12px;margin:0;">Want to adjust trades, counties, or permit threshold? Reply to this email.</p>
  </div>
  <div style="text-align:center;margin-top:24px;">
    <p style="color:#475569;font-size:12px;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p>
  </div>
</div></body></html>`);
              await notifyMatt(
                `💰 New High-Volume Buyer Client — ${meta.business_name || email} ($199/mo)`,
                `<p><strong>${meta.business_name || email}</strong><br>Email: ${email}<br>Contact: ${meta.contact_name || "n/a"}<br>Phone: ${meta.phone || "n/a"}<br>Trades: ${targetTrades.join(", ")}<br>Counties: ${targetCounties.join(", ")}<br>Min permits: ${minPermits}</p>`
              );
            }
          }
        } catch (e) {
          console.error("[WEBHOOK] high_volume_buyer_subscription error:", e);
          await notifyMatt(
            `🚨 High-Volume Buyer provision FAILED — ${email || "unknown"} paid but not activated`,
            `<p>Error: ${e instanceof Error ? e.message : String(e)}</p><p>Stripe session: ${session.id}</p>`
          ).catch(() => {});
          return new Response(JSON.stringify({ error: "provisioning failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "industry_pulse_subscription") {
        const email = meta.email || customerEmail;
        try {
          if (email) {
            const targetIndustries = meta.target_industries
              ? meta.target_industries.split(",").map((t: string) => t.trim()).filter(Boolean)
              : ["boiler", "hvac", "manufacturing"];
            const { data: inserted, error: insertErr } = await (sb.from as any)("industry_pulse_clients").upsert({
              company_name: meta.company_name || email,
              email,
              phone: meta.phone || null,
              contact_name: meta.contact_name || null,
              target_industries: targetIndustries,
              stripe_customer_id: session.customer as string || null,
              stripe_subscription_id: session.subscription as string || null,
              active: true,
            }, { onConflict: "email" }).select("dashboard_token").single();
            if (insertErr) throw new Error(`industry_pulse_clients upsert: ${insertErr.message}`);

            // Send welcome email + SMS with dashboard link
            const siteUrl = "https://detroitwebagent.com";
            const dashLink = `${siteUrl}/my-industry-pulse?token=${inserted.dashboard_token}`;
            if (RESEND_API_KEY) {
              await dwaEmail(email, "📡 Demand Radar is Live — Your Dashboard is Ready", `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;text-align:center;">
    <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0;">📡 DEMAND RADAR</p>
    <h1 style="color:#fff;font-size:24px;margin:12px 0 8px;">You're In.</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Predictive sales signals start flowing today.</p>
    <a href="${dashLink}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:700;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:15px;">📊 Open Your Dashboard</a>
    <p style="color:#64748b;font-size:12px;margin:20px 0 0;">Bookmark this link — it's your personal, always-on intelligence feed.</p>
  </div>
  <div style="text-align:center;margin-top:24px;">
    <p style="color:#475569;font-size:12px;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p>
  </div>
</div></body></html>`);
              const tierLabel = meta.tier === "enterprise" ? "$499/mo Enterprise"
                : meta.tier === "snapshot" ? "$99 One-Time Snapshot"
                : "$199/mo Weekly";
              await notifyMatt(
                `💰 New Demand Radar Client — ${meta.company_name || email} (${tierLabel})`,
                `<p><strong>${meta.company_name || email}</strong><br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}<br>Tier: ${tierLabel}<br>Industries: ${targetIndustries.join(", ")}<br>Dashboard: <a href="${dashLink}">${dashLink}</a></p>`
              );
            }
            // Welcome SMS if phone provided
            if (meta.phone) {
              await sendSMS(
                meta.phone,
                "+13139921219",
                `Demand Radar is live. Your sales intelligence dashboard: ${dashLink} — Reply STOP to opt out.`,
                "demand_radar_welcome"
              );
            }
          }
        } catch (e) {
          console.error("[WEBHOOK] industry_pulse_subscription error:", e);
          await notifyMatt(`🚨 Industry Pulse provision FAILED — ${email || "unknown"}`, `<p>Error: ${e instanceof Error ? e.message : String(e)}</p>`).catch(() => {});
          return new Response(JSON.stringify({ error: "provisioning failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "mortgage_radar_subscription") {
        const email = (meta.email || customerEmail || "").toLowerCase();
        try {
          if (!email) throw new Error("missing email");
          const tier = meta.tier || "solo";
          const zips = (meta.zip_codes || "").split(",").map((z: string) => z.trim()).filter(Boolean);
          const { error: insertErr } = await (sb.from as any)("mortgage_radar_clients").upsert({
            email,
            contact_name: meta.contact_name || null,
            business_name: meta.business_name || null,
            nmls_number: meta.nmls_number || null,
            phone: meta.phone || null,
            tier,
            zip_codes: zips,
            extra_zip_count: parseInt(meta.extra_zip_count || "0", 10) || 0,
            stripe_customer_id: session.customer as string || null,
            stripe_subscription_id: session.subscription as string || null,
            active: true,
            dob: meta.dob || null,
            tcpa_consent_at: meta.tcpa_consent_at || new Date().toISOString(),
            manual_ack_at: meta.manual_ack_at || new Date().toISOString(),
          }, { onConflict: "email" });
          if (insertErr) throw new Error(`mortgage_radar_clients upsert: ${insertErr.message}`);

          // Fire-and-forget initial scan so new subscriber sees leads within minutes
          fetch(`${SUPABASE_URL}/functions/v1/mortgage-radar-scanner`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({ initial: true }),
          }).catch(() => {});

          const siteUrl = "https://detroitwebagent.com";
          const dashToken = await signMortgageToken(email);
          const dashLink = `${siteUrl}/my-mortgage-radar?email=${encodeURIComponent(email)}&token=${encodeURIComponent(dashToken)}`;
          const tierLabel = tier === "team" ? "$899/mo Team (15 ZIPs)" : "$399/mo Solo (5 ZIPs)";

          if (RESEND_API_KEY) {
            await dwaEmail(email, "🏠 Mortgage Radar is Live — Your In-Market Leads Start Today", `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;text-align:center;">
    <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0;">🏠 MORTGAGE RADAR</p>
    <h1 style="color:#fff;font-size:24px;margin:12px 0 8px;">You're In, ${meta.contact_name || "there"}.</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Pre-trigger mortgage signals from public records — 100% FCRA-clean. Your first leads land within 24 hours.</p>
    <a href="${dashLink}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:700;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:15px;">📊 Open Your Dashboard</a>
    <p style="color:#64748b;font-size:12px;margin:20px 0 0;">ZIPs monitored: ${zips.join(", ") || "(set in dashboard)"}</p>
  </div>
  <p style="color:#64748b;font-size:11px;text-align:center;margin-top:16px;">Public + behavioral signals only. No bureau trigger leads. All outreach must be sent manually by you in compliance with TCPA + FCRA.</p>
  <p style="color:#475569;font-size:12px;text-align:center;margin-top:16px;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p>
</div></body></html>`);
            await notifyMatt(
              `💰 New Mortgage Radar Client — ${meta.business_name || email} (${tierLabel})`,
              `<p><strong>${meta.business_name || email}</strong><br>Contact: ${meta.contact_name || "n/a"}<br>NMLS: ${meta.nmls_number || "n/a"}<br>Email: ${email}<br>Phone: ${meta.phone || "n/a"}<br>Tier: ${tierLabel}<br>ZIPs: ${zips.join(", ")}</p>`
            );
          }
          if (meta.phone) {
            await sendSMS(meta.phone, "+13139921219",
              `Mortgage Radar is live. Dashboard: ${dashLink} — Reply STOP to opt out.`,
              "mortgage_radar_welcome");
          }
        } catch (e) {
          console.error("[WEBHOOK] mortgage_radar_subscription error:", e);
          await notifyMatt(`🚨 Mortgage Radar provision FAILED — ${email || "unknown"}`, `<p>Error: ${e instanceof Error ? e.message : String(e)}</p>`).catch(() => {});
          return new Response(JSON.stringify({ error: "provisioning failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "mortgage_radar_trial") {
        const email = meta.email || customerEmail;
        try {
          const setupIntentId = session.setup_intent as string;
          const setupIntent = setupIntentId ? await stripe.setupIntents.retrieve(setupIntentId) : null;
          const paymentMethodId = setupIntent?.payment_method as string | null;

          if (email) {
            await (sb.from as any)("mortgage_radar_clients").upsert({
              email,
              business_name: meta.business_name || email,
              contact_name: meta.contact_name || null,
              nmls_number: meta.nmls_number || null,
              phone: meta.phone || null,
              zip_codes: meta.zip_codes ? meta.zip_codes.split(",").map((z: string) => z.trim()) : [],
              stripe_customer_id: session.customer as string || null,
              stripe_payment_method_id: paymentMethodId || null,
              active: true,
              trial_active: true,
              trial_leads_remaining: 10,
              tier: meta.tier || "solo",
            }, { onConflict: "email" });
          }

          await notifyMatt(
            `🎯 Mortgage Radar trial started: ${meta.contact_name || email}`,
            `<p>10 free leads. Card saved — auto-charges $399/mo when trial exhausted.</p><p>Email: ${email}</p>`
          ).catch(() => {});
        } catch (e) {
          console.error("[WEBHOOK] mortgage_radar_trial error:", e);
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "buyer_radar_subscription") {
        const email = (meta.email || customerEmail || "").toLowerCase();
        try {
          if (!email) throw new Error("missing email");
          const tier = meta.tier || "core";
          const planLabel = tier === "enterprise" ? "$799/mo Enterprise (RFQ Intercept)"
            : tier === "pro" ? "$599/mo Pro (Watchlist)"
            : "$399/mo Core";
          const { data: inserted, error: insertErr } = await (sb.from as any)("industry_pulse_clients").insert({
            company_name: meta.company_name || email,
            email,
            phone: meta.phone || null,
            contact_name: meta.contact_name || null,
            target_industries: ["manufacturing", "specialty_manufacturing", "fabricated_metal", "automotive", "defense"],
            buyer_type: "supplier",
            vertical: meta.vertical || "steel",
            plan: tier,
            stripe_customer_id: session.customer as string || null,
            stripe_subscription_id: session.subscription as string || null,
            active: true,
          }).select("dashboard_token").single();
          if (insertErr) throw new Error(`buyer_radar insert: ${insertErr.message}`);

          const siteUrl = "https://detroitwebagent.com";
          const dashLink = `${siteUrl}/my-buyer-radar?token=${inserted.dashboard_token}`;
          if (RESEND_API_KEY) {
            await dwaEmail(email, "🏭 Buyer Radar is Live — Your Dashboard is Ready", `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;text-align:center;">
    <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0;">🏭 BUYER RADAR</p>
    <h1 style="color:#fff;font-size:24px;margin:12px 0 8px;">You're In.</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Daily buyer-intent signals start flowing today.</p>
    <a href="${dashLink}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:700;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:15px;">📊 Open Your Dashboard</a>
    <p style="color:#64748b;font-size:12px;margin:20px 0 0;">Bookmark this link — it's your always-on industrial intelligence feed.</p>
  </div>
  <div style="text-align:center;margin-top:24px;">
    <p style="color:#475569;font-size:12px;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p>
  </div>
</div></body></html>`);
            await notifyMatt(
              `💰 New Buyer Radar Client — ${meta.company_name || email} (${planLabel})`,
              `<p><strong>${meta.company_name || email}</strong><br>Email: ${email}<br>Contact: ${meta.contact_name || "n/a"}<br>Phone: ${meta.phone || "n/a"}<br>Tier: ${planLabel}<br>Vertical: ${meta.vertical || "steel"}<br>Dashboard: <a href="${dashLink}">${dashLink}</a></p>`
            );
          }
          if (meta.phone) {
            await sendSMS(
              meta.phone,
              "+13139921219",
              `Buyer Radar is live. Your industrial intelligence dashboard: ${dashLink} — Reply STOP to opt out.`,
              "buyer_radar_welcome"
            );
          }
        } catch (e) {
          console.error("[WEBHOOK] buyer_radar_subscription error:", e);
          await notifyMatt(`🚨 Buyer Radar provision FAILED — ${email || "unknown"}`, `<p>Error: ${e instanceof Error ? e.message : String(e)}</p>`).catch(() => {});
          return new Response(JSON.stringify({ error: "provisioning failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // === Golden Ticket Marketplace — a la carte lead purchase ===
      if (meta.type === "marketplace_lead_purchase") {
        const email = (meta.buyer_email || customerEmail || "").toLowerCase();
        const lead_id = meta.lead_id;
        const product = meta.product;
        try {
          if (!email || !lead_id || !product) throw new Error("missing buyer_email/lead_id/product");

          // Read configurable TTL (defaults to 30 days)
          let ttlDays = 30;
          try {
            const { data: ttlRow } = await sb.from("marketplace_settings" as any)
              .select("value_int").eq("key", "access_ttl_days").maybeSingle();
            if (ttlRow && (ttlRow as any).value_int) ttlDays = (ttlRow as any).value_int;
          } catch { /* default ok */ }
          const accessExpiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

          // Atomic claim: only mark sold if we still own the pending lock
          const { data: claim, error: claimErr } = await (sb.from as any)("marketplace_lead_locks")
            .update({
              status: "sold",
              stripe_session_id: session.id,
              stripe_payment_intent_id: (session.payment_intent as string) || null,
              stripe_charge_id: ((session as any).latest_charge as string) || null,
              sold_at: new Date().toISOString(),
              access_expires_at: accessExpiresAt,
              revoked_at: null,
              revoke_reason: null,
            })
            .eq("lead_id", lead_id)
            .eq("product", product)
            .in("status", ["pending", "soft_lock", "claimed"])
            .eq("buyer_email", email)
            .select("id");
          if (claimErr) throw new Error(`lock claim: ${claimErr.message}`);

          // Merge any anonymous browsing history into this confirmed buyer
          const anonId = (meta.anon_session_id as string) || null;
          if (anonId) {
            try {
              await (sb.rpc as any)("merge_anon_buyer_views", {
                p_anon_session_id: anonId,
                p_buyer_email: email,
              });
            } catch (mergeErr) {
              console.warn("[mp anon merge]", mergeErr);
            }
          }

          if (!claim || claim.length === 0) {
            // Race lost or already sold — treat as duplicate but don't 500 (would re-trigger Stripe retries)
            await notifyMatt(`⚠️ Marketplace duplicate claim — ${email} on ${lead_id}`,
              `<p>Lead ${lead_id} (${product}) already sold or lock missing for ${email}. Refund check?</p>`).catch(()=>{});
            return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
          }

          // GHOST-3 fix: await PDF generation so failures alert Matt rather than silently dropping
          try {
            const pdfRes = await fetch(`${SUPABASE_URL}/functions/v1/marketplace-generate-dossier-pdf`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({ lead_id, product, buyer_email: email }),
              signal: AbortSignal.timeout(25_000),
            });
            if (!pdfRes.ok) throw new Error(`PDF function returned ${pdfRes.status}`);
          } catch (pdfErr) {
            console.error("[mp pdf trigger] failed:", pdfErr);
            await notifyMatt(
              `⚠️ Marketplace PDF FAILED — ${lead_id.slice(0, 8)} for ${email}`,
              `<p>Error: ${String(pdfErr)}</p><p>Manually trigger: POST /marketplace-generate-dossier-pdf with lead_id=${lead_id} product=${product} buyer_email=${email}</p>`
            ).catch(() => {});
          }

          // Fetch the unlocked lead for the email
          const { data: lead } = await (sb.from as any)("unified_lead_marketplace_view")
            .select("*").eq("id", lead_id).maybeSingle();

          const dashLink = `https://detroitwebagent.com/lead/${lead_id}?paid=1&buyer=${encodeURIComponent(email)}`;
          const productLabel = ({mortgage:"Mortgage",talent:"Talent",demand:"Demand",growth:"Growth",supply:"Supply"} as any)[product] || product;

          if (RESEND_API_KEY) {
            // GHOST-2 fix: stamp email_sent_at on success so reconcile cron knows delivery happened
            await dwaEmail(email, `🎟 Your ${productLabel} Dossier is Unlocked`, `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;">
    <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0;">🎟 Golden Ticket · Unlocked</p>
    <h1 style="color:#fff;font-size:22px;margin:8px 0 16px;">Your ${productLabel} dossier is ready.</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 16px;">${(lead as any)?.human_summary || "Full intelligence, contact details, and suggested openers — ready to action now."}</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${dashLink}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:700;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:15px;">📂 Open Dossier</a>
    </div>
    <p style="color:#fbbf24;font-size:12px;border-top:1px solid #1e3a5f;padding-top:16px;margin:16px 0 0;"><strong>TCPA reminder:</strong> Verify Established Business Relationship or written consent before texting. Manual send only — DWA never auto-texts on your behalf.</p>
  </div>
  <p style="color:#475569;font-size:11px;text-align:center;margin-top:16px;">Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p>
</div></body></html>`);
          }
          // GHOST-2 fix: stamp delivery timestamp so reconcile cron knows email was sent
          // Check if buyer is a First Look subscriber — flag the lock accordingly
          const { data: flSub } = await (sb.from as any)("marketplace_first_look_subscribers")
            .select("id")
            .eq("email", email)
            .eq("status", "active")
            .maybeSingle();
          await sb.from("marketplace_lead_locks" as any)
            .update({ email_sent_at: new Date().toISOString(), first_look_active: !!flSub })
            .eq("lead_id", lead_id)
            .eq("product", product);

          await notifyMatt(
            `💰 Marketplace sale — ${productLabel} · ${email}`,
            `<p><strong>${email}</strong> bought ${productLabel} lead <code>${lead_id.slice(0,8)}</code><br>${(lead as any)?.city || ""} ${(lead as any)?.zip || ""} · score ${(lead as any)?.score || "?"}/10</p>`
          ).catch(()=>{});

          await sendSMS(ADMIN_PHONE, "+13139921219",
            `💰 Marketplace: ${email} bought ${productLabel} lead. Score ${(lead as any)?.score || "?"}/10.`,
            "marketplace_sale_admin").catch(()=>{});

          // Purchase confirmation SMS to the buyer (item 41)
          try {
            const { data: buyerProfile } = await (sb.from as any)("profiles")
              .select("phone").eq("email", email).maybeSingle();
            const buyerPhone = (buyerProfile as any)?.phone || (meta.buyer_phone as string) || null;
            if (buyerPhone) {
              await sendSMS(buyerPhone, "+13139921219",
                `🎟 Detroit Web Agency: Your ${productLabel} dossier is unlocked. Open it: ${dashLink}  TCPA: verify EBR before texting. Reply STOP to opt out.`,
                "marketplace_purchase_confirmation").catch(()=>{});
            }
          } catch (smsErr) {
            console.warn("[mp purchase SMS]", smsErr);
          }

        } catch (e) {
          console.error("[WEBHOOK] marketplace_lead_purchase error:", e);
          await notifyMatt(`🚨 Marketplace fulfillment FAILED — ${email || "unknown"} / ${lead_id}`,
            `<p>Error: ${e instanceof Error ? e.message : String(e)}</p>`).catch(()=>{});
          return new Response(JSON.stringify({ error: "marketplace_lead_purchase failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // === Contractor Leads À La Carte purchase ===
      if (meta.type === "alacarte_lead_purchase") {
        const buyerEmail = (meta.buyer_email || customerEmail || "").toLowerCase();
        const offerId = meta.offer_id;
        const leadId = meta.lead_id;
        try {
          if (!offerId || !leadId || !buyerEmail) {
            throw new Error("missing offer_id / lead_id / buyer_email");
          }
          // Atomic claim via RPC (first-payer-wins, refunds others)
          const { data: claimResult, error: claimErr } = await (sb.rpc as any)("claim_alacarte_lead", {
            _offer_id: offerId,
            _lead_id: leadId,
            _claimer_email: buyerEmail,
            _stripe_session_id: session.id,
          });
          if (claimErr) throw claimErr;
          const claimed = (claimResult as any)?.claimed === true;

          if (claimed) {
            // Fetch lead details to send to buyer
            const { data: lead } = await (sb.from as any)("contractor_leads")
              .select("name, phone, email, project_type, message, contractor_lead_sites(trade, city)")
              .eq("id", leadId).single();
            const trade = lead?.contractor_lead_sites?.trade || "Lead";
            const city = lead?.contractor_lead_sites?.city || "";
            const html = `<h2>You won the lead — ${trade} in ${city}</h2>
              <p><strong>Homeowner:</strong> ${lead?.name || "—"}</p>
              <p><strong>Phone:</strong> <a href="tel:${lead?.phone}">${lead?.phone || "—"}</a></p>
              <p><strong>Email:</strong> ${lead?.email || "—"}</p>
              <p><strong>Project:</strong> ${lead?.project_type || "—"}</p>
              <p><strong>Notes:</strong> ${lead?.message || "—"}</p>
              <p style="margin-top:24px;color:#64748b;">Call them within 5 minutes — that's how you win.</p>`;
            await dwaEmail(buyerEmail, `🎯 You won: ${trade} lead in ${city}`, html).catch(()=>{});
            await notifyMatt(`💰 À la carte lead sold — ${buyerEmail} claimed ${trade}/${city}`, html).catch(()=>{});
          } else {
            // Refund — someone else got it first
            const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
            const paymentIntent = (session as any).payment_intent;
            if (paymentIntent) {
              await stripe.refunds.create({ payment_intent: paymentIntent, reason: "duplicate" }).catch(()=>{});
            }
            const refundHtml = `<h2>Refunded — lead already claimed</h2>
              <p>Another contractor paid for this lead seconds before you. Your card has been refunded in full.</p>
              <p>More leads coming — keep an eye on your phone.</p>`;
            await dwaEmail(buyerEmail, `Refunded — lead already claimed`, refundHtml).catch(()=>{});
          }
        } catch (e) {
          console.error("[WEBHOOK] alacarte_lead_purchase error:", e);
          await notifyMatt(`🚨 À la carte fulfillment FAILED — ${buyerEmail} / ${leadId}`,
            `<p>Error: ${e instanceof Error ? e.message : String(e)}</p>`).catch(()=>{});
          return new Response(JSON.stringify({ error: "alacarte_lead_purchase failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "marketplace_first_look_subscription") {
        const email = (meta.email || customerEmail || "").toLowerCase();
        const productKey = meta.product || "all";
        try {
          const subscriptionId = (session as any).subscription || null;
          const customerId = (session as any).customer || null;
          const { error: upErr } = await (sb.from as any)("marketplace_first_look_subscribers")
            .upsert({
              email,
              product: productKey,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              status: "active",
              updated_at: new Date().toISOString(),
            }, { onConflict: "stripe_subscription_id" });
          if (upErr) {
            console.error("[WEBHOOK] first_look upsert error:", upErr);
            return new Response(JSON.stringify({ error: "first_look_upsert_failed" }), { status: 500 });
          }

          const productLabel = productKey === "all" ? "all marketplace products" : `${productKey} leads`;
          await dwaEmail(email,
            "✅ First Look access activated",
            `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a1628;color:#e6f1ff;">
              <h1 style="color:#00d4ff;font-size:22px;margin:0 0 12px;">First Look is live</h1>
              <p>You'll now see brand-new <strong>hot</strong> leads in <strong>${productLabel}</strong> a full hour before everyone else.</p>
              <p>New hot leads → SMS within 15 minutes (subscribers).<br/>Public marketplace → 1 hour later.</p>
              <p style="margin-top:24px;"><a href="https://detroitwebagent.com/marketplace/receipts?email=${encodeURIComponent(email)}" style="background:#00d4ff;color:#0a1628;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;">View your receipts</a></p>
              <p style="font-size:11px;color:#7a8aa0;margin-top:24px;">Cancel anytime. Detroit Web Agency · matt@detroitwebagent.com</p>
            </div>`).catch(()=>{});

          await notifyMatt(`💎 First Look subscriber: ${email} (${productKey})`,
            `<p>${email} subscribed to First Look — ${productKey}.</p>`).catch(()=>{});
        } catch (e) {
          console.error("[WEBHOOK] first_look error:", e);
          await notifyMatt(`🚨 First Look subscription failed — ${email}`,
            `<p>Error: ${e instanceof Error ? e.message : String(e)}</p>`).catch(()=>{});
          return new Response(JSON.stringify({ error: "first_look_failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // === Channel 3 — Industrial Pulse public unlock ($50 snapshot OR $199/mo firehose) ===
      if (meta.type === "industrial_pulse_snapshot" || meta.type === "industrial_pulse_firehose") {
        const email = (meta.email || customerEmail || "").toLowerCase();
        const isSubscription = meta.type === "industrial_pulse_firehose";
        const planLabel = isSubscription ? "$199/mo Firehose" : "$50 Snapshot";
        try {
          if (!email) throw new Error("missing email");

          if (meta.unlock_id) {
            const { error: upErr } = await (sb.from as any)("industrial_pulse_unlocks").update({
              status: "active",
              activated_at: new Date().toISOString(),
              stripe_customer_id: session.customer as string || null,
              stripe_subscription_id: session.subscription as string || null,
            }).eq("id", meta.unlock_id);
            if (upErr) console.error("[ipu unlock update]", upErr.message);
          } else {
            await (sb.from as any)("industrial_pulse_unlocks").insert({
              email,
              plan: isSubscription ? "firehose_199" : "snapshot_50",
              status: "active",
              stripe_session_id: session.id,
              stripe_customer_id: session.customer as string || null,
              stripe_subscription_id: session.subscription as string || null,
              amount_cents: isSubscription ? 19900 : 5000,
              activated_at: new Date().toISOString(),
              week_start: new Date().toISOString().slice(0, 10),
              metadata: { business_name: meta.business_name || null, fallback_insert: true },
            });
          }

          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: signals } = await (sb.from as any)("industry_pulse_signals")
            .select("company_name, location, industry, hiring_roles, hiring_count, predicted_needs, confidence")
            .gte("detected_at", sevenDaysAgo)
            .gte("confidence", 7)
            .order("confidence", { ascending: false })
            .limit(isSubscription ? 50 : 25);

          const rows = (signals || []).map((s: any) => `
            <tr>
              <td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#fff;font-weight:600;">${s.company_name || "—"}</td>
              <td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#94a3b8;font-size:12px;">${s.location || "Metro Detroit"}</td>
              <td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#cbd5e1;font-size:12px;">${(s.hiring_count || "?")}× ${(s.hiring_roles || []).join(", ")}</td>
              <td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#64748b;font-size:11px;">${(s.predicted_needs || []).slice(0,3).join(" · ")}</td>
              <td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#00d4ff;font-weight:700;text-align:center;">${s.confidence || "-"}/10</td>
            </tr>`).join("");

          if (RESEND_API_KEY) {
            await dwaEmail(email,
              `🔓 Unlocked — ${(signals || []).length} Metro Detroit hiring signals`,
              `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;">
<div style="max-width:680px;margin:0 auto;padding:24px;">
  <div style="border-bottom:2px solid #00d4ff;padding-bottom:16px;margin-bottom:20px;">
    <div style="font-size:11px;letter-spacing:3px;color:#00d4ff;font-weight:700;text-transform:uppercase;">DETROIT INDUSTRIAL PULSE — ${planLabel}</div>
    <h1 style="color:#fff;font-size:22px;margin:8px 0 4px;">Your unlock is ready.</h1>
    <p style="color:#64748b;font-size:13px;margin:0;">${(signals || []).length} signals from the last 7 days · confidence ≥ 7/10</p>
  </div>
  <table style="width:100%;border-collapse:collapse;background:#0a1628;border:1px solid #1e3a5f;border-radius:6px;">
    <thead><tr style="background:#0f1e3a;">
      <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;letter-spacing:1px;">COMPANY</th>
      <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;letter-spacing:1px;">LOCATION</th>
      <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;letter-spacing:1px;">HIRING</th>
      <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;letter-spacing:1px;">SPEND</th>
      <th style="padding:10px;text-align:center;color:#00d4ff;font-size:11px;letter-spacing:1px;">CONF</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="5" style="padding:20px;color:#64748b;text-align:center;">No signals yet — radar refreshes hourly. Reply to this email and I'll send a fresh batch.</td></tr>`}</tbody>
  </table>
  ${isSubscription ? `<p style="color:#94a3b8;font-size:13px;margin-top:20px;">You're on the daily firehose — new signals arrive every morning.</p>` : `<p style="color:#94a3b8;font-size:13px;margin-top:20px;">This was a one-week unlock. Want every signal, every day? <a href="https://www.detroitwebagent.com/industrial-pulse?unlock=1" style="color:#00d4ff;">Upgrade to firehose →</a></p>`}
  <p style="color:#475569;font-size:12px;margin-top:24px;border-top:1px solid #1e3a5f;padding-top:12px;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p>
</div></body></html>`);

            await notifyMatt(
              `💰 Industrial Pulse — ${planLabel} · ${email}`,
              `<p><strong>${meta.business_name || email}</strong> just unlocked the ${planLabel}. Sent ${(signals || []).length} signals.</p>`
            );
          }
        } catch (e) {
          console.error("[WEBHOOK] industrial_pulse error:", e);
          await notifyMatt(`🚨 Industrial Pulse fulfillment FAILED — ${email}`, `<p>${e instanceof Error ? e.message : String(e)}</p>`).catch(() => {});
          return new Response(JSON.stringify({ error: "fulfillment failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }


      // ── DOMAIN BREACH REPORT — $19 one-time ──────────────────────────────────
      if (meta.type === "domain_breach_report") {
        try {
          const email = meta.customer_email || meta.email || customerEmail;
          if (email && meta.domain) {
            fetch(`${SUPABASE_URL}/functions/v1/deliver-domain-breach-report`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({ customer_email: email, domain: meta.domain, stripe_session_id: session.id }),
            }).catch((e) => console.error("[WEBHOOK] deliver-domain-breach-report failed:", e));
            console.log(`[WEBHOOK] domain_breach_report triggered for ${email} — ${meta.domain}`);
          }
        } catch (e) {
          console.error("[WEBHOOK] domain_breach_report error:", e);
          return new Response(JSON.stringify({ error: "domain_breach_report failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── KEYWORD GAP REPORT — $19 one-time ────────────────────────────────────
      if (meta.type === "keyword_gap_report") {
        try {
          const email = meta.customer_email || meta.email || customerEmail;
          if (email && meta.your_domain && meta.competitor_domain) {
            fetch(`${SUPABASE_URL}/functions/v1/deliver-keyword-gap-report`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({ customer_email: email, your_domain: meta.your_domain, competitor_domain: meta.competitor_domain, stripe_session_id: session.id }),
            }).catch((e) => console.error("[WEBHOOK] deliver-keyword-gap-report failed:", e));
            console.log(`[WEBHOOK] keyword_gap_report triggered for ${email}`);
          }
        } catch (e) {
          console.error("[WEBHOOK] keyword_gap_report error:", e);
          return new Response(JSON.stringify({ error: "keyword_gap_report failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
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

      // ── CONTRACTOR TERRITORY LOCK — set active_contractor_id on payment ────
      if (meta.type === "contractor_lead_subscription" && meta.contractor_id && meta.trade && meta.city) {
        try {
          const slug = `${String(meta.trade).toLowerCase()}-${String(meta.city).toLowerCase().replace(/\s+/g, "-")}`;
          // Ensure contractor_clients row is active and has stripe subscription ID
          await sb.from("contractor_clients")
            .update({ active: true, stripe_subscription_id: session.subscription as string || null })
            .eq("id", meta.contractor_id);
          // Lock the territory — find by slug first, fall back to trade+city match
          const { data: site } = await sb.from("contractor_lead_sites")
            .select("id, active_contractor_id")
            .or(`slug.eq.${slug},and(trade.ilike.${meta.trade},city.ilike.${meta.city})`)
            .maybeSingle();
          if (site) {
            await sb.from("contractor_lead_sites")
              .update({ active_contractor_id: meta.contractor_id, active: true })
              .eq("id", site.id);
            console.log(`[WEBHOOK] Territory locked: ${meta.trade} in ${meta.city} → contractor ${meta.contractor_id}`);
          } else {
            // Territory row doesn't exist yet — insert it
            await sb.from("contractor_lead_sites").insert({
              trade: meta.trade,
              city: meta.city,
              state: meta.state || "MI",
              slug,
              active_contractor_id: meta.contractor_id,
              active: true,
              monthly_fee_cents: session.amount_total || 39900,
            });
            console.log(`[WEBHOOK] New territory created and locked: ${slug}`);
          }
        } catch (e) {
          console.error("[WEBHOOK] contractor territory lock failed:", e instanceof Error ? e.message : String(e));
          await notifyMatt(`⚠️ Territory lock failed for ${meta.trade}/${meta.city} — contractor ${meta.contractor_id}. Fix manually in admin.`);
        }
      }

      // ── PROSPECT NUDGE CONVERSION TRACKING ─────────────────────────────────
      // If contractor checkout came from an admin-generated tracked link, set paid_at.
      if (meta.type === "contractor_lead_subscription" && meta.ref) {
        try {
          await sb.from("prospect_nudges")
            .update({ paid_at: new Date().toISOString(), status: "converted" })
            .eq("link_token", meta.ref)
            .is("paid_at", null);
        } catch (e) {
          console.error("[WEBHOOK] prospect_nudges paid_at update failed:", e);
        }
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
                    html: `<p>Hey ${referrerProfile.athlete_name || referrerProfile.full_name || ""},</p><p>Your friend just booked a session at M2 Development — and that means you earned a <strong>free session</strong>!</p><p>Head to <a href="https://www.mattmichelstraining.com/schedule">Schedule</a> to book yours.</p><p>— Matt</p>`,
                  }),
                }).catch((emailErr) => console.error("[WEBHOOK] Referral reward email failed for", referrerProfile.email, emailErr));
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
            await dwaEmail(email, "Your Dark Web Monitor is Active — First Scan Starting Now", dwaEmailHtml({
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
        } catch (e) {
          console.error("[WEBHOOK] dark_web_monitor error:", e);
          return new Response(JSON.stringify({ error: "dark_web_monitor failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── SEO GUARD — $29/mo with 7-day trial ──────────────────────────────
      if (meta.type === "seo_guard_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await (sb.from as any)("seo_guard_clients").upsert({
              email,
              business_name: meta.business_name || null,
              website_url: meta.website_url || "",
              phone: meta.phone || null,
              keywords: meta.keywords ? meta.keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : [],
              active: true,
              stripe_customer_id: session.customer as string || null,
              stripe_subscription_id: session.subscription as string || null,
              trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            }, { onConflict: "email" });

            await dwaEmail(email, "Your SEO Guard is Active — First Report Arrives Monday", dwaEmailHtml({
              greeting: `Hey${meta.business_name ? " " + meta.business_name + " team" : ""} —`,
              headline: "Your SEO Guard is Active",
              body: `<p style="margin:0 0 12px"><strong>We're now monitoring your website for SEO issues every week.</strong></p>
<p style="margin:0 0 8px">🔍 <strong>Website monitored:</strong> ${meta.website_url}</p>
<p style="margin:0 0 8px">📊 <strong>Keywords tracked:</strong> ${meta.keywords || "none set yet"}</p>
<p style="margin:0 0 8px">📬 <strong>Weekly reports</strong> — every Monday you'll get a full SEO check</p>
<p style="margin:0 0 8px">📱 <strong>SMS alerts</strong> — if a keyword drops 3+ spots or Google de-indexes a page</p>
<p style="margin:0 0 8px">🤖 <strong>Monthly AI audit</strong> — plain-English summary of your biggest issues + fixes</p>
<p style="margin:0 0 16px">🆓 <strong>7-day free trial</strong> — your first bill is in 7 days</p>
<p style="margin:0;color:#64748b;font-size:13px">Your first report will arrive next Monday morning.</p>`,
              cta: { text: "Text Matt With Questions", url: "sms:+13139921219" },
            }));
            await notifyMatt(
              `💰 New SEO Guard — ${meta.business_name || email} ($29/mo trial)`,
              `<p><strong>${meta.business_name || email}</strong><br>Email: ${email}<br>URL: ${meta.website_url || "n/a"}<br>Keywords: ${meta.keywords || "none"}<br>Phone: ${meta.phone || "n/a"}</p>`
            );
          }
        } catch (e) {
          console.error("[WEBHOOK] seo_guard error:", e);
          return new Response(JSON.stringify({ error: "seo_guard failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
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
            await dwaEmail(email, "Your Dark Web Monitor MSP Plan is Active — Up to 10 Domains", dwaEmailHtml({
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
        } catch (e) {
          console.error("[WEBHOOK] dark_web_monitor_reseller error:", e);
          return new Response(JSON.stringify({ error: "dark_web_monitor_reseller failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── EMPLOYEE CREDENTIAL AUDIT — $149 one-time ─────────────────────────
      if (meta.type === "employee_credential_audit") {
        const auditId = meta.audit_id;
        fetch(`${SUPABASE_URL}/functions/v1/employee-credential-scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
          body: JSON.stringify({ audit_id: auditId }),
        }).catch((e: unknown) => console.error("[WEBHOOK] employee-credential-scan fire error:", e));
        // Update stripe_session_id on the audit record
        try {
          const sb2 = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
          await sb2.from("employee_credential_audits").update({ stripe_session_id: session.id as string }).eq("id", auditId);
        } catch (e) {
          console.error("[WEBHOOK] employee_credential_audit session_id update error:", e);
          return new Response(JSON.stringify({ error: "employee_credential_audit session_id update failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── NEW HIRE BREACH CHECK — $9.99 one-time HIBP screen ───────────────────
      if (meta.type === "new_hire_breach_check") {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/new-hire-breach-check`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
            body: JSON.stringify({
              candidate_name: meta.candidate_name,
              candidate_email: meta.candidate_email,
              requester_email: meta.requester_email,
              is_test: meta.is_test === "true",
              stripe_session_id: session.id,
            }),
          });
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`new-hire-breach-check ${res.status}: ${body.slice(0, 200)}`);
          }
        } catch (e) {
          console.error("[WEBHOOK] new_hire_breach_check error:", e);
          await notifyMatt(
            `🚨 New Hire Breach Check FAILED — ${meta.requester_email || "unknown"} paid $9.99 but no report delivered`,
            `<p>Error: ${e instanceof Error ? e.message : String(e)}</p><p>Session: ${session.id}</p><p>Candidate: ${meta.candidate_email}</p><p>Manual fix: invoke new-hire-breach-check directly.</p>`
          ).catch(() => {});
          return new Response(JSON.stringify({ error: "report delivery failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
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
      await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

      // ── WAVE 4: STORM DAMAGE LEAD BLASTER ──────────────────────────────────
      if (meta.type === "storm_lead_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("storm_lead_clients" as any).upsert({
              email,
              business_name: meta.business_name || meta.name || email,
              phone: meta.phone || null,
              zip_codes: meta.zip_codes ? meta.zip_codes.split(",").map((z: string) => z.trim()) : [],
              trade: meta.trade || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            await Promise.all([
              fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }, body: JSON.stringify({ email, type: "storm_lead_subscription", name: meta.business_name || meta.name }) }),
              notifyMatt(
                `💰 New Storm Damage Leads client — ${meta.business_name || email} ($29/mo)`,
                `<p><strong>${meta.business_name || email}</strong><br>${email} | ${meta.phone || "no phone"}<br>Trade: ${meta.trade || "—"} | Zips: ${meta.zip_codes || "—"}</p>`
              ),
            ]);
          }
        } catch (e) {
          console.error("[WEBHOOK] storm_lead_subscription error:", e);
          return new Response(JSON.stringify({ error: "storm_lead_subscription failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WAVE 4: RECALL ALERT SERVICE ────────────────────────────────────────
      if (meta.type === "recall_alert_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("recall_alert_clients" as any).upsert({
              email,
              business_name: meta.business_name || meta.name || email,
              phone: meta.phone || null,
              industry: meta.industry || null,
              product_categories: meta.product_categories ? meta.product_categories.split(",").map((c: string) => c.trim()) : [],
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            await Promise.all([
              fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }, body: JSON.stringify({ email, type: "recall_alert_subscription", name: meta.business_name || meta.name }) }),
              notifyMatt(
                `💰 New Recall Alert client — ${meta.business_name || email} ($19/mo)`,
                `<p><strong>${meta.business_name || email}</strong><br>${email} | ${meta.phone || "no phone"}<br>Industry: ${meta.industry || "—"}</p>`
              ),
            ]);
          }
        } catch (e) {
          console.error("[WEBHOOK] recall_alert_subscription error:", e);
          return new Response(JSON.stringify({ error: "recall_alert_subscription failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WAVE 4: PERMIT WATCH ─────────────────────────────────────────────────
      if (meta.type === "permit_watch_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("permit_watch_clients" as any).upsert({
              email,
              business_name: meta.business_name || meta.name || email,
              phone: meta.phone || null,
              city: meta.city || "Grosse Pointe",
              state: meta.state || "MI",
              trades: meta.trades ? meta.trades.split(",").map((t: string) => t.trim()) : [],
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            await Promise.all([
              fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }, body: JSON.stringify({ email, type: "permit_watch_subscription", name: meta.business_name || meta.name }) }),
              notifyMatt(
                `💰 New Permit Watch client — ${meta.business_name || email} ($29/mo)`,
                `<p><strong>${meta.business_name || email}</strong><br>${email} | ${meta.phone || "no phone"}<br>Location: ${meta.city || "—"}, ${meta.state || "MI"} | Trades: ${meta.trades || "—"}</p>`
              ),
            ]);
          }
        } catch (e) {
          console.error("[WEBHOOK] permit_watch_subscription error:", e);
          return new Response(JSON.stringify({ error: "permit_watch_subscription failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WAVE 4: WEBSITE SPEED AUDIT ──────────────────────────────────────────
      if (meta.type === "speed_audit_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("speed_audit_clients" as any).upsert({
              email,
              business_name: meta.business_name || meta.name || email,
              website_url: meta.website_url || "",
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            await Promise.all([
              fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }, body: JSON.stringify({ email, type: "speed_audit_subscription", name: meta.business_name || meta.name }) }),
              notifyMatt(
                `💰 New Website Speed Audit client — ${meta.business_name || email} ($29/mo)`,
                `<p><strong>${meta.business_name || email}</strong><br>${email}<br>URL: ${meta.website_url || "—"}</p>`
              ),
            ]);
          }
        } catch (e) {
          console.error("[WEBHOOK] speed_audit_subscription error:", e);
          return new Response(JSON.stringify({ error: "speed_audit_subscription failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WAVE 4: AI BEDTIME STORIES ───────────────────────────────────────────
      if (meta.type === "bedtime_story_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("bedtime_story_clients" as any).upsert({
              parent_email: email,
              child_name: meta.child_name || "your child",
              child_age: meta.child_age ? parseInt(meta.child_age) : 5,
              interests: meta.interests ? meta.interests.split(",").map((i: string) => i.trim()) : [],
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "parent_email" });
            await Promise.all([
              fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }, body: JSON.stringify({ email, type: "bedtime_story_subscription", name: meta.child_name || "your child" }) }),
              notifyMatt(
                `💰 New AI Bedtime Stories subscriber — ${email} ($4.99/mo)`,
                `<p>${email}<br>Child: ${meta.child_name || "—"}, age ${meta.child_age || "5"}<br>Interests: ${meta.interests || "—"}</p>`
              ),
            ]);
          }
        } catch (e) {
          console.error("[WEBHOOK] bedtime_story_subscription error:", e);
          return new Response(JSON.stringify({ error: "bedtime_story_subscription failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WAVE 4: NEIGHBORHOOD CRIME DIGEST ───────────────────────────────────
      if (meta.type === "crime_digest_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("crime_digest_clients" as any).upsert({
              email,
              business_name: meta.business_name || meta.name || null,
              phone: meta.phone || null,
              zip_code: meta.zip_code || "48236",
              city: meta.city || null,
              state: meta.state || "MI",
              client_type: meta.client_type || "property_manager",
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            await Promise.all([
              fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }, body: JSON.stringify({ email, type: "crime_digest_subscription", name: meta.business_name || meta.name }) }),
              notifyMatt(
                `💰 New Crime Digest subscriber — ${meta.business_name || email} ($19/mo)`,
                `<p><strong>${meta.business_name || email}</strong><br>${email} | ${meta.phone || "no phone"}<br>Zip: ${meta.zip_code || "—"} | ${meta.city || "—"}, ${meta.state || "MI"}</p>`
              ),
            ]);
          }
        } catch (e) {
          console.error("[WEBHOOK] crime_digest_subscription error:", e);
          return new Response(JSON.stringify({ error: "crime_digest_subscription failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── WAVE 4: BUSINESS LICENSE MONITOR ────────────────────────────────────
      if (meta.type === "license_monitor_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("license_monitor_clients" as any).upsert({
              email,
              business_name: meta.business_name || meta.name || email,
              phone: meta.phone || null,
              state: meta.state || "MI",
              license_types: meta.license_types ? meta.license_types.split(",").map((l: string) => l.trim()) : [],
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            await Promise.all([
              fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }, body: JSON.stringify({ email, type: "license_monitor_subscription", name: meta.business_name || meta.name }) }),
              notifyMatt(
                `💰 New License Monitor client — ${meta.business_name || email} ($25/mo)`,
                `<p><strong>${meta.business_name || email}</strong><br>${email} | ${meta.phone || "no phone"}<br>State: ${meta.state || "MI"} | License types: ${meta.license_types || "—"}</p>`
              ),
            ]);
          }
        } catch (e) {
          console.error("[WEBHOOK] license_monitor_subscription error:", e);
          return new Response(JSON.stringify({ error: "license_monitor_subscription failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── SITE RADAR — $49/mo visitor tracking ─────────────────────────────
      if (meta.type === "site_radar_subscription") {
        try {
          const email = (meta.email || customerEmail || "").toLowerCase();
          if (email) {
            const scriptKey = crypto.randomUUID().replace(/-/g, "");
            await (sb.from as any)("field_crm_clients").upsert({
              email,
              business_name: meta.businessName || meta.business_name || null,
              website: meta.website || null,
              industry: "agency",
              status: "active",
              monthly_price: 49,
              visitor_script_key: scriptKey,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            const scriptTag = `&lt;script src="https://detroitwebagent.com/radar.js?key=${scriptKey}" async&gt;&lt;/script&gt;`;
            await dwaEmail(email, "SiteRadar is Live — Install Your Tracking Script", `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">📡 SITERADAR</p><h1 style="color:#fff;font-size:24px;margin:0 0 8px;">You're in. One step to go.</h1><p style="color:#94a3b8;font-size:14px;margin:0 0 20px;">Paste this script tag before &lt;/body&gt; on your site and you'll start seeing visitor intel within minutes:</p><div style="background:#0d1f3c;border:1px solid #1e3a5f;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;color:#00d4ff;word-break:break-all;margin:0 0 20px;">${scriptTag}</div><p style="color:#64748b;font-size:12px;margin:0;">Questions? Text Matt at <a href="sms:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p></div><p style="color:#475569;font-size:11px;text-align:center;margin-top:16px;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p></div></body></html>`);
            await notifyMatt(
              `💰 New SiteRadar client — ${meta.businessName || meta.business_name || email} ($49/mo)`,
              `<p><strong>${meta.businessName || meta.business_name || email}</strong><br>Email: ${email}<br>Website: ${meta.website || "n/a"}<br>Script key: ${scriptKey}</p>`
            );
          }
        } catch (e) {
          console.error("[WEBHOOK] site_radar_subscription error:", e);
          await markFulfilled(false, e instanceof Error ? e.message : String(e), "site_radar_subscription");
          return new Response(JSON.stringify({ error: "site_radar_subscription failed" }), { status: 500 });
        }
        await markFulfilled(true, "site_radar_subscription"); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── MISSED CALL TEXT-BACK — $99/mo with 7-day trial ──────────────────
      if (meta.type === "missed_call_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("missed_call_clients" as any).upsert({
              email,
              contact_name: meta.name || null,
              business_name: meta.businessName || meta.business_name || null,
              business_phone: meta.phone || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            const { data: mcRow } = await sb.from("missed_call_clients" as any)
              .select("dashboard_token").eq("email", email).maybeSingle();
            const mcToken = (mcRow as any)?.dashboard_token || "";
            const mcDashUrl = `https://detroitwebagent.com/my-missed-call${mcToken ? `?token=${mcToken}` : ""}`;
            const mcBizName = meta.businessName || meta.business_name || meta.name || "there";
            await dwaEmail(email, "Missed Call Catch is Active — Never Lose a Lead Again", `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">📞 MISSED CALL CATCH</p><h1 style="color:#fff;font-size:24px;margin:0 0 8px;">You're live, ${mcBizName}.</h1><p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Every missed call now gets an instant text-back from your business. No lead slips through.</p><div style="text-align:center;margin:0 0 24px;"><a href="${mcDashUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:800;font-size:15px;padding:14px 40px;border-radius:8px;text-decoration:none;">View Your Dashboard →</a><p style="color:#64748b;font-size:12px;margin:10px 0 0;">See your call stats and current response message.</p></div><div style="background:#0d1f3c;border:1px solid #1e3a5f;border-radius:12px;padding:20px;"><p style="color:#fff;font-weight:700;font-size:13px;margin:0 0 10px;">WHAT HAPPENS NEXT:</p><p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">• Calls to your number forward to our system automatically</p><p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">• Missed calls get an instant text-back with your custom message</p><p style="margin:0;color:#e2e8f0;font-size:13px;">• Reply to this email if you want to update your response message</p></div></div><p style="color:#475569;font-size:11px;text-align:center;margin-top:16px;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p></div></body></html>`);
            await notifyMatt(
              `💰 New Missed Call client — ${meta.businessName || meta.business_name || email} ($99/mo)`,
              `<p><strong>${meta.businessName || meta.business_name || email}</strong><br>${email} | ${meta.phone || "no phone"}</p>`
            );
          }
        } catch (e) {
          console.error("[WEBHOOK] missed_call_subscription error:", e);
          return new Response(JSON.stringify({ error: "missed_call_subscription failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── FIELDDESK — $199/mo field service CRM ────────────────────────────
      if (meta.type === "field_crm_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            await sb.from("field_crm_clients" as any).upsert({
              email,
              contact_name: meta.name || null,
              business_name: meta.company || meta.business_name || null,
              industry: meta.industry || "field_service",
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            const { data: fdRow } = await sb.from("field_crm_clients" as any)
              .select("dispatch_token").eq("email", email).maybeSingle();
            const dispatchToken = (fdRow as any)?.dispatch_token || "";
            const dispatchUrl = `https://detroitwebagent.com/field-service/dispatch${dispatchToken ? `?token=${dispatchToken}` : ""}`;
            const fdBizName = meta.company || meta.business_name || meta.name || "there";
            await dwaEmail(email, "FieldDesk is Live — Your Dispatch Board is Ready", `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">⚙️ FIELDDESK</p><h1 style="color:#fff;font-size:24px;margin:0 0 8px;">FieldDesk is live, ${fdBizName}.</h1><p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Your dispatch board, job tracking, and tech mobile app are ready.</p><div style="text-align:center;margin:0 0 24px;"><a href="${dispatchUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:800;font-size:15px;padding:14px 40px;border-radius:8px;text-decoration:none;">Open Dispatch Board →</a><p style="color:#64748b;font-size:12px;margin:10px 0 0;">Bookmark this link — it's your private dashboard access.</p></div><div style="background:#0d1f3c;border:1px solid #1e3a5f;border-radius:12px;padding:20px;"><p style="color:#fff;font-weight:700;font-size:13px;margin:0 0 12px;">TWO QUICK SETUP STEPS:</p><p style="margin:0 0 10px;color:#e2e8f0;font-size:13px;"><span style="background:#00d4ff;color:#0a1628;font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;margin-right:8px;">STEP 1</span>Reply with your tech list — names and cell numbers</p><p style="margin:0;color:#e2e8f0;font-size:13px;"><span style="background:#00d4ff;color:#0a1628;font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;margin-right:8px;">STEP 2</span>Techs install the mobile app: <a href="https://detroitwebagent.com/field-service/tech" style="color:#00d4ff;">detroitwebagent.com/field-service/tech</a></p></div></div><p style="color:#475569;font-size:11px;text-align:center;margin-top:16px;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p></div></body></html>`);
            await notifyMatt(
              `💰 New FieldDesk client — ${meta.company || meta.business_name || email} ($199/mo)`,
              `<p><strong>${meta.company || meta.business_name || email}</strong><br>${email} | ${meta.phone || "no phone"}<br>Industry: ${meta.industry || "not specified"}<br>Plan: ${meta.plan || "standalone"}</p>`
            );
            // Bundle Missed-Call free with FieldDesk
            await sb.from("missed_call_clients" as any).upsert({
              email,
              business_name: meta.company || meta.business_name || null,
              business_phone: meta.phone || null,
              active: true,
              bundled_with: "fielddesk",
              stripe_customer_id: session.customer as string || null,
              dashboard_token: crypto.randomUUID(),
            }, { onConflict: "email", ignoreDuplicates: true }).catch(() => {});
            if (meta.phone) {
              const { sendSMS } = await import("../_shared/twilio.ts");
              await sendSMS({ to: meta.phone, body: `Good news — Missed-Call Text-Back is included free with your FieldDesk plan. Any missed call now gets an instant text-back to that customer. — Matt, Detroit Web Agency\nReply STOP to opt out` }).catch(() => {});
            }
          }
        } catch (e) {
          console.error("[WEBHOOK] field_service_subscription error:", e);
          return new Response(JSON.stringify({ error: "field_service_subscription failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── CONTRACTOR LEADS — dedicated welcome email with dashboard link ─────
      if (meta.type === "contractor_lead_subscription") {
        try {
          const email = meta.email || customerEmail;
          if (email) {
            // Fetch roi_token so we can include the dashboard link in the welcome email
            const { data: contractorRow } = await sb
              .from("contractor_clients")
              .select("id, roi_token, business_name, trade, city")
              .eq("email", email)
              .maybeSingle();
            const roiToken = (contractorRow as any)?.roi_token;
            const dashUrl = roiToken
              ? `https://detroitwebagent.com/contractor-portal/${roiToken}`
              : `https://detroitwebagent.com/my-contractor-leads`;
            const trade = (contractorRow as any)?.trade || meta.trade || "your trade";
            const city = (contractorRow as any)?.city || meta.city || "your area";
            const bizName = (contractorRow as any)?.business_name || meta.business_name || meta.name || "there";
            await dwaEmail(
              email,
              "You're Locked In — Your Exclusive Lead Territory is Live",
              `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;">
    <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">📍 CONTRACTOR LEAD NETWORK</p>
    <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">You're locked in, ${bizName}.</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Your exclusive ${trade} territory in ${city} is reserved. Every lead that comes in goes straight to you — no other contractor gets it.</p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${dashUrl}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:700;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:15px;">📊 Open Your Lead Dashboard</a>
    </div>
    <div style="background:#0d1f3c;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin:0 0 20px;">
      <p style="color:#fff;font-weight:700;font-size:13px;margin:0 0 12px;letter-spacing:0.5px;">WHAT HAPPENS NEXT:</p>
      <p style="margin:0 0 10px;color:#e2e8f0;font-size:13px;"><span style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;margin-right:8px;">STEP 1</span>Reply with the best phone number to text leads to</p>
      <p style="margin:0 0 10px;color:#e2e8f0;font-size:13px;"><span style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;margin-right:8px;">STEP 2</span>Your landing page goes live within 24–48 hours</p>
      <p style="margin:0;color:#e2e8f0;font-size:13px;"><span style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;margin-right:8px;">STEP 3</span>Leads arrive with name, phone, email + project details</p>
    </div>
    <div style="background:#0d1f3c;border-left:3px solid #00d4ff;padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 20px;">
      <p style="color:#94a3b8;font-size:13px;margin:0;">Unlike Angi or Thumbtack, every lead is exclusive to you. No bidding wars. No shared contacts. One contractor per trade per city — period.</p>
    </div>
    <p style="color:#64748b;font-size:12px;margin:0;">Questions? Text or call Matt: <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p>
  </div>
</div></body></html>`
            );
            await notifyMatt(
              `💰 New Contractor Leads client — ${bizName} (${trade} in ${city})`,
              `<p><strong>${bizName}</strong><br>Email: ${email}<br>Trade: ${trade}<br>City: ${city}<br>Phone: ${meta.phone || "n/a"}<br>Dashboard: <a href="${dashUrl}">${dashUrl}</a></p>`
            );
            // Bundle Missed-Call free with Contractor Leads
            await sb.from("missed_call_clients" as any).upsert({
              email,
              business_name: bizName !== "there" ? bizName : null,
              business_phone: meta.phone || null,
              active: true,
              bundled_with: "contractor_leads",
              stripe_customer_id: session.customer as string || null,
              dashboard_token: crypto.randomUUID(),
            }, { onConflict: "email", ignoreDuplicates: true }).catch(() => {});
            if (meta.phone) {
              const { sendSMS } = await import("../_shared/twilio.ts");
              await sendSMS({ to: meta.phone, body: `Good news — Missed-Call Text-Back is included free with your Contractor Leads plan. Any missed call now gets an instant text-back to that customer. — Matt, Detroit Web Agency\nReply STOP to opt out` }).catch(() => {});
            }
          }
        } catch (e) {
          console.error("[WEBHOOK] contractor_lead_subscription welcome email error:", e);
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── GBP SAAS — $49-99/mo Google Business Profile automation ─────────────
      if (meta.type === "gbp_subscription") {
        const email = meta.email || customerEmail;
        if (email) {
          try {
            await sb.from("gbp_saas_clients" as any).upsert({
              email,
              business_name: meta.business_name || meta.name || null,
              phone: meta.phone || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            await Promise.all([
              fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }, body: JSON.stringify({ email, type: "gbp_saas_subscription", name: meta.business_name || meta.name }) }),
              notifyMatt(`💰 New GBP Saas client — ${meta.business_name || email}`, `<p>${email} | ${meta.phone || "no phone"}</p>`),
            ]);
          } catch (e) { console.error("[WEBHOOK] gbp_subscription error:", e); }
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── SOCIAL MEDIA AI — $199-299/mo ────────────────────────────────────────
      if (meta.type === "social_media_subscription") {
        const email = meta.email || customerEmail;
        if (email) {
          try {
            await sb.from("social_media_clients" as any).upsert({
              email,
              business_name: meta.business_name || meta.name || null,
              phone: meta.phone || null,
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            await Promise.all([
              fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }, body: JSON.stringify({ email, type: "social_media_subscription", name: meta.business_name || meta.name }) }),
              notifyMatt(`💰 New Social Media AI client — ${meta.business_name || email}`, `<p>${email} | ${meta.phone || "no phone"}</p>`),
            ]);
          } catch (e) { console.error("[WEBHOOK] social_media_subscription error:", e); }
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── FIELD REP TOOLS — $29/mo AI tool suite ───────────────────────────────
      if (meta.type === "field_rep_subscription") {
        const email = meta.email || customerEmail;
        if (email) {
          try {
            await sb.from("b2b_subscribers" as any).upsert({
              email,
              niche: "field_rep_tools",
              active: true,
              stripe_subscription_id: session.subscription as string || null,
            }, { onConflict: "email" });
            await Promise.all([
              fetch(`${SUPABASE_URL}/functions/v1/auto-onboard`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }, body: JSON.stringify({ email, type: "field_rep_subscription", name: meta.name }) }),
              notifyMatt(`💰 New Field Rep Tools subscriber — ${email} ($29/mo)`, `<p>${email}</p>`),
            ]);
          } catch (e) { console.error("[WEBHOOK] field_rep_subscription error:", e); }
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── CATCH-ALL: any subscription type not explicitly handled above ──────
      // Writes to saas_subscriptions so no paid subscriber is ever lost.
      if (meta.type && meta.type.endsWith("_subscription") && (meta.email || customerEmail)) {
        try {
          const email = meta.email || customerEmail;
          await sb.from("saas_subscriptions" as any).upsert({
            email,
            product_type: meta.type,
            business_name: meta.business_name || null,
            name: meta.name || null,
            phone: meta.phone || null,
            city: meta.city || null,
            state: meta.state || "MI",
            active: true,
            stripe_customer_id: session.customer as string || null,
            stripe_session_id: session.id,
            metadata: meta,
          }, { onConflict: "email,product_type" });
          await sendM2Email(
            email,
            "You're in — we're setting things up for you",
            m2Email({
              greeting: `Hi ${meta.name || "there"},`,
              headline: "Your subscription is confirmed",
              body: `<p>Thanks for subscribing! We've received your payment and <strong>${meta.business_name ? meta.business_name + " is" : "you are"} all set</strong>.</p>
<p>Matt will reach out within 24 hours to complete your onboarding and make sure everything is running smoothly.</p>
<p>Questions in the meantime? Text or call anytime.</p>`,
              cta: { text: "Text Matt Now", url: "sms:+13139921219" },
            })
          );
          await notifyMatt(
            `💰 New subscriber — ${meta.type.replace(/_/g, " ")} — ${meta.business_name || email}`,
            `<p><strong>Product:</strong> ${meta.type}<br>
<strong>Email:</strong> ${email}<br>
<strong>Business:</strong> ${meta.business_name || "n/a"}<br>
<strong>Name:</strong> ${meta.name || "n/a"}<br>
<strong>Phone:</strong> ${meta.phone || "n/a"}<br>
<strong>City:</strong> ${meta.city || "n/a"}</p>
<p><em>This was handled by the catch-all handler — this product may need a dedicated webhook block.</em></p>`
          );
          console.log(`[WEBHOOK] catch-all: handled ${meta.type} for ${email}`);
        } catch (e) {
          console.error("[WEBHOOK] catch-all subscription error:", e);
          return new Response(JSON.stringify({ error: "catch-all subscription failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── Revenue Suite Bundle ──────────────────────────────────────────
      if (meta.type === "bundle_revenue_suite") {
        try {
          const email = meta.email || customerEmail;
          const tables = [
            "review_monitor_clients", "sms_blast_clients", "noshow_clients",
            "estimate_drip_clients", "invoice_chaser_clients", "afterjob_drip_clients",
            "promo_blaster_clients", "slow_day_clients",
          ];
          await Promise.all(
            tables.map((t) =>
              sb.from(t).upsert(
                { email, business_name: meta.business_name || "", phone: meta.phone || "", active: true },
                { onConflict: "email" }
              )
            )
          );
          await dwaEmail(
            email,
            "Revenue Suite is Live — All 8 Tools Are Active",
            `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">⚙️ REVENUE SUITE</p><h1 style="color:#fff;font-size:24px;margin:0 0 8px;">You're live, ${meta.business_name || "there"}.</h1><p style="color:#94a3b8;font-size:14px;margin:0 0 16px;">All 8 automated revenue tools are now active:</p><ul style="color:#e2e8f0;font-size:13px;padding-left:20px;margin:0 0 24px;"><li>Review Monitor</li><li>Weekly SMS Blast</li><li>No-Show Re-Booker</li><li>Estimate Follow-Up Drip</li><li>Invoice Chaser</li><li>After-Job Drip</li><li>Seasonal Promo Blaster</li><li>Slow Day SMS</li></ul><p style="color:#94a3b8;font-size:13px;margin:0;">I'll reach out within 24 hours to configure everything for your business. Text anytime: <a href="sms:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p></div><p style="color:#475569;font-size:11px;text-align:center;margin-top:16px;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p></div></body></html>`
          );
          await notifyMatt(
            `🔥 Revenue Suite sold — ${meta.business_name || email}`,
            `<p><strong>Revenue Suite ($299/mo)</strong> purchased!<br>Email: ${email}<br>Business: ${meta.business_name || "n/a"}<br>Phone: ${meta.phone || "n/a"}<br>City: ${meta.city || "n/a"}</p><p>All 8 tables upserted. Welcome email sent.</p>`
          );
          console.log(`[WEBHOOK] Revenue Suite: ${email} — all 8 products activated`);
        } catch (e) {
          console.error("[WEBHOOK] Revenue Suite error:", e);
          return new Response(JSON.stringify({ error: "Revenue Suite failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AGENCY ANNUAL PREPAY ($25K Territory Lock) ───────────────────────
      if (meta.type === "agency_annual_prepay" && meta.agency_id) {
        try {
          const { data: agency } = await sb
            .from("staffing_agency_clients")
            .select("id, agency_name, contact_email, vertical, territory_counties")
            .eq("id", meta.agency_id)
            .maybeSingle();

          await sb
            .from("staffing_agency_clients")
            .update({
              pricing_model: "territory_lock",
              territory_exclusive: true,
              annual_prepay_cents: 2500000,
            })
            .eq("id", meta.agency_id);

          // Create territory locks for each county (12 months)
          if (agency?.territory_counties?.length && agency?.vertical) {
            const expiresAt = new Date(Date.now() + 365 * 86400 * 1000).toISOString();
            for (const county of agency.territory_counties) {
              await sb.from("agency_territory_locks").insert({
                agency_id: agency.id,
                vertical: agency.vertical,
                county,
                active: true,
                expires_at: expiresAt,
              });
            }
          }

          await notifyMatt(
            `🎯 TERRITORY LOCK SOLD — $25K — ${agency?.agency_name || "agency"}`,
            `<p><strong>$25,000 annual prepay received!</strong></p><p>Agency: ${agency?.agency_name}<br>Vertical: ${agency?.vertical}<br>Counties: ${agency?.territory_counties?.join(", ") || "n/a"}<br>Email: ${agency?.contact_email}</p><p>Territory locks created for 12 months. Their feed is now exclusive.</p>`
          );
          console.log(`[WEBHOOK] Agency annual prepay: ${meta.agency_id}`);
        } catch (e) {
          console.error("[WEBHOOK] Agency annual prepay error:", e);
          return new Response(JSON.stringify({ error: "agency_annual_prepay processing failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AGENCY PERFORMANCE SETUP (card saved, no upfront charge) ─────────
      if (meta.type === "agency_performance_setup" && meta.agency_id) {
        try {
          const setupSession = session as any;
          const setupIntentId = setupSession.setup_intent as string | null;
          let paymentMethodId: string | null = null;

          if (setupIntentId) {
            try {
              const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
              paymentMethodId = setupIntent.payment_method as string | null;
            } catch (e) { console.error("[WEBHOOK] Failed to retrieve SetupIntent:", e); }
          }

          if (paymentMethodId) {
            await sb
              .from("staffing_agency_clients")
              .update({ stripe_payment_method_id: paymentMethodId })
              .eq("id", meta.agency_id);
          }

          const { data: agency } = await sb
            .from("staffing_agency_clients")
            .select("agency_name, contact_email, vertical")
            .eq("id", meta.agency_id)
            .maybeSingle();

          await notifyMatt(
            `💳 Agency card saved — ${agency?.agency_name || "agency"}`,
            `<p><strong>Performance Feed activated.</strong></p><p>Agency: ${agency?.agency_name}<br>Email: ${agency?.contact_email}<br>Vertical: ${agency?.vertical}</p><p>Card saved. Will auto-charge $250 per booked interview via Fast-Track button.</p>`
          );
          console.log(`[WEBHOOK] Agency card saved: ${meta.agency_id}`);
        } catch (e) {
          console.error("[WEBHOOK] Agency performance setup error:", e);
          return new Response(JSON.stringify({ error: "agency_performance_setup processing failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── Dead Lead Billing Setup — card saved, activate auto-charge ─────────────
      if (meta.type === "dead_lead_billing_setup") {
        try {
          const setupIntentId = (session as any).setup_intent as string | null;
          let paymentMethodId: string | null = null;
          if (setupIntentId) {
            const si = await stripe.setupIntents.retrieve(setupIntentId);
            paymentMethodId = si.payment_method as string | null;
          }
          if (paymentMethodId && meta.contractor_id) {
            await (sb.from as any)("contractor_clients")
              .update({ stripe_payment_method_id: paymentMethodId, dead_lead_billing_active: true })
              .eq("id", meta.contractor_id);
            const { data: cRow } = await (sb.from as any)("contractor_clients")
              .select("email, business_name, roi_token")
              .eq("id", meta.contractor_id)
              .maybeSingle();
            const cEmail = (cRow as any)?.email;
            const cBiz = (cRow as any)?.business_name || "there";
            const statsUrl = (cRow as any)?.roi_token
              ? `https://detroitwebagent.com/dead-lead-stats?token=${(cRow as any).roi_token}`
              : "https://detroitwebagent.com";
            if (cEmail) {
              await dwaEmail(cEmail, "You're Set — Auto-Billing is Active for Dead Lead Recovery",
                `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">♻️ DEAD LEAD REACTIVATION</p><h1 style="color:#fff;font-size:22px;margin:0 0 8px;">Card saved, ${cBiz}.</h1><p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Auto-billing is live. Every time one of your dead leads replies YES, you'll be notified instantly and $50 is charged automatically — no invoice, no waiting.</p><div style="text-align:center;margin:0 0 24px;"><a href="${statsUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:800;font-size:15px;padding:14px 40px;border-radius:8px;text-decoration:none;">View Your Campaign Stats →</a></div><div style="background:#0d1f3c;border:1px solid #1e3a5f;border-radius:12px;padding:20px;"><p style="color:#fff;font-weight:700;font-size:13px;margin:0 0 10px;">WHAT HAPPENS NEXT:</p><p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">• Your dead leads get a 3-text SMS drip starting tomorrow at 10am</p><p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">• You get an instant text when someone replies interested</p><p style="margin:0;color:#e2e8f0;font-size:13px;">• $50 is auto-charged only on positive replies — nothing if no one responds</p></div></div><p style="color:#475569;font-size:11px;text-align:center;margin-top:16px;">Matt Michels · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p></div></body></html>`
              );
            }
            await notifyMatt(
              `💳 Dead lead card saved — ${cBiz}`,
              `<p><strong>${cBiz}</strong> saved card. Auto-$50 fires on positive replies.<br>Contractor ID: ${meta.contractor_id}</p>`
            );
          }
        } catch (e) {
          console.error("[WEBHOOK] dead_lead_billing_setup error:", e);
          return new Response(JSON.stringify({ error: "dead_lead_billing_setup failed" }), { status: 500 });
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── Dead Lead Pilot — $1 proof-of-concept, fires first batch of texts ──
      if (meta.type === "dead_lead_pilot") {
        try {
          const email = meta.email || customerEmail;
          const bizName = meta.business_name || email || "there";
          const contractorId = meta.contractor_id || null;

          // Retrieve the PaymentIntent to save the payment method for future $50 charges
          const pi = session.payment_intent
            ? await stripe.paymentIntents.retrieve(session.payment_intent as string)
            : null;
          const pmId = pi?.payment_method as string | null;

          if (contractorId && pmId) {
            await (sb.from as any)("contractor_clients")
              .update({ stripe_payment_method_id: pmId, pilot_active: true, dead_lead_billing_active: true })
              .eq("id", contractorId);
          } else if (email) {
            // Pilot from cold ad landing page — upsert a minimal contractor record
            const { data: existing } = await (sb.from as any)("contractor_clients")
              .select("id").eq("email", email).maybeSingle();
            if (!existing) {
              await (sb.from as any)("contractor_clients").insert({
                email,
                business_name: meta.business_name || null,
                stripe_customer_id: session.customer as string || null,
                stripe_payment_method_id: pmId || null,
                pilot_active: true,
                dead_lead_billing_active: true,
              });
            } else {
              await (sb.from as any)("contractor_clients")
                .update({ stripe_payment_method_id: pmId || null, pilot_active: true, dead_lead_billing_active: true })
                .eq("id", existing.id);
            }
          }

          // Welcome email
          if (email) {
            await dwaEmail(email, "Your $1 Pilot is Live — We're Texting Your Old Leads",
              `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;"><p style="color:#ff6b35;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">♻️ DEAD LEAD REACTIVATION — PILOT</p><h1 style="color:#fff;font-size:22px;margin:0 0 8px;">You're in, ${bizName}.</h1><p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">We're texting your first batch of old leads within 24-48 hours. You'll be notified the moment someone replies. Card on file: $50 charged per interested reply — $0 if nobody responds.</p><div style="background:#0d1f3c;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin:0 0 20px;"><p style="color:#fff;font-weight:700;font-size:13px;margin:0 0 10px;">YOUR NEXT STEP:</p><p style="margin:0;color:#e2e8f0;font-size:13px;">Reply to this email with your contact list (spreadsheet, CSV, CRM export — any format). We'll handle the rest.</p></div><p style="color:#64748b;font-size:13px;margin:0;">Questions? Call or text Matt: <a href="tel:+13139921219" style="color:#ff6b35;">(313) 992-1219</a></p></div></div></body></html>`
            ).catch(() => {});
          }
          await notifyMatt(
            `🎯 $1 Dead Lead pilot started — ${bizName}`,
            `<p><strong>${bizName}</strong> paid $1 for pilot.<br>Email: ${email || "unknown"}<br>Contractor ID: ${contractorId || "new"}<br>Watch for replies — send lead list request if they don't respond within 2 hours.</p>`
          );
        } catch (e) {
          console.error("[WEBHOOK] dead_lead_pilot error:", e);
        }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI PHONE ANSWERING — $149/mo ─────────────────────────────────────
      if (meta.type === "phone_answering_subscription") {
        try {
          const email = meta.email || customerEmail;
          const bizName = meta.businessName || meta.business_name || meta.name || "there";
          if (email) {
            await dwaEmail(email, "AI Phone Answering is Live", `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">📞 AI PHONE ANSWERING</p><h1 style="color:#fff;font-size:24px;margin:0 0 8px;">You're live, ${bizName}.</h1><p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Your AI receptionist is ready. Reply to this email with your business hours and the forwarding number you want calls routed to, and I'll have it answering within 24 hours.</p><p style="color:#94a3b8;font-size:13px;margin:0;">Questions? Just reply or text (313) 992-1219. — Matt</p></div></div></body></html>`);
            await notifyMatt(`💰 New AI Phone Answering — ${bizName} ($149/mo)`, `<p><strong>${bizName}</strong><br>${email} | ${meta.phone || "no phone"}</p><p>ACTION: Set up Twilio routing.</p>`);
          }
        } catch (e) { console.error("[WEBHOOK] phone_answering_subscription error:", e); return new Response(JSON.stringify({ error: "phone_answering failed" }), { status: 500 }); }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI ESTIMATE GENERATOR — $99/mo ───────────────────────────────────
      if (meta.type === "estimate_generator_subscription") {
        try {
          const email = meta.email || customerEmail;
          const bizName = meta.businessName || meta.business_name || meta.name || "there";
          if (email) {
            await dwaEmail(email, "AI Estimate Generator is Active", `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">📋 AI ESTIMATE GENERATOR</p><h1 style="color:#fff;font-size:24px;margin:0 0 8px;">You're in, ${bizName}.</h1><p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Generate professional estimates in 60 seconds. Reply with your trade and your pricing model and I'll preload your templates so the first estimate is ready to send today.</p><p style="color:#94a3b8;font-size:13px;margin:0;">— Matt · (313) 992-1219</p></div></div></body></html>`);
            await notifyMatt(`💰 New AI Estimate Generator — ${bizName} ($99/mo)`, `<p><strong>${bizName}</strong><br>${email} | ${meta.industry || ""} ${meta.city || ""}</p><p>ACTION: Preload pricing templates.</p>`);
          }
        } catch (e) { console.error("[WEBHOOK] estimate_generator_subscription error:", e); return new Response(JSON.stringify({ error: "estimate_generator failed" }), { status: 500 }); }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI REPUTATION DASHBOARD ──────────────────────────────────────────
      if (meta.type === "reputation_dashboard_subscription") {
        try {
          const email = meta.email || customerEmail;
          const bizName = meta.businessName || meta.business_name || meta.name || "there";
          if (email) {
            await dwaEmail(email, "Reputation Dashboard is Active", `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">⭐ REPUTATION DASHBOARD</p><h1 style="color:#fff;font-size:24px;margin:0 0 8px;">Welcome, ${bizName}.</h1><p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Reply with your Google Business Profile URL (or just your business address) and I'll have your dashboard wired in within 24 hours. You'll get instant alerts for every new review.</p><p style="color:#94a3b8;font-size:13px;margin:0;">— Matt · (313) 992-1219</p></div></div></body></html>`);
            await notifyMatt(`💰 New Reputation Dashboard — ${bizName}`, `<p><strong>${bizName}</strong><br>${email}<br>Website: ${meta.website || "n/a"}</p>`);
          }
        } catch (e) { console.error("[WEBHOOK] reputation_dashboard_subscription error:", e); return new Response(JSON.stringify({ error: "reputation failed" }), { status: 500 }); }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AI ADS COPY ──────────────────────────────────────────────────────
      if (meta.type === "ads_copy_subscription") {
        try {
          const email = meta.email || customerEmail;
          const bizName = meta.businessName || meta.business_name || meta.name || "there";
          if (email) {
            await dwaEmail(email, "AI Ads Copy is Live", `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">🎯 AI ADS COPY</p><h1 style="color:#fff;font-size:24px;margin:0 0 8px;">You're in, ${bizName}.</h1><p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">First ad pack drops in your inbox within 24 hours. Reply if you want a specific offer or angle prioritized.</p><p style="color:#94a3b8;font-size:13px;margin:0;">— Matt · (313) 992-1219</p></div></div></body></html>`);
            await notifyMatt(`💰 New AI Ads Copy — ${bizName}`, `<p><strong>${bizName}</strong><br>${email}<br>City: ${meta.city || ""}<br>Services: ${meta.services || ""}</p><p>ACTION: Send first ad pack within 24h.</p>`);
          }
        } catch (e) { console.error("[WEBHOOK] ads_copy_subscription error:", e); return new Response(JSON.stringify({ error: "ads_copy failed" }), { status: 500 }); }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── AUDIT REPORT (one-off) ───────────────────────────────────────────
      if (meta.type === "audit_report") {
        try {
          const email = meta.email || customerEmail;
          const bizName = meta.businessName || meta.business_name || meta.name || "there";
          if (email) {
            await dwaEmail(email, "Your Audit Report is Being Built", `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">📊 AUDIT REPORT</p><h1 style="color:#fff;font-size:24px;margin:0 0 8px;">Got it, ${bizName}.</h1><p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Your full audit (SEO, GBP, citations, speed, and competitor gap) lands in this inbox within 48 hours. No fluff — just the things that move revenue.</p><p style="color:#94a3b8;font-size:13px;margin:0;">— Matt · (313) 992-1219</p></div></div></body></html>`);
            await notifyMatt(`💰 New Audit Report — ${bizName}`, `<p><strong>${bizName}</strong><br>${email}<br>Website: ${meta.website || ""}</p><p>ACTION: Build audit within 48h.</p>`);
          }
        } catch (e) { console.error("[WEBHOOK] audit_report error:", e); return new Response(JSON.stringify({ error: "audit_report failed" }), { status: 500 }); }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // ── DJ Conley Forever-Pricing subscription ────────────────────────────
      if (meta.type === "djconley_subscription") {
        try {
          const email = (meta.email || (session.customer_details as Record<string, string>)?.email || "").toLowerCase();
          const tier = meta.tier || "core";
          const lockedCents = parseInt(meta.locked_price_cents || "49900", 10);
          if (email) {
            await sb.from("client_price_locks").upsert({
              client_email: email,
              product: tier,
              locked_monthly_price: lockedCents / 100,
              stripe_subscription_id: session.subscription as string || null,
              notes: "Price locked for the lifetime of this subscription. Carve-outs apply only to net-new product lines launched 24+ months from start date, and only with 60-day written notice.",
              locked_since: new Date().toISOString().slice(0, 10),
              active: true,
            } as any, { onConflict: "client_email,product" });
            await dwaEmail(email, "🔒 Your Forever Pricing is Locked", `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 16px;"><div style="background:#0a1628;border:1px solid #00d4ff;border-radius:16px;padding:32px;"><p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px;">🔒 FOREVER PRICING ACTIVE</p><h1 style="color:#fff;font-size:24px;margin:0 0 16px;">Welcome aboard.</h1><p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 16px;">Your monthly rate of <strong style="color:#00d4ff;">$${(lockedCents/100).toFixed(0)}/mo</strong> is locked for the lifetime of your subscription. As long as you stay active, your price never goes up — even when we add new features.</p><p style="color:#64748b;font-size:12px;margin:16px 0 0;border-top:1px solid #1e3a5f;padding-top:16px;">Carve-outs apply only to net-new product lines launched 24+ months from start date, with 60-day written notice.</p><p style="color:#94a3b8;font-size:13px;margin:24px 0 0;">— Matt · (313) 992-1219</p></div></div></body></html>`);
            await notifyMatt(`🔒 DJ Conley Forever-Lock — ${email}`, `<p><strong>${email}</strong><br>Tier: ${tier}<br>Locked at: $${(lockedCents/100).toFixed(0)}/mo</p>`);
          }
        } catch (e) { console.error("[WEBHOOK] djconley_subscription error:", e); return new Response(JSON.stringify({ error: "djconley_subscription failed" }), { status: 500 }); }
        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (meta.type === "trade_radar_subscription" && meta.vertical) {
        const vertical = meta.vertical as string;
        const zipCodesRaw = meta.zip_codes as string ?? "";
        const zipCodes = zipCodesRaw ? zipCodesRaw.split(",").map((z: string) => z.trim()).filter(Boolean) : [];
        await sb.from("trade_radar_clients").upsert({
          email: session.customer_email ?? (meta.email as string),
          vertical,
          contact_name: (meta.contact_name as string) || null,
          business_name: (meta.business_name as string) || null,
          phone: (meta.phone as string) || null,
          zip_codes: zipCodes,
          active: true,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        }, { onConflict: "email,vertical", ignoreDuplicates: false });

        const clientEmail = session.customer_email ?? (meta.email as string);
        const clientName = (meta.contact_name as string) || (meta.business_name as string) || "there";
        const verticalLabel = vertical.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const dashPath = `/${vertical.replace(/_/g, "-")}-radar`;

        await dwaEmail(clientEmail, `Welcome to ${verticalLabel} Radar — your 7-day trial has started`, `<!DOCTYPE html><html><body style="margin:0;background:#0a1628;font-family:-apple-system,sans-serif;color:#e6f1ff;"><div style="max-width:560px;margin:0 auto;padding:32px 24px;"><span style="color:#00d4ff;font-weight:800;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Detroit Web Agency</span><h1 style="color:#fff;font-size:22px;margin:24px 0 12px;">Your ${verticalLabel} Radar trial is live.</h1><p style="color:#94a3b8;line-height:1.6;">Hi ${clientName}, your 7-day free trial has started. You'll receive your first lead digest by tomorrow morning — exclusive homeowner signals in your ZIPs that nobody else is sending to ${verticalLabel.toLowerCase()} contractors.</p><p style="color:#94a3b8;margin:16px 0;"><strong style="color:#e6f1ff;">What happens next:</strong><br>• Daily email with scored leads (1–10)<br>• SMS alert when a 9+/10 lead drops<br>• No charge for 7 days, then 50% off for 3 months</p><p style="margin:28px 0 8px;"><a href="https://detroitwebagent.com${dashPath}" style="background:#00d4ff;color:#0a1628;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;">View Your Dashboard</a></p><hr style="border:0;border-top:1px solid #1e3a5f;margin:32px 0 16px;"/><p style="font-size:11px;color:#7a8aa0;">Detroit Web Agency · (313) 992-1219 · <a href="mailto:matt@detroitwebagent.com" style="color:#7a8aa0;">matt@detroitwebagent.com</a></p></div></body></html>`);

        if (meta.phone) {
          await sendSMS(meta.phone as string, `Welcome to ${verticalLabel} Radar! Your 7-day free trial just started. Expect your first leads tomorrow morning. Questions? Call (313) 992-1219. — Detroit Web Agency`);
        }

        await notifyMatt(
          `🏠 NEW Trade Radar client: ${verticalLabel}`,
          `<p>${clientEmail} signed up for ${verticalLabel} Radar — ${zipCodes.length} ZIPs configured.</p>`,
        );

        // Fire initial scan for this vertical (fire-and-forget)
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        fetch(`${SUPABASE_URL}/functions/v1/trade-radar-scanner`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
          body: JSON.stringify({ vertical, initial: true }),
        }).catch(() => {});

        await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Unmatched checkout.session.completed — log and acknowledge
      console.log(`[WEBHOOK] checkout.session.completed with unhandled meta.type: ${meta.type || "none"}`);
      await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
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
      await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // ── Invoice payment failed — deactivate product clients after 3 failures ──
    if (event.type === "invoice.payment_failed") {
      try {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        const customerEmail = invoice.customer_email as string;
        const attemptCount = invoice.attempt_count as number || 1;
        // Only deactivate after 3 failed attempts (Stripe default dunning)
        if (subscriptionId && attemptCount >= 3) {
          await Promise.all([
            sb.from("hire_alert_clients").update({ active: false }).eq("stripe_subscription_id", subscriptionId),
            sb.from("field_crm_clients").update({ active: false }).eq("stripe_subscription_id", subscriptionId),
            sb.from("missed_call_clients" as any).update({ active: false }).eq("stripe_subscription_id", subscriptionId),
          ]);
          console.log(`[WEBHOOK] Deactivated clients after ${attemptCount} failed payments for sub ${subscriptionId}`);
          await notifyMatt(
            `💸 Payment Failed (${attemptCount}x) — ${customerEmail || subscriptionId}`,
            `<p>Invoice <strong>${invoice.id}</strong> failed ${attemptCount} times.<br>Customer: ${customerEmail || "unknown"}<br>Amount: $${((invoice.amount_due || 0) / 100).toFixed(2)}<br>Subscription: ${subscriptionId}</p><p>Product clients deactivated. Customer needs to update payment method.</p>`
          ).catch(() => {});
        } else if (attemptCount === 1) {
          // First failure — notify Matt, then SMS the customer if we have their phone
          await notifyMatt(
            `⚠️ Payment Failed (1st attempt) — ${customerEmail || subscriptionId}`,
            `<p>Invoice ${invoice.id} failed. Stripe will retry automatically. No action needed yet.</p>`
          ).catch(() => {});
          // Look up customer phone from any product table
          if (customerEmail) {
            const [haResult, fcResult, mcResult, ccResult] = await Promise.all([
              sb.from("hire_alert_clients").select("owner_phone").eq("owner_email", customerEmail).maybeSingle(),
              sb.from("field_crm_clients").select("owner_phone").eq("owner_email", customerEmail).maybeSingle(),
              sb.from("missed_call_clients" as any).select("owner_phone").eq("owner_email", customerEmail).maybeSingle(),
              sb.from("contractor_clients").select("phone").eq("email", customerEmail).maybeSingle(),
            ]);
            const customerPhone = haResult.data?.owner_phone || fcResult.data?.owner_phone ||
              mcResult.data?.owner_phone || ccResult.data?.phone || null;
            if (customerPhone) {
              const portalUrl = `https://billing.stripe.com/p/login/test_00g`;
              await sendSMS(
                customerPhone,
                Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219",
                `Hey — looks like your card didn't go through for your Detroit Web Agency subscription. Quick fix: update your payment info here: https://detroitwebagent.com/billing — or reply and I'll help. — Matt`,
                "payment_failed_sms"
              ).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.error("[WEBHOOK] invoice.payment_failed error:", e);
        return new Response(JSON.stringify({ error: "invoice.payment_failed failed" }), { status: 500 });
      }
      await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // ── Unhandled event types (invoice.finalized, etc.) — acknowledge safely ──
    console.log(`[WEBHOOK] Unhandled event type: ${event.type} — acknowledging`);
    await markFulfilled(true); return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[STRIPE-WEBHOOK] Error:", msg);
    // PARTIAL-1 fix: mark this event as failed so the reconcile cron can re-fire it.
    // markFulfilled may not exist if the error happened before idempotency setup
    // (e.g. signature verification) — guard with typeof check.
    try {
      // @ts-ignore — markFulfilled is in the closure scope when reachable
      if (typeof markFulfilled === "function") await markFulfilled(false, msg);
    } catch (_) { /* swallow — best-effort */ }
    // Alert Matt on fatal webhook failures (signature errors, crashes, etc.)
    sendSMS(
      ADMIN_PHONE,
      Deno.env.get("TWILIO_PHONE_NUMBER") || "",
      `STRIPE-WEBHOOK FATAL: ${msg.slice(0, 120)}`,
      "stripe_webhook_error"
    ).catch(() => {});
    // Defense Protocol: signature verification failures = 400 (Stripe gives up).
    // ALL other errors = 500 so Stripe retries with exponential backoff.
    const isSignatureError = /signature|webhook secret/i.test(msg);
    return new Response(JSON.stringify({ error: msg }), { status: isSignatureError ? 400 : 500 });
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
