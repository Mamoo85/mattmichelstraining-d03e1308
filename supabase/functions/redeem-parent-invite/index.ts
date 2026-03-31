import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    // Get the calling user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Not authenticated");

    const { token } = await req.json();
    if (!token) throw new Error("Token required");

    // Look up the invite
    const { data: invite, error: inviteErr } = await supabase
      .from("parent_invite_tokens")
      .select("*")
      .eq("token", token)
      .eq("is_used", false)
      .maybeSingle();

    if (inviteErr) throw inviteErr;
    if (!invite) throw new Error("Invalid or expired invite link");
    if (invite.parent_user_id === user.id) throw new Error("You cannot redeem your own invite");

    // Check if already linked
    const { data: existing } = await supabase
      .from("parent_child_links")
      .select("id")
      .eq("parent_user_id", invite.parent_user_id)
      .eq("child_user_id", user.id)
      .maybeSingle();

    if (existing) throw new Error("Already linked to this parent");

    // Create the parent-child link
    const { error: linkErr } = await supabase
      .from("parent_child_links")
      .insert({ parent_user_id: invite.parent_user_id, child_user_id: user.id });
    if (linkErr) throw linkErr;

    // Assign child role
    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: user.id, role: "child" }, { onConflict: "user_id,role" });
    if (roleErr) console.error("Role assignment warning:", roleErr);

    // Mark invite as used
    await supabase
      .from("parent_invite_tokens")
      .update({ is_used: true, used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(JSON.stringify({ success: true, parentName: invite.child_name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err instanceof Error ? err.message : "Unknown error") }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
