// approve-spend — One-click approval/denial of spending decisions for the Chairman
//
// Matt receives APPROVE/DENY links in the CFO daily email.
// Clicking a link hits this function as a GET request.
//
// GET /functions/v1/approve-spend?id={uuid}&action=approve|deny&token={REMOTE_CONTROL_SECRET}
// Returns a simple HTML confirmation page — no login required.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const REMOTE_SECRET   = Deno.env.get("REMOTE_CONTROL_SECRET") || "";
const RESEND_KEY      = Deno.env.get("RESEND_API_KEY") || "";
const OWNER_EMAIL     = "matthewmichels4@gmail.com";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function htmlPage(title: string, body: string, success: boolean): Response {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; border-radius: 12px; padding: 40px; max-width: 480px; text-align: center; border: 1px solid ${success ? "#22c55e" : "#ef4444"}; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: ${success ? "#22c55e" : "#ef4444"}; margin: 0 0 12px; font-size: 24px; }
    p { color: #94a3b8; line-height: 1.6; }
    .detail { background: #0f172a; border-radius: 8px; padding: 12px; margin: 20px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✅" : "❌"}</div>
    <h1>${title}</h1>
    ${body}
    <p style="font-size:12px;color:#334155;margin-top:24px;">M² AI Corporation · You can close this tab</p>
  </div>
</body>
</html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // CORS for direct fetch calls
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" } });
  }

  const id = url.searchParams.get("id");
  const action = url.searchParams.get("action");
  const token = url.searchParams.get("token");

  // Auth check
  if (!REMOTE_SECRET || token !== REMOTE_SECRET) {
    return htmlPage("Unauthorized", "<p>Invalid or missing token. This link may have expired.</p>", false);
  }

  if (!id || !["approve", "deny"].includes(action || "")) {
    return htmlPage("Invalid Request", "<p>Missing required parameters.</p>", false);
  }

  // Fetch the approval record
  const { data: approval, error } = await sb.from("spending_approvals")
    .select("id, agent, description, projected_cost_cents, projected_revenue_cents, status, created_at")
    .eq("id", id)
    .single();

  if (error || !approval) {
    return htmlPage("Not Found", "<p>This spending approval could not be found. It may have already been decided.</p>", false);
  }

  if (approval.status !== "pending") {
    const alreadyAction = approval.status === "approved" ? "✅ approved" : "❌ denied";
    return htmlPage(
      "Already Decided",
      `<p>This decision was already ${alreadyAction}. No further action needed.</p>`,
      approval.status === "approved",
    );
  }

  const isApprove = action === "approve";
  const newStatus = isApprove ? "approved" : "denied";

  // Update the record
  await sb.from("spending_approvals")
    .update({ status: newStatus, decided_at: new Date().toISOString() })
    .eq("id", id);

  const profit = approval.projected_revenue_cents - approval.projected_cost_cents;
  const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`;

  // Notify via email
  if (RESEND_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "CFO Report <matt@detroitwebagent.com>",
        to: [OWNER_EMAIL],
        subject: `${isApprove ? "✅ Approved" : "❌ Denied"}: ${approval.description.slice(0, 60)}`,
        html: `<div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:8px;max-width:480px;">
          <h2 style="color:${isApprove ? "#22c55e" : "#ef4444"};">${isApprove ? "✅ Decision Approved" : "❌ Decision Denied"}</h2>
          <p><strong>Request:</strong> ${approval.description}</p>
          <p><strong>Agent:</strong> ${approval.agent}</p>
          <p><strong>Cost:</strong> ${fmtCents(approval.projected_cost_cents)} &nbsp;|&nbsp; <strong>Revenue:</strong> ${fmtCents(approval.projected_revenue_cents)} &nbsp;|&nbsp; <strong>Net:</strong> ${fmtCents(profit)}</p>
          <p style="color:#64748b;font-size:12px;">Decided at: ${new Date().toLocaleString("en-US", { timeZone: "America/Detroit" })} ET</p>
        </div>`,
      }),
    });
  }

  console.log(`[APPROVE-SPEND] ${newStatus.toUpperCase()} — id:${id} agent:${approval.agent}`);

  return htmlPage(
    isApprove ? "Decision Approved!" : "Decision Denied",
    `<div class="detail">
      <p style="margin:0;color:#94a3b8;font-size:13px;">${approval.description}</p>
    </div>
    <p>The ${approval.agent} agent has been notified. ${isApprove ? "It will proceed with the plan." : "No action will be taken."}</p>`,
    isApprove,
  );
});
