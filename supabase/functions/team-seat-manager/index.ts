// Team Seat Manager — invite / list / revoke / accept teammates on an account
// Pricing model: flat per-account fee, unlimited seats included.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const SEAT_CAP = 10; // soft cap per owner; bump in code if you want more

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendInviteEmail(email: string, ownerEmail: string, token: string, origin: string) {
  if (!RESEND_API_KEY) return;
  const acceptUrl = `${origin}/accept-team-invite?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="background:#0a1628;color:#00d4ff;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">You've been added to a Detroit Web Agency team</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p><strong>${ownerEmail}</strong> invited you to share their account — leads, dossiers, and dashboards.</p>
        <p style="margin:24px 0">
          <a href="${acceptUrl}" style="background:#00d4ff;color:#0a1628;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Accept invitation</a>
        </p>
        <p style="color:#6b7280;font-size:13px">Or paste this URL: ${acceptUrl}</p>
      </div>
    </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Detroit Web Agency <matt@detroitwebagent.com>",
      to: [email],
      subject: `${ownerEmail} added you to their DWA team`,
      html,
    }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_auth" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "invalid_session" }, 401);
  const user = userData.user;

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";

  try {
    if (req.method === "GET" || action === "list") {
      const { data, error } = await sb
        .from("account_team_members")
        .select("*")
        .eq("account_owner_id", user.id)
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return json({ members: data, seat_cap: SEAT_CAP });
    }

    const body = await req.json().catch(() => ({}));

    if (action === "invite") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "invalid_email" }, 400);
      }
      // Seat cap
      const { count } = await sb
        .from("account_team_members")
        .select("id", { count: "exact", head: true })
        .eq("account_owner_id", user.id)
        .neq("status", "revoked");
      if ((count || 0) >= SEAT_CAP) return json({ error: "seat_cap_reached", cap: SEAT_CAP }, 400);

      const token = crypto.randomUUID().replace(/-/g, "");
      const { data, error } = await sb
        .from("account_team_members")
        .upsert(
          {
            account_owner_id: user.id,
            member_email: email,
            invite_token: token,
            status: "invited",
            invited_at: new Date().toISOString(),
            revoked_at: null,
          },
          { onConflict: "account_owner_id,member_email" },
        )
        .select()
        .single();
      if (error) throw error;

      const origin = req.headers.get("origin") || "https://detroitwebagent.com";
      await sendInviteEmail(email, user.email || "Your colleague", token, origin);

      return json({ ok: true, member: data });
    }

    if (action === "revoke") {
      const id = String(body.id || "");
      if (!id) return json({ error: "missing_id" }, 400);
      const { error } = await sb
        .from("account_team_members")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("account_owner_id", user.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "accept") {
      const token = String(body.token || "");
      if (!token) return json({ error: "missing_token" }, 400);
      const { data: row, error: findErr } = await sb
        .from("account_team_members")
        .select("*")
        .eq("invite_token", token)
        .maybeSingle();
      if (findErr) throw findErr;
      if (!row) return json({ error: "invalid_token" }, 404);
      if (row.status === "revoked") return json({ error: "revoked" }, 410);
      if (row.member_email.toLowerCase() !== (user.email || "").toLowerCase()) {
        return json({ error: "email_mismatch" }, 403);
      }
      const { error: upErr } = await sb
        .from("account_team_members")
        .update({
          status: "active",
          member_user_id: user.id,
          accepted_at: new Date().toISOString(),
          invite_token: null,
        })
        .eq("id", row.id);
      if (upErr) throw upErr;
      return json({ ok: true, account_owner_id: row.account_owner_id });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("[team-seat-manager]", e);
    return json({ error: e?.message || "server_error" }, 500);
  }
});
