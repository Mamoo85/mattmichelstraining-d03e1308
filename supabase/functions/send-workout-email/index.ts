import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WorkoutDay {
  dayLabel: string;
  exercises: { title: string; sets: string; reps: string; notes?: string; phase?: string }[];
}

interface WorkoutProgram {
  title: string;
  description: string;
  days: WorkoutDay[];
}

function buildEmailHtml(firstName: string, program: WorkoutProgram): string {
  const phaseColors: Record<string, string> = {
    "Rolling/Soft Tissue": "#3b82f6",
    "Dynamic Warmup": "#f59e0b",
    "Main Work": "#f97316",
    "Finisher/Conditioning": "#ef4444",
    Cooldown: "#22c55e",
  };

  const daysHtml = program.days
    .map(
      (day) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid #333;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#1a1a2e;padding:12px 16px;border-bottom:1px solid #333;">
        <strong style="color:#fff;font-size:13px;text-transform:uppercase;letter-spacing:1px;">${day.dayLabel}</strong>
      </td></tr>
      ${day.exercises
        .map(
          (ex) => `
        <tr><td style="padding:10px 16px;border-bottom:1px solid #222;background:#0f0f1a;">
          <span style="color:#fff;font-weight:bold;font-size:14px;">${ex.title}</span>
          ${ex.phase ? `<span style="font-size:10px;font-weight:bold;text-transform:uppercase;padding:2px 6px;border-radius:4px;margin-left:8px;background:${phaseColors[ex.phase] || "#333"}22;color:${phaseColors[ex.phase] || "#999"};">${ex.phase}</span>` : ""}
          <br/>
          <span style="color:#999;font-size:12px;">${ex.sets} × ${ex.reps}${ex.notes ? ` — ${ex.notes}` : ""}</span>
        </td></tr>`
        )
        .join("")}
    </table>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a14;">
<tr><td align="center" style="padding:24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <!-- Header -->
    <tr><td style="text-align:center;padding:24px 0;">
      <div style="font-size:28px;font-weight:900;color:#f97316;letter-spacing:2px;">M²</div>
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:3px;">TRAINING</div>
    </td></tr>

    <!-- Greeting -->
    <tr><td style="padding:16px 0;color:#fff;font-size:16px;">
      Hey ${firstName || "there"} 👋
    </td></tr>
    <tr><td style="padding:0 0 24px;color:#ccc;font-size:14px;line-height:1.6;">
      Here's the custom workout you generated with Coach Matt's AI. Save this email — it's your Week 1 baseline.
    </td></tr>

    <!-- Program Title -->
    <tr><td style="padding:16px;background:#1a1a2e;border:1px solid #333;border-radius:8px;margin-bottom:16px;">
      <strong style="color:#f97316;font-size:16px;">🏋️ ${program.title}</strong><br/>
      <span style="color:#999;font-size:13px;">${program.description}</span>
    </td></tr>

    <tr><td style="height:16px;"></td></tr>

    <!-- Days -->
    <tr><td>${daysHtml}</td></tr>

    <!-- CTA -->
    <tr><td style="padding:32px 0;text-align:center;">
      <div style="background:linear-gradient(135deg,#f9731620,#0a0a14,#f9731610);border:2px solid #f9731666;border-radius:12px;padding:32px 24px;">
        <div style="color:#fff;font-size:18px;font-weight:900;margin-bottom:8px;">This Is Just Week 1.</div>
        <div style="color:#999;font-size:13px;margin-bottom:20px;line-height:1.5;">
          Load this routine into the M² Portal for live weight tracking, progressive overload, and form analysis from Coach Matt.
        </div>
        <a href="https://mattmichelstraining.lovable.app/auth?mode=signup"
           style="display:inline-block;background:#f97316;color:#fff;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:1px;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Load Into M² Portal →
        </a>
        <div style="color:#666;font-size:11px;margin-top:12px;">14-day free trial • $12.99/mo after • Cancel anytime</div>
      </div>
    </td></tr>

    <!-- Footer -->
    <tr><td style="text-align:center;padding:24px 0;border-top:1px solid #222;">
      <span style="color:#555;font-size:11px;">© M² Training | Matt Michel Strength & Conditioning</span>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { firstName, email, program } = await req.json();

    if (!email || !program) {
      return new Response(
        JSON.stringify({ error: "Email and program are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert lead into marketing_leads (upsert)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabaseAdmin
      .from("marketing_leads")
      .upsert(
        { email, first_name: firstName || null, source: "AI_Honeypot", updated_at: new Date().toISOString() },
        { onConflict: "email,source" }
      );

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const html = buildEmailHtml(firstName || "", program as WorkoutProgram);

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "M² Training <noreply@notify.mattmichelstraining.com>",
        to: [email],
        subject: `Your Custom Workout: ${(program as WorkoutProgram).title}`,
        html,
      }),
    });

    if (!resendResp.ok) {
      const err = await resendResp.text();
      console.error("Resend error:", err);
      throw new Error("Failed to send email");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("send-workout-email error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
