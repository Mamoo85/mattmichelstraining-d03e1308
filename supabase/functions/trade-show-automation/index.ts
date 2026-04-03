// trade-show-automation — HTTP POST
// Receives badge scan list, generates personalized 3-email sequences,
// sends email 1 immediately, stores email 2+3 for followup cron.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TradeShowContact {
  name: string;
  email: string;
  phone?: string;
  company: string;
  title: string;
}

interface EmailSequence {
  subject: string;
  body: string;
}

async function generateEmailSequence(
  contact: TradeShowContact,
  showName: string,
  senderName: string,
  senderCompany: string,
  senderProduct: string
): Promise<{ email1: EmailSequence; email2: EmailSequence; email3: EmailSequence } | null> {
  const prompt = `You are an expert B2B sales copywriter. Write a 3-email follow-up sequence for a trade show contact.

SHOW: ${showName}
SENDER: ${senderName} from ${senderCompany}
SENDER'S PRODUCT/SERVICE: ${senderProduct}

CONTACT:
Name: ${contact.name}
Company: ${contact.company}
Title: ${contact.title}

Write 3 emails:

EMAIL 1 (send day 1 — "Great meeting you"):
- Subject line that references ${showName} specifically
- Warm, personal opener referencing meeting at the show
- 1-2 sentences of value relevant to their company/title
- Soft CTA: "I'll send over some resources in a few days"
- Keep under 120 words total

EMAIL 2 (send day 4 — value add):
- Subject line focused on a pain point for their role/industry
- Lead with insight or stat relevant to a ${contact.title} at a ${contact.company}-type company
- Connect insight to how ${senderProduct} solves it
- One clear CTA: "Worth a quick chat?" with [CALENDAR_LINK] placeholder
- Keep under 150 words total

EMAIL 3 (send day 10 — low-pressure close):
- Subject line: friendly, low-pressure
- Acknowledge this is last follow-up for now
- Reiterate one key value prop in one sentence
- Ask for 15 minutes: "Would a 15-minute call this week or next make sense?"
- Give easy out: "If the timing isn't right, no worries at all."
- Keep under 100 words total

FORMAT AS JSON:
{
  "email1": { "subject": "...", "body": "Full HTML email body with inline styles, professional but warm" },
  "email2": { "subject": "...", "body": "Full HTML email body with inline styles" },
  "email3": { "subject": "...", "body": "Full HTML email body with inline styles" }
}

Each HTML email should include a simple signature: ${senderName} | ${senderCompany}`;

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const aiJson = await aiRes.json();
  const rawText = aiJson.content?.[0]?.text || "{}";

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const p = JSON.parse(jsonMatch[0]);
    return {
      email1: p.email1 as EmailSequence,
      email2: p.email2 as EmailSequence,
      email3: p.email3 as EmailSequence,
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const { clientId, showName, contacts } = body as {
      clientId: string;
      showName: string;
      contacts: TradeShowContact[];
    };

    if (!clientId || !showName || !contacts?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: clientId, showName, contacts" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch client
    const { data: client, error: clientErr } = await sb
      .from("trade_show_clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const senderName = client.contact_name || client.name || "The Team";
    const senderCompany = client.company_name || "Our Company";
    const senderProduct = client.product_description || "our solution";
    const senderEmail = client.reply_to_email || "matt@mattmichelstraining.com";

    // Create campaign record
    const { data: campaign, error: campaignErr } = await sb
      .from("trade_show_campaigns")
      .insert({
        client_id: clientId,
        show_name: showName,
        contacts_count: contacts.length,
        sequences_started: 0,
        created_at: new Date().toISOString(),
        status: "processing",
      })
      .select("id")
      .single();

    if (campaignErr || !campaign) {
      throw new Error(`Campaign creation failed: ${campaignErr?.message}`);
    }

    const campaignId = campaign.id;
    let sequencesStarted = 0;
    const now = new Date();
    const day4 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const day10 = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();

    for (const contact of contacts) {
      try {
        if (!contact.email) continue;

        const sequences = await generateEmailSequence(
          contact,
          showName,
          senderName,
          senderCompany,
          senderProduct
        );

        if (!sequences) continue;

        const { email1, email2, email3 } = sequences;

        // Send email 1 immediately
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName} <matt@mattmichelstraining.com>`,
            reply_to: senderEmail !== "matt@mattmichelstraining.com" ? senderEmail : undefined,
            to: [contact.email],
            subject: email1.subject || `Great meeting you at ${showName}!`,
            html: email1.body || `<p>Great meeting you at ${showName}!</p>`,
          }),
        });

        // Store contact + all 3 emails for campaign tracking / followup cron
        await sb.from("trade_show_sequences").insert({
          campaign_id: campaignId,
          contact_name: contact.name,
          contact_email: contact.email,
          contact_phone: contact.phone || null,
          contact_company: contact.company,
          contact_title: contact.title,
          email1_subject: email1.subject,
          email1_body: email1.body,
          email1_sent_at: new Date().toISOString(),
          email2_subject: email2.subject,
          email2_body: email2.body,
          email2_send_at: day4,
          email2_sent: false,
          email3_subject: email3.subject,
          email3_body: email3.body,
          email3_send_at: day10,
          email3_sent: false,
          created_at: new Date().toISOString(),
        });

        sequencesStarted++;
      } catch (contactErr) {
        console.error(`Error processing contact ${contact.email}:`, contactErr);
      }
    }

    // Update campaign with final count
    await sb
      .from("trade_show_campaigns")
      .update({ sequences_started: sequencesStarted, status: "active" })
      .eq("id", campaignId);

    return new Response(
      JSON.stringify({ success: true, campaignId, contactsProcessed: sequencesStarted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("trade-show-automation error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
