import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;


const log = (msg: string, data?: any) => {
  const d = data ? ` — ${JSON.stringify(data)}` : "";
  console.log(`[GENERATE-NUTRITION-PLAN] ${msg}${d}`);
};

// Macro targets by sport/goal
function estimateMacros(sport: string, weightLbs: number, goal: string) {
  const kg = weightLbs / 2.205;
  let protein = Math.round(kg * 2.2); // 2.2g per kg for athletes
  let calories = 0;

  if (goal === "bulk") {
    calories = Math.round(35 * kg + 500); // maintenance + surplus
    protein = Math.round(kg * 2.4);
  } else if (goal === "cut") {
    calories = Math.round(30 * kg);
    protein = Math.round(kg * 2.6); // higher protein on cut
  } else {
    calories = Math.round(33 * kg);
  }

  const fatG = Math.round((calories * 0.25) / 9);
  const carbsG = Math.round((calories - protein * 4 - fatG * 9) / 4);

  return { calories, protein, carbsG, fatG };
}

function buildEmailHtml(customerEmail: string, plan: string, content: string, sport: string): string {
  const planLabel = plan === "full" ? "Full 7-Day Plan" : "Nutrition Blueprint";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a14;">
<tr><td align="center" style="padding:24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td style="background:#f97316;padding:3px 0;"></td></tr>
    <tr><td style="text-align:center;padding:24px 0 16px;background:#0f0f1a;">
      <div style="font-size:32px;font-weight:900;color:#f97316;letter-spacing:3px;">M²</div>
      <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:4px;margin-top:2px;">ATHLETE NUTRITION</div>
      <div style="width:40px;height:2px;background:#f97316;margin:10px auto 0;"></div>
    </td></tr>
    <tr><td style="padding:24px;background:#0f0f1a;color:#ccc;font-size:15px;line-height:1.7;">
      <p style="color:#fff;font-size:17px;font-weight:bold;margin-top:0;">Your ${planLabel} is ready.</p>
      <p>I built this specifically for ${sport} athletes who want to fuel performance — not just eat healthy. Every recommendation here comes from working with athletes at every level for 20+ years.</p>
      <p>Apply this for 4 weeks consistently and you'll feel the difference before you see it.</p>
      <p style="color:#f97316;font-weight:bold;">— Coach Matt Michels</p>
    </td></tr>
    <tr><td style="padding:0 24px 24px;background:#0f0f1a;">
      <div style="background:#111;border-left:3px solid #f97316;padding:24px;color:#ccc;font-size:14px;line-height:1.8;">
        ${content}
      </div>
    </td></tr>
    <tr><td style="background:#0f0f1a;padding:16px 24px 24px;text-align:center;border-top:1px solid #1a1a2e;">
      <a href="https://mattmichelstraining.com/auth?redirect=/trial-welcome" style="display:inline-block;background:#f97316;color:#fff;padding:12px 28px;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Start Your Free Training Trial</a>
      <div style="font-size:10px;color:#444;margin-top:8px;">M² Training · Grosse Pointe, MI</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}


const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      stripe_session_id,
      customer_email,
      plan = "basic",
      sport,
      weight_lbs,
      goal,
      dietary_restrictions,
      position,
    } = await req.json();

    if (!customer_email || !stripe_session_id) {
      throw new Error("customer_email and stripe_session_id are required");
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Dedup check
    const templateName = `nutrition_plan_${stripe_session_id}`;
    const { data: existingLog } = await sb
      .from("email_send_log")
      .select("id")
      .eq("template_name", templateName)
      .eq("recipient_email", customer_email)
      .maybeSingle();

    if (existingLog) {
      log("Already delivered", { customer_email });
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const weightNum = parseInt(weight_lbs) || 170;
    const macros = estimateMacros(sport || "general", weightNum, goal || "maintain");

    const isFull = plan === "full";
    const userPrompt = isFull
      ? `Create a complete 7-day meal plan for a ${sport}${position ? ` ${position}` : ""} athlete.
         Weight: ${weightNum} lbs. Goal: ${goal}. Dietary restrictions: ${dietary_restrictions || "none"}.
         Daily targets: ~${macros.calories} calories, ${macros.protein}g protein, ${macros.carbsG}g carbs, ${macros.fatG}g fat.
         Include 4 meals per day. For each day list: breakfast, lunch, dinner, snack — with ingredients and approximate macros.
         End with a Sunday meal prep guide (what to batch-cook) and a grocery list by category.
         Use clean HTML: h3 tags for day headings, p tags for meals, strong for meal names. No markdown. No backticks.`
      : `Create a concise athlete nutrition blueprint for a ${sport}${position ? ` ${position}` : ""} athlete.
         Weight: ${weightNum} lbs. Goal: ${goal}. Restrictions: ${dietary_restrictions || "none"}.
         Daily targets: ~${macros.calories} cal, ${macros.protein}g protein.
         Include: (1) macro overview (2) best pre-workout foods (3) post-workout recovery meal (4) 3 daily sample meals
         (5) top 5 foods to eat (6) top 5 foods to avoid (7) hydration tips.
         Use clean HTML. h3 for sections. No markdown. No backticks.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are Coach Matt Michels, an elite sports performance coach and certified sports nutritionist with 20+ years coaching athletes from youth to college level.
            Your nutrition advice is practical, performance-focused, and based on real athlete experience.
            Never mention AI. Write everything as your own expert recommendations. Be direct and specific.`,
          },
          { role: "user", content: userPrompt },
        ],
        max_tokens: isFull ? 2000 : 1000,
        temperature: 0.65,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI error ${aiRes.status}: ${errText}`);
    }

    const aiData = await aiRes.json();
    const generatedPlan = aiData.choices?.[0]?.message?.content || "";
    if (!generatedPlan) throw new Error("No content generated");

    // Store in DB
    await sb.from("nutrition_plan_orders" as any).upsert({
      stripe_session_id,
      customer_email,
      sport: sport || "general",
      weight_lbs: weightNum,
      goal: goal || "maintain",
      dietary_restrictions: dietary_restrictions || "",
      generated_plan: generatedPlan,
      emailed_at: new Date().toISOString(),
    }, { onConflict: "stripe_session_id" });

    // Send email
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [customer_email],
        subject: `Your ${sport} Nutrition Blueprint — From Coach Matt`,
        html: buildEmailHtml(customer_email, plan, generatedPlan, sport || "athlete"),
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      throw new Error(`Email failed: ${errText}`);
    }

    await sb.from("email_send_log").insert({
      template_name: templateName,
      recipient_email: customer_email,
    });

    log("Nutrition plan delivered", { customer_email, plan, sport });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[GENERATE-NUTRITION-PLAN] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
