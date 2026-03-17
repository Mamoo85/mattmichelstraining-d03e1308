import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = userData.user;

    // Get user profile for name
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name, athlete_name")
      .eq("user_id", user.id)
      .single();

    const athleteName = profile?.athlete_name || profile?.full_name || user.email || "Unknown";

    const body = await req.json();
    const { programTitle, exerciseName, weekNumber, dayNumber, message, videoUrl } = body;

    // Build email
    const videoSection = videoUrl
      ? `<p><strong>📹 Form Check Video:</strong> <a href="${videoUrl}" target="_blank">Watch Video</a></p>`
      : "";

    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px;">
          New Question from ${athleteName}
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 6px 12px; font-weight: bold; color: #666; width: 120px;">Program</td>
            <td style="padding: 6px 12px;">${programTitle}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; font-weight: bold; color: #666;">Week / Day</td>
            <td style="padding: 6px 12px;">Week ${weekNumber}, Day ${dayNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; font-weight: bold; color: #666;">Exercise</td>
            <td style="padding: 6px 12px;">${exerciseName}</td>
          </tr>
        </table>
        <div style="background: #f5f5f5; padding: 16px; border-left: 3px solid #333; margin: 16px 0;">
          <p style="margin: 0; white-space: pre-wrap;">${message}</p>
        </div>
        ${videoSection}
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          Sent from M² Training Portal · Reply directly to this athlete in the admin dashboard.
        </p>
      </div>
    `;

    // Send via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "M² Training <noreply@m2training.lovable.app>",
        to: ["matthewmichels4@gmail.com"],
        subject: `[M² Portal] ${athleteName} asked about ${exerciseName} — ${programTitle}`,
        html: htmlBody,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("[NOTIFY-COACH] Resend error:", errText);
      throw new Error("Failed to send email notification");
    }

    // Also create a notification in-app
    await supabaseClient.from("notifications").insert({
      user_id: user.id, // We'll find admin IDs separately
      type: "athlete_question",
      title: `Question from ${athleteName}`,
      body: `Asked about ${exerciseName} in ${programTitle} (Week ${weekNumber}, Day ${dayNumber})`,
      link: "/admin",
    });

    // Notify admins in-app
    const { data: adminRoles } = await supabaseClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRoles) {
      for (const admin of adminRoles) {
        await supabaseClient.from("notifications").insert({
          user_id: admin.user_id,
          type: "athlete_question",
          title: `Question from ${athleteName}`,
          body: `Asked about ${exerciseName} in ${programTitle} (Week ${weekNumber}, Day ${dayNumber})`,
          link: "/admin",
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[NOTIFY-COACH] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
