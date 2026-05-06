// Posts Detroit Web Agency content to Matt's LinkedIn 3x/week
// Cron: Mon/Wed/Fri 9am ET (13:00 UTC)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const DWA_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.detroitwebagent.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Lead Web Agent · Detroit Web Agency<br/>Grosse Pointe, MI · (313) 992-1219</div></div>`;

const TOPICS = [
  "Write a 2-3 sentence LinkedIn post from Matt Michels, owner of Detroit Web Agency, about why local contractors lose jobs by not having a fast, mobile-optimized website. Conversational, no corporate speak. Mention detroitwebagent.com casually.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels about why custom-built websites outperform templates for local service businesses (roofing, HVAC, plumbing). Mention his agency Detroit Web Agent.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels about how automated lead capture systems on contractor websites convert 3x more visitors into booked jobs. Metro Detroit angle.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels about the power of automated text-back and missed call systems for local businesses — the owner should be doing the work, not chasing leads manually. Practical and direct.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels about why most contractor websites don't convert visitors into calls — and how Detroit Web Agency builds sites that actually generate leads.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels about how Google Business Profile optimization combined with a great website is the #1 growth strategy for local contractors. He runs Detroit Web Agency.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels about how local businesses that respond to leads within 5 minutes close significantly more jobs — and how automated systems make that possible.",
];

async function getLinkedInToken(sb: any): Promise<{ token: string; personId: string } | null> {
  const { data } = await sb
    .from("oauth_tokens")
    .select("access_token, expires_at")
    .eq("provider", "linkedin")
    .single();

  if (!data?.access_token) return null;

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    console.error("[LINKEDIN-POSTER] Token expired");
    return null;
  }

  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${data.access_token}` } });

  if (!profileRes.ok) return null;
  const profile = await profileRes.json();
  const personId = profile.sub;

  return { token: data.access_token, personId };
}

async function generatePost(): Promise<string> {
  const topic = TOPICS[Math.floor(Date.now() / 86400000) % TOPICS.length];

  if (!LOVABLE_API_KEY) {
    return "Local businesses — if your website isn't generating leads, it's costing you money. Custom sites built to convert. detroitwebagent.com #Detroit #WebDesign";
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite", 
      messages: [{ role: "user", content: topic }] }) });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "Local businesses — your website should be your best salesperson. Custom web design + automated lead systems. detroitwebagent.com";
}

async function postToLinkedIn(personId: string, token: string, text: string): Promise<boolean> {
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0" },
    body: JSON.stringify({
      author: `urn:li:person:${personId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE" } },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" } }) });

  if (!res.ok) {
    const err = await res.text();
    console.error("[LINKEDIN-POSTER] Post failed:", err);
  }
  return res.ok;
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const auth = await getLinkedInToken(sb);
    if (!auth) {
      console.error("[LINKEDIN-POSTER] No valid token found");
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: ["matt@detroitwebagent.com"], bcc: ["matthewmichels4@gmail.com"],
            subject: "⚠️ LinkedIn token expired — re-auth needed",
            html: `<p>Your LinkedIn auto-posting stopped because the token expired.</p><p><a href="https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${Deno.env.get("LINKEDIN_CLIENT_ID")}&redirect_uri=${SUPABASE_URL}/functions/v1/linkedin-auth-callback&scope=openid%20profile%20w_member_social&state=dwalinkedin">Click here to reconnect LinkedIn →</a>${DWA_SIGNATURE}</p>` }) });
      }
      return new Response(JSON.stringify({ error: "No valid token" }), { status: 200 });
    }

    const post = await generatePost();
    const ok = await postToLinkedIn(auth.personId, auth.token, post);

    console.log(`[LINKEDIN-POSTER] ${ok ? "Posted" : "Failed"}: ${post.substring(0, 60)}...`);
    return new Response(JSON.stringify({ ok, preview: post.substring(0, 100) }), { status: 200 });

  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[LINKEDIN-POSTER] Fatal:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
