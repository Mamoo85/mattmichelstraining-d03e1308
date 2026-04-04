// hoa-cold-outreach — cron Monday 7am ET
// Prospects property management companies and sends personalized cold emails
// pitching HOA Secretary AI via Firecrawl search + Claude Haiku

// SQL setup (run once):
// CREATE TABLE hoa_leads (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, email text UNIQUE NOT NULL, name text, hoa_name text, home_count text, source text, next_followup_at timestamptz, created_at timestamptz DEFAULT now());
// CREATE TABLE hoa_outreach_prospects (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_name text, website text, email text UNIQUE, status text DEFAULT 'pending', next_followup_at timestamptz, created_at timestamptz DEFAULT now());
// ALTER TABLE hoa_leads ENABLE ROW LEVEL SECURITY;
// ALTER TABLE hoa_outreach_prospects ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_all" ON hoa_leads TO service_role USING (true) WITH CHECK (true);
// CREATE POLICY "service_role_all" ON hoa_outreach_prospects TO service_role USING (true) WITH CHECK (true);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const MAX_NEW_PROSPECTS_PER_RUN = 10;

interface FirecrawlResult {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
}

async function firecrawlSearch(query: string): Promise<FirecrawlResult[]> {
  if (!FIRECRAWL_API_KEY) {
    console.warn("[hoa-cold-outreach] FIRECRAWL_API_KEY not set, skipping search");
    return [];
  }
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: 5 }),
    });
    if (!res.ok) {
      console.error("[hoa-cold-outreach] Firecrawl error:", res.status, await res.text());
      return [];
    }
    const data = await res.json();
    return data?.data || data?.results || [];
  } catch (e) {
    console.error("[hoa-cold-outreach] Firecrawl fetch error:", e);
    return [];
  }
}

function extractEmailFromText(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

function extractCompanyName(result: FirecrawlResult): string {
  return result.title?.split(" - ")?.[0]?.split(" | ")?.[0]?.trim() || "Property Management Company";
}

async function generateColdEmail(companyName: string, touchNumber: number): Promise<string> {
  if (!ANTHROPIC_API_KEY) return "";

  let prompt = "";
  if (touchNumber === 1) {
    prompt = `Write a short, personalized 4-sentence cold email to ${companyName}, a property management company that manages multiple HOAs.

Sentence 1: Acknowledge they manage multiple HOAs and the administrative load that comes with it.
Sentence 2: Name the specific problem: writing meeting minutes takes 2-3 hours per community per month.
Sentence 3: Introduce the solution: HOA Secretary AI writes professional minutes in under 2 minutes from rough notes — no formatting, no cleanup.
Sentence 4: Low-pressure CTA: "Worth a 5-min look? mattmichelstraining.com/hoa-secretary"

Rules:
- No subject line, just the body
- Conversational, not salesy
- No bullet points
- Sign off as "Matt" only
- Under 100 words total`;
  } else if (touchNumber === 2) {
    prompt = `Write a very short follow-up cold email (2-3 sentences) to ${companyName} about HOA Secretary AI.

Open with: "Just bumping this up —" then ask if the meeting minutes problem resonated. End with the link: mattmichelstraining.com/hoa-secretary

Rules:
- No subject line, just the body
- Casual and brief
- Sign off as "Matt" only
- Under 50 words`;
  } else {
    prompt = `Write a brief final follow-up email (2 sentences) to ${companyName} about HOA Secretary AI.

Let them know this is the last note, and if timing's ever right they can find it at mattmichelstraining.com/hoa-secretary. Offer a free trial.

Rules:
- No subject line, just the body
- Friendly, no pressure
- Sign off as "Matt" only
- Under 40 words`;
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data?.content?.[0]?.text?.trim() || "";
  } catch (e) {
    console.error("[hoa-cold-outreach] Claude error:", e);
    return "";
  }
}

async function sendEmail(to: string, subject: string, bodyText: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-radius:8px;">
    <p style="color:#334155;font-size:15px;line-height:1.8;margin:0 0 28px;white-space:pre-wrap;">${bodyText}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M2 Development · (313) 806-4952<br><a href="mailto:matt@mattmichelstraining.com" style="color:#e8621a;text-decoration:none;">matt@mattmichelstraining.com</a></div>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Matt Michels <matt@mattmichelstraining.com>",
      to: [to],
      subject,
      html,
    }),
  });
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();

  let newProspects = 0;
  let emailsSent = 0;

  // ── Step 1: Prospect new companies via Firecrawl ──────────────────────────
  const queries = [
    "property management company HOA Michigan site:yelp.com OR site:google.com",
    "HOA management company contact email Michigan",
  ];

  const allResults: FirecrawlResult[] = [];
  for (const q of queries) {
    const results = await firecrawlSearch(q);
    allResults.push(...results);
    if (allResults.length >= MAX_NEW_PROSPECTS_PER_RUN) break;
  }

  for (const result of allResults.slice(0, MAX_NEW_PROSPECTS_PER_RUN)) {
    const website = result.url || "";
    const fullText = [result.title || "", result.description || "", result.markdown || ""].join(" ");
    const email = extractEmailFromText(fullText);
    const companyName = extractCompanyName(result);

    if (!email && !website) continue;

    // Check if already exists
    const lookupField = email ? "email" : "website";
    const lookupValue = email || website;
    const { data: existing } = await sb
      .from("hoa_outreach_prospects")
      .select("id")
      .eq(lookupField, lookupValue)
      .maybeSingle();

    if (existing) continue;

    const { error: insertErr } = await sb.from("hoa_outreach_prospects").insert({
      company_name: companyName,
      website: website || null,
      email: email || null,
      status: "pending",
      created_at: now.toISOString(),
    });

    if (!insertErr) newProspects++;
  }

  console.log(`[hoa-cold-outreach] Inserted ${newProspects} new prospects`);

  // ── Step 2: Send first touch to pending prospects ─────────────────────────
  const { data: pendingProspects } = await sb
    .from("hoa_outreach_prospects")
    .select("*")
    .eq("status", "pending")
    .not("email", "is", null);

  for (const prospect of pendingProspects || []) {
    try {
      const emailBody = await generateColdEmail(prospect.company_name, 1);
      if (!emailBody) continue;

      await sendEmail(
        prospect.email,
        "Quick question about your HOA minutes process",
        emailBody
      );

      const followupAt = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
      await sb
        .from("hoa_outreach_prospects")
        .update({ status: "contacted_1", next_followup_at: followupAt.toISOString() })
        .eq("id", prospect.id);

      emailsSent++;
    } catch (e) {
      console.error(`[hoa-cold-outreach] Touch 1 error for ${prospect.email}:`, e);
    }
  }

  // ── Step 3: Send follow-up #2 to contacted_1 prospects ───────────────────
  const { data: touch2Prospects } = await sb
    .from("hoa_outreach_prospects")
    .select("*")
    .eq("status", "contacted_1")
    .not("email", "is", null)
    .lte("next_followup_at", now.toISOString());

  for (const prospect of touch2Prospects || []) {
    try {
      const emailBody = await generateColdEmail(prospect.company_name, 2);
      if (!emailBody) continue;

      await sendEmail(
        prospect.email,
        "Re: HOA minutes process",
        emailBody
      );

      const followupAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      await sb
        .from("hoa_outreach_prospects")
        .update({ status: "contacted_2", next_followup_at: followupAt.toISOString() })
        .eq("id", prospect.id);

      emailsSent++;
    } catch (e) {
      console.error(`[hoa-cold-outreach] Touch 2 error for ${prospect.email}:`, e);
    }
  }

  // ── Step 4: Send final touch to contacted_2 prospects ────────────────────
  const { data: touch3Prospects } = await sb
    .from("hoa_outreach_prospects")
    .select("*")
    .eq("status", "contacted_2")
    .not("email", "is", null)
    .lte("next_followup_at", now.toISOString());

  for (const prospect of touch3Prospects || []) {
    try {
      const emailBody = await generateColdEmail(prospect.company_name, 3);
      if (!emailBody) continue;

      await sendEmail(
        prospect.email,
        "Last note — HOA Secretary AI",
        emailBody
      );

      await sb
        .from("hoa_outreach_prospects")
        .update({ status: "completed", next_followup_at: null })
        .eq("id", prospect.id);

      emailsSent++;
    } catch (e) {
      console.error(`[hoa-cold-outreach] Touch 3 error for ${prospect.email}:`, e);
    }
  }

  console.log(`[hoa-cold-outreach] Done. New prospects: ${newProspects}, emails sent: ${emailsSent}`);
  return new Response(
    JSON.stringify({ success: true, newProspects, emailsSent }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
