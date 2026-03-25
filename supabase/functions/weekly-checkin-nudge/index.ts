import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all users with active subscriptions
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id")
      .not("subscription_tier", "is", null);

    if (error) throw error;

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No active subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert a notification for each active user
    const notifications = profiles.map((p: any) => ({
      user_id: p.user_id,
      type: "checkin_reminder",
      title: "Weekly Check-In Reminder",
      body: "Don't forget to log your training this week. Stay consistent — that's where the results are.",
      link: "/dashboard",
    }));

    const { error: insertError } = await supabase.from("notifications").insert(notifications);
    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ message: `Sent ${notifications.length} reminders` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
