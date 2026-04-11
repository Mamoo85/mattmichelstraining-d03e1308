import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const MATT_CELL = "+13138064952";
const FROM_EMAIL = "Matt Michels <matt@detroitwebagency.com>";
const REPLY_TO = "matt@detroitwebagency.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { senderEmail, senderName, replyBody, originalSubject } = await req.json();
    if (!senderEmail || !replyBody) {
      return new Response(JSON.stringify({ error: "senderEmail and replyBody required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = senderName ? senderName.split(" ")[0] : senderEmail.split("@")[0];

    // ── AI Classification via Lovable Gateway ──
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{
          role: "system",
          content: `You are classifying replies to cold B2B outreach emails for a Detroit web agency.

Categorize the reply as ONE of: INTERESTED, OBJECTION_BUSY, OBJECTION_HAVE_SOMEONE, OBJECTION_PRICE, HARD_NO, OUT_OF_OFFICE, UNSUBSCRIBE

Respond with ONLY a JSON object: {"category": "...", "summary": "one sentence summary of their reply"}`,
        }, {
          role: "user",
          content: `From: ${senderEmail}\nSubject: ${originalSubject || "N/A"}\nBody: ${replyBody.slice(0, 600)}`,
        }],
      }),
    });
    const aiData = await aiRes.json();
    const rawContent = (aiData?.choices?.[0]?.message?.content || "{}").trim();

    let category = "OTHER";
    let summary = "";

    try {
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      category = parsed.category || "OTHER";
      summary = parsed.summary || "";
    } catch {
      category = rawContent.includes("INTERESTED") ? "INTERESTED" : "OTHER";
    }

    // ── Log reply to prospect_email_log ──
    await sb.from("prospect_email_log").update({
      reply_received_at: new Date().toISOString(),
      reply_body: replyBody.slice(0, 2000),
      reply_category: category,
    }).eq("email", senderEmail).order("sent_at", { ascending: false }).limit(1);

    // ── Handle each category ──

    if (category === "INTERESTED") {
      // 1. Send "3 free leads" reply — human delay feel, not instant bot
      const replySubject = originalSubject
        ? (originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`)
        : "Re: Quick follow-up";

      const replyBody2 = `Hey ${firstName} — awesome, let's do it.\n\nI'm going to text you the next 3 exclusive leads for free so you can see the quality before spending a dime. What's the best cell number to reach you?\n\n— Matt\n(313) 806-4952`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [senderEmail],
          reply_to: REPLY_TO,
          subject: replySubject,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.8;color:#1e293b;max-width:520px;margin:0 auto;padding:24px 0;">
<p>${replyBody2.replace(/\n/g, "<br>")}</p>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
  <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Detroit Web Agency · Grosse Pointe, MI<br>(313) 806-4952</div>
</div>
</div>`,
        }),
      });

      // 2. SMS Matt immediately
      await sendSMS(
        MATT_CELL,
        TWILIO_PHONE_NUMBER,
        `🔥 HOT LEAD: ${senderEmail} said YES to free leads.\n\nThey replied: "${replyBody.slice(0, 120)}"\n\nAuto-reply sent asking for their cell. CALL THEM NOW.`,
        "contractor_leads"
      );

      // 3. Update lead status
      await sb.from("outreach_leads").update({ status: "Responded" }).eq("email", senderEmail);

    } else if (category === "OBJECTION_BUSY" || category === "OBJECTION_HAVE_SOMEONE" || category === "OBJECTION_PRICE") {
      // Ghost Delay: draft contextual reply, stage it for 10 min, SMS Matt to cancel if needed

      let draftBody = "";
      let draftSubject = originalSubject
        ? (originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`)
        : "Re: Quick follow-up";

      if (category === "OBJECTION_BUSY") {
        draftBody = `Hey ${firstName} — totally get it, busy is good.\n\nThat's exactly why this works: once it's set up, the whole thing runs on its own. No more chasing. Takes 20 minutes to go live.\n\nWorth a look when you get a breather?\n\n— Matt\n(313) 806-4952`;
      } else if (category === "OBJECTION_HAVE_SOMEONE") {
        draftBody = `Hey ${firstName} — good to hear, having someone on it is the right call.\n\nMost of the companies I work with kept their current setup and just added our lead system on top for extra volume. Two streams are better than one.\n\nHappy to show you the math if you're curious — no pressure.\n\n— Matt\n(313) 806-4952`;
      } else if (category === "OBJECTION_PRICE") {
        draftBody = `Hey ${firstName} — fair point, budget has to make sense.\n\nOur Missed-Call Text-Back is $99/mo and usually pays for itself after one captured lead. Most guys see ROI in the first 30 days.\n\nIf it doesn't pay for itself in 60 days, I'll refund you. That's how confident I am.\n\n— Matt\n(313) 806-4952`;
      }

      // Save to ghost delay queue
      const sendAfter = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { data: draft } = await sb.from("email_reply_drafts").insert({
        lead_email: senderEmail,
        draft_body: draftBody,
        draft_subject: draftSubject,
        category,
        send_after: sendAfter,
      }).select("id").single();

      // SMS Matt with cancel option
      const cancelUrl = `${SUPABASE_URL}/functions/v1/cancel-reply-draft?id=${draft?.id}`;
      const preview = draftBody.slice(0, 100).replace(/\n/g, " ");

      await sendSMS(
        MATT_CELL,
        TWILIO_PHONE_NUMBER,
        `Draft ready for ${senderEmail} (${category.replace("OBJECTION_", "")}):\n\n"${preview}..."\n\nAuto-sends in 10 min. Cancel: ${cancelUrl}`,
        "contractor_leads"
      );

    } else if (category === "HARD_NO") {
      await sb.from("outreach_leads").update({ status: "closed" }).eq("email", senderEmail);
      console.log(`[NEGOTIATOR] Hard no from ${senderEmail} — closed lead, no reply sent`);

    } else if (category === "UNSUBSCRIBE") {
      await sb.from("outreach_leads").update({ status: "unsubscribed" }).eq("email", senderEmail);
      console.log(`[NEGOTIATOR] Unsubscribe from ${senderEmail} — no reply sent`);
    }

    return new Response(
      JSON.stringify({ ok: true, category, summary, sender: senderEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[NEGOTIATOR] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
