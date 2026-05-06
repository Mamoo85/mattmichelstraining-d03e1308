// fielddesk-import-eway: discovery-call intake endpoint for shops considering
// the FieldDesk migration path off eWay CRM. This is a public lead-capture
// endpoint — no actual eWay data is touched in this function. The "import"
// happens manually (Matt-led discovery call → custom CSV mapping) once we've
// confirmed the prospect is real.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DiscoveryRequest {
  org_name?: string;
  contact_email?: string;
  tech_count?: number;
  mode?: "discovery" | "mirror" | "cutover";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as DiscoveryRequest;
    const orgName = body.org_name?.trim();
    const email = body.contact_email?.trim().toLowerCase();
    const techCount = Number.isFinite(body.tech_count) ? body.tech_count : null;
    const mode = body.mode ?? "discovery";

    if (!orgName || !email) {
      return new Response(
        JSON.stringify({ error: "org_name and contact_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Insert a discovery row. If the table doesn't exist yet, fail open with
    // a 200 so the form still works and we still get a Resend notification.
    const { error: insertError } = await supabase
      .from("fielddesk_migration_requests")
      .insert({
        org_name: orgName,
        contact_email: email,
        tech_count: techCount,
        mode,
        migration_status: "discovery",
      });
    if (insertError) {
      console.error("[fielddesk-import-eway] insert failed:", insertError);
    }

    // Notify Matt
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: ["matt@detroitwebagent.com"],
            reply_to: email,
            subject: `FieldDesk Migration Request — ${orgName}`,
            html: `
              <p>New eWay → FieldDesk migration discovery request.</p>
              <ul>
                <li><strong>Company:</strong> ${escapeHtml(orgName)}</li>
                <li><strong>Email:</strong> ${escapeHtml(email)}</li>
                <li><strong>Tech count:</strong> ${techCount ?? "n/a"}</li>
                <li><strong>Mode:</strong> ${mode}</li>
              </ul>
              <p>Reply to this email to respond directly.</p>
            `,
          }),
        });
      } catch (notifyErr) {
        console.error("[fielddesk-import-eway] resend notify failed:", notifyErr);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message:
          "Got it — we'll be in touch within one business day to schedule discovery.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fielddesk-import-eway] error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
