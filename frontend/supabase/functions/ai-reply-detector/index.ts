import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const MATT_CELL = Deno.env.get("MATT_PERSONAL_PHONE") || Deno.env.get("ADMIN_PHONE") || "";
const FROM_EMAIL = "Matt Michels <matt@detroitwebagent.com>";
const REPLY_TO = "matt@detroitwebagent.com";

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
      // Check if this is a dead lead reactivation pitch (different reply needed)
      const { data: outreachLead } = await sb
        .from("outreach_leads")
        .select("offer_pitched, business_name")
        .eq("email", senderEmail)
        .maybeSingle();
      const isDeadLead = (outreachLead as any)?.offer_pitched === "dead_lead_reactivation";
      const bizName = (outreachLead as any)?.business_name || senderEmail;

      const replySubject = originalSubject
        ? (originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`)
        : "Re: Quick follow-up";

      let replyBody2: string;
      let mattSms: string;

      if (isDeadLead) {
        replyBody2 = `Hey ${firstName} — great timing. Paste your dead lead list here and we'll start the drip today:\n\ndetroitwebagent.com/dead-lead-intake\n\nTakes 2 minutes. No charge until a lead replies YES.\n\n— Matt\n(313) 992-1219`;
        mattSms = `♻️ DEAD LEAD PITCH HIT: ${bizName} replied YES. Intake link sent automatically. Check Resend.`;
      } else {
        replyBody2 = `Hey ${firstName} — awesome, let's do it.\n\nI'm going to text you the next 3 exclusive leads for free so you can see the quality before spending a dime. What's the best cell number to reach you?\n\n— Matt\n(313) 992-1219`;
        mattSms = `🔥 HOT LEAD: ${senderEmail} said YES to free leads.\n\nThey replied: "${replyBody.slice(0, 120)}"\n\nAuto-reply sent asking for their cell. CALL THEM NOW.`;
      }

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
  <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Detroit Web Agency · Grosse Pointe, MI<br>(313) 992-1219</div>
</div>
</div>`,
        }),
      });

      await sendSMS(MATT_CELL, TWILIO_PHONE_NUMBER, mattSms, "contractor_leads");

      await sb.from("outreach_leads").update({ status: "Responded" }).eq("email", senderEmail);

    } else if (category === "OBJECTION_BUSY" || category === "OBJECTION_HAVE_SOMEONE" || category === "OBJECTION_PRICE") {
      // Ghost Delay: draft contextual reply, stage it for 10 min, SMS Matt to cancel if needed

      // Check offer_pitched to customize objection reply
      const { data: objLead } = await sb
        .from("outreach_leads")
        .select("offer_pitched")
        .eq("email", senderEmail)
        .maybeSingle();
      const isDeadLeadObj = (objLead as any)?.offer_pitched === "dead_lead_reactivation";

      let draftBody = "";
      const draftSubject = originalSubject
        ? (originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`)
        : "Re: Quick follow-up";

      if (isDeadLeadObj) {
        if (category === "OBJECTION_BUSY") {
          draftBody = `Hey ${firstName} — no problem at all.\n\nWhen you get a sec, you can paste your old leads in 2 minutes here: detroitwebagent.com/dead-lead-intake\n\nThe drip runs itself after that. Zero time from you.\n\n— Matt\n(313) 992-1219`;
        } else if (category === "OBJECTION_HAVE_SOMEONE") {
          draftBody = `Hey ${firstName} — totally fair. This is different from what most people are running.\n\nWe're not replacing anything — we just SMS your dead estimates (the quotes that never went anywhere) and see who's still interested. You pay $50 only when one replies YES.\n\n— Matt\n(313) 992-1219`;
        } else if (category === "OBJECTION_PRICE") {
          draftBody = `Hey ${firstName} — there's no upfront cost. You pay $50 only when a dead lead replies YES they still need the work.\n\nIf none reply, you pay nothing. Worth a try: detroitwebagent.com/dead-lead-intake\n\n— Matt\n(313) 992-1219`;
        }
      } else if (category === "OBJECTION_BUSY") {
        draftBody = `Hey ${firstName} — totally get it, busy is good.\n\nThat's exactly why this works: once it's set up, the whole thing runs on its own. No more chasing. Takes 20 minutes to go live.\n\nWorth a look when you get a breather?\n\n— Matt\n(313) 992-1219`;
      } else if (category === "OBJECTION_HAVE_SOMEONE") {
        draftBody = `Hey ${firstName} — good to hear, having someone on it is the right call.\n\nMost of the companies I work with kept their current setup and just added our lead system on top for extra volume. Two streams are better than one.\n\nHappy to show you the math if you're curious — no pressure.\n\n— Matt\n(313) 992-1219`;
      } else if (category === "OBJECTION_PRICE") {
        draftBody = `Hey ${firstName} — fair point, budget has to make sense.\n\nOur Missed-Call Text-Back is $99/mo and usually pays for itself after one captured lead. Most guys see ROI in the first 30 days.\n\nIf it doesn't pay for itself in 60 days, I'll refund you. That's how confident I am.\n\n— Matt\n(313) 992-1219`;
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

      // SMS Matt with cancel option (guard null draft ID)
      const cancelUrl = draft?.id
        ? `${SUPABASE_URL}/functions/v1/cancel-reply-draft?id=${draft.id}`
        : null;
      const cancelNote = cancelUrl ? `\n\nCancel: ${cancelUrl}` : "";
      const preview = draftBody.slice(0, 100).replace(/\n/g, " ");

      await sendSMS(
        MATT_CELL,
        TWILIO_PHONE_NUMBER,
        `Draft ready for ${senderEmail} (${category.replace("OBJECTION_", "")}):\n\n"${preview}..."${draft?.id ? `\n\nAuto-sends in 10 min.${cancelNote}` : "\n\n⚠️ Draft save failed — reply manually."}`,
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
