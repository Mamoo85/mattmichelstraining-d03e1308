// AI Proposal Generator — serves POST requests
// Body: { clientEmail, projectName, clientName, projectScope, budget?, timeline?, prospectEmail? }
// 1. Looks up sender in proposal_clients by clientEmail, checks active=true
// 2. Generates a full HTML proposal via Claude
// 3. Emails proposal to both the client (sender) and the prospect (if prospectEmail provided)
// 4. Increments proposal_count

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const FROM_EMAIL = "Matt Michels <matt@mattmichelstraining.com>";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS" };

interface ProposalRequest {
  clientEmail: string;
  projectName: string;
  clientName: string;
  projectScope: string;
  budget?: string;
  timeline?: string;
  prospectEmail?: string;
}

interface ProposalClient {
  id: string;
  email: string;
  business_name: string;
  active: boolean;
  proposal_count: number;
}

async function generateProposal(
  client: ProposalClient,
  req: ProposalRequest,
): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite", 
      messages: [
        {
          role: "user",
          content: `Write a professional business proposal for ${client.business_name} to send to client '${req.clientName}'. Project: ${req.projectName}. Scope: ${req.projectScope}. Budget range: ${req.budget || "TBD"}. Timeline: ${req.timeline || "To be determined"}. Include: executive summary, scope of work, deliverables, timeline, investment (use the budget range), terms, and a professional call to action. Format as HTML with proper headings and sections.` },
      ] }) });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error: ${err}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

function wrapProposalHtml(
  proposalContent: string,
  businessName: string,
  projectName: string,
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Proposal — ${projectName}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;">

  <tr><td style="background:#1e293b;padding:24px 32px;border-radius:10px 10px 0 0;">
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">${businessName}</h1>
    <p style="margin:8px 0 0;color:#e8621a;font-size:15px;font-weight:600;">Business Proposal — ${projectName}</p>
    <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
  </td></tr>

  <tr><td style="background:#ffffff;padding:36px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;font-size:15px;color:#1e293b;line-height:1.75;">
    ${proposalContent}
  </td></tr>

  <tr><td style="background:#f1f5f9;padding:20px 32px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <img src="https://mattmichelstraining.com/images/matt-boat.jpg"
            alt="Matt Michels" width="48" height="48"
            style="border-radius:50%;vertical-align:middle;margin-right:12px;">
          <span style="font-size:13px;color:#475569;vertical-align:middle;">
            ${businessName} · Prepared by M2 Development
          </span>
          <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
          <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
          </span>
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, bcc: ["matthewmichels4@gmail.com"] }) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  try {
    let body: ProposalRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    const { clientEmail, projectName, clientName, projectScope, budget, timeline, prospectEmail } =
      body;

    if (!clientEmail || !projectName || !clientName || !projectScope) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing required fields: clientEmail, projectName, clientName, projectScope" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up the client
    const { data: clientData, error: clientError } = await supabase
      .from("proposal_clients")
      .select("id, email, business_name, active, proposal_count")
      .eq("email", clientEmail)
      .single();

    if (clientError || !clientData) {
      return new Response(
        JSON.stringify({ ok: false, error: "Client not found" }),
        { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const client = clientData as ProposalClient;

    if (!client.active) {
      return new Response(
        JSON.stringify({ ok: false, error: "Client account is not active" }),
        { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // Generate the proposal
    const proposalContent = await generateProposal(client, body);
    const proposalHtml = wrapProposalHtml(proposalContent, client.business_name, projectName);

    // Determine recipients
    const recipients: string[] = [clientEmail];
    if (prospectEmail && prospectEmail !== clientEmail) {
      recipients.push(prospectEmail);
    }

    const subject = `Business Proposal — ${projectName}`;
    await sendEmail(recipients, subject, proposalHtml);

    // Increment proposal_count
    await supabase
      .from("proposal_clients")
      .update({ proposal_count: (client.proposal_count || 0) + 1 })
      .eq("id", client.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Fatal error:", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }
});
