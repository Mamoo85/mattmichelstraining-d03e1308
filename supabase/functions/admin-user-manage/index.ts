import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Admin auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    const { data: roleCheck } = await supabaseClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!roleCheck) throw new Error("Admin access required");

    const { action, targetUserId, targetEmail, targetName, linkParentId, unlinkChildId } = await req.json();

    // ── Invite In-Person Client ──────────────────────────────────────
    if (action === "invite_in_person") {
      if (!targetEmail) throw new Error("Email required");

      // Check if user already exists
      const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase()
      );

      if (existingUser) {
        // User exists — just flag them as in-person
        await supabaseClient
          .from("profiles")
          .update({ is_in_person: true })
          .eq("user_id", existingUser.id);

        // Send them a magic link
        const { error: linkError } = await supabaseClient.auth.admin.generateLink({
          type: "magiclink",
          email: targetEmail,
          options: {
            redirectTo: `${req.headers.get("origin") || "https://mattmichelstraining.lovable.app"}/dashboard`,
          },
        });
        if (linkError) console.error("Magic link error:", linkError.message);

        return new Response(JSON.stringify({
          success: true,
          message: `${targetEmail} flagged as in-person client (existing account)`,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // New user — create account with auto-confirm, then flag profile
      const tempPassword = crypto.randomUUID();
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email: targetEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: targetName || "",
          account_role: "independent_adult",
        },
      });
      if (createError) throw new Error(`Account creation failed: ${createError.message}`);

      // Flag as in-person on their profile (trigger creates profile on signup)
      // Small delay to let the trigger fire
      await new Promise((r) => setTimeout(r, 500));
      await supabaseClient
        .from("profiles")
        .update({
          is_in_person: true,
          full_name: targetName || null,
        })
        .eq("user_id", newUser.user.id);

      // Send magic link so they can sign in without knowing the temp password
      const { error: linkError } = await supabaseClient.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
        options: {
          redirectTo: `${req.headers.get("origin") || "https://mattmichelstraining.lovable.app"}/dashboard`,
        },
      });
      if (linkError) console.error("Magic link error:", linkError.message);

      return new Response(JSON.stringify({
        success: true,
        message: `Invite sent to ${targetEmail} — account created with Basic access`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_magic_link") {
      if (!targetEmail) throw new Error("Email required");

      const { error } = await supabaseClient.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
        options: {
          redirectTo: `${req.headers.get("origin") || Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app")}/dashboard`,
        },
      });
      if (error) throw new Error(`Magic link failed: ${error.message}`);

      return new Response(JSON.stringify({ success: true, message: `Magic link sent to ${targetEmail}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "erase_user_data") {
      if (!targetUserId) throw new Error("User ID required");

      const tables = [
        "logged_exercises",
        "workout_logs",
        "progress_logs",
        "coach_notes",
        "lift_messages",
        "coach_direct_messages",
        "program_messages",
        "notifications",
        "point_transactions",
        "challenge_entries",
        "challenge_participants",
        "session_bookings",
        "session_credits",
        "studio_checkins",
        "community_workouts",
        "gifted_products",
        "gifted_sessions",
        "purchased_programs",
        "user_active_programs",
        "family_subscription_items",
        "parent_child_links",
        "referral_codes",
        "referral_conversions",
        "subscriptions",
      ];

      for (const table of tables) {
        await supabaseClient.from(table).delete().eq("user_id", targetUserId);
      }

      await supabaseClient.from("parent_child_links").delete().eq("parent_user_id", targetUserId);
      await supabaseClient.from("profiles").delete().eq("user_id", targetUserId);

      const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(targetUserId);
      if (deleteError) console.error("Auth user delete error:", deleteError.message);

      return new Response(JSON.stringify({ success: true, message: "User data erased" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "link_family") {
      if (!linkParentId || !targetUserId) throw new Error("Parent and child user IDs required");

      const { error } = await supabaseClient.from("parent_child_links").insert({
        parent_user_id: linkParentId,
        child_user_id: targetUserId,
      });
      if (error) throw new Error(error.message);

      return new Response(JSON.stringify({ success: true, message: "Family link created" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unlink_family") {
      if (!unlinkChildId) throw new Error("Child user ID required");

      const { error } = await supabaseClient
        .from("parent_child_links")
        .delete()
        .eq("child_user_id", unlinkChildId);
      if (error) throw new Error(error.message);

      return new Response(JSON.stringify({ success: true, message: "Family link removed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (e) {
    console.error("admin-user-manage error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
