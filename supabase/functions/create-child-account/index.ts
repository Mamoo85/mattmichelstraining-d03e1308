import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Authenticate the caller
    const anonClient = createClient(supabaseUrl, anonKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");

    const callerId = userData.user.id;
    const { childEmail, childName, childPassword, adminParentOverride } = await req.json();

    // Use service role client for admin check and account creation
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Determine the parent ID
    let parentId = callerId;

    if (adminParentOverride) {
      // Verify caller is admin
      const { data: isAdmin } = await adminClient.rpc("has_role", {
        _user_id: callerId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Only admins can create accounts on behalf of parents");
      parentId = adminParentOverride;
    }

    if (!childEmail || !childName || !childPassword) {
      throw new Error("Missing required fields: childEmail, childName, childPassword");
    }

    if (childPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Create the child auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: childEmail,
      password: childPassword,
      email_confirm: true,
      user_metadata: {
        full_name: childName,
        parent_user_id: parentId,
      },
    });

    if (createError) throw new Error(`Failed to create account: ${createError.message}`);
    if (!newUser.user) throw new Error("Account creation failed");

    const childId = newUser.user.id;

    // Assign 'child' role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: childId, role: "child" });
    if (roleError) console.error("Role assignment error:", roleError);

    // Assign 'parent' role to parent if not already
    const { error: parentRoleError } = await adminClient
      .from("user_roles")
      .upsert({ user_id: parentId, role: "parent" }, { onConflict: "user_id,role" });
    if (parentRoleError) console.error("Parent role error:", parentRoleError);

    // Create parent-child link
    const { error: linkError } = await adminClient
      .from("parent_child_links")
      .insert({ parent_user_id: parentId, child_user_id: childId });
    if (linkError) throw new Error(`Failed to link accounts: ${linkError.message}`);

    // Update child profile with athlete name and account_role
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ athlete_name: childName, account_role: "athlete" })
      .eq("user_id", childId);
    if (profileError) console.error("Profile update error:", profileError);

    // Update parent profile account_role
    const { error: parentProfileError } = await adminClient
      .from("profiles")
      .update({ account_role: "parent" })
      .eq("user_id", parentId);
    if (parentProfileError) console.error("Parent profile update error:", parentProfileError);

    return new Response(
      JSON.stringify({ success: true, childId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
