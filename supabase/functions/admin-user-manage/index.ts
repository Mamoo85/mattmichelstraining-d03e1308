import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const body = await req.json();
    const { action } = body;

    // ── Redeem In-Person Invite (called by the signing-up user — verify their JWT) ──
    if (action === "redeem_ip_invite") {
      const { token } = body;
      if (!token) throw new Error("Token required");

      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
      const { data: callerData, error: callerError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
      if (callerError || !callerData.user) throw new Error("Auth failed");
      const callerUserId = callerData.user.id;

      const { data: invite, error: inviteErr } = await supabaseClient
        .from("in_person_invite_tokens")
        .select("*")
        .eq("token", token)
        .single();

      if (inviteErr || !invite) throw new Error("Invalid invite link");
      if (invite.is_used) throw new Error("This invite link has already been used");

      await supabaseClient
        .from("profiles")
        .update({ is_in_person: true })
        .eq("user_id", callerUserId);

      await supabaseClient
        .from("in_person_invite_tokens")
        .update({ is_used: true, used_at: new Date().toISOString(), used_by: callerUserId })
        .eq("id", invite.id);

      return new Response(JSON.stringify({ success: true, message: "Welcome! You're set up as an in-person client." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── All other actions require admin auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const authToken = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(authToken);
    if (userError || !userData.user) throw new Error("Auth failed");

    const { data: roleCheck } = await supabaseClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!roleCheck) throw new Error("Admin access required");

    const { targetUserId, targetEmail, targetName, linkParentId, unlinkChildId, label, updates } = body;

    // ── Update Profile ──
    if (action === "update_profile") {
      if (!targetUserId) throw new Error("User ID required");
      if (!updates || typeof updates !== "object") throw new Error("Updates object required");

      const allowedFields = ["full_name", "athlete_name", "email", "account_role"];
      const profilePatch: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const key of allowedFields) {
        if (key in updates) profilePatch[key] = updates[key];
      }

      const { error: profileErr } = await supabaseClient
        .from("profiles")
        .update(profilePatch)
        .eq("user_id", targetUserId);
      if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`);

      if (updates.email) {
        const { error: authErr } = await supabaseClient.auth.admin.updateUserById(targetUserId, {
          email: updates.email,
        });
        if (authErr) console.error("Auth email update failed:", authErr.message);
      }

      if (updates.full_name !== undefined) {
        const { error: metaErr } = await supabaseClient.auth.admin.updateUserById(targetUserId, {
          user_metadata: { full_name: updates.full_name },
        });
        if (metaErr) console.error("Auth metadata update failed:", metaErr.message);
      }

      return new Response(JSON.stringify({ success: true, message: "Profile updated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create In-Person Invite Token ──
    if (action === "create_ip_invite") {
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();

      const { error: insertErr } = await supabaseClient
        .from("in_person_invite_tokens")
        .insert({
          token,
          created_by: userData.user.id,
          label: label || null,
        });

      if (insertErr) throw new Error(`Failed to create invite: ${insertErr.message}`);

      return new Response(JSON.stringify({ success: true, token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Invite In-Person (email-based) ──
    if (action === "invite_in_person") {
      if (!targetEmail) throw new Error("Email required");

      const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase()
      );

      if (existingUser) {
        await supabaseClient
          .from("profiles")
          .update({ is_in_person: true })
          .eq("user_id", existingUser.id);

        const { error: linkError } = await supabaseClient.auth.admin.generateLink({
          type: "magiclink",
          email: targetEmail,
          options: {
             redirectTo: `${req.headers.get("origin") || "https://www.mattmichelstraining.com"}/dashboard`,
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

      await new Promise((r) => setTimeout(r, 500));
      await supabaseClient
        .from("profiles")
        .update({ is_in_person: true, full_name: targetName || null })
        .eq("user_id", newUser.user.id);

      const { error: linkError } = await supabaseClient.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
        options: {
          redirectTo: `${req.headers.get("origin") || "https://www.mattmichelstraining.com"}/dashboard`,
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
          redirectTo: `${req.headers.get("origin") || "https://www.mattmichelstraining.com"}/dashboard`,
        },
      });
      if (error) throw new Error(`Magic link failed: ${error.message}`);

      return new Response(JSON.stringify({ success: true, message: `Magic link sent to ${targetEmail}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Merge Accounts ──
    if (action === "merge_accounts") {
      const { keepUserId, mergeUserId } = body;
      if (!keepUserId || !mergeUserId) throw new Error("Both keepUserId and mergeUserId are required");
      if (keepUserId === mergeUserId) throw new Error("Cannot merge an account with itself");

      // Get both profiles
      const { data: keepProfile } = await supabaseClient.from("profiles").select("*").eq("user_id", keepUserId).single();
      const { data: mergeProfile } = await supabaseClient.from("profiles").select("*").eq("user_id", mergeUserId).single();
      if (!keepProfile || !mergeProfile) throw new Error("One or both user profiles not found");

      // Tables with user_id column to migrate
      const userIdTables = [
        "logged_exercises", "workout_logs", "progress_logs", "coach_notes",
        "lift_messages", "coach_direct_messages", "program_messages",
        "notifications", "point_transactions", "challenge_entries",
        "challenge_participants", "session_bookings", "session_credits",
        "studio_checkins", "community_workouts", "gifted_products",
        "gifted_sessions", "purchased_programs", "user_active_programs",
        "custom_program_requests", "intake_assessments", "lift_videos",
        "coach_ai_drafts", "focus_logs", "shared_workout_results",
      ];

      const migrated: Record<string, number> = {};

      for (const table of userIdTables) {
        try {
          const { data: rows } = await supabaseClient
            .from(table)
            .select("id")
            .eq("user_id", mergeUserId);
          
          if (rows && rows.length > 0) {
            await supabaseClient
              .from(table)
              .update({ user_id: keepUserId })
              .eq("user_id", mergeUserId);
            migrated[table] = rows.length;
          }
        } catch (e) {
          // Table may not exist or have different schema — skip
          console.warn(`Merge skip table ${table}:`, e);
        }
      }

      // Migrate parent_child_links (both sides)
      try {
        await supabaseClient.from("parent_child_links").update({ parent_user_id: keepUserId }).eq("parent_user_id", mergeUserId);
        await supabaseClient.from("parent_child_links").update({ child_user_id: keepUserId }).eq("child_user_id", mergeUserId);
      } catch (e) { console.warn("Merge parent_child_links:", e); }

      // Migrate family_subscription_items
      try {
        await supabaseClient.from("family_subscription_items").update({ parent_user_id: keepUserId }).eq("parent_user_id", mergeUserId);
        await supabaseClient.from("family_subscription_items").update({ member_user_id: keepUserId }).eq("member_user_id", mergeUserId);
      } catch (e) { console.warn("Merge family_subscription_items:", e); }

      // Migrate user_points — sum totals
      try {
        const { data: mergePoints } = await supabaseClient.from("user_points").select("total_points").eq("user_id", mergeUserId).single();
        if (mergePoints && mergePoints.total_points > 0) {
          await supabaseClient.rpc("award_points", {
            _user_id: keepUserId,
            _action: "admin_award",
            _points: mergePoints.total_points,
            _description: `Merged from ${mergeProfile.email}`,
          });
        }
        await supabaseClient.from("user_points").delete().eq("user_id", mergeUserId);
      } catch (e) { console.warn("Merge user_points:", e); }

      // Copy non-null profile fields from merged account if keep has them null
      const fillFields = ["athlete_name", "full_name", "phone"];
      const profilePatch: Record<string, any> = {};
      for (const field of fillFields) {
        if (!keepProfile[field] && mergeProfile[field]) {
          profilePatch[field] = mergeProfile[field];
        }
      }
      if (Object.keys(profilePatch).length > 0) {
        await supabaseClient.from("profiles").update(profilePatch).eq("user_id", keepUserId);
      }

      // Store the merged email as a linked email
      if (mergeProfile.email) {
        await supabaseClient.from("user_linked_emails").insert({
          user_id: keepUserId,
          email: mergeProfile.email,
        }).then(({ error }) => {
          if (error) console.warn("Linked email insert:", error.message);
        });
      }

      // Delete merged profile and auth user
      await supabaseClient.from("profiles").delete().eq("user_id", mergeUserId);
      const { error: deleteAuthErr } = await supabaseClient.auth.admin.deleteUser(mergeUserId);
      if (deleteAuthErr) console.error("Auth delete error:", deleteAuthErr.message);

      return new Response(JSON.stringify({
        success: true,
        message: `Merged ${mergeProfile.email} into ${keepProfile.email}`,
        migrated,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "erase_user_data") {
      if (!targetUserId) throw new Error("User ID required");

      const tables = [
        "logged_exercises", "workout_logs", "progress_logs", "coach_notes",
        "lift_messages", "coach_direct_messages", "program_messages",
        "notifications", "point_transactions", "challenge_entries",
        "challenge_participants", "session_bookings", "session_credits",
        "studio_checkins", "community_workouts", "gifted_products",
        "gifted_sessions", "purchased_programs", "user_active_programs",
        "family_subscription_items", "parent_child_links", "referral_codes",
        "referral_conversions", "subscriptions",
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
