// Hand-written DM templates for the Growth Signal Outreach tab.
// Three plays × three tones = 9 templates. Each carries an `audience` tag
// so the wrong template can never be paired with the wrong target.
// IMPORTANT: written like a human would write them — no "I track 42 of these
// this week" filler, no forced "free dossier" CTA on every line.

import type { Distributor } from "./metroDistributors";

export type Play = "supply_radar" | "talent_radar" | "fielddesk";
export type Audience = "supply_house" | "contractor_owner" | "contractor_ops";
export type Tone = "direct" | "curious" | "value_first";

export interface TemplateCtx {
  recipientFirstName?: string;     // who you're DMing — use [Name] if unknown
  recipientCompany?: string;       // distributor name (Supply Radar) or contractor name (Talent/FieldDesk)
  signalCompany: string;           // the contractor showing growth signals (subject of the intel)
  signalCity: string;              // e.g. "Detroit"
  trade: string;                   // e.g. "Commercial HVAC"
  permits: number;
  hires: number;
  topRole: string;                 // e.g. "HVAC tech"
  predictedCommodities: string[];  // e.g. ["copper pipe","refrigerant"]
  predictedSpend: string;          // e.g. "$80k–$200k over next 60 days"
  daysOnMarket?: number;           // for Talent Radar
}

export interface Template {
  id: string;
  play: Play;
  audience: Audience;
  tone: Tone;
  label: string;
  build: (ctx: TemplateCtx) => string;
}

const name = (ctx: TemplateCtx) => ctx.recipientFirstName || "[Name]";

export const OUTREACH_TEMPLATES: Template[] = [
  // ───────── SUPPLY RADAR → DM supply houses ─────────
  {
    id: "supply_direct",
    play: "supply_radar",
    audience: "supply_house",
    tone: "direct",
    label: "Direct",
    build: (ctx) =>
`Hi ${name(ctx)} — heads up: ${ctx.signalCompany} pulled ${ctx.permits} ${ctx.trade.toLowerCase()} permits in ${ctx.signalCity} this month and is hiring ${ctx.hires} ${ctx.topRole}s. They're about to need a lot of ${ctx.predictedCommodities[0] || "equipment"} fast.

We run a Monday list of contractors like this in your territory — Supply Radar, $199/mo, 7-day free trial. Want me to send this week's?`,
  },
  {
    id: "supply_curious",
    play: "supply_radar",
    audience: "supply_house",
    tone: "curious",
    label: "Curious",
    build: (ctx) =>
`${name(ctx)} — quick question. Are you tracking ${ctx.signalCompany}? They just pulled ${ctx.permits} permits and posted ${ctx.hires} ${ctx.topRole} jobs in ${ctx.signalCity}. That usually = ${ctx.predictedSpend} in materials coming.

If you're not getting these alerts in real time, that's what we do — happy to send you the current week free.`,
  },
  {
    id: "supply_value",
    play: "supply_radar",
    audience: "supply_house",
    tone: "value_first",
    label: "Value-first",
    build: (ctx) =>
`${name(ctx)} — sharing this because it's right in your wheelhouse:

${ctx.signalCompany} (${ctx.signalCity}) — ${ctx.permits} ${ctx.trade.toLowerCase()} permits + ${ctx.hires} new hires in the last 30 days. Likely ${ctx.predictedCommodities.slice(0, 2).join(" + ")} spend in the ${ctx.predictedSpend} range.

No catch — just thought your team should know. If you want this kind of intel weekly, I'll explain how we pull it.`,
  },

  // ───────── TALENT RADAR → DM the hiring contractor's owner ─────────
  {
    id: "talent_direct",
    play: "talent_radar",
    audience: "contractor_owner",
    tone: "direct",
    label: "Direct",
    build: (ctx) =>
`Hi ${name(ctx)} — saw your ${ctx.hires} ${ctx.topRole} postings${ctx.daysOnMarket ? ` (live ${ctx.daysOnMarket} days now)` : ""}. Licensed trades in MI take 60+ days to fill on average — costing you jobs you could be running.

We watch MIOSHA license issues + permit activity statewide and ping you the day a qualified ${ctx.topRole} becomes available. $149/mo, runs in the background. Want me to send 3 candidates already on file?`,
  },
  {
    id: "talent_curious",
    play: "talent_radar",
    audience: "contractor_owner",
    tone: "curious",
    label: "Curious",
    build: (ctx) =>
`${name(ctx)} — how are you handling the ${ctx.topRole} hiring right now? Saw ${ctx.signalCompany} has ${ctx.hires} open${ctx.daysOnMarket && ctx.daysOnMarket > 30 ? ` and a couple have been up over a month` : ""}.

Reason I ask: we monitor every new MIOSHA license + every job change in MI trades. If someone qualified pops up, you hear first. Worth a 5-min call?`,
  },
  {
    id: "talent_value",
    play: "talent_radar",
    audience: "contractor_owner",
    tone: "value_first",
    label: "Value-first",
    build: (ctx) =>
`${name(ctx)} — quick offer, no pitch needed.

We track licensed ${ctx.topRole}s coming on the market in MI (MIOSHA + permit + job-board signals). I can send you 3 names from this week's batch that match your ${ctx.signalCity} area, free, just to prove it works. Reply "send" if useful.`,
  },

  // ───────── FIELDDESK + WEB DESIGN → DM the growing contractor ─────────
  {
    id: "fd_direct",
    play: "fielddesk",
    audience: "contractor_owner",
    tone: "direct",
    label: "Direct",
    build: (ctx) =>
`Hi ${name(ctx)} — congrats on the growth (${ctx.permits} permits + ${ctx.hires} hires in 30 days is no joke). At this pace your dispatch board and website become the bottleneck before your truck count does.

We build the ops infrastructure for shops your size — FieldDesk dispatch + a real website, $499 setup + $199/mo. Worth 15 min to see if it fits?`,
  },
  {
    id: "fd_curious",
    play: "fielddesk",
    audience: "contractor_owner",
    tone: "curious",
    label: "Curious",
    build: (ctx) =>
`${name(ctx)} — when you brought on the new ${ctx.topRole}s, how are you scheduling them? Whiteboard? Spreadsheet? eWay?

Reason I ask: we just stood up a dispatch + tech app for another ${ctx.signalCity} ${ctx.trade.toLowerCase()} shop running ${ctx.hires}+ techs. Would a 5-min look help?`,
  },
  {
    id: "fd_value",
    play: "fielddesk",
    audience: "contractor_owner",
    tone: "value_first",
    label: "Value-first",
    build: (ctx) =>
`${name(ctx)} — saw ${ctx.signalCompany} scaling fast in ${ctx.signalCity}. Sharing this because we've seen it kill margin: at ${ctx.hires}+ techs without real dispatch software, you start losing 1-2 calls a day to scheduling friction.

Happy to send a 90-second loom of how our shops handle it — no sales call needed. Just reply "send".`,
  },
];

export function templatesForPlay(play: Play): Template[] {
  return OUTREACH_TEMPLATES.filter(t => t.play === play);
}

export function audienceForPlay(play: Play): Audience {
  if (play === "supply_radar") return "supply_house";
  return "contractor_owner";
}

export const PLAY_META: Record<Play, { label: string; emoji: string; price: string; targetLine: string; description: string }> = {
  supply_radar: {
    label: "Supply Radar",
    emoji: "📦",
    price: "$199/mo",
    targetLine: "DM supply houses about THIS contractor's incoming spend",
    description: "You sell intel to distributors. Audience = sales managers at HVAC/plumbing/electrical supply houses.",
  },
  talent_radar: {
    label: "Talent Radar",
    emoji: "🎯",
    price: "$149/mo",
    targetLine: "DM the hiring contractor for help filling the roles",
    description: "You sell hiring help to the contractor. Audience = owner / GM / hiring manager at the contractor.",
  },
  fielddesk: {
    label: "FieldDesk + Web Design",
    emoji: "🏗️",
    price: "$499 + $199/mo",
    targetLine: "DM the contractor — they're growing, need ops infrastructure",
    description: "You sell dispatch software + website. Audience = owner at the growing contractor.",
  },
};
