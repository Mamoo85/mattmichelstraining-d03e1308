import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
      <hr style="border:1px solid #eee;margin:20px 0;">
      <p style="font-size:12px;color:#999;">Warm-up: 5 min jump rope + arm circles + hip 90/90s before every session.</p>
    `,
  },
  "price_1TBWRzD52tPWee46IQxgPosm": {
    title: "Top 5 Exercises for Football",
    filename: "M2-Football-Guide.pdf",
    content: `
      <h2 style="color:#e85d04;margin-bottom:8px;">Top 5 Exercises for Football</h2>
      <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M² Performance Training</p>
      <hr style="border:1px solid #e85d04;margin:20px 0;">
      <h3>1. Trap Bar Deadlift</h3>
      <p><strong>Sets/Reps:</strong> 4×5 | <strong>Rest:</strong> 90s</p>
      <p><strong>WHY:</strong> Total body power from the ground up. Builds the explosive hip extension that drives blocks, tackles, and sprints.</p>
      <h3>2. Box Jump</h3>
      <p><strong>Sets/Reps:</strong> 4×4 | <strong>Rest:</strong> 60s</p>
      <p><strong>WHY:</strong> Teaches rate of force development — how fast you can produce power. Football is won in the first 3 steps.</p>
      <h3>3. Bench Press</h3>
      <p><strong>Sets/Reps:</strong> 4×6 | <strong>Rest:</strong> 90s</p>
      <p><strong>WHY:</strong> Upper body pressing strength for hand fighting, blocking, and contact. The foundation of collision prep.</p>
      <h3>4. Farmer's Carry</h3>
      <p><strong>Sets/Reps:</strong> 3×40 yards | <strong>Rest:</strong> 60s</p>
      <p><strong>WHY:</strong> Grip, core bracing, and full-body stability under load. This is functional durability in motion.</p>
      <h3>5. Bulgarian Split Squat</h3>
      <p><strong>Sets/Reps:</strong> 3×8 each leg | <strong>Rest:</strong> 60s</p>
      <p><strong>WHY:</strong> Single-leg strength prevents knee injuries and builds the unilateral power needed for cutting and acceleration.</p>
    `,
  },
  "price_1TBWSgD52tPWee46vmwnXiHe": {
    title: "Top 5 Exercises for Basketball",
    filename: "M2-Basketball-Guide.pdf",
    content: `
      <h2 style="color:#e85d04;margin-bottom:8px;">Top 5 Exercises for Basketball</h2>
      <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M² Performance Training</p>
      <hr style="border:1px solid #e85d04;margin:20px 0;">
      <h3>1. Depth Drop to Vertical Jump</h3>
      <p><strong>Sets/Reps:</strong> 4×4 | <strong>Rest:</strong> 90s</p>
      <p><strong>WHY:</strong> Trains reactive strength — the ability to absorb force and redirect it upward. This is how you actually jump higher.</p>
      <h3>2. Lateral Lunge</h3>
      <p><strong>Sets/Reps:</strong> 3×8 each side | <strong>Rest:</strong> 45s</p>
      <p><strong>WHY:</strong> Basketball is lateral. This builds hip mobility and adductor strength for defensive slides and crossover drives.</p>
      <h3>3. Nordic Hamstring Curl</h3>
      <p><strong>Sets/Reps:</strong> 3×5 | <strong>Rest:</strong> 60s</p>
      <p><strong>WHY:</strong> The #1 exercise for preventing ACL and hamstring injuries. Non-negotiable for any jumping athlete.</p>
      <h3>4. Pallof Press</h3>
      <p><strong>Sets/Reps:</strong> 3×10 each side | <strong>Rest:</strong> 30s</p>
      <p><strong>WHY:</strong> Anti-rotation core work. Builds the stability to absorb contact in the lane and finish through defenders.</p>
      <h3>5. Single-Leg Calf Raise (Slow Eccentric)</h3>
      <p><strong>Sets/Reps:</strong> 3×12 each (3s down) | <strong>Rest:</strong> 30s</p>
      <p><strong>WHY:</strong> Achilles and calf durability. Basketball puts enormous stress on these tissues — this builds the capacity to handle it.</p>
    `,
  },
  "price_1TBWSxD52tPWee465QPmHaTK": {
    title: "Hockey Strength Essentials",
    filename: "M2-Hockey-Guide.pdf",
    content: `
      <h2 style="color:#e85d04;margin-bottom:8px;">Hockey Strength Essentials</h2>
      <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M² Performance Training</p>
      <hr style="border:1px solid #e85d04;margin:20px 0;">
      <h3>1. Sumo Deadlift</h3><p><strong>Sets/Reps:</strong> 4×5 | <strong>WHY:</strong> Mimics the skating stance. Builds the adductor and glute strength that drives every stride.</p>
      <h3>2. Copenhagen Plank</h3><p><strong>Sets/Reps:</strong> 3×20s each side | <strong>WHY:</strong> Groin injury prevention. Hockey's #1 non-contact injury, and this is the #1 exercise to prevent it.</p>
      <h3>3. Single-Leg Hip Thrust</h3><p><strong>Sets/Reps:</strong> 3×10 each | <strong>WHY:</strong> Glute power on one leg — directly translates to push-off power on the ice.</p>
      <h3>4. Landmine Press</h3><p><strong>Sets/Reps:</strong> 3×8 each arm | <strong>WHY:</strong> Shoulder stability for stick handling and checking, without the overhead stress that aggravates hockey shoulders.</p>
      <h3>5. Lateral Bound</h3><p><strong>Sets/Reps:</strong> 4×5 each side | <strong>WHY:</strong> Explosive lateral power. This IS skating off the ice.</p>
    `,
  },
  "price_1TBWTFD52tPWee46fh1GttaO": {
    title: "Top 5 Exercises for Soccer",
    filename: "M2-Soccer-Guide.pdf",
    content: `
      <h2 style="color:#e85d04;margin-bottom:8px;">Top 5 Exercises for Soccer</h2>
      <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M² Performance Training</p>
      <hr style="border:1px solid #e85d04;margin:20px 0;">
      <h3>1. Single-Leg Squat to Box</h3><p><strong>Sets/Reps:</strong> 3×8 each | <strong>WHY:</strong> Soccer is played on one leg. This builds the quad and glute strength for every sprint, cut, and kick.</p>
      <h3>2. Hip Flexor March (Banded)</h3><p><strong>Sets/Reps:</strong> 3×12 each | <strong>WHY:</strong> Hip flexor strength for sprinting speed and knee drive. Most soccer injuries stem from weak hip flexors.</p>
      <h3>3. Glute Bridge Walkout</h3><p><strong>Sets/Reps:</strong> 3×8 | <strong>WHY:</strong> Hamstring and glute endurance. Prevents the hamstring pulls that sideline players late in games.</p>
      <h3>4. Side Plank with Hip Abduction</h3><p><strong>Sets/Reps:</strong> 3×10 each side | <strong>WHY:</strong> Builds lateral hip stability for change-of-direction and protects the knee from valgus collapse.</p>
      <h3>5. A-Skip Progression</h3><p><strong>Sets/Reps:</strong> 3×20 yards | <strong>WHY:</strong> Sprint mechanics drill. Teaches proper knee drive and ground contact for faster, more efficient running.</p>
    `,
  },
  "price_1TBWTVD52tPWee46MSdo6gXX": {
    title: "Top 5 Exercises for Lacrosse",
    filename: "M2-Lacrosse-Guide.pdf",
    content: `
      <h2 style="color:#e85d04;margin-bottom:8px;">Top 5 Exercises for Lacrosse</h2>
      <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M² Performance Training</p>
      <hr style="border:1px solid #e85d04;margin:20px 0;">
      <h3>1. Push-Up to Rotation</h3><p><strong>Sets/Reps:</strong> 3×8 each side | <strong>WHY:</strong> Pressing strength with rotational control. Mimics the demands of stick checks and passes.</p>
      <h3>2. Rear-Foot Elevated Split Squat</h3><p><strong>Sets/Reps:</strong> 3×8 each | <strong>WHY:</strong> Single-leg strength for acceleration and deceleration on the field.</p>
      <h3>3. Face Pull</h3><p><strong>Sets/Reps:</strong> 3×15 | <strong>WHY:</strong> Shoulder health for overhead stick work. Builds the posterior shoulder that protects against overuse injuries.</p>
      <h3>4. Sled Push</h3><p><strong>Sets/Reps:</strong> 4×20 yards | <strong>WHY:</strong> Acceleration power. Builds the drive phase that wins ground balls and transitions.</p>
      <h3>5. Dead Bug</h3><p><strong>Sets/Reps:</strong> 3×10 each side | <strong>WHY:</strong> Core stability for contact. Teaches the trunk to stay rigid while the limbs move — exactly what lacrosse demands.</p>
    `,
  },
  "price_1TBWTmD52tPWee46FaB1wcFz": {
    title: "Top 10 Exercises: Pre & Post Pregnancy",
    filename: "M2-Pregnancy-Guide.pdf",
    content: `
      <h2 style="color:#e85d04;margin-bottom:8px;">Top 10 Exercises: Pre & Post Pregnancy</h2>
      <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M² Performance Training</p>
      <hr style="border:1px solid #e85d04;margin:20px 0;">
      <h3>1. Diaphragmatic Breathing</h3><p><strong>WHY:</strong> Foundation of core recovery. Reconnects the deep core system postpartum.</p>
      <h3>2. Glute Bridge</h3><p><strong>WHY:</strong> Safe glute activation through all trimesters. Builds the posterior chain without loading the spine.</p>
      <h3>3. Bird Dog</h3><p><strong>WHY:</strong> Core stability without pressure on the abdominal wall. Safe and effective pre and post.</p>
      <h3>4. Wall Sit</h3><p><strong>WHY:</strong> Isometric leg strength that's low-impact and easily modified.</p>
      <h3>5. Side-Lying Hip Abduction</h3><p><strong>WHY:</strong> Pelvic stability. Prevents the hip and SI joint pain common in pregnancy.</p>
      <h3>6. Modified Push-Up</h3><p><strong>WHY:</strong> Maintains upper body strength with safe positioning.</p>
      <h3>7. Squat to Box</h3><p><strong>WHY:</strong> Functional movement pattern that supports daily activities.</p>
      <h3>8. Pallof Press</h3><p><strong>WHY:</strong> Anti-rotation core work safe for diastasis recti.</p>
      <h3>9. Cat-Cow</h3><p><strong>WHY:</strong> Spinal mobility and pelvic floor awareness.</p>
      <h3>10. Farmer's Walk</h3><p><strong>WHY:</strong> Full-body carry strength — directly prepares you for carrying your baby everywhere.</p>
    `,
  },
  "price_1TBWU1D52tPWee46qnvE9Zrv": {
    title: "Youth Athlete Starter Guide",
    filename: "M2-Youth-Starter-Guide.pdf",
    content: `
      <h2 style="color:#e85d04;margin-bottom:8px;">Youth Athlete Starter Guide — 4 Week Program</h2>
      <p style="font-size:14px;color:#666;margin-bottom:20px;">By Matt Michels · M² Performance Training</p>
      <hr style="border:1px solid #e85d04;margin:20px 0;">
      <h3>Week 1-2: Movement Quality</h3>
      <p>Bodyweight squat, push-up, hip hinge, lunge, plank — master these before adding load.</p>
      <h3>Week 3: Work Capacity</h3>
      <p>Circuit training: 3 rounds of 6 exercises, 30s work / 15s rest. Build the engine.</p>
      <h3>Week 4: Introduction to Strength</h3>
      <p>Goblet squat, DB press, band pull-apart, RDL — light load, perfect form, every rep.</p>
      <hr style="border:1px solid #eee;margin:20px 0;">
      <p><strong>Movement Quality Checklist:</strong> Knees track toes ✓ | Neutral spine ✓ | Full range ✓ | Controlled tempo ✓</p>
      <p><strong>For Parents:</strong> Don't rush the process. Foundation first. The strength will come — and when it does, it'll stick.</p>
    `,
  },
};

serve(async (req) => {
  // Stripe webhooks are POST only
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      // Fallback: parse without verification (dev mode)
      event = JSON.parse(body);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only handle guide payments (mode: payment)
      if (session.mode !== "payment") {
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const customerEmail = session.customer_details?.email || session.customer_email;
      const priceId = session.metadata?.priceId;

      if (!customerEmail) {
        console.error("[WEBHOOK] No customer email found on session", session.id);
        return new Response(JSON.stringify({ error: "No email" }), { status: 200 });
      }

      // Auto-add purchased guide/program to user's portal
      if (priceId && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        
        // Find user by email
        const { data: profiles } = await sb
          .from("profiles")
          .select("user_id")
          .eq("email", customerEmail)
          .limit(1);

        if (profiles && profiles.length > 0) {
          const userId = profiles[0].user_id;
          const guide = GUIDE_MAP[priceId];
          
          if (guide) {
            // Parse exercises from guide content for the portal
            const exercises = parseGuideExercises(guide.content);
            
            await sb.from("purchased_programs").insert({
              user_id: userId,
              program_title: guide.title,
              program_type: guide.title.includes("Youth") ? "starter" : "sport_guide",
              sport: extractSport(guide.title),
              exercises: JSON.stringify(exercises),
              stripe_session_id: session.id,
            });

            // Notify user their program is in the portal
            await sb.from("notifications").insert({
              user_id: userId,
              type: "program_purchased",
              title: "Program Added to Portal",
              body: `Your "${guide.title}" is now in your portal. Log lifts and ask Matt questions on any exercise.`,
              link: "/dashboard",
            });

            console.log("[WEBHOOK] Program added to portal for user:", userId);
          }
        }
      }

      if (!priceId || !GUIDE_MAP[priceId]) {
        console.log("[WEBHOOK] No guide mapping for priceId:", priceId);
        return new Response(JSON.stringify({ received: true, note: "no guide for this price" }), { status: 200 });
      }

      const guide = GUIDE_MAP[priceId];

      // Send email via Resend
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
            <p style="color:#ccc;font-size:14px;margin:0 0 12px;">Hey there,</p>
            <p style="color:#ccc;font-size:14px;margin:0 0 12px;">
              Thanks for your purchase. Here's your guide — <strong style="color:#e85d04;">${guide.title}</strong>.
              It's also been added to your M² Portal — log in to track your lifts, see your progress, and ask me questions on any exercise.
            </p>
            <p style="color:#ccc;font-size:14px;margin:0;">
              I wrote every word of this from 20+ years of training athletes. Read the <em>WHY</em> behind each exercise — 
              when you understand why, you do it better. 100% of the time.
            </p>
            <p style="color:#e85d04;font-size:14px;margin:16px 0 0;font-weight:bold;">— Matt Michels</p>
          </div>

          <div style="background:#222;padding:24px;margin-bottom:20px;">
            ${guide.content}
          </div>

          <div style="text-align:center;padding:20px;border-top:1px solid #333;">
            <p style="color:#666;font-size:11px;margin:0;">
              M² Performance Training · Detroit, MI<br>
              Questions? Text (313) 806-4952 or email matthew.michels4@gmail.com
            </p>
          </div>
        </div>
      `;

      const resendResponse = await fetch("https://api.resend.com/emails", {
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

      const resendData = await resendResponse.json();
      console.log("[WEBHOOK] Email sent:", resendData);

      if (!resendResponse.ok) {
        console.error("[WEBHOOK] Resend error:", resendData);
      }
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
