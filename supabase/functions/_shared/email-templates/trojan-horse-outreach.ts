/**
 * Trojan Horse Outreach — branded HTML email template.
 * Renders Matt's "free pre-vetted candidate" pitch with a styled candidate
 * teaser card and a single low-friction CTA. Looks personal, not marketing.
 */

export interface TeaserCandidate {
  licensed_role: string;
  county: string;
  signal_strength: "exceptional" | "strong" | "moderate";
  availability?: string;
}

export interface TrojanHorseEmailInput {
  greeting_name?: string | null;       // "Sarah" or null → "Hi there"
  agency_name: string;
  intro_paragraph: string;             // Opus-generated body intro (1-3 sentences)
  bridge_paragraph?: string;           // Optional middle paragraph
  primary_candidate: TeaserCandidate;  // Cherry-picked, featured
  alt_candidates?: TeaserCandidate[];  // 0-2 supporting matches
  cta_label?: string;                  // default: "Send me the full profile"
  reply_to?: string;                   // matt@detroitwebagent.com
}

const DWA_TEAL = "#00d4ff";
const INK = "#0a1628";
const SUBTLE = "#64748b";
const BORDER = "#e2e8f0";

const tierBadge = (tier: TeaserCandidate["signal_strength"]) => {
  const map = {
    exceptional: { bg: "#ecfdf5", fg: "#047857", label: "EXCEPTIONAL SIGNAL" },
    strong:      { bg: "#eff6ff", fg: "#1d4ed8", label: "STRONG SIGNAL" },
    moderate:    { bg: "#f1f5f9", fg: "#475569", label: "MATCH" },
  } as const;
  const c = map[tier] ?? map.moderate;
  return `<span style="display:inline-block;padding:3px 8px;font-size:10px;font-weight:700;letter-spacing:0.8px;color:${c.fg};background:${c.bg};border-radius:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${c.label}</span>`;
};

const candidateCard = (c: TeaserCandidate, featured = false) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0;">
    <tr>
      <td style="padding:16px 18px;background:${featured ? "#f0fbff" : "#f8fafc"};border:1px solid ${featured ? DWA_TEAL : BORDER};border-left:3px solid ${featured ? DWA_TEAL : "#cbd5e1"};border-radius:8px;">
        <div style="font-size:15px;font-weight:600;color:${INK};line-height:1.4;margin:0 0 4px;">
          ${escapeHtml(c.licensed_role)}
        </div>
        <div style="font-size:13px;color:${SUBTLE};margin:0 0 10px;">${escapeHtml(c.county)}${c.availability ? ` · ${escapeHtml(c.availability)}` : ""}</div>
        ${tierBadge(c.signal_strength)}
      </td>
    </tr>
  </table>
`;

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphs(body: string): string {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function buildTrojanHorseHtml(input: TrojanHorseEmailInput): string {
  const greeting = input.greeting_name
    ? `Hi ${escapeHtml(input.greeting_name)},`
    : `Hi there,`;
  const cta = input.cta_label || "Send me the full profile";
  const altCards = (input.alt_candidates || []).slice(0, 2).map((c) => candidateCard(c, false)).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pre-market candidate — ${escapeHtml(input.agency_name)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:0 4px 24px;">
              <p style="margin:0 0 18px;font-size:15px;color:${INK};">${greeting}</p>
              ${paragraphs(input.intro_paragraph)}

              <div style="margin:18px 0 6px;font-size:11px;font-weight:700;letter-spacing:1.2px;color:${SUBTLE};text-transform:uppercase;">
                Pre-market match
              </div>
              ${candidateCard(input.primary_candidate, true)}
              ${altCards ? `<div style="margin:14px 0 6px;font-size:11px;font-weight:700;letter-spacing:1.2px;color:${SUBTLE};text-transform:uppercase;">Plus ${input.alt_candidates!.length} more in the pipeline</div>${altCards}` : ""}

              ${input.bridge_paragraph ? paragraphs(input.bridge_paragraph) : ""}

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 18px;">
                <tr>
                  <td style="background:${DWA_TEAL};border-radius:8px;">
                    <a href="mailto:${escapeHtml(input.reply_to || "matt@detroitwebagent.com")}?subject=${encodeURIComponent(`Yes — send the full profile for ${input.agency_name}`)}"
                       style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:${INK};text-decoration:none;font-family:inherit;">
                      ${escapeHtml(cta)} →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 4px;font-size:15px;color:${INK};">Matt Michels</p>
              <p style="margin:0;font-size:13px;color:${SUBTLE};line-height:1.5;">
                Founder · Detroit Web Agency<br>
                <a href="mailto:matt@detroitwebagent.com" style="color:${SUBTLE};text-decoration:none;">matt@detroitwebagent.com</a> · (313) 992-1219
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildTrojanHorsePlainText(input: TrojanHorseEmailInput): string {
  const greeting = input.greeting_name ? `Hi ${input.greeting_name},` : "Hi there,";
  const lines: string[] = [greeting, "", input.intro_paragraph, ""];
  lines.push("PRE-MARKET MATCH:");
  lines.push(`  • ${input.primary_candidate.licensed_role} — ${input.primary_candidate.county} (${input.primary_candidate.signal_strength} signal)`);
  for (const c of input.alt_candidates || []) {
    lines.push(`  • ${c.licensed_role} — ${c.county} (${c.signal_strength} signal)`);
  }
  if (input.bridge_paragraph) lines.push("", input.bridge_paragraph);
  lines.push("", input.cta_label || "Send me the full profile", "");
  lines.push("Matt Michels");
  lines.push("Founder · Detroit Web Agency");
  lines.push("matt@detroitwebagent.com · (313) 992-1219");
  return lines.join("\n");
}
