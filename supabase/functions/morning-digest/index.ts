// Morning Digest — daily 7am ET cron
// Sends Matt a single consolidated email with everything needing approval

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

function generateSig(id: string): string {
  const raw = `${id}${SUPABASE_SERVICE_KEY}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").substring(0, 16);
}

function approveLink(functionName: string, id: string, action: string): string {
  const sig = generateSig(id);
  return `${SUPABASE_URL}/functions/v1/${functionName}?id=${id}&action=${action}&sig=${sig}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Run all three queries in parallel
  const [filingDraftsRes, bidProposalsRes, deadlinesRes] = await Promise.all([
    sb
      .from("reg_filing_drafts")
      .select("id, title, created_at, reg_filing_clients(company_name)")
      .eq("status", "pending_approval"),
    sb
      .from("bid_intel_proposals")
      .select("id, created_at, bid_intel_clients(company_name), bid_intel_opportunities(title)")
      .eq("status", "pending_approval"),
    sb
      .from("reg_filing_deadlines")
      .select("id, title, due_date, reg_filing_clients(company_name)")
      .eq("status", "upcoming")
      .gte("due_date", new Date().toISOString().split("T")[0])
      .lte("due_date", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]),
  ]);

  const filingDrafts = filingDraftsRes.data || [];
  const bidProposals = bidProposalsRes.data || [];
  const deadlines = deadlinesRes.data || [];

  // Skip if nothing to report
  if (!filingDrafts.length && !bidProposals.length && !deadlines.length) {
    return new Response(JSON.stringify({ ok: true, sent: false, reason: "nothing pending" }), { status: 200 });
  }

  // Build email sections
  let sections = "";

  if (filingDrafts.length) {
    sections += `
      <tr><td style="padding:24px 0 8px 0">
        <h2 style="margin:0;font-size:18px;color:#1e293b;border-bottom:2px solid #e8621a;padding-bottom:6px">
          Filing Drafts Pending Approval (${filingDrafts.length})
        </h2>
      </td></tr>`;

    for (const draft of filingDrafts) {
      const company = draft.reg_filing_clients?.company_name || "Unknown";
      const approveUrl = approveLink("reg-filing-approve", draft.id, "approve");
      const dismissUrl = approveLink("reg-filing-approve", draft.id, "dismiss");

      sections += `
      <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:4px 0">
            <strong style="color:#1e293b">${draft.title || "Untitled Draft"}</strong><br>
            <span style="color:#64748b;font-size:13px">${company} &bull; ${formatDate(draft.created_at)}</span>
          </td>
          <td align="right" style="white-space:nowrap">
            <a href="${approveUrl}" style="display:inline-block;padding:6px 14px;background:#e8621a;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;margin-right:6px">Approve</a>
            <a href="${dismissUrl}" style="display:inline-block;padding:6px 14px;background:#94a3b8;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600">Dismiss</a>
          </td>
        </tr></table>
      </td></tr>`;
    }
  }

  if (bidProposals.length) {
    sections += `
      <tr><td style="padding:24px 0 8px 0">
        <h2 style="margin:0;font-size:18px;color:#1e293b;border-bottom:2px solid #e8621a;padding-bottom:6px">
          Bid Proposals Pending Approval (${bidProposals.length})
        </h2>
      </td></tr>`;

    for (const proposal of bidProposals) {
      const company = proposal.bid_intel_clients?.company_name || "Unknown";
      const oppTitle = proposal.bid_intel_opportunities?.title || "Untitled Opportunity";
      const approveUrl = approveLink("bid-intel-approve", proposal.id, "approve");
      const dismissUrl = approveLink("bid-intel-approve", proposal.id, "dismiss");

      sections += `
      <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:4px 0">
            <strong style="color:#1e293b">${oppTitle}</strong><br>
            <span style="color:#64748b;font-size:13px">${company} &bull; ${formatDate(proposal.created_at)}</span>
          </td>
          <td align="right" style="white-space:nowrap">
            <a href="${approveUrl}" style="display:inline-block;padding:6px 14px;background:#e8621a;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;margin-right:6px">Approve</a>
            <a href="${dismissUrl}" style="display:inline-block;padding:6px 14px;background:#94a3b8;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600">Dismiss</a>
          </td>
        </tr></table>
      </td></tr>`;
    }
  }

  if (deadlines.length) {
    sections += `
      <tr><td style="padding:24px 0 8px 0">
        <h2 style="margin:0;font-size:18px;color:#1e293b;border-bottom:2px solid #e8621a;padding-bottom:6px">
          Upcoming Deadlines — Next 7 Days (${deadlines.length})
        </h2>
      </td></tr>`;

    for (const dl of deadlines) {
      const company = dl.reg_filing_clients?.company_name || "Unknown";

      sections += `
      <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
        <strong style="color:#1e293b">${dl.title || "Untitled Deadline"}</strong><br>
        <span style="color:#64748b;font-size:13px">${company} &bull; Due: <strong style="color:#dc2626">${formatDate(dl.due_date)}</strong></span>
      </td></tr>`;
    }
  }

  // Build full email
  const totalItems = filingDrafts.length + bidProposals.length + deadlines.length;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <!-- Header -->
        <tr><td style="background:#1e293b;padding:20px 24px">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <span style="color:#e8621a;font-size:20px;font-weight:700">M&sup2;</span>
              <span style="color:#fff;font-size:20px;font-weight:700"> Morning Digest</span>
            </td>
            <td align="right" style="color:#94a3b8;font-size:13px">${today}</td>
          </tr></table>
        </td></tr>
        <!-- Summary -->
        <tr><td style="padding:20px 24px;background:#fef3cd;border-bottom:1px solid #e2e8f0">
          <span style="font-size:15px;color:#1e293b"><strong>${totalItems}</strong> item${totalItems !== 1 ? "s" : ""} need${totalItems === 1 ? "s" : ""} your attention today.</span>
        </td></tr>
        <!-- Sections -->
        <tr><td style="padding:0 24px 24px 24px">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${sections}
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
          <span style="color:#94a3b8;font-size:12px">M&sup2; Development &bull; mattmichelstraining.com</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "matt@mattmichelstraining.com",
      to: "matt@mattmichelstraining.com",
      subject: `Morning Digest — ${totalItems} item${totalItems !== 1 ? "s" : ""} pending`,
      html,
    }),
  });

  return new Response(JSON.stringify({ ok: true, sent: true, filings: filingDrafts.length, proposals: bidProposals.length, deadlines: deadlines.length }), { status: 200 });
});
