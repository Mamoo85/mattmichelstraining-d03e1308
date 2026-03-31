import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractPathSegment(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    return parts[parts.length - 1] || "";
  } catch {
    // fallback: strip trailing slashes and take last segment
    const parts = url.replace(/^https?:\/\/[^/]+\//, "").replace(/\/+$/, "").split("/");
    return parts[parts.length - 1] || url;
  }
}

function getNextPostingDay(): string {
  const now = new Date();
  const dow = now.getDay();
  const posting = [1, 3, 5]; // Mon, Wed, Fri
  for (let i = 1; i <= 7; i++) {
    const next = (dow + i) % 7;
    if (posting.includes(next)) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    }
  }
  return "Monday";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, client_id } = body;

    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── GET CLIENT ────────────────────────────────────────────────────────────
    if (action === "get_client") {
      const { data, error } = await sb
        .from("social_media_clients")
        .select("business_name, plan, contact_name")
        .eq("id", client_id)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Client not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          business_name: data.business_name,
          plan: data.plan,
          contact_name: data.contact_name,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── CONNECT ───────────────────────────────────────────────────────────────
    if (action === "connect") {
      const { fb_page_url, linkedin_page_url, brand_voice, target_audience, post_topics, avoid_topics } = body;

      if (!brand_voice || !post_topics) {
        return new Response(JSON.stringify({ error: "brand_voice and post_topics are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fb_page_id = fb_page_url ? extractPathSegment(fb_page_url) : null;
      const linkedin_org_id = linkedin_page_url ? extractPathSegment(linkedin_page_url) : null;

      // Fetch current client for email details
      const { data: existing, error: fetchErr } = await sb
        .from("social_media_clients")
        .select("business_name, email, contact_name")
        .eq("id", client_id)
        .single();

      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: "Client not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateErr } = await sb
        .from("social_media_clients")
        .update({
          fb_page_id: fb_page_id || null,
          linkedin_org_id: linkedin_org_id || null,
          onboarding_completed: true,
          brand_voice: brand_voice,
          post_topics: {
            topics: post_topics,
            avoid: avoid_topics || "",
            audience: target_audience || "",
          },
        })
        .eq("id", client_id);

      if (updateErr) {
        console.error("[social-connect-intake] update error:", updateErr);
        return new Response(JSON.stringify({ error: "Failed to save your information. Please try again." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const nextDay = getNextPostingDay();
      const firstName = existing.contact_name?.split(" ")[0] || null;

      // Email Matt
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² Notifications <matt@mattmichelstraining.com>",
            to: ["matthewmichels@mattmichelstraining.com"],
            subject: `Social media client connected — ${existing.business_name}`,
            html: `<p>New client <strong>${existing.business_name}</strong> completed onboarding.</p>
<ul>
  <li>FB Page ID: <strong>${fb_page_id || "not provided"}</strong></li>
  <li>LinkedIn Org ID: <strong>${linkedin_org_id || "not provided"}</strong></li>
  <li>Brand voice: ${brand_voice}</li>
  <li>Audience: ${target_audience || "—"}</li>
  <li>Topics: ${post_topics}</li>
  <li>Avoid: ${avoid_topics || "none"}</li>
</ul>
<p>You still need to add their access tokens in Supabase. Check the <strong>social_media_clients</strong> table (row id: ${client_id}).</p>`,
          }),
        });

        // Email client confirmation
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@mattmichelstraining.com>",
            to: [existing.email],
            subject: "You're connected — first post coming soon",
            html: `<p>Hey${firstName ? " " + firstName : ""},</p>
<p>You're all set! Your account is connected and your AI posts are ready to start going out.</p>
<p>Your first post is scheduled for <strong>${nextDay}</strong>. I'll send you a preview email before anything goes live so you can see exactly what's posting.</p>
<p>Here's what to expect:</p>
<ul>
  <li>Posts go out Monday, Wednesday, and Friday</li>
  <li>Each post is written fresh for your business</li>
  <li>You'll get a preview before each one goes live</li>
  <li>Reply to any email or text me if you want to make changes</li>
</ul>
<p>Questions? Reply here or text me directly at (313) 806-4952.</p>
<p>— Matt</p>
<p><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" width="48" height="48" style="border-radius:50%;object-fit:cover;" alt="Matt Michels" /></p>`,
          }),
        });
      }

      return new Response(JSON.stringify({ success: true, next_post_day: nextDay }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[social-connect-intake] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
