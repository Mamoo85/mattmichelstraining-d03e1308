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
    <!-- Header Bar -->
    <tr><td style="background:#f97316;padding:3px 0;"></td></tr>
    <tr><td style="text-align:center;padding:28px 0 16px;background:#0f0f1a;">
      <div style="font-size:36px;font-weight:900;color:#f97316;letter-spacing:3px;line-height:1;">M²</div>
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:4px;margin-top:4px;">TRAINING</div>
      <div style="width:40px;height:2px;background:#f97316;margin:12px auto 0;"></div>
    </td></tr>

    <!-- Greeting -->
    <tr><td style="padding:24px 24px 8px;color:#fff;font-size:18px;font-weight:bold;background:#0f0f1a;">
      Hey ${firstName || "there"} 👋
    </td></tr>
    <tr><td style="padding:0 24px 24px;color:#ccc;font-size:14px;line-height:1.6;background:#0f0f1a;">
      Here's the custom workout you generated with Coach Matt's system. Save this email — it's your Week 1 baseline.
    </td></tr>

    <!-- Program Title -->
    <tr><td style="padding:0 24px 16px;background:#0f0f1a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border:1px solid #333;border-radius:8px;">
        <tr><td style="padding:16px;">
          <strong style="color:#f97316;font-size:16px;">🏋️ ${program.title}</strong><br/>
          <span style="color:#999;font-size:13px;line-height:1.5;">${program.description}</span>
        </td></tr>
      </table>
    </td></tr>

    <!-- Days -->
    <tr><td style="padding:0 24px;background:#0f0f1a;">${daysHtml}</td></tr>

    <!-- Tech Showcase -->
    <tr><td style="padding:24px;background:#0f0f1a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e,#0f0f1a);border:1px solid #f9731633;border-radius:8px;">
        <tr><td style="padding:24px;text-align:center;">
          <div style="font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:3px;color:#f97316;margin-bottom:8px;">M² Technology Suite</div>
          <div style="font-size:16px;font-weight:900;color:#fff;margin-bottom:12px;">This Workout Is Just the Beginning.</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding:6px;text-align:center;vertical-align:top;">
                <div style="font-size:11px;font-weight:bold;color:#00d4ff;">📸 Posture Analysis</div>
                <div style="font-size:10px;color:#888;margin-top:2px;">Full skeletal scan from your phone</div>
              </td>
              <td width="50%" style="padding:6px;text-align:center;vertical-align:top;">
                <div style="font-size:11px;font-weight:bold;color:#f97316;">⚡ Velocity Tracking</div>
                <div style="font-size:10px;color:#888;margin-top:2px;">Real-time bar speed every rep</div>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding:6px;text-align:center;vertical-align:top;">
                <div style="font-size:11px;font-weight:bold;color:#e040fb;">🍽️ Nutrition Scanner</div>
                <div style="font-size:10px;color:#888;margin-top:2px;">Snap a photo, get every macro</div>
              </td>
              <td width="50%" style="padding:6px;text-align:center;vertical-align:top;">
                <div style="font-size:11px;font-weight:bold;color:#f97316;">📊 Smart Logger</div>
                <div style="font-size:10px;color:#888;margin-top:2px;">HD demos + 1-tap weight logging</div>
              </td>
            </tr>
          </table>
          <div style="margin-top:16px;font-size:11px;color:#ccc;">20+ years of expertise. All for <strong style="color:#f97316;">$19.99/mo</strong>.</div>
        </td></tr>
      </table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:16px 24px 32px;text-align:center;background:#0f0f1a;">
      <div style="background:linear-gradient(135deg,#f9731620,#0f0f1a,#f9731610);border:2px solid #f9731666;border-radius:12px;padding:32px 24px;">
        <div style="color:#fff;font-size:18px;font-weight:900;margin-bottom:8px;">Load This Into the M² Portal</div>
        <div style="color:#999;font-size:13px;margin-bottom:20px;line-height:1.5;">
          Track your weights, get progressive overload, and direct feedback from Coach Matt — a real trainer in Grosse Pointe, MI.
        </div>
        <a href="https://www.mattmichelstraining.com/auth?mode=signup&trial=true"
           style="display:inline-block;background:#f97316;color:#fff;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:1px;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Start Free Trial →
        </a>
        <div style="color:#666;font-size:11px;margin-top:12px;">14-day free trial • Credit card required • Cancel anytime</div>
      </div>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#0a0a14;padding:24px;text-align:center;border-top:1px solid #222;">
      <div style="font-size:18px;font-weight:900;color:#f97316;letter-spacing:2px;">M²</div>
      <div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:3px;margin-top:2px;">TRAINING</div>
      <div style="font-size:10px;color:#444;margin-top:8px;">Matt Michel Strength & Conditioning</div>
      <div style="font-size:10px;color:#444;">Grosse Pointe, MI</div>
    </td></tr>
  </table>
</td></tr>
</table>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>
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
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [email], bcc: ["matthewmichels4@gmail.com"],
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
