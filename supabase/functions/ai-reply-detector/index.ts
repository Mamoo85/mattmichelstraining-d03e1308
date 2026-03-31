import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CALENDAR_LINK = "https://mattmichelstraining.com/get-started";
const LOOM_DEMO_LINK = "https://mattmichelstraining.com/demo";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { senderEmail, replyBody, originalSubject } = await req.json();
    if (!senderEmail || !replyBody) {
      return new Response(JSON.stringify({ error: "senderEmail and replyBody required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Agent 3: THE NEGOTIATOR — Classify & Auto-Reply ──
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "system", content: `You are an autonomous Inbox Management Agent monitoring replies to cold outreach campaigns for Matt Michels, a web design and automation consultant in Grosse Pointe, MI.

Step 1: Categorize the reply intent as one of: INTERESTED, OBJECTION_BUSY, OBJECTION_HAVE_SOMEONE, OBJECTION_PRICE, HARD_NO, OUT_OF_OFFICE, UNSUBSCRIBE

Step 2: Draft the perfect auto-reply based on category:

If INTERESTED: Reply warmly and provide a link. Example: "Great to hear — here is a quick breakdown I put together: [LOOM_LINK]. Let me know what you think, or if it is easier, here is my calendar: [CALENDAR_LINK]"

If OBJECTION_BUSY: "Completely understand. That is exactly why our Missed-Call Text-Back is 100% automated. Takes 5 minutes to set up and runs while you are on the job site. Worth a quick look? [LOOM_LINK]"

If OBJECTION_HAVE_SOMEONE: "Glad to hear you are taking it seriously. Most of our clients kept their current agency but layered our lead system on top for extra volume. Mind if I send the demo anyway? [LOOM_LINK]"

If OBJECTION_PRICE: "Totally fair. Our Missed-Call Text-Back starts at $99/mo and usually pays for itself after one captured lead. Happy to show you the math: [LOOM_LINK]"

If HARD_NO: "No problem at all. Keep crushing it this year. I will follow up in a few months if anything changes."

If OUT_OF_OFFICE or UNSUBSCRIBE: Do not draft a reply, set auto_reply to empty string.

Respond with ONLY a JSON object: {"category": "...", "auto_reply": "...", "objection_type": "..."}
Replace [LOOM_LINK] with the actual link and [CALENDAR_LINK] with the actual link.
Keep replies under 3 sentences. Maintain a sharp, professional, yet relaxed tone. Sign off as Matt.` },
        { role: "user", content: `From: ${senderEmail}\nSubject: ${originalSubject || "N/A"}\nBody: ${replyBody.slice(0, 500)}` }],
      }),
    });
    const aiData = await aiRes.json();
    const rawContent = (aiData?.choices?.[0]?.message?.content || "{}").trim();

    let category = "OTHER";
    let autoReply = "";
    let objectionType = "";

    try {
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      category = parsed.category || "OTHER";
      autoReply = (parsed.auto_reply || "")
        .replace(/\[LOOM_LINK\]/g, LOOM_DEMO_LINK)
        .replace(/\[CALENDAR_LINK\]/g, CALENDAR_LINK);
      objectionType = parsed.objection_type || "";
    } catch {
      category = rawContent.includes("INTERESTED") ? "INTERESTED" : "OTHER";
    }

    // ── Auto-send reply if we have one ──
    if (autoReply && RESEND_API_KEY && !["OUT_OF_OFFICE", "UNSUBSCRIBE"].includes(category)) {
      const replySubject = originalSubject
        ? (originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`)
        : "Re: Quick question about your business";

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@mattmichelstraining.com>",
          to: [senderEmail],
          bcc: ["matthewmichels4@gmail.com"],
          reply_to: "matt@mattmichelstraining.com",
          subject: replySubject,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.8;color:#1e293b;max-width:520px;margin:0 auto;padding:24px 0;">
<p>${autoReply.replace(/\n/g, "<br>")}</p>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
  <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
  <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M² Development · Grosse Pointe, MI<br>(313) 806-4952</div>
  <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
</div>
</div>`,
        }),
      });
      console.log(`[NEGOTIATOR] Auto-replied to ${senderEmail} — category: ${category}`);
    }

    // ── Update lead status in outreach_leads ──
    if (category === "HARD_NO") {
      await sb.from("outreach_leads").update({ status: "closed" }).eq("email", senderEmail);
    } else if (category === "INTERESTED") {
      await sb.from("outreach_leads").update({ status: "Replied" }).eq("email", senderEmail);
    }

    // ── Notify Matt immediately for hot leads ──
    if (category === "INTERESTED" && RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Lead Alert <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
          subject: `🔥 HOT LEAD: ${senderEmail} replied INTERESTED`,
          html: `<div style="font-family:sans-serif;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;">
<h2 style="color:#22c55e;">🔥 Interested Reply Detected</h2>
<p><strong>From:</strong> ${senderEmail}</p>
<p><strong>Subject:</strong> ${originalSubject || "N/A"}</p>
<p><strong>Their Message:</strong></p>
<blockquote style="border-left:3px solid #e8621a;padding-left:12px;color:#94a3b8;">${replyBody.slice(0, 1000)}</blockquote>
<p style="color:#22c55e;font-weight:bold;">✅ Auto-reply already sent with Loom demo + calendar link</p>
<p style="color:#e8621a;font-weight:bold;">Follow up personally to close this deal!</p>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
  <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
  <div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div>
  <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
</div></div>`,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, category, objectionType, autoReplySent: !!autoReply, sender: senderEmail }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[NEGOTIATOR] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
