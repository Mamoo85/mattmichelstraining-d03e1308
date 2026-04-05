// Bid Intel Approve — one-click approval for bid intelligence proposals
// Supports POST body { draft_id, action } or email deep links via query params

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateSig(proposalId: string): string {
  const raw = `${proposalId}${SUPABASE_SERVICE_KEY}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").substring(0, 16);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let proposalId: string | null = null;
    let action: string | null = null;
    let isDeepLink = false;

    // Check query params first (email deep links)
    if (url.searchParams.has("id")) {
      proposalId = url.searchParams.get("id");
      action = url.searchParams.get("action");
      const sig = url.searchParams.get("sig");
      isDeepLink = true;

      if (!proposalId || !sig || generateSig(proposalId) !== sig) {
        return new Response("<html><body><h2>Invalid or expired link.</h2></body></html>", {
          status: 403,
          headers: { "Content-Type": "text/html", ...corsHeaders },
        });
      }
    } else {
      // POST body
      const body = await req.json();
      proposalId = body.draft_id;
      action = body.action;
    }

    if (!proposalId || !action || !["approve", "dismiss"].includes(action)) {
      return new Response(JSON.stringify({ error: "draft_id and action (approve|dismiss) required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch the proposal with client and opportunity info
    const { data: proposal, error: fetchErr } = await sb
      .from("bid_intel_proposals")
      .select("*, bid_intel_clients(company_name, email), bid_intel_opportunities(title)")
      .eq("id", proposalId)
      .maybeSingle();

    if (fetchErr || !proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "approve") {
      const { error: updateErr } = await sb
        .from("bid_intel_proposals")
        .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: "matt" })
        .eq("id", proposalId);

      if (updateErr) throw updateErr;

      // Send the approved proposal to the client
      const clientEmail = proposal.bid_intel_clients?.email;
      const companyName = proposal.bid_intel_clients?.company_name || "Client";
      const opportunityTitle = proposal.bid_intel_opportunities?.title || "Bid Opportunity";

      if (clientEmail) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "matt@mattmichelstraining.com",
            to: clientEmail,
            subject: `Your Bid Proposal — ${opportunityTitle}`,
            html: proposal.proposal_html || `<p>Your bid proposal for "${opportunityTitle}" has been approved and is ready for submission.</p>`,
          }),
        });
      }
    } else {
      // dismiss
      const { error: updateErr } = await sb
        .from("bid_intel_proposals")
        .update({ status: "dismissed" })
        .eq("id", proposalId);

      if (updateErr) throw updateErr;
    }

    if (isDeepLink) {
      const statusLabel = action === "approve" ? "Approved" : "Dismissed";
      return new Response(
        `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2 style="color:#1e293b">Bid Proposal ${statusLabel}</h2>
          <p style="color:#64748b">You can close this tab.</p>
        </body></html>`,
        { status: 200, headers: { "Content-Type": "text/html", ...corsHeaders } },
      );
    }

    return new Response(JSON.stringify({ ok: true, action, proposal_id: proposalId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
