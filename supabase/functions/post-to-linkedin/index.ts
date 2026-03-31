// Posts M² promotional content to Matt's personal LinkedIn 3x/week
// Cron: Mon/Wed/Fri 9am ET (13:00 UTC)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const TOPICS = [
  "Write a 2-3 sentence LinkedIn post from Matt Michels, a Metro Detroit local marketing consultant, about why local contractors lose jobs by missing calls — and how automated text-back solves it. Conversational, no corporate speak.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels about why Google Business Profile is the most underutilized tool for local trade businesses (roofing, HVAC, plumbing). Mention his $49/mo management service casually.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels about how exclusive contractor leads (not shared Angi leads) change a contractor's close rate. Local Detroit angle.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels about the power of automated systems for small local businesses — the owner should be doing the work, not managing marketing. Practical and direct.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels about why most contractor websites don't convert visitors into calls — and what actually works. Metro Detroit focus.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels sharing a quick B2B sales tip for field reps. Something tactical like handling objections or voicemail scripts. He writes the Field Rep Weekly newsletter.",
  "Write a 2-3 sentence LinkedIn post from Matt Michels about how local businesses that respond to Google reviews within 2 hours get significantly more calls. Mention automated review response.",
];

async function getLinkedInToken(sb: any): Promise<{ token: string; personId: string } | null> {
  const { data } = await sb
    .from("oauth_tokens")
    .select("access_token, expires_at")
    .eq("provider", "linkedin")
    .single();

  if (!data?.access_token) return null;

  // Check if expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    console.error("[LINKEDIN-POSTER] Token expired");
    return null;
  }

  // Get LinkedIn person ID
  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${data.access_token}` } });

  if (!profileRes.ok) return null;
  const profile = await profileRes.json();
  const personId = profile.sub; // OpenID Connect subject = LinkedIn member ID

  return { token: data.access_token, personId };
}

async function generatePost(): Promise<string> {
  const topic = TOPICS[Math.floor(Date.now() / 86400000) % TOPICS.length];

  if (!LOVABLE_API_KEY) {
    return "Local businesses — if you're missing calls, you're missing jobs. Automated text-back sends an instant reply to every missed caller. Simple, effective, $99/mo. #Detroit #LocalBusiness";
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
  return data?.choices?.[0]?.message?.content?.trim() || "Local businesses — automated systems = more calls, more jobs. mattmichelstraining.com";
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
            from: "M² System <matt@mattmichelstraining.com>",
            to: ["matt@m2training.com"], bcc: ["matthewmichels4@gmail.com"],
            subject: "⚠️ LinkedIn token expired — re-auth needed",
            html: `<p>Your LinkedIn auto-posting stopped because the token expired.</p><p><a href="https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${Deno.env.get("LINKEDIN_CLIENT_ID")}&redirect_uri=https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/linkedin-auth-callback&scope=openid%20profile%20w_member_social&state=m2linkedin">Click here to reconnect LinkedIn →</a><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI \u00b7 (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>` }) });
      }
      return new Response(JSON.stringify({ error: "No valid token" }), { status: 200 });
    }

    const post = await generatePost();
    const ok = await postToLinkedIn(auth.personId, auth.token, post);

    console.log(`[LINKEDIN-POSTER] ${ok ? "Posted" : "Failed"}: ${post.substring(0, 60)}...`);
    return new Response(JSON.stringify({ ok, preview: post.substring(0, 100) }), { status: 200 });

  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[LINKEDIN-POSTER] Fatal:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
