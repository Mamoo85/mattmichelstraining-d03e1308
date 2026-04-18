import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TO = "matt@mattmichelstraining.com";

const EMAILS: Array<{ subject: string; html: string }> = [
  { subject: `⚡ [MOCK TRIAL] TechAlert Welcome — Premier HVAC Inc. ($149/mo)`, html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TechAlert Welcome — Trades Client ($149/mo)</title>
</head>
<body style="margin:0;padding:20px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<p style="color:#64748b;font-size:11px;text-align:center;margin:0 0 16px;">SIMULATED WELCOME EMAIL — Trades Client ($149/mo standalone) — Premier HVAC Inc.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
<tr><td align="center" style="padding:0 16px 32px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1e293b 100%);padding:36px 32px 28px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;">
    <p style="margin:0;color:#00d4ff;font-size:10px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">⚡ TechAlert by Detroit Web Agency</p>
    <p style="margin:12px 0 0;color:#fff;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">You're In. The Scanner<br>Is Already Running.</p>
    <p style="margin:12px 0 0;color:#94a3b8;font-size:14px;line-height:1.6;">Welcome to TechAlert, Premier HVAC Inc. Your first alert fires tomorrow morning at 7am.</p>
  </td></tr>

  <!-- WHAT YOU GET -->
  <tr><td style="background:#fff;padding:32px;">
    <p style="margin:0 0 20px;font-size:15px;font-weight:800;color:#1e293b;">Here's exactly what happens next:</p>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;border-left:4px solid #10b981;padding:16px 20px;">
          <tr><td>
            <p style="margin:0;font-size:14px;font-weight:800;color:#1e293b;">🔍 Daily at 7am — We scan for you</p>
            <p style="margin:6px 0 0;font-size:13px;color:#475569;line-height:1.6;">55+ live sources checked automatically across state license registries, healthcare credentialing systems, job boards, professional networks, trade directories, union halls, social platforms, and local news. Methodology proprietary — results delivered, sources never disclosed.</p>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:10px;border-left:4px solid #3b82f6;padding:16px 20px;">
          <tr><td>
            <p style="margin:0;font-size:14px;font-weight:800;color:#1e293b;">📊 Three alert tiers — based on availability signals</p>
            <p style="margin:8px 0 0;font-size:13px;color:#475569;">🟢 <strong>High Availability (score 8-10)</strong> — Immediately seeks work. Email + SMS both fire. Act fast.</p>
            <p style="margin:6px 0 0;font-size:13px;color:#475569;">🟡 <strong>Possible Availability (score 5-7)</strong> — Licensed, may be open. Email alert only.</p>
            <p style="margin:6px 0 0;font-size:13px;color:#475569;">🔵 <strong>Monitoring (score 1-4)</strong> — Stored in your dashboard. Worth a proactive outreach.</p>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border-radius:10px;border-left:4px solid #eab308;padding:16px 20px;">
          <tr><td>
            <p style="margin:0;font-size:14px;font-weight:800;color:#1e293b;">⚡ One-click action on every candidate</p>
            <p style="margin:6px 0 0;font-size:13px;color:#475569;line-height:1.6;">Every alert email has clickable buttons: Call direct, Email, message on LinkedIn, verify state license. No dead ends. The top candidates also get an AI-written qualifications summary and hiring recommendation so you know who to call first.</p>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf4ff;border-radius:10px;border-left:4px solid #a855f7;padding:16px 20px;">
          <tr><td>
            <p style="margin:0;font-size:14px;font-weight:800;color:#1e293b;">📋 Your target roles we're monitoring</p>
            <p style="margin:6px 0 0;font-size:13px;color:#475569;">HVAC Technician · Boiler Operator · Refrigeration Tech · Plumber · Pipefitter · Electrician</p>
            <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">Reply to change roles or add zip code filters at any time.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>

    <!-- THREE SOURCE CARDS -->
    <p style="margin:24px 0 16px;font-size:13px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;">What makes this different</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:0 6px 0 0;vertical-align:top;width:33%;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:10px;padding:16px;text-align:center;">
            <tr><td>
              <p style="margin:0;font-size:24px;">🏛️</p>
              <p style="margin:6px 0 0;font-size:12px;font-weight:800;color:#00d4ff;">State Registry</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b;line-height:1.5;">Every newly issued license = we know day 1</p>
            </td></tr>
          </table>
        </td>
        <td style="padding:0 3px;vertical-align:top;width:33%;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:10px;padding:16px;text-align:center;">
            <tr><td>
              <p style="margin:0;font-size:24px;">🔎</p>
              <p style="margin:6px 0 0;font-size:12px;font-weight:800;color:#00d4ff;">55 Live Sources</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b;line-height:1.5;">Job boards, union halls, directories, social — all checked daily</p>
            </td></tr>
          </table>
        </td>
        <td style="padding:0 0 0 6px;vertical-align:top;width:33%;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:10px;padding:16px;text-align:center;">
            <tr><td>
              <p style="margin:0;font-size:24px;">📱</p>
              <p style="margin:6px 0 0;font-size:12px;font-weight:800;color:#00d4ff;">Enriched Dossiers</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b;line-height:1.5;">Phone, email, LinkedIn, employer, AI hiring recommendation</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr><td style="text-align:center;">
        <a href="https://www.detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#fff;padding:16px 36px;border-radius:10px;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:0.5px;">📊 Open Your Dashboard →</a>
        <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;">Bookmark this — it's your live feed of every candidate we've found for you</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:20px 28px;border-radius:0 0 16px 16px;background:#0a1628;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:44px;height:44px;border-radius:50%;border:2px solid #00d4ff30;" alt="Matt"></td>
          <td style="padding-left:12px;vertical-align:middle;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#fff;">Matt Michels</p>
            <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;text-decoration:none;">(313) 992-1219</a></p>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <p style="margin:0;font-size:11px;color:#64748b;">Questions? Just reply to this email.</p>
        <p style="margin:2px 0 0;font-size:10px;color:#475569;"><a href="mailto:matt@detroitwebagent.com?subject=Unsubscribe%20TechAlert" style="color:#64748b;">Unsubscribe</a></p>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>
` },
  { subject: `⚡ [MOCK TRIAL] TechAlert Welcome — Sunrise Senior Care ($49/mo bundle)`, html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TechAlert Welcome — Healthcare Client ($49/mo bundle)</title>
</head>
<body style="margin:0;padding:20px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<p style="color:#64748b;font-size:11px;text-align:center;margin:0 0 16px;">SIMULATED WELCOME EMAIL — Healthcare Client ($49/mo bundle w/ FieldDesk) — Sunrise Senior Care LLC</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
<tr><td align="center" style="padding:0 16px 32px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1e293b 100%);padding:36px 32px 28px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;">
    <p style="margin:0;color:#00d4ff;font-size:10px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">⚡ TechAlert by Detroit Web Agency</p>
    <p style="margin:12px 0 0;color:#fff;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">Welcome, Sunrise Senior Care.<br>Your CNA Pipeline Is Live.</p>
    <p style="margin:12px 0 0;color:#94a3b8;font-size:14px;line-height:1.6;">Your first alert fires tomorrow at 7am. Here's what we're watching.</p>
  </td></tr>

  <!-- WHAT YOU GET -->
  <tr><td style="background:#fff;padding:32px;">
    <p style="margin:0 0 20px;font-size:15px;font-weight:800;color:#1e293b;">Your healthcare monitoring setup:</p>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;border-left:4px solid #10b981;padding:16px 20px;">
          <tr><td>
            <p style="margin:0;font-size:14px;font-weight:800;color:#1e293b;">🏥 Your target roles we're monitoring</p>
            <p style="margin:8px 0 0;font-size:13px;color:#475569;">
              <span style="background:#7c3aed18;color:#7c3aed;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;margin-right:6px;">CNA</span>
              <span style="background:#0891b218;color:#0891b2;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;margin-right:6px;">LPN</span>
              <span style="background:#e8621a18;color:#e8621a;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;margin-right:6px;">RN</span>
              <span style="background:#10b98118;color:#059669;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;">Home Health Aide</span>
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">Reply to add Director of Nursing, Medical Assistant, or other roles at any time.</p>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf4ff;border-radius:10px;border-left:4px solid #a855f7;padding:16px 20px;">
          <tr><td>
            <p style="margin:0;font-size:14px;font-weight:800;color:#1e293b;">✅ NPI verification included on every healthcare candidate</p>
            <p style="margin:6px 0 0;font-size:13px;color:#475569;line-height:1.6;">When we find a nurse or CNA, we automatically cross-reference the federal NPI Registry — verifying license status, taxonomy, NPI number, and practice address. If they're in the registry, you see the badge: <span style="background:#7c3aed18;color:#7c3aed;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">✅ License Verified</span></p>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:10px;border-left:4px solid #3b82f6;padding:16px 20px;">
          <tr><td>
            <p style="margin:0;font-size:14px;font-weight:800;color:#1e293b;">🔍 Healthcare intelligence sources we monitor 24/7</p>
            <table cellpadding="0" cellspacing="0" style="margin-top:8px;">
              <tr><td style="padding:3px 0;font-size:12px;color:#475569;">🏛️ <strong>Michigan Nurse Aide Registry (LARA)</strong> — every new CNA certification issued in Michigan</td></tr>
              <tr><td style="padding:3px 0;font-size:12px;color:#475569;">🏥 <strong>NPI Registry</strong> — federal database of all licensed nurses in Michigan</td></tr>
              <tr><td style="padding:3px 0;font-size:12px;color:#475569;">📋 <strong>Nursys</strong> — national RN/LPN license registry, updated continuously</td></tr>
              <tr><td style="padding:3px 0;font-size:12px;color:#475569;">🏢 <strong>BCHS-licensed facilities</strong> — staff transitions at licensed Michigan care facilities</td></tr>
              <tr><td style="padding:3px 0;font-size:12px;color:#475569;">💼 <strong>Indeed resumes + LinkedIn "open to work"</strong> — actively seeking candidates</td></tr>
              <tr><td style="padding:3px 0;font-size:12px;color:#475569;">🏫 <strong>Michigan Works! + trade school graduates</strong> — fresh CNA program completers</td></tr>
              <tr><td style="padding:3px 0;font-size:12px;color:#475569;">🔔 <strong>WARN Act layoffs</strong> — healthcare workers displaced from closing facilities</td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border-radius:10px;border-left:4px solid #eab308;padding:16px 20px;">
          <tr><td>
            <p style="margin:0;font-size:14px;font-weight:800;color:#1e293b;">💡 Why this beats agency staffing</p>
            <table cellpadding="0" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td style="padding:4px 12px 4px 0;font-size:13px;color:#dc2626;font-weight:600;white-space:nowrap;">❌ Agency fee</td>
                <td style="padding:4px 0;font-size:13px;color:#64748b;">$4,000–8,000 per CNA placed</td>
              </tr>
              <tr>
                <td style="padding:4px 12px 4px 0;font-size:13px;color:#059669;font-weight:600;white-space:nowrap;">✅ TechAlert</td>
                <td style="padding:4px 0;font-size:13px;color:#64748b;">$49/mo — you call them directly, keep the savings</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
      <tr><td style="text-align:center;">
        <a href="https://www.detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#fff;padding:16px 36px;border-radius:10px;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:0.5px;">📊 Open Your Dashboard →</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:20px 28px;border-radius:0 0 16px 16px;background:#0a1628;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:44px;height:44px;border-radius:50%;border:2px solid #00d4ff30;" alt="Matt"></td>
          <td style="padding-left:12px;vertical-align:middle;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#fff;">Matt Michels</p>
            <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;text-decoration:none;">(313) 992-1219</a></p>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <p style="margin:0;font-size:11px;color:#64748b;">Questions? Just reply to this email.</p>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>
` },
  { subject: `⚡ [MOCK TRIAL] TechAlert Alert — 4 Candidates Found (Trades)`, html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TechAlert Alert Email — Mixed Trades + Healthcare</title>
</head>
<body style="margin:0;padding:20px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<p style="color:#64748b;font-size:11px;text-align:center;margin:0 0 16px;">SIMULATED ALERT EMAIL — Morning of April 19, 2026 — Client: Premier HVAC Inc. (target roles: HVAC, Boiler, Plumber)</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
<tr><td align="center" style="padding:0 16px 32px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1e293b 100%);padding:32px 28px 24px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">⚡ TechAlert</p>
        <p style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">New Licensed Techs<br>in Your Area</p>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background:#00d4ff20;border:1px solid #00d4ff40;padding:12px 16px;border-radius:12px;text-align:center;">
            <p style="margin:0;font-size:28px;font-weight:900;color:#00d4ff;line-height:1;">4</p>
            <p style="margin:2px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Candidates</p>
          </td>
        </tr></table>
      </td>
    </tr></table>
    <p style="margin:16px 0 0;color:#94a3b8;font-size:13px;">April 19, 2026 · for Premier HVAC Inc.</p>
  </td></tr>

  <!-- URGENCY BAR -->
  <tr><td style="background:#e8621a;padding:12px 28px;">
    <p style="margin:0;color:#fff;font-size:13px;font-weight:700;text-align:center;">🔥 2 high-availability candidates detected — your competitors don't have this intel</p>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#fff;padding:28px;">
    <p style="color:#1e293b;font-size:15px;line-height:1.7;margin:0 0 8px;">Hey Premier HVAC team —</p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">We identified new licensed professionals near you this morning. <strong>2 high-availability candidates</strong> — tap the buttons below to reach out before someone else does.</p>

    <table width="100%" cellpadding="0" cellspacing="0">

      <!-- ── CANDIDATE 1: HOT HVAC ── -->
      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #e8621a40;box-shadow:0 2px 8px rgba(232,98,26,0.12);">
          <tr><td style="background:linear-gradient(135deg,#0a1628,#1e293b);padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <p style="margin:0;font-size:16px;font-weight:800;color:#fff;letter-spacing:-0.3px;">Marcus T. Williams</p>
                <p style="margin:3px 0 0;font-size:12px;color:#94a3b8;">Detected April 19, 2026</p>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#dc2626;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:800;letter-spacing:0.5px;">🟢 High</td>
                </tr></table>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 18px;background:#fff;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:0 0 8px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#00d4ff18;color:#0891b2;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">HVAC Technician</td>
                  <td width="8"></td>
                  <td style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">📍 Sterling Heights, MI</td>
                  <td width="8"></td>
                  <td style="background:#10b98118;color:#059669;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">12+ yrs exp</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#475569;">🏢 <strong>Left: Comfort Systems USA</strong> · HVAC Service Manager</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#475569;">🪪 License: <strong>MI-HVAC-004821</strong> · Exp: <strong>03/2027</strong> · <span style="color:#059669;font-weight:700;">Active</span></td></tr>
              <tr><td style="padding:8px 0 4px;">
                <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#f0fdf4;padding:10px 12px;border-radius:8px;border-left:3px solid #059669;"><strong>📋 Qualifications:</strong> Licensed HVAC technician with 12+ years of residential and light commercial experience, EPA 608 Universal certified, strong background in heat pump systems and refrigerant recovery. Recently separated from previous employer.</p>
              </td></tr>
              <tr><td style="padding:4px 0;">
                <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#eff6ff;padding:10px 12px;border-radius:8px;border-left:3px solid #3b82f6;"><strong>💡 Recommendation:</strong> Call today. Active job seeker signal confirmed, Metro Detroit area, fully licensed with strong commercial experience. High fit for senior tech or service manager role.</p>
              </td></tr>
              <tr><td style="padding:12px 0 4px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td><a href="tel:+13135550142" style="display:inline-block;background:#e8621a;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">📞 Call (313) 555-0142</a></td>
                  <td><a href="mailto:m.williams.hvac@gmail.com" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">✉️ Send Email</a></td>
                  <td><a href="https://www.linkedin.com/" target="_blank" rel="noreferrer" style="display:inline-block;background:#0a66c2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">🔗 LinkedIn</a></td>
                  <td><a href="https://www.detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER&amp;action=claim" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">⚡ Claim</a></td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- ── CANDIDATE 2: HOT BOILER OPERATOR ── -->
      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #e8621a40;box-shadow:0 2px 8px rgba(232,98,26,0.12);">
          <tr><td style="background:linear-gradient(135deg,#0a1628,#1e293b);padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <p style="margin:0;font-size:16px;font-weight:800;color:#fff;">Darnell A. Porter</p>
                <p style="margin:3px 0 0;font-size:12px;color:#94a3b8;">Detected April 19, 2026</p>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#e8621a;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:800;">🔥 9/10</td>
                </tr></table>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 18px;background:#fff;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:0 0 8px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#00d4ff18;color:#0891b2;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;">Boiler Operator</td>
                  <td width="8"></td>
                  <td style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">📍 Detroit, MI</td>
                  <td width="8"></td>
                  <td style="background:#e8621a18;color:#e8621a;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">🆕 New License</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#475569;">🪪 License: <strong>MI-BOP-009134</strong> · Issued: <strong>04/15/2026</strong> · Exp: <strong>04/2028</strong> · <span style="color:#059669;font-weight:700;">Active</span></td></tr>
              <tr><td style="padding:8px 0 4px;">
                <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#fff7ed;padding:10px 12px;border-radius:8px;border-left:3px solid #e8621a;"><strong>🔥 Why this is urgent:</strong> New license issued 4 days ago. Brand new to the market — nobody has called him yet. Newly licensed candidates appear in our intelligence engine the day their license is issued — a 96-hour window before word gets out.</p>
              </td></tr>
              <tr><td style="padding:8px 0 4px;">
                <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#f0fdf4;padding:10px 12px;border-radius:8px;border-left:3px solid #059669;"><strong>📋 Qualifications:</strong> Newly licensed Michigan Boiler Operator, completed state certification process. No prior employment on record — likely finishing training program and entering the workforce. Strong candidate for entry-level boiler operator role with growth potential.</p>
              </td></tr>
              <tr><td style="padding:12px 0 4px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td><a href="tel:+13135550287" style="display:inline-block;background:#e8621a;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">📞 Call (313) 555-0287</a></td>
                  <td><a href="https://www.detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER&amp;action=claim" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">⚡ Claim</a></td>
                  <td><a href="https://www.detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER&amp;action=draft" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">✍️ Draft Outreach</a></td>
                  <td><a href="https://aca-prod.accela.com/MILARA/Default.aspx" target="_blank" rel="noreferrer" style="display:inline-block;background:#059669;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">📜 Verify License</a></td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- ── CANDIDATE 3: POSSIBLE — PLUMBER ── -->
      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td style="background:#f8fafc;padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <p style="margin:0;font-size:16px;font-weight:500;color:#1e293b;">Sandra K. Okafor</p>
                <p style="margin:3px 0 0;font-size:12px;color:#64748b;">Detected April 19, 2026</p>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#f59e0b;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:800;">🟡 Possible</td>
                </tr></table>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 18px;background:#fff;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:0 0 8px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#00d4ff18;color:#0891b2;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;">Master Plumber</td>
                  <td width="8"></td>
                  <td style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">📍 Livonia, MI</td>
                  <td width="8"></td>
                  <td style="background:#10b98118;color:#059669;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">8+ yrs exp</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#475569;">🏢 <strong>Currently:</strong> Roto-Rooter Livonia · Senior Plumber</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#475569;">🪪 License: <strong>MI-MP-017745</strong> · Exp: <strong>11/2026</strong> · <span style="color:#f59e0b;font-weight:700;">⚠️ Expires in 7 months</span></td></tr>
              <tr><td style="padding:8px 0 4px;">
                <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#f0fdf4;padding:10px 12px;border-radius:8px;border-left:3px solid #059669;"><strong>📋 Qualifications:</strong> Michigan Master Plumber with 8 years commercial and residential experience. Currently employed but license renewal due in 7 months — a common transition window. Worth a proactive outreach now before renewal season.</p>
              </td></tr>
              <tr><td style="padding:12px 0 4px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td><a href="mailto:s.okafor.plumb@gmail.com" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">✉️ Send Email</a></td>
                  <td><a href="https://www.linkedin.com/" target="_blank" rel="noreferrer" style="display:inline-block;background:#0a66c2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">🔗 LinkedIn</a></td>
                  <td><a href="https://aca-prod.accela.com/MILARA/Default.aspx" target="_blank" rel="noreferrer" style="display:inline-block;background:#059669;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">📜 Verify License</a></td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- ── CANDIDATE 4: POSSIBLE — HVAC NEW GRAD ── -->
      <tr><td style="padding:0 0 0px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td style="background:#f8fafc;padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <p style="margin:0;font-size:16px;font-weight:500;color:#1e293b;">Kevin M. Ruiz</p>
                <p style="margin:3px 0 0;font-size:12px;color:#64748b;">Detected April 19, 2026</p>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#f59e0b;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:800;">🟡 Possible</td>
                </tr></table>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 18px;background:#fff;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:0 0 8px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#00d4ff18;color:#0891b2;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;">HVAC Technician</td>
                  <td width="8"></td>
                  <td style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">📍 Dearborn, MI</td>
                  <td width="8"></td>
                  <td style="background:#e8621a18;color:#e8621a;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">🎓 Recent Graduate</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#475569;">🏫 HVAC/R Certificate — Henry Ford College, April 2026 · EPA 608 Universal</td></tr>
              <tr><td style="padding:8px 0 4px;">
                <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#f0fdf4;padding:10px 12px;border-radius:8px;border-left:3px solid #059669;"><strong>📋 Qualifications:</strong> Recent HVAC/R graduate from Henry Ford College, EPA 608 certified, completing degree in Spring 2026. Actively seeking first industry position. Strong candidate for apprentice or helper role with a path to journeyman.</p>
              </td></tr>
              <tr><td style="padding:12px 0 4px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td><a href="tel:+13135550391" style="display:inline-block;background:#e8621a;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">📞 Call (313) 555-0391</a></td>
                  <td><a href="https://www.detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER&amp;action=draft" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">✍️ Draft Outreach</a></td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>

  <!-- AVAILABILITY GUIDE -->
  <tr><td style="background:#f8fafc;padding:20px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Availability Tiers</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:4px 0;font-size:12px;color:#475569;">🟢 <strong>High Availability</strong> — Actively seeking work, local, contactable right now</td></tr>
      <tr><td style="padding:4px 0;font-size:12px;color:#475569;">🟡 <strong>Possible Availability</strong> — Licensed professional who may be open to opportunities</td></tr>
      <tr><td style="padding:4px 0;font-size:12px;color:#475569;">🔵 <strong>Monitor</strong> — On our radar — worth reaching out proactively</td></tr>
    </table>
  </td></tr>

  <!-- DASHBOARD CTA -->
  <tr><td style="background:#0a1628;padding:20px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;text-align:center;">
    <a href="https://www.detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:0.5px;">📊 View Full Dossiers in Your Dashboard</a>
    <p style="margin:10px 0 0;font-size:11px;color:#64748b;">Browse, filter, and track all candidates with complete contact information</p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:20px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;background:#0a1628;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #00d4ff30;" alt="Matt"></td>
          <td style="padding-left:12px;vertical-align:middle;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#fff;">Matt Michels</p>
            <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;text-decoration:none;">(313) 992-1219</a></p>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <p style="margin:0;font-size:10px;color:#475569;">Reply to adjust roles or zip codes</p>
        <p style="margin:2px 0 0;font-size:10px;color:#475569;"><a href="mailto:matt@detroitwebagent.com?subject=Unsubscribe%20TechAlert" style="color:#64748b;text-decoration:none;">Unsubscribe</a></p>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>
` },
  { subject: `⚡ [MOCK TRIAL] TechAlert Alert — 3 Healthcare Candidates (CNA/RN/LPN)`, html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TechAlert Alert Email — Healthcare Client</title>
</head>
<body style="margin:0;padding:20px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<p style="color:#64748b;font-size:11px;text-align:center;margin:0 0 16px;">SIMULATED ALERT EMAIL — April 19, 2026 — Client: Sunrise Senior Care LLC (target roles: CNA, LPN, RN, Home Health Aide)</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
<tr><td align="center" style="padding:0 16px 32px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1e293b 100%);padding:32px 28px 24px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">⚡ TechAlert</p>
        <p style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;line-height:1.2;">New Licensed Healthcare<br>Professionals in Your Area</p>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background:#00d4ff20;border:1px solid #00d4ff40;padding:12px 16px;border-radius:12px;text-align:center;">
            <p style="margin:0;font-size:28px;font-weight:900;color:#00d4ff;line-height:1;">3</p>
            <p style="margin:2px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Candidates</p>
          </td>
        </tr></table>
      </td>
    </tr></table>
    <p style="margin:16px 0 0;color:#94a3b8;font-size:13px;">April 19, 2026 · for Sunrise Senior Care LLC</p>
  </td></tr>

  <!-- URGENCY BAR -->
  <tr><td style="background:#e8621a;padding:12px 28px;">
    <p style="margin:0;color:#fff;font-size:13px;font-weight:700;text-align:center;">🔥 1 high-availability candidate + 2 NPI-verified nurses detected</p>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#fff;padding:28px;">
    <p style="color:#1e293b;font-size:15px;line-height:1.7;margin:0 0 8px;">Hey Sunrise Senior Care team —</p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">We found 3 licensed healthcare professionals near you this morning, including 1 CNA actively seeking work and 2 NPI-verified nurses who may be open to new opportunities.</p>

    <table width="100%" cellpadding="0" cellspacing="0">

      <!-- ── CANDIDATE 1: HOT CNA ── -->
      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #e8621a40;box-shadow:0 2px 8px rgba(232,98,26,0.12);">
          <tr><td style="background:linear-gradient(135deg,#0a1628,#1e293b);padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <p style="margin:0;font-size:16px;font-weight:800;color:#fff;">Tamika D. Johnson</p>
                <p style="margin:3px 0 0;font-size:12px;color:#94a3b8;">Detected April 19</p>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#dc2626;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:800;">🟢 High</td>
                </tr></table>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 18px;background:#fff;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:0 0 8px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#7c3aed18;color:#7c3aed;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;">Certified Nursing Assistant</td>
                  <td width="8"></td>
                  <td style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">📍 Warren, MI</td>
                  <td width="8"></td>
                  <td style="background:#e8621a18;color:#e8621a;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">🆕 New Cert</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#7c3aed;font-weight:600;">✅ Michigan Nurse Aide Registry — Certification #MI-CNA-048821 · Active</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#475569;">Certification issued: <strong>April 16, 2026</strong> — 3 days ago. First-time certification.</td></tr>
              <tr><td style="padding:8px 0 4px;">
                <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#fff7ed;padding:10px 12px;border-radius:8px;border-left:3px solid #e8621a;"><strong>🔥 Why this is urgent:</strong> Brand new certification issued 3 days ago. She completed her CNA program and just entered the market. No employer yet. This is a 72-hour window before staffing agencies flood her inbox.</p>
              </td></tr>
              <tr><td style="padding:8px 0 4px;">
                <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#f0fdf4;padding:10px 12px;border-radius:8px;border-left:3px solid #059669;"><strong>📋 Qualifications:</strong> Newly certified CNA from Warren, MI. Completed state certification exam this week. No prior employer on record — actively entering the workforce. Ideal candidate for assisted living facility, home health agency, or skilled nursing placement.</p>
              </td></tr>
              <tr><td style="padding:4px 0;">
                <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#eff6ff;padding:10px 12px;border-radius:8px;border-left:3px solid #3b82f6;"><strong>💡 Recommendation:</strong> Call or text today. First-time CNAs choose their first employer within 2 weeks of certification — whoever calls first has the highest conversion rate. Lead with your schedule flexibility and benefits.</p>
              </td></tr>
              <tr><td style="padding:12px 0 4px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td><a href="tel:+15865550174" style="display:inline-block;background:#e8621a;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">📞 Call (586) 555-0174</a></td>
                  <td><a href="tel:+15865550174" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">📱 Mobile (586) 555-0174</a></td>
                  <td><a href="https://www.detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER&amp;action=claim" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">⚡ Claim</a></td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- ── CANDIDATE 2: POSSIBLE — RN ── -->
      <tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td style="background:#f8fafc;padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <p style="margin:0;font-size:16px;font-weight:500;color:#1e293b;">Patricia M. Osei-Bonsu</p>
                <p style="margin:3px 0 0;font-size:12px;color:#64748b;">Detected April 19</p>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#f59e0b;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:800;">🟡 Possible</td>
                </tr></table>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 18px;background:#fff;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:0 0 8px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#7c3aed18;color:#7c3aed;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;">Registered Nurse</td>
                  <td width="8"></td>
                  <td style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">📍 Detroit, MI</td>
                  <td width="8"></td>
                  <td style="background:#10b98118;color:#059669;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">✅ License Verified</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#7c3aed;">✅ NPI#1437291048 · Family Practice RN (Taxonomy: 163W00000X) · Verified</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#475569;">📍 Practice address: 8200 W. Outer Drive, Detroit, MI 48219</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#475569;">☎️ Business line: (313) 555-0612</td></tr>
              <tr><td style="padding:8px 0 4px;">
                <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#f0fdf4;padding:10px 12px;border-radius:8px;border-left:3px solid #059669;"><strong>📋 Qualifications:</strong> Michigan-licensed RN with active NPI registration, Family Practice taxonomy. Current practice location in Detroit's west side. Open to supplemental or per-diem senior care shifts based on public profile signals.</p>
              </td></tr>
              <tr><td style="padding:12px 0 4px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td><a href="tel:+13135550612" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">📞 Business Line (313) 555-0612</a></td>
                  <td><a href="https://npiregistry.cms.hhs.gov/provider-view/1437291048" target="_blank" rel="noreferrer" style="display:inline-block;background:#059669;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">📜 Verify NPI</a></td>
                  <td><a href="https://www.detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER&amp;action=draft" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">✍️ Draft Outreach</a></td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- ── CANDIDATE 3: POSSIBLE — LPN ── -->
      <tr><td style="padding:0 0 0px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td style="background:#f8fafc;padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <p style="margin:0;font-size:16px;font-weight:500;color:#1e293b;">Robert J. Klemens</p>
                <p style="margin:3px 0 0;font-size:12px;color:#64748b;">Detected April 19</p>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#f59e0b;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:800;">🟡 Possible</td>
                </tr></table>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 18px;background:#fff;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:0 0 8px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#7c3aed18;color:#7c3aed;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;">Licensed Practical Nurse</td>
                  <td width="8"></td>
                  <td style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">📍 Dearborn, MI</td>
                  <td width="8"></td>
                  <td style="background:#10b98118;color:#059669;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">6+ yrs exp</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#475569;">🪪 Michigan LPN License <strong>#LPN-72814</strong> · Exp: <strong>08/2026</strong> · <span style="color:#f59e0b;font-weight:700;">⚠️ Renewing soon</span></td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#475569;">🏢 Last known: Beaumont Dearborn — charge LPN, long-term care unit</td></tr>
              <tr><td style="padding:8px 0 4px;">
                <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#f0fdf4;padding:10px 12px;border-radius:8px;border-left:3px solid #059669;"><strong>📋 Qualifications:</strong> Experienced LPN with 6+ years in long-term care and skilled nursing. Currently at Beaumont Dearborn but license renewal due August 2026 — common signal for evaluating other options. Medicare/Medicaid experience, familiar with documentation standards.</p>
              </td></tr>
              <tr><td style="padding:12px 0 4px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td><a href="mailto:r.klemens.lpn@gmail.com" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">✉️ Send Email</a></td>
                  <td><a href="https://www.linkedin.com/" target="_blank" rel="noreferrer" style="display:inline-block;background:#0a66c2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">🔗 LinkedIn</a></td>
                  <td><a href="https://www.detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER&amp;action=draft" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">✍️ Draft Outreach</a></td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>

  <!-- DASHBOARD CTA -->
  <tr><td style="background:#0a1628;padding:20px 28px;text-align:center;">
    <a href="https://www.detroitwebagent.com/my-techalert?token=DWA_DEMO_MASTER" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:800;text-decoration:none;">📊 View Full Dossiers in Your Dashboard</a>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:20px 28px;border-radius:0 0 16px 16px;background:#0a1628;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:44px;height:44px;border-radius:50%;border:2px solid #00d4ff30;" alt="Matt"></td>
          <td style="padding-left:12px;vertical-align:middle;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#fff;">Matt Michels</p>
            <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;text-decoration:none;">(313) 992-1219</a></p>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <p style="margin:0;font-size:10px;color:#475569;">Reply to adjust roles or add zip filters</p>
        <p style="margin:2px 0 0;font-size:10px;color:#475569;"><a href="mailto:matt@detroitwebagent.com?subject=Unsubscribe%20TechAlert" style="color:#64748b;">Unsubscribe</a></p>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>
` },
  { subject: `⚡ [MOCK TRIAL] TechAlert Founder Report — 7 Candidates, 3 Clients, $397 MRR`, html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TechAlert — Matt's Founder Daily Report</title>
</head>
<body style="margin:0;padding:20px;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<p style="color:#64748b;font-size:11px;text-align:center;margin:0 0 16px;">SIMULATED FOUNDER REPORT — Only Matt sees this — April 19, 2026 — 3 active clients, 7 candidates found, 2 HOT</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
<tr><td align="center" style="padding:0 16px 32px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1e293b 100%);padding:28px 28px 20px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <p style="margin:0;color:#00d4ff;font-size:10px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">⚡ TechAlert — Founder Report</p>
        <p style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">April 19, 2026</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:12px;">Daily scan complete · 3 active clients · $397/mo MRR</p>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;border:2px solid #00d4ff40;" alt="Matt">
      </td>
    </tr></table>
  </td></tr>

  <!-- KPI DASHBOARD -->
  <tr><td style="background:#1e293b;padding:20px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;padding:16px 8px;background:#ffffff08;border-radius:12px;">
        <p style="margin:0;font-size:32px;font-weight:900;color:#00d4ff;line-height:1;">47</p>
        <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Scanned</p>
      </td>
      <td width="8"></td>
      <td style="text-align:center;padding:16px 8px;background:#ffffff08;border-radius:12px;">
        <p style="margin:0;font-size:32px;font-weight:900;color:#fff;line-height:1;">7</p>
        <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">New</p>
      </td>
      <td width="8"></td>
      <td style="text-align:center;padding:16px 8px;background:#10b98118;border-radius:12px;">
        <p style="margin:0;font-size:32px;font-weight:900;color:#10b981;line-height:1;">5</p>
        <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Enriched</p>
      </td>
      <td width="8"></td>
      <td style="text-align:center;padding:16px 8px;background:#e8621a15;border-radius:12px;border:1px solid #e8621a40;">
        <p style="margin:0;font-size:32px;font-weight:900;color:#e8621a;line-height:1;">2</p>
        <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Hot 🔥</p>
      </td>
      <td width="8"></td>
      <td style="text-align:center;padding:16px 8px;background:#ffffff08;border-radius:12px;">
        <p style="margin:0;font-size:32px;font-weight:900;color:#10b981;line-height:1;">3</p>
        <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Alerted</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- SOURCE + ENRICHMENT HEALTH -->
  <tr><td style="background:#1e293b;padding:0 28px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="padding:8px 12px;background:#ffffff06;border-radius:8px;font-size:11px;color:#94a3b8;line-height:1.8;">
        🟢 State Registry: <strong style="color:#00d4ff;">34</strong> &nbsp;·&nbsp; 🟡 Job Networks: <strong style="color:#00d4ff;">13</strong> &nbsp;·&nbsp; 🏥 Healthcare Credentialing: <strong style="color:#7c3aed;">2</strong> &nbsp;·&nbsp; 📱 Mobile Resolution: <strong style="color:#ea580c;">1</strong> &nbsp;·&nbsp; 👻 Ghost leads filtered: <strong style="color:#e8621a;">2</strong> &nbsp;·&nbsp; 🔄 Enrichment pending: <strong style="color:#f59e0b;">2</strong>
      </td>
    </tr></table>
  </td></tr>

  <!-- CLIENT ALERT SUMMARY -->
  <tr><td style="background:#1e293b;padding:0 28px 16px;">
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Alert delivery summary</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #334155;">
      <tr style="background:#0a1628;">
        <th style="padding:10px 12px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1px;">Client</th>
        <th style="padding:10px 12px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1px;">Plan</th>
        <th style="padding:10px 12px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1px;">Target Roles</th>
        <th style="padding:10px 12px;font-size:10px;color:#94a3b8;text-align:center;text-transform:uppercase;letter-spacing:1px;">Sent</th>
        <th style="padding:10px 12px;font-size:10px;color:#94a3b8;text-align:center;text-transform:uppercase;letter-spacing:1px;">Hot</th>
        <th style="padding:10px 12px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1px;">SMS</th>
      </tr>
      <tr style="background:#0f172a;border-bottom:1px solid #1e293b;">
        <td style="padding:12px;font-size:13px;color:#fff;font-weight:600;">Premier HVAC Inc.</td>
        <td style="padding:12px;font-size:12px;color:#64748b;">$149/mo</td>
        <td style="padding:12px;font-size:12px;color:#94a3b8;">HVAC, Boiler, Plumber</td>
        <td style="padding:12px;text-align:center;"><span style="color:#10b981;font-weight:700;">✅ 4</span></td>
        <td style="padding:12px;text-align:center;"><span style="color:#e8621a;font-weight:800;">🔥 2</span></td>
        <td style="padding:12px;font-size:12px;color:#10b981;">✅ Sent</td>
      </tr>
      <tr style="background:#0f172a;border-bottom:1px solid #1e293b;">
        <td style="padding:12px;font-size:13px;color:#fff;font-weight:600;">Sunrise Senior Care</td>
        <td style="padding:12px;font-size:12px;color:#64748b;">$49/mo bundle</td>
        <td style="padding:12px;font-size:12px;color:#94a3b8;">CNA, LPN, RN, HHA</td>
        <td style="padding:12px;text-align:center;"><span style="color:#10b981;font-weight:700;">✅ 3</span></td>
        <td style="padding:12px;text-align:center;"><span style="color:#e8621a;font-weight:800;">🔥 1</span></td>
        <td style="padding:12px;font-size:12px;color:#10b981;">✅ Sent</td>
      </tr>
      <tr style="background:#0f172a;">
        <td style="padding:12px;font-size:13px;color:#fff;font-weight:600;">Macomb Electric</td>
        <td style="padding:12px;font-size:12px;color:#64748b;">$99/mo beta</td>
        <td style="padding:12px;font-size:12px;color:#94a3b8;">Electrician, Pipefitter</td>
        <td style="padding:12px;text-align:center;"><span style="color:#94a3b8;font-weight:600;">— 0</span></td>
        <td style="padding:12px;text-align:center;"><span style="color:#94a3b8;">—</span></td>
        <td style="padding:12px;font-size:12px;color:#64748b;">— No match today</td>
      </tr>
    </table>
  </td></tr>

  <!-- CANDIDATE TABLE -->
  <tr><td style="background:#fff;padding:24px 20px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="margin:0 0 16px;font-size:14px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">All 7 Candidates — Sorted by Score</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <tr style="background:#0a1628;">
        <th style="padding:10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1px;">Name</th>
        <th style="padding:10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1px;">Trade</th>
        <th style="padding:10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1px;">City</th>
        <th style="padding:10px;font-size:10px;color:#94a3b8;text-align:center;text-transform:uppercase;letter-spacing:1px;">Score</th>
        <th style="padding:10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1px;">Source</th>
        <th style="padding:10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1px;">Enrich</th>
        <th style="padding:10px;font-size:10px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:1px;">Status</th>
      </tr>
      <!-- Row 1 -->
      <tr style="background:#0a16280a;border-bottom:1px solid #e2e8f0;">
        <td style="padding:12px 10px;font-size:13px;color:#1e293b;font-weight:800;">Darnell A. Porter<br><span style="font-size:11px;color:#e8621a;font-weight:600;">(313) 555-0287</span><br><span style="font-size:10px;color:#7c3aed;">🏥 Healthcare verified</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">Boiler Operator<br><span style="font-size:10px;color:#94a3b8;">#MI-BOP-009134</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">Detroit</td>
        <td style="padding:12px 10px;text-align:center;"><span style="background:#e8621a;color:#fff;padding:3px 10px;border-radius:12px;font-weight:800;font-size:12px;">🔥 9/10</span></td>
        <td style="padding:12px 10px;font-size:11px;color:#64748b;">🔵 Verified</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ complete</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ Actionable</td>
      </tr>
      <!-- Row 2 -->
      <tr style="background:#fff;border-bottom:1px solid #e2e8f0;">
        <td style="padding:12px 10px;font-size:13px;color:#1e293b;font-weight:800;">Marcus T. Williams<br><span style="font-size:11px;color:#e8621a;font-weight:600;">(313) 555-0142</span><br><span style="font-size:11px;color:#0891b2;">m.williams.hvac@gmail.com</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">HVAC Technician<br><span style="font-size:10px;color:#94a3b8;">#MI-HVAC-004821</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">Sterling Heights</td>
        <td style="padding:12px 10px;text-align:center;"><span style="background:#dc2626;color:#fff;padding:3px 10px;border-radius:12px;font-weight:800;font-size:12px;">🔥 8/10</span></td>
        <td style="padding:12px 10px;font-size:11px;color:#64748b;">🔵 Verified</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ complete</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ Actionable</td>
      </tr>
      <!-- Row 3 -->
      <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
        <td style="padding:12px 10px;font-size:13px;color:#1e293b;font-weight:500;">Tamika D. Johnson<br><span style="font-size:11px;color:#ea580c;font-weight:600;">📱 (586) 555-0174 (Verified mobile)</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">CNA<br><span style="font-size:10px;color:#94a3b8;">#MI-CNA-048821</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">Warren</td>
        <td style="padding:12px 10px;text-align:center;"><span style="background:#e8621a;color:#fff;padding:3px 10px;border-radius:12px;font-weight:800;font-size:12px;">8/10</span></td>
        <td style="padding:12px 10px;font-size:11px;color:#64748b;">🔵 Verified</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ complete</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ Actionable</td>
      </tr>
      <!-- Row 4 -->
      <tr style="background:#fff;border-bottom:1px solid #e2e8f0;">
        <td style="padding:12px 10px;font-size:13px;color:#1e293b;font-weight:500;">Patricia M. Osei-Bonsu<br><span style="font-size:10px;color:#7c3aed;">🏥 Verified credential</span><br><span style="font-size:11px;color:#0d9488;">(313) 555-0612 (Business line)</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">Registered Nurse<br><span style="font-size:10px;color:#94a3b8;">Family Practice</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">Detroit</td>
        <td style="padding:12px 10px;text-align:center;"><span style="background:#f59e0b;color:#fff;padding:3px 10px;border-radius:12px;font-weight:800;font-size:12px;">6/10</span></td>
        <td style="padding:12px 10px;font-size:11px;color:#64748b;">🔵 Verified</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ complete</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ Actionable</td>
      </tr>
      <!-- Row 5 -->
      <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
        <td style="padding:12px 10px;font-size:13px;color:#1e293b;font-weight:500;">Sandra K. Okafor<br><span style="font-size:11px;color:#0891b2;">s.okafor.plumb@gmail.com</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">Master Plumber<br><span style="font-size:10px;color:#94a3b8;">#MI-MP-017745</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">Livonia</td>
        <td style="padding:12px 10px;text-align:center;"><span style="background:#f59e0b;color:#fff;padding:3px 10px;border-radius:12px;font-weight:800;font-size:12px;">6/10</span></td>
        <td style="padding:12px 10px;font-size:11px;color:#64748b;">🔵 Verified</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ complete</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ Actionable</td>
      </tr>
      <!-- Row 6 -->
      <tr style="background:#fff;border-bottom:1px solid #e2e8f0;">
        <td style="padding:12px 10px;font-size:13px;color:#1e293b;font-weight:500;">Robert J. Klemens<br><span style="font-size:11px;color:#0891b2;">r.klemens.lpn@gmail.com</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">LPN<br><span style="font-size:10px;color:#94a3b8;">#LPN-72814</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">Dearborn</td>
        <td style="padding:12px 10px;text-align:center;"><span style="background:#f59e0b;color:#fff;padding:3px 10px;border-radius:12px;font-weight:800;font-size:12px;">5/10</span></td>
        <td style="padding:12px 10px;font-size:11px;color:#64748b;">🔵 Verified</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ complete</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ Actionable</td>
      </tr>
      <!-- Row 7 -->
      <tr style="background:#f8fafc;">
        <td style="padding:12px 10px;font-size:13px;color:#1e293b;font-weight:500;">Kevin M. Ruiz</td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">HVAC Technician<br><span style="font-size:10px;color:#94a3b8;">EPA 608</span></td>
        <td style="padding:12px 10px;font-size:12px;color:#475569;">Dearborn</td>
        <td style="padding:12px 10px;text-align:center;"><span style="background:#f59e0b;color:#fff;padding:3px 10px;border-radius:12px;font-weight:800;font-size:12px;">5/10</span></td>
        <td style="padding:12px 10px;font-size:11px;color:#64748b;">🔵 Verified</td>
        <td style="padding:12px 10px;font-size:11px;color:#f59e0b;">⏳ pending</td>
        <td style="padding:12px 10px;font-size:11px;color:#10b981;">✅ Actionable</td>
      </tr>
    </table>
  </td></tr>

  <!-- LEGEND + FOOTER -->
  <tr><td style="padding:20px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;background:#0a1628;">
    <p style="margin:0 0 6px;font-size:11px;color:#64748b;line-height:1.8;">
      🔥 <strong style="color:#e8621a;">8-10</strong> = alert sent to matching clients &nbsp;·&nbsp;
      ⚡ <strong style="color:#f59e0b;">5-7</strong> = included in email, no SMS &nbsp;·&nbsp;
      <span style="color:#94a3b8;">Below 5</span> = stored, no alert<br>
      ✅ complete = NPI→Sonar→PDL waterfall ran inline &nbsp;·&nbsp; ⏳ pending = 2h enrich cron picks up next run<br>
      👻 2 ghost leads filtered (score ≥5 but no contactable info — not sent to clients)
    </p>
    <p style="margin:12px 0 0;font-size:12px;color:#475569;">
      💰 MRR: $397/mo · 3 clients · Next: close Macomb Electric trial → $99/mo · Target: 10 clients = $1,490/mo
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>
` },
];

async function sendEmail(subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "TechAlert <matt@detroitwebagent.com>", to: TO, subject, html }),
  });
  const data = await res.json();
  return { ok: res.ok, id: data.id, error: data.message };
}

serve(async () => {
  const results = [];
  for (const email of EMAILS) {
    const result = await sendEmail(email.subject, email.html);
    results.push({ subject: email.subject.slice(0, 60), ...result });
    await new Promise((r) => setTimeout(r, 400));
  }
  return new Response(JSON.stringify({ sent: results.filter(r => r.ok).length, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
