import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RAW_BASE = "https://raw.githubusercontent.com/mamoo85/m2training/main/mock-trial";

const EMAILS = [
  {
    to: "matt@mattmichelstraining.com",
    subject: "⚡ [MOCK TRIAL] TechAlert Welcome — Premier HVAC Inc. ($149/mo)",
    file: "welcome-email-trades.html",
  },
  {
    to: "matt@mattmichelstraining.com",
    subject: "⚡ [MOCK TRIAL] TechAlert Welcome — Sunrise Senior Care ($49/mo bundle)",
    file: "welcome-email-healthcare.html",
  },
  {
    to: "matt@mattmichelstraining.com",
    subject: "⚡ [MOCK TRIAL] TechAlert Alert — 4 Candidates Found (Trades)",
    file: "alert-email-mixed.html",
  },
  {
    to: "matt@mattmichelstraining.com",
    subject: "⚡ [MOCK TRIAL] TechAlert Alert — 3 Healthcare Candidates (CNA/RN/LPN)",
    file: "alert-email-healthcare.html",
  },
  {
    to: "matt@mattmichelstraining.com",
    subject: "⚡ [MOCK TRIAL] TechAlert Founder Report — 7 Candidates, 3 Clients, $397 MRR",
    file: "founder-report.html",
  },
];

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "TechAlert <matt@detroitwebagent.com>",
      to,
      subject,
      html,
    }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, id: data.id, error: data.message };
}

serve(async () => {
  const results = [];

  for (const email of EMAILS) {
    const htmlRes = await fetch(`${RAW_BASE}/${email.file}`);
    if (!htmlRes.ok) {
      results.push({ file: email.file, ok: false, error: "Failed to fetch HTML" });
      continue;
    }
    const html = await htmlRes.text();
    const result = await sendEmail(email.to, email.subject, html);
    results.push({ file: email.file, ...result });
    await new Promise((r) => setTimeout(r, 300));
  }

  return new Response(JSON.stringify({ sent: results.length, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
