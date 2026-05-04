// dwa-contractor-referral — Unified DWA contractor-to-contractor referral system
// Actions: create_code, validate, list_mine, mark_signup, mark_paid
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function generateCode(name: string): string {
  const clean = (name || "DWA").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "DWA";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${clean}-${suffix}`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Detroit Web Agency <matt@detroitwebagent.com>",
      to: [to],
      subject,
      html,
    }),
  }).catch(() => {});
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = body.action || "create_code";

  try {
    if (action === "create_code") {
      const referrerEmail = String(body.referrer_email || "").trim().toLowerCase();
      const referredEmail = String(body.referred_email || "").trim().toLowerCase();
      if (!referrerEmail || !referredEmail) {
        return json({ error: "missing_email" }, 400);
      }
      if (referrerEmail === referredEmail) {
        return json({ error: "self_referral_not_allowed" }, 400);
      }

      const code = generateCode(body.referrer_business_name || referrerEmail.split("@")[0]);

      const { data, error } = await sb
        .from("dwa_contractor_referrals")
        .insert({
          referrer_email: referrerEmail,
          referrer_business_name: body.referrer_business_name || null,
          referrer_phone: body.referrer_phone || null,
          referred_email: referredEmail,
          referred_business_name: body.referred_business_name || null,
          referred_phone: body.referred_phone || null,
          product_interest: body.product_interest || "any",
          referral_code: code,
          status: "pending",
        })
        .select()
        .single();

      if (error) return json({ error: error.message }, 500);

      // Notify referred contractor
      const referLink = `https://detroitwebagent.com/?ref=${code}`;
      const productLine =
        body.product_interest && body.product_interest !== "any"
          ? `specifically ${body.product_interest}`
          : "our contractor automation tools";

      await sendEmail(
        referredEmail,
        `${body.referrer_business_name || "A contractor"} thinks you should see this`,
        `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a1628">
          <h2 style="color:#00d4ff;margin:0 0 12px">You've been referred to Detroit Web Agency</h2>
          <p><strong>${body.referrer_business_name || referrerEmail}</strong> uses our automation stack and thought you'd want to check out ${productLine}.</p>
          <p>We help Michigan trades contractors automate lead follow-up, hire faster, and stop missing calls.</p>
          <p style="margin:24px 0">
            <a href="${referLink}" style="background:#00d4ff;color:#0a1628;padding:12px 24px;text-decoration:none;font-weight:bold;display:inline-block">See What We Do →</a>
          </p>
          <p style="font-size:13px;color:#666">No obligation. If you sign up, ${body.referrer_business_name || "your colleague"} gets a $50 account credit as a thank-you.</p>
          <p style="font-size:13px;color:#666">— Matt Michels, Detroit Web Agency<br/>(313) 992-1219</p>
        </div>`,
      );

      // Confirm to referrer
      await sendEmail(
        referrerEmail,
        `Your referral to ${referredEmail} is in`,
        `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a1628">
          <h2 style="color:#00d4ff;margin:0 0 12px">Referral sent ✓</h2>
          <p>We just emailed <strong>${referredEmail}</strong> on your behalf.</p>
          <p><strong>Your code:</strong> <code style="background:#f1f5f9;padding:4px 8px">${code}</code></p>
          <p>If they sign up for any DWA product, you'll get a <strong>$50 account credit</strong> automatically applied to your next invoice.</p>
          <p style="font-size:13px;color:#666">— Matt</p>
        </div>`,
      );

      return json({ ok: true, code, referral: data });
    }

    if (action === "validate") {
      const code = String(body.code || "").trim().toUpperCase();
      if (!code) return json({ valid: false }, 200);
      const { data } = await sb
        .from("dwa_contractor_referrals")
        .select("id, referrer_email, referrer_business_name, status")
        .eq("referral_code", code)
        .maybeSingle();
      return json({ valid: !!data, referral: data });
    }

    if (action === "list_mine") {
      const referrerEmail = String(body.referrer_email || "").trim().toLowerCase();
      if (!referrerEmail) return json({ error: "missing_email" }, 400);
      const { data, error } = await sb
        .from("dwa_contractor_referrals")
        .select("*")
        .eq("referrer_email", referrerEmail)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);

      const stats = {
        total: data?.length || 0,
        pending: data?.filter((r: any) => r.status === "pending").length || 0,
        signed_up: data?.filter((r: any) => r.status === "signed_up").length || 0,
        paid: data?.filter((r: any) => r.status === "paid" || r.status === "credited").length || 0,
        credit_earned_cents:
          data
            ?.filter((r: any) => r.status === "credited" || r.status === "paid")
            .reduce((s: number, r: any) => s + (r.credit_amount_cents || 0), 0) || 0,
      };
      return json({ ok: true, referrals: data || [], stats });
    }

    if (action === "mark_signup") {
      const code = String(body.code || "").trim().toUpperCase();
      if (!code) return json({ error: "missing_code" }, 400);
      const { error } = await sb
        .from("dwa_contractor_referrals")
        .update({ status: "signed_up", signed_up_at: new Date().toISOString() })
        .eq("referral_code", code)
        .eq("status", "pending");
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "mark_paid") {
      const code = String(body.code || "").trim().toUpperCase();
      if (!code) return json({ error: "missing_code" }, 400);
      const { data, error } = await sb
        .from("dwa_contractor_referrals")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("referral_code", code)
        .in("status", ["pending", "signed_up"])
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      // Notify Matt
      await sendEmail(
        "matt@detroitwebagent.com",
        `💰 Referral converted: ${code}`,
        `<p>Referrer <strong>${data?.referrer_email}</strong> earned $50 credit. Referred: ${data?.referred_email}.</p><p>Apply credit on next invoice.</p>`,
      );
      return json({ ok: true, referral: data });
    }

    if (action === "toggle_leaderboard") {
      const email = String(body.email || "").trim().toLowerCase();
      const opt_in = !!body.opt_in;
      const name = String(body.name || "").trim();
      if (!email) return json({ error: "missing_email" }, 400);
      // Upsert minimal partner row keyed on email
      const { error } = await sb
        .from("referral_partners")
        .upsert(
          { email, name: name || email.split("@")[0], code: email.split("@")[0].toUpperCase().slice(0, 8) + Math.floor(Math.random() * 999), show_on_leaderboard: opt_in },
          { onConflict: "email" },
        );
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "server_error" }, 500);
  }
});
