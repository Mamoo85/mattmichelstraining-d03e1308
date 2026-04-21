/**
 * Day-3 value-add email templates for the dead-lead drip sequence.
 * Each trade gets one HTML email, white-labeled from the contractor's business.
 * Used by dead-lead-drip step 2 (D3 EMAIL).
 *
 * All emails include a soft CTA + STOP/UNSUB instruction (CAN-SPAM).
 * No phantom features, no aggressive pitching — these are educational hooks.
 */

interface TemplateVars {
  firstName: string;
  bizName: string;
  bizPhone?: string;
  unsubLink?: string;
}

function footer(v: TemplateVars): string {
  const phone = v.bizPhone ? ` · ${v.bizPhone}` : "";
  const unsub = v.unsubLink
    ? `<a href="${v.unsubLink}" style="color:#94a3b8;text-decoration:underline">Unsubscribe</a>`
    : `Reply STOP to opt out`;
  return `
  <div style="padding:20px 28px;border-top:1px solid #e2e8f0;text-align:center;background:#f8fafc">
    <p style="margin:0;color:#64748b;font-size:12px">${v.bizName}${phone}</p>
    <p style="margin:6px 0 0;color:#94a3b8;font-size:11px">${unsub}</p>
  </div>`;
}

function shell(v: TemplateVars, headline: string, body: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif">
<div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
  <div style="padding:24px 28px 8px">
    <p style="margin:0 0 12px;color:#0f172a;font-size:13px;font-weight:600">Hey ${v.firstName},</p>
    <h1 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:800;line-height:1.3">${headline}</h1>
    <div style="color:#334155;font-size:14px;line-height:1.65">${body}</div>
  </div>
  ${footer(v)}
</div></body></html>`;
}

const T = {
  hvac(v: TemplateVars): { subject: string; html: string } {
    return {
      subject: `Quick furnace pre-winter checklist (5 things, no pitch)`,
      html: shell(
        v,
        "5 things to check on your furnace before the first deep freeze",
        `<p>It's that time again — Michigan winters don't give a warning. Here's the short list ${v.bizName} runs through on every pre-season tune-up:</p>
        <ol style="padding-left:20px">
          <li><strong>Filter</strong> — replace if you can't see light through it.</li>
          <li><strong>Thermostat</strong> — swap batteries, even if it seems fine.</li>
          <li><strong>Vents</strong> — make sure no furniture or rugs are blocking returns.</li>
          <li><strong>Flame sensor</strong> — a 30-second cleaning prevents 80% of "won't start" calls.</li>
          <li><strong>CO detector</strong> — test it. If it's older than 7 years, replace it.</li>
        </ol>
        <p>If something feels off, just reply to this email or call us — no pressure either way.</p>`
      ),
    };
  },
  roofing(v: TemplateVars): { subject: string; html: string } {
    return {
      subject: `What ice dams actually cost (a Michigan homeowner's note)`,
      html: shell(
        v,
        "The real cost of ignoring an ice dam",
        `<p>Most folks see an icicle and think "looks pretty." Here's what actually happens behind the scenes:</p>
        <ul style="padding-left:20px">
          <li>Average ice-dam interior damage claim in Metro Detroit: <strong>$6,400–$11,000</strong>.</li>
          <li>Insurance pays — but premiums almost always jump after.</li>
          <li>Two preventive things you can do today: clean the gutters, and check your attic insulation depth.</li>
        </ul>
        <p>If you want a no-pressure pre-winter look, reply with a good day this week and ${v.bizName} will swing by.</p>`
      ),
    };
  },
  plumbing(v: TemplateVars): { subject: string; html: string } {
    return {
      subject: `3 leaks that turn into $8K claims`,
      html: shell(
        v,
        "Tiny leaks, big bills — the 3 we see most",
        `<p>Most plumbing emergencies start as $40 fixes. Here are the three to keep an eye on:</p>
        <ol style="padding-left:20px">
          <li><strong>Toilet base</strong> — any moisture means the wax ring is failing. Subfloor rot starts in weeks.</li>
          <li><strong>Water heater pan</strong> — even a damp pan is a sign. A burst tank floods a basement in under 4 minutes.</li>
          <li><strong>Under-sink supply lines</strong> — braided steel only lasts 8–10 years. Cheap to replace, brutal when they go.</li>
        </ol>
        <p>If anything's been on your "I'll get to it" list, reply and ${v.bizName} can take a quick look.</p>`
      ),
    };
  },
  electrical(v: TemplateVars): { subject: string; html: string } {
    return {
      subject: `Michigan panel inspection rules changed — quick read`,
      html: shell(
        v,
        "What changed in 2026 for residential panels",
        `<p>The Michigan Electrical Code adopted the 2023 NEC update this year. Two things directly affect homeowners:</p>
        <ul style="padding-left:20px">
          <li><strong>GFCI required in more rooms</strong> — including basements, laundry, and any outlet within 6 feet of a sink.</li>
          <li><strong>Whole-home surge protection</strong> required at the panel for any new installs or major upgrades.</li>
        </ul>
        <p>Older panels (pre-2008) often fail inspection at point-of-sale. If you're thinking of selling in the next 1–2 years, reply and ${v.bizName} can do a quick walkthrough.</p>`
      ),
    };
  },
  general(v: TemplateVars): { subject: string; html: string } {
    return {
      subject: `Seasonal home check — 4 things worth 5 minutes`,
      html: shell(
        v,
        "4 quick things worth checking this month",
        `<ul style="padding-left:20px">
          <li>Smoke + CO detectors — test the buttons.</li>
          <li>Sump pump — pour a bucket of water in to confirm it kicks on.</li>
          <li>Outside hose bibs — disconnect hoses before the first freeze.</li>
          <li>Dryer vent — clean it. Lint fires are the #1 home insurance claim in winter.</li>
        </ul>
        <p>If anything turns up that you'd rather not deal with yourself, ${v.bizName} is a reply away.</p>`
      ),
    };
  },
};

export function getDeadLeadEmail(
  trade: string,
  vars: TemplateVars
): { subject: string; html: string } {
  const key = (trade || "").toLowerCase().replace(/[^a-z]/g, "");
  if (key.includes("hvac") || key.includes("furnace") || key.includes("heating") || key.includes("cooling")) return T.hvac(vars);
  if (key.includes("roof")) return T.roofing(vars);
  if (key.includes("plumb")) return T.plumbing(vars);
  if (key.includes("electric")) return T.electrical(vars);
  return T.general(vars);
}
