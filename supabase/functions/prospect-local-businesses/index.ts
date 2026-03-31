import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const log = (step: string, data?: any) =>
  console.log(`[PROSPECTOR] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Business categories: technically illiterate, cash-rich, motivated to spend ──
// Rotated daily so each run targets a fresh industry
const INDUSTRY_ROTATION = [
  "plumber",
  "electrician",
  "HVAC contractor",
  "roofer",
  "landscaper",
  "auto repair shop",
  "cleaning service",
  "tree service",
  "pressure washing",
  "painting contractor",
  "carpet cleaning",
  "moving company",
  "towing company",
  "locksmith",
  "pest control",
  "pool service",
  "junk removal",
  "concrete contractor",
  "deck builder",
  "fence contractor",
  "tattoo studio",
  "nail salon",
  "barber shop",
  "dog grooming",
  "catering company",
  "food truck",
  "party rental",
  "home inspector",
  "mobile mechanic",
  "chimney sweep",
  "metal fabrication shop",
  "commercial real estate broker",
  "industrial equipment dealer",
  "plastic injection molding company",
  "commercial contractor",
  "commercial property management",
];

// Cities across Michigan + Midwest — regional expansion
const CITY_ROTATION = [
  // Metro Detroit / Southeast MI
  "Detroit MI",
  "Grosse Pointe MI",
  "Warren MI",
  "Sterling Heights MI",
  "Livonia MI",
  "Dearborn MI",
  "Troy MI",
  "Southfield MI",
  "Pontiac MI",
  "Royal Oak MI",
  "Ann Arbor MI",
  "Ypsilanti MI",
  "Novi MI",
  "Canton MI",
  "Macomb MI",
  // Mid-Michigan
  "Flint MI",
  "Lansing MI",
  "East Lansing MI",
  "Jackson MI",
  "Saginaw MI",
  "Bay City MI",
  "Midland MI",
  // West Michigan
  "Grand Rapids MI",
  "Kalamazoo MI",
  "Battle Creek MI",
  "Muskegon MI",
  "Holland MI",
  "Traverse City MI",
  // Northern MI / UP
  "Alpena MI",
  "Marquette MI",
  // Ohio
  "Columbus OH",
  "Cleveland OH",
  "Cincinnati OH",
  "Toledo OH",
  "Akron OH",
  "Dayton OH",
  "Canton OH",
  "Youngstown OH",
  // Indiana
  "Indianapolis IN",
  "Fort Wayne IN",
  "South Bend IN",
  "Evansville IN",
  "Mishawaka IN",
  // Illinois (suburbs — not Chicago proper which is oversaturated)
  "Naperville IL",
  "Aurora IL",
  "Joliet IL",
  "Rockford IL",
  "Peoria IL",
  "Springfield IL",
  // Wisconsin
  "Milwaukee WI",
  "Madison WI",
  "Green Bay WI",
  "Racine WI",
  "Kenosha WI",
  // Kentucky
  "Louisville KY",
  "Lexington KY",
  // Missouri
  "St. Louis MO",
  "Kansas City MO",
];

function scoreDigitalGap(result: any): number {
  let score = 0;
  const url: string = result.url || result.metadata?.sourceURL || "";
  const content: string = result.markdown || result.content || "";

  if (!url || url.includes("facebook.com") || url.includes("yelp.com") || url.includes("yellowpages.com")) score += 35;
  else if (content.length < 500) score += 25;
  else score += 10;

  if (!content.includes("contact") && !content.includes("quote") && !content.includes("call")) score += 15;
  if (!content.includes("google") && !content.includes("maps")) score += 10;
  if (content.length < 1000) score += 15;
  if (!/\(\d{3}\)\s?\d{3}-\d{4}|\d{3}-\d{3}-\d{4}/.test(content)) score += 10;

  return Math.min(score, 95);
}

async function generateOutreachEmail(
  business: string,
  industry: string,
  city: string,
  lovableKey: string
): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are Matt Michels, a local business consultant in Grosse Pointe, MI. You help Metro Detroit small businesses grow with web design, AI automation, and done-for-you marketing tools. Your tone is straight-talking, local, and personal — not a pitch, more like a neighbor reaching out.` },
        {
          role: "user",
          content: `Write a short, punchy cold outreach email to "${business}", a ${industry} in ${city}.

Subject line + email body (under 160 words total).

Make it:
- Specific to their industry (mention a real pain they'd recognize)
- Reference that you're local (Grosse Pointe / Metro Detroit)
- Lead with the #1 most relevant service for a ${industry} business:
  * If HVAC/Plumbing/Roofing/Electrical/Contractor: lead with Missed Call Text-Back ($99/mo) — every missed call auto-texts the customer back within 60 seconds
  * If Restaurant/Retail/Salon/Gym: lead with Text Message Marketing ($79/mo) — AI writes and sends monthly SMS campaigns to their customer list
  * If Medical/Dental/Healthcare: lead with AI Reputation Dashboard ($79/mo) — weekly report on their Google/Yelp reviews with AI response suggestions
  * If Real Estate/Insurance: lead with AI Phone Answering ($149/mo) — AI answers every call 24/7, transcripts sent instantly
  * If Web/Tech or anything else: lead with web design ($499 flat, live in 7 days)
- Briefly mention you also build websites starting at $499 if they need one
- End with: "Takes 30 seconds to get started: mattmichelstraining.com/get-started — I'll reach out the same day."
- Then add a P.S. line: "P.S. — If you'd rather just text, (313) 806-4952 works too."

Do NOT use salesy language. Sound like a real person. One problem, one solution.

Format:
SUBJECT: [subject line]
---
[email body]` },
      ],
      temperature: 0.75 }) });

  if (!response.ok) throw new Error(`AI API error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!LOVABLE_API_KEY || !FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "API keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Auth: allow admin users OR service-role (cron) calls
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      // If a real user JWT was passed, verify admin role
      if (user) {
        const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      // If no user returned, this is a service-role/cron call — allow it to proceed
    }

    // Parse body — support day_rotation mode for cron calls
    let body: any = {};
    try { body = await req.json(); } catch { /* cron may send empty body */ }

    let { industry, city, limit = 5, mode } = body;

    // ── LINKEDIN BATCH MODE ────────────────────────────────────────────────
    // When mode === "linkedin_batch", pull top 10 emailed leads and generate
    // LinkedIn connection request notes, then email Matt a copy-paste batch.
    if (mode === "linkedin_batch") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: leads, error: leadsErr } = await serviceClient
        .from("outreach_leads")
        .select("id, business_name, owner_name, city, industry")
        .eq("status", "Emailed")
        .order("last_contact_date", { ascending: false })
        .limit(10);

      if (leadsErr) throw new Error(`Failed to fetch leads: ${leadsErr.message}`);
      if (!leads || leads.length === 0) {
        return new Response(JSON.stringify({ sent: 0, message: "No emailed leads found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const rows: { id: string; business_name: string; owner_name: string; message: string }[] = [];

      for (const lead of leads) {
        const ownerName = lead.owner_name || "Business Owner";
        const businessName = lead.business_name || "your business";
        const leadCity = lead.city || "Michigan";
        const leadIndustry = lead.industry || "local business";

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite", 
            messages: [{
              role: "user",
              content: `Write a 280-char max LinkedIn connection request note from Matt Michels (web design/local marketing, Grosse Pointe MI) to ${ownerName} at ${businessName} in ${leadCity}. Reference their specific industry: ${leadIndustry}. Casual, local, not salesy. No hashtags. Return only the note text, nothing else.` }] }) });

        const aiData = await aiRes.json();
        const message = (aiData?.choices?.[0]?.message?.content || "").trim().slice(0, 280);

        await serviceClient
          .from("outreach_leads")
          .update({ linkedin_message: message })
          .eq("id", lead.id);

        rows.push({ id: lead.id, business_name: businessName, owner_name: ownerName, message });

        await new Promise(r => setTimeout(r, 300));
      }

      const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

      const tableRows = rows.map(r => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b;white-space:nowrap;">${r.business_name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;white-space:nowrap;">${r.owner_name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;line-height:1.5;">${r.message}</td>
        </tr>`).join("");

      const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;">
  <tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">LinkedIn Batch</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${dateStr}</p>
  </td></tr>
  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b;font-weight:700;">10 LinkedIn messages ready to send</p>
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">
      Open LinkedIn Sales Navigator, search each name below, and send the connection request with the note provided. These are leads that already received a cold email — use the connection note as your warm follow-up.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;border-bottom:none;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Business</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Owner</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">LinkedIn Note (copy-paste)</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </td></tr>
  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</div>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² System <matt@notify.m2training.com>",
            to: ["matt@m2training.com"],
            reply_to: "matt@m2training.com",
            subject: `10 LinkedIn messages ready to send — ${dateStr}`,
            html: emailHtml }) });
      }

      log("LinkedIn batch complete", { count: rows.length });
      return new Response(JSON.stringify({ sent: rows.length, mode: "linkedin_batch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CONTRACTOR LEAD PITCH MODE ─────────────────────────────────────────
    // When mode === "contractor_lead_pitch", pitch the lead gen service instead of web design
    if (mode === "contractor_lead_pitch") {
      const CONTRACTOR_INDUSTRIES = ["roofing contractor", "HVAC contractor", "plumbing contractor", "electrician", "gutter company"];
      const CONTRACTOR_CITIES = ["Detroit MI", "Warren MI", "Sterling Heights MI", "Livonia MI", "Ann Arbor MI", "Dearborn MI", "Troy MI", "Southfield MI", "Pontiac MI", "Royal Oak MI"];
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const contractorIndustry = CONTRACTOR_INDUSTRIES[dayOfYear % CONTRACTOR_INDUSTRIES.length];
      const contractorCity = CONTRACTOR_CITIES[new Date().getDate() % CONTRACTOR_CITIES.length];

      // Search for contractors to pitch
      const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: `${contractorIndustry} ${contractorCity} site:yelp.com OR site:yellowpages.com`, limit: 5 }) });
      const searchData = await searchRes.json();
      const results = searchData.data || [];

      let pitched = 0;
      for (const result of results.slice(0, 5)) {
        const businessName = result.metadata?.title || result.title || "your business";
        const email = result.metadata?.email;
        if (!email) continue;

        // Check dedup
        const { data: existing } = await serviceClient.from("email_send_log").select("id").eq("email", email).eq("campaign", "contractor_lead_pitch").limit(1);
        if (existing && existing.length > 0) continue;

        // Generate AI pitch for lead gen service
        const pitchPrompt = `Write a short cold email from Matt Michels to "${businessName}", a ${contractorIndustry} in ${contractorCity.split(" ")[0]}.

Matt runs a local lead generation service. He has a website that generates exclusive roofing/HVAC/plumbing/electrical leads in Metro Detroit. He's looking for ONE contractor per trade per city to receive all the leads.

Key points:
- Leads are exclusive (they don't compete with other contractors)
- No Angi or HomeAdvisor — no shared leads
- $299–$399/month flat, cancel anytime
- Free 3-lead trial to prove it works first
- End with: "Get started at mattmichelstraining.com/get-started — takes 30 seconds, and I'll reach out the same day."
- Then add a P.S. line: "P.S. — If you'd rather just text, (313) 806-4952 works too."

Subject + email body, under 120 words total. Sound like a real person, not a marketer.

Format:
SUBJECT: [subject line]
---
[email body]`;

        const aiRes = await fetch("https://api.lovable.ai/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: pitchPrompt }] }) });
        const aiData = await aiRes.json();
        const emailText = aiData.choices?.[0]?.message?.content || "";
        const subjectMatch = emailText.match(/SUBJECT:\s*(.+)/);
        const subject = subjectMatch ? subjectMatch[1].trim() : `Exclusive ${contractorIndustry} leads — ${contractorCity.split(" ")[0]}`;
        const bodyText = emailText.replace(/SUBJECT:.*\n---\n?/, "").trim();

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY") || ""}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@notify.m2training.com>",
            to: [email],
            reply_to: "matt@m2training.com",
            subject,
            html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.8;color:#1e293b;max-width:500px;">${bodyText.replace(/\n/g, "<br>")}<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-family-cornfield.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels"><div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>Grosse Pointe, MI · (313) 806-4952</div></div></div>` }) });

        await serviceClient.from("email_send_log").insert({ email, campaign: "contractor_lead_pitch", business_name: businessName });
        pitched++;
      }

      log("Contractor lead pitch run complete", { pitched, industry: contractorIndustry, city: contractorCity });
      return new Response(JSON.stringify({ pitched, mode: "contractor_lead_pitch" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Day-rotation mode: pick industry + city from rotation based on today
    if (!industry) {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      industry = INDUSTRY_ROTATION[dayOfYear % INDUSTRY_ROTATION.length];
    }
    if (!city) {
      const dayOfMonth = new Date().getDate();
      city = CITY_ROTATION[dayOfMonth % CITY_ROTATION.length];
    }

    log("Starting prospecting run", { industry, city, limit });

    const searchQuery = `${industry} ${city} site:yelp.com OR site:google.com OR site:yellowpages.com`;
    const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchQuery, limit: Math.min(limit * 2, 20) }) });

    if (!searchRes.ok) throw new Error(`Firecrawl search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    const results: any[] = searchData.data || searchData.results || [];
    log("Firecrawl results", { count: results.length });

    if (results.length === 0) {
      return new Response(JSON.stringify({ found: 0, queued: 0, skipped: 0, message: "No results from search" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let queued = 0;
    let skipped = 0;
    const newLeads: string[] = [];

    for (const result of results) {
      if (queued >= limit) break;

      try {
        const gapScore = scoreDigitalGap(result);
        if (gapScore < 40) { skipped++; continue; }

        const title: string = result.title || result.metadata?.title || "";
        const businessName = title.replace(/\s*[-|·].*$/, "").trim() || `${industry} in ${city}`;

        const { data: existing } = await serviceClient
          .from("web_design_leads" as any)
          .select("id")
          .ilike("business", `%${businessName.substring(0, 20)}%`)
          .limit(1);

        if (existing && existing.length > 0) { skipped++; continue; }

        const outreachEmail = await generateOutreachEmail(businessName, industry, city, LOVABLE_API_KEY);

        const lines = outreachEmail.split("\n");
        const subjectLine = lines.find(l => l.startsWith("SUBJECT:"))?.replace("SUBJECT:", "").trim()
          || `Your ${industry} business could be getting more calls`;
        const emailBody = lines.slice(lines.findIndex(l => l === "---") + 1).join("\n").trim();

        const { data: newLead, error: insertErr } = await serviceClient
          .from("web_design_leads" as any)
          .insert({
            name: "Business Owner",
            business: businessName,
            phone: "",
            email: "",
            description: `SOURCE: auto_prospected | INDUSTRY: ${industry} | CITY: ${city} | GAP_SCORE: ${gapScore} | URL: ${result.url || "none"}\n\nAUTO-GENERATED OUTREACH:\nSubject: ${subjectLine}\n\n${emailBody}`,
            status: "new",
            notes: `Auto-prospected ${new Date().toLocaleDateString()}. Gap score: ${gapScore}/100. Drip queued.` })
          .select("id")
          .single();

        if (insertErr) { log("Insert error", { error: insertErr.message }); skipped++; continue; }

        queued++;
        newLeads.push(newLead.id);
        log("Lead queued", { business: businessName, gapScore, industry, city });

        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        log("Error processing result", { error: String(err) });
        skipped++;
      }
    }

    log("Run complete", { found: results.length, queued, skipped, industry, city });

    return new Response(
      JSON.stringify({
        found: results.length,
        queued,
        skipped,
        leads: newLeads,
        industry,
        city,
        message: `Prospecting complete. ${queued} new ${industry} leads in ${city} added to CRM.` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
