import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, firstName } = await req.json();
    if (!email) throw new Error("Email is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert subscriber server-side as backup
    await supabase
      .from("newsletter_subscribers")
      .upsert({ email: email.toLowerCase(), source: "free-program" }, { onConflict: "email" });

    // Generate program via Lovable AI Gateway
    const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are Coach Matt Michels, a strength and conditioning specialist with 20+ years experience. Generate a 4-week beginner strength program. Return ONLY valid JSON with this structure:
{
  "title": "M² Beginner Strength Program",
  "weeks": [
    {
      "week": 1,
      "focus": "Foundation",
      "days": [
        {
          "day": "Day 1 — Full Body",
          "exercises": [
            { "name": "Goblet Squat", "sets": "3", "reps": "10", "notes": "Focus on depth" }
          ]
        }
      ]
    }
  ]
}
Include 3 training days per week. Focus on compound movements. Include warmup and cooldown. Keep it safe for true beginners ages 13+. No sled exercises.`,
          },
          { role: "user", content: "Generate a 4-week beginner strength program." },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI generation failed: ${errText}`);
    }

    const aiData = await aiRes.json();
    const programText = aiData.choices?.[0]?.message?.content;
    if (!programText) throw new Error("No program generated");

    const program = JSON.parse(programText);

    // Build HTML email
    const name = firstName || "Athlete";
    const emailHtml = buildEmailHtml(name, program);

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      },
      body: JSON.stringify({
        from: "Coach Matt <matt@notify.mattmichelstraining.com>",
        to: [email],
        subject: "Your Free 4-Week Strength Program from M² Training",
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      throw new Error(`Email send failed: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-free-program error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildEmailHtml(name: string, program: any): string {
  const weeksHtml = (program.weeks || [])
    .map((week: any) => {
      const daysHtml = (week.days || [])
        .map((day: any) => {
          const exercisesHtml = (day.exercises || [])
            .map(
              (ex: any) =>
                `<tr>
                  <td style="padding:6px 10px;border-bottom:1px solid #222;color:#e0e0e0;font-size:13px">${ex.name}</td>
                  <td style="padding:6px 10px;border-bottom:1px solid #222;color:#f97316;font-size:13px;text-align:center">${ex.sets}×${ex.reps}</td>
                  <td style="padding:6px 10px;border-bottom:1px solid #222;color:#888;font-size:12px">${ex.notes || ""}</td>
                </tr>`
            )
            .join("");

          return `<div style="margin-bottom:16px">
            <h4 style="color:#f97316;font-size:14px;margin:0 0 8px;font-weight:700">${day.day}</h4>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="border-bottom:2px solid #333">
                  <th style="text-align:left;padding:4px 10px;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:0.1em">Exercise</th>
                  <th style="text-align:center;padding:4px 10px;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:0.1em">Sets×Reps</th>
                  <th style="text-align:left;padding:4px 10px;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:0.1em">Notes</th>
                </tr>
              </thead>
              <tbody>${exercisesHtml}</tbody>
            </table>
          </div>`;
        })
        .join("");

      return `<div style="margin-bottom:28px">
        <h3 style="color:#fff;font-size:18px;margin:0 0 4px;font-weight:800">Week ${week.week} — ${week.focus}</h3>
        <div style="width:40px;height:3px;background:#f97316;margin-bottom:14px"></div>
        ${daysHtml}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px">
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="color:#fff;font-size:24px;margin:0;font-weight:900">M² TRAINING</h1>
      <p style="color:#666;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;margin:4px 0 0">Free 4-Week Beginner Strength Program</p>
    </div>
    <div style="background:#141414;border:1px solid #222;padding:24px;margin-bottom:24px">
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px">
        Hey ${name},
      </p>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px">
        Here's your free 4-week beginner strength program. This is the same foundation I use with my in-person athletes. 3 days per week, compound movements, progressive overload built in.
      </p>
      <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 24px">
        Print it, screenshot it, or just pull this email up at the gym. Let's get to work.
      </p>
      ${weeksHtml}
    </div>
    <div style="text-align:center;padding:20px 0;border-top:1px solid #222">
      <p style="color:#888;font-size:13px;margin:0 0 12px">Want real coaching behind this program?</p>
      <a href="https://www.mattmichelstraining.com/pricing" style="display:inline-block;background:#f97316;color:#fff;padding:12px 28px;font-size:13px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em">Start a Free 14-Day Trial →</a>
    </div>
    <p style="color:#444;font-size:11px;text-align:center;margin-top:20px">
      Matt Michels Training · Grosse Pointe Park, MI · matthewmichels4@gmail.com
    </p>
  </div>
</body>
</html>`;
}
