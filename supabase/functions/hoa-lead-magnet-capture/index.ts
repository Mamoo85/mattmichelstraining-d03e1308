// hoa-lead-magnet-capture — HTTP POST
// Called when someone downloads the free HOA meeting minutes template
// Upserts lead to hoa_leads table + sends template email via Resend

// SQL setup (run once):
// CREATE TABLE hoa_leads (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, email text UNIQUE NOT NULL, name text, hoa_name text, home_count text, source text, next_followup_at timestamptz, created_at timestamptz DEFAULT now());
// ALTER TABLE hoa_leads ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_all" ON hoa_leads TO service_role USING (true) WITH CHECK (true);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { email, name, hoaName, homeCount } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const followupAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // now + 3 days

    // Upsert lead to hoa_leads
    const { error: upsertErr } = await sb.from("hoa_leads").upsert(
      {
        email,
        name: name || null,
        hoa_name: hoaName || null,
        home_count: homeCount || null,
        source: "template_download",
        created_at: now.toISOString(),
        next_followup_at: followupAt.toISOString(),
      },
      { onConflict: "email" }
    );

    if (upsertErr) {
      console.error("[hoa-lead-magnet-capture] Upsert error:", upsertErr);
    }

    const displayName = name || "there";

    // Build template email HTML
    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;">

  <tr><td style="background:#1e293b;padding:24px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">M² HOA Secretary</p>
    <p style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">Your HOA Meeting Minutes Template</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Free resource from Matt Michels · mattmichelstraining.com</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Here's your free HOA meeting minutes template, ${displayName}. Use it as a starting point every month — just fill in the blanks after each meeting.
    </p>

    <!-- TEMPLATE START -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:28px;margin:0 0 28px;font-family:'Courier New',Courier,monospace;font-size:13px;color:#1e293b;line-height:1.9;">

      <p style="text-align:center;font-weight:700;font-size:15px;margin:0 0 4px;font-family:inherit;">[HOA NAME]</p>
      <p style="text-align:center;font-weight:700;font-size:13px;margin:0 0 4px;font-family:inherit;">BOARD OF DIRECTORS MEETING MINUTES</p>
      <p style="text-align:center;font-size:13px;margin:0 0 24px;font-family:inherit;">Date: _________________________ &nbsp;&nbsp; Time: _________ &nbsp;&nbsp; Location: _________________________</p>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">

      <p style="font-weight:700;margin:0 0 6px;font-family:inherit;">1. CALL TO ORDER</p>
      <p style="margin:0 0 4px;font-family:inherit;">The meeting was called to order at _______ by _______________________________, President.</p>
      <p style="margin:0 0 20px;font-family:inherit;">A quorum was [ ] confirmed &nbsp;&nbsp; [ ] not present</p>

      <p style="font-weight:700;margin:0 0 6px;font-family:inherit;">2. ATTENDANCE</p>
      <p style="margin:0 0 4px;font-family:inherit;"><strong>Board Members Present:</strong></p>
      <p style="margin:0 0 4px;padding-left:16px;font-family:inherit;">[ ] President: ___________________________</p>
      <p style="margin:0 0 4px;padding-left:16px;font-family:inherit;">[ ] Vice President: ___________________________</p>
      <p style="margin:0 0 4px;padding-left:16px;font-family:inherit;">[ ] Treasurer: ___________________________</p>
      <p style="margin:0 0 4px;padding-left:16px;font-family:inherit;">[ ] Secretary: ___________________________</p>
      <p style="margin:0 0 4px;padding-left:16px;font-family:inherit;">[ ] Member at Large: ___________________________</p>
      <p style="margin:0 0 4px;font-family:inherit;"><strong>Board Members Absent:</strong> ___________________________</p>
      <p style="margin:0 0 20px;font-family:inherit;"><strong>Guests/Homeowners Present:</strong> ___________________________</p>

      <p style="font-weight:700;margin:0 0 6px;font-family:inherit;">3. APPROVAL OF PREVIOUS MINUTES</p>
      <p style="margin:0 0 4px;font-family:inherit;">Motion to approve minutes from _______________ meeting by: ___________________________</p>
      <p style="margin:0 0 4px;font-family:inherit;">Seconded by: ___________________________</p>
      <p style="margin:0 0 20px;font-family:inherit;">Vote: &nbsp;&nbsp; For: _____ &nbsp;&nbsp; Against: _____ &nbsp;&nbsp; Abstain: _____ &nbsp;&nbsp; Result: [ ] Approved &nbsp;&nbsp; [ ] Tabled</p>

      <p style="font-weight:700;margin:0 0 6px;font-family:inherit;">4. TREASURER'S REPORT</p>
      <p style="margin:0 0 4px;font-family:inherit;">Current balance: $_______________ &nbsp;&nbsp; Month's income: $_______________ &nbsp;&nbsp; Expenses: $_______________</p>
      <p style="margin:0 0 4px;font-family:inherit;">Notes: ___________________________________________________________</p>
      <p style="margin:0 0 4px;font-family:inherit;">Motion to accept report by: ___________________________ &nbsp; Seconded: ___________________________</p>
      <p style="margin:0 0 20px;font-family:inherit;">Vote: &nbsp;&nbsp; For: _____ &nbsp;&nbsp; Against: _____ &nbsp;&nbsp; Result: [ ] Approved &nbsp;&nbsp; [ ] Tabled</p>

      <p style="font-weight:700;margin:0 0 6px;font-family:inherit;">5. OLD BUSINESS</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 4px;font-family:inherit;">
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:700;background:#f1f5f9;">Item</td><td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:700;background:#f1f5f9;">Discussion / Update</td><td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:700;background:#f1f5f9;">Action / Vote</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;">1.</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;">2.</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;">3.</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td></tr>
      </table>
      <p style="margin:0 0 20px;font-family:inherit;">&nbsp;</p>

      <p style="font-weight:700;margin:0 0 6px;font-family:inherit;">6. NEW BUSINESS</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 4px;font-family:inherit;">
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:700;background:#f1f5f9;">Item</td><td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:700;background:#f1f5f9;">Discussion</td><td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:700;background:#f1f5f9;">Motion / Vote</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;">1.</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">For: ___ Against: ___ Abstain: ___</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;">2.</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">For: ___ Against: ___ Abstain: ___</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;">3.</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">For: ___ Against: ___ Abstain: ___</td></tr>
      </table>
      <p style="margin:0 0 20px;font-family:inherit;">&nbsp;</p>

      <p style="font-weight:700;margin:0 0 6px;font-family:inherit;">7. ACTION ITEMS</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-family:inherit;">
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:700;background:#f1f5f9;">Action Item</td><td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:700;background:#f1f5f9;">Responsible Party</td><td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:700;background:#f1f5f9;">Due Date</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;">1.</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;">2.</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td></tr>
        <tr><td style="border:1px solid #cbd5e1;padding:8px 10px;">3.</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td><td style="border:1px solid #cbd5e1;padding:8px 10px;">&nbsp;</td></tr>
      </table>

      <p style="font-weight:700;margin:0 0 6px;font-family:inherit;">8. ADJOURNMENT</p>
      <p style="margin:0 0 4px;font-family:inherit;">Motion to adjourn by: ___________________________ &nbsp; Seconded by: ___________________________</p>
      <p style="margin:0 0 20px;font-family:inherit;">Meeting adjourned at _______ on _______________________________</p>

      <p style="margin:0 0 4px;font-family:inherit;"><strong>Next Meeting:</strong> Date: _______________ &nbsp; Time: _______ &nbsp; Location: ___________________________</p>
      <br>
      <p style="margin:0 0 4px;font-family:inherit;">Minutes submitted by: ___________________________</p>
      <p style="margin:0 0 4px;font-family:inherit;">Date submitted: ___________________________</p>
      <p style="margin:0 0 4px;font-family:inherit;">Approved by: ___________________________</p>
      <p style="margin:0;font-family:inherit;">Date approved: ___________________________</p>

    </div>
    <!-- TEMPLATE END -->

    <!-- PRO TIPS -->
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:20px 24px;margin:0 0 28px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#c2410c;">3 Pro Tips for Better HOA Minutes</p>
      <p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.6;"><strong>1. Record, don't transcribe.</strong> You don't need a word-for-word account. Capture the motion, who made it, the vote count, and the outcome. That's what matters legally.</p>
      <p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.6;"><strong>2. Approve minutes at the next meeting — not after.</strong> Circulate a draft to board members within 48 hours while details are fresh. Formal approval happens at the top of your next meeting.</p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;"><strong>3. Always document abstentions and conflicts of interest.</strong> If a board member abstains from a vote, note it. If they have a financial interest in the outcome, note that too. It protects everyone.</p>
    </div>

    <!-- SOFT CTA -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin:0 0 28px;text-align:center;">
      <p style="margin:0 0 8px;font-size:14px;color:#334155;line-height:1.6;">Tired of filling this out every month?</p>
      <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;"><strong>HOA Secretary AI writes your minutes automatically from rough notes.</strong> Paste in what you jotted down during the meeting and get back a fully formatted, board-ready document in seconds.</p>
      <a href="https://www.mattmichelstraining.com/hoa-secretary" style="display:inline-block;background:#e8621a;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Learn more →</a>
    </div>

  </td></tr>

  <tr><td style="padding:16px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;background:#fff;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" alt="Matt Michels">
      <div style="font-size:13px;color:#334155;"><strong>Matt Michels</strong><br>M2 Development · (313) 806-4952<br><a href="mailto:matt@mattmichelstraining.com" style="color:#e8621a;text-decoration:none;">matt@mattmichelstraining.com</a></div>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

    // Send template email via Resend
    if (RESEND_API_KEY) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Matt Michels <matt@mattmichelstraining.com>",
          to: [email],
          subject: "Your HOA Meeting Minutes Template (+ bonus tips)",
          html: emailHtml,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error("[hoa-lead-magnet-capture] Resend error:", errText);
      }
    }

    console.log(`[hoa-lead-magnet-capture] Lead captured and template sent to ${email}`);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hoa-lead-magnet-capture] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
