import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const log = (step: string, data?: any) =>
  console.log(`[CONTRACTOR-SMS] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// SMS text per offer
const SMS1: Record<string, (biz: string, city: string) => string> = {
  leads: (biz, city) =>
    `Hey — Matt Michels here, Grosse Pointe. I run an exclusive lead system for contractors in ${city} — one contractor per trade, no shared leads. I've got one spot open. Worth a look? (313) 806-4952`,
  gbp: (biz, city) =>
    `Hey — Matt Michels, Grosse Pointe. I noticed ${biz}'s Google ranking in ${city} has room to improve. I automate GBP for local contractors — $199/mo, I handle everything. Interested? (313) 806-4952`,
  missed_call: (biz, city) =>
    `Hey — Matt here in Grosse Pointe. When you're on a job and miss a call, does anything text that person back automatically? Most contractors lose 2-3 jobs/week to whoever picks up first. I built a $99/mo fix. Worth a look? (313) 806-4952`,
};

const SMS2: Record<string, (biz: string, city: string) => string> = {
  leads: (biz, city) =>
    `Matt Michels again — the ${city} lead spot is still open. Once it goes to another ${city} contractor in your trade, that's it. Reply or call (313) 806-4952 if you want first shot.`,
  gbp: (biz, city) =>
    `Matt again — just wanted to make sure this didn't get buried. $199/mo for automated Google ranking for ${biz} in ${city}. No work on your end. Happy to show you what it does. (313) 806-4952`,
  missed_call: (biz, city) =>
    `Matt Michels following up — a Warren plumber I set this up for picked up an extra job last month because my system texted a missed caller back in 30 sec while he was working. $99/mo. (313) 806-4952`,
};

serve(async () => {
  try {
    const TWILIO_DEFAULT_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || Deno.env.get("TWILIO_DEFAULT_NUMBER") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (!TWILIO_DEFAULT_NUMBER) {
      return new Response(JSON.stringify({ error: "Missing TWILIO_PHONE_NUMBER" }), { status: 500 });
    }

    let sent = 0;

    // ── Text 1: leads emailed 2+ days ago, no SMS yet ──
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    const { data: sms1Leads } = await sb
      .from("outreach_leads")
      .select("id, business_name, phone, city, offer_pitched")
      .eq("status", "emailed")
      .eq("sms_sent", false)
      .not("phone", "is", null)
      .lt("created_at", twoDaysAgo);

    for (const lead of sms1Leads || []) {
      const offer = lead.offer_pitched || "leads";
      const msg = (SMS1[offer] || SMS1.leads)(lead.business_name || "your business", lead.city || "your area");

      try {
        const result = await sendSMS(lead.phone, TWILIO_DEFAULT_NUMBER, msg, "contractor_sms_follow");
        if (result.success) {
          await sb.from("outreach_leads").update({
            sms_sent: true,
            sms_sent_at: new Date().toISOString(),
          }).eq("id", lead.id);
          sent++;
          log("SMS 1 sent", { phone: lead.phone, offer });
        } else {
          log("SMS 1 failed", { phone: lead.phone, error: result.error });
        }
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        log("SMS 1 failed", { phone: lead.phone, error: String(e) });
      }
    }

    // ── Text 2: SMS 1 sent 2+ days ago, no SMS 2 yet ──
    const { data: sms2Leads } = await sb
      .from("outreach_leads")
      .select("id, business_name, phone, city, offer_pitched, sms_sent_at")
      .eq("status", "emailed")
      .eq("sms_sent", true)
      .eq("sms_2_sent", false)
      .not("phone", "is", null);

    for (const lead of sms2Leads || []) {
      const daysSinceSms1 = lead.sms_sent_at
        ? (Date.now() - new Date(lead.sms_sent_at).getTime()) / 86400000
        : 999;
      if (daysSinceSms1 < 2) continue;

      const offer = lead.offer_pitched || "leads";
      const msg = (SMS2[offer] || SMS2.leads)(lead.business_name || "your business", lead.city || "your area");

      try {
        const result = await sendSMS(lead.phone, TWILIO_DEFAULT_NUMBER, msg, "contractor_sms_follow");
        if (result.success) {
          await sb.from("outreach_leads").update({
            sms_2_sent: true,
            sms_2_sent_at: new Date().toISOString(),
          }).eq("id", lead.id);
          sent++;
          log("SMS 2 sent", { phone: lead.phone, offer });
        } else {
          log("SMS 2 failed", { phone: lead.phone, error: result.error });
        }
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        log("SMS 2 failed", { phone: lead.phone, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
