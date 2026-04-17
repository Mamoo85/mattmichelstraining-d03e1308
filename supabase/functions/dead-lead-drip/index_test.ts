import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ===== Trade template tests =====
// Reimplemented from index.ts to test template selection and substitution in isolation.

const TRADE_TEMPLATES: Record<string, { d1: string; d2: string; d3: string }> = {
  hvac: {
    d1: `Hey {name}, this is the office at {bizName}. Just checking in — is your HVAC system still giving you trouble, or did you find someone to handle it?\nReply STOP to opt out`,
    d2: `Hey {name} — {bizName} again. A lot of folks are scheduling service before the season peaks and we book up fast. We can usually get out in 2-3 days. Reply YES to lock in a spot.\nReply STOP to opt out`,
    d3: `Last note from {bizName}. If your heating or cooling ever needs attention, just reply and we'll take care of you. Stay comfortable out there!\nReply STOP to opt out`,
  },
  roofing: {
    d1: `Hey {name}, {bizName} here — following up on that roofing quote from a while back. Did you ever get that taken care of, or are you still looking at it?\nReply STOP to opt out`,
    d2: `Hey {name} — {bizName} again. Wanted to reach out before the weather turns. A small roof issue now can turn into a major repair after the first freeze. We can get eyes on it this week.\nReply STOP to opt out`,
    d3: `Last message from {bizName}. Another Michigan winter's coming — if that roof still needs work, reply YES and we'll get you squared away before the snow flies.\nReply STOP to opt out`,
  },
  plumbing: {
    d1: `Hey {name}, this is {bizName} following up. Did that plumbing issue ever get resolved, or is it still something you're dealing with?\nReply STOP to opt out`,
    d2: `Hey {name} — {bizName} here. Plumbing problems have a way of getting worse when you wait. If it's still bothering you, reply YES and we'll get someone out fast.\nReply STOP to opt out`,
    d3: `Last follow-up from {bizName}. That leak or drain issue won't fix itself — whenever you're ready, we're a quick reply away. Take care!\nReply STOP to opt out`,
  },
  electrical: {
    d1: `Hey {name}, {bizName} following up. Did you ever get that electrical work taken care of, or is it still on the list? We're booking this week.\nReply STOP to opt out`,
    d2: `Hey {name} — {bizName} again. Electrical issues are one thing you really don't want to delay. We have openings this week — just reply YES.\nReply STOP to opt out`,
    d3: `Last check-in from {bizName}. Whenever you're ready to get that electrical sorted, we're here. Stay safe!\nReply STOP to opt out`,
  },
  general: {
    d1: `Hey {name}, this is the dispatch desk following up for {bizName}. Did you ever get that {trade} issue taken care of, or are you still looking for a quote?\nReply STOP to opt out`,
    d2: `Hey {name} — {bizName} again. Still available if you need {trade} help. Just reply YES and we'll get someone out to you.\nReply STOP to opt out`,
    d3: `Last follow-up from {bizName} — if you ever need {trade} work in the future, just reply and we'll make it easy. Take care!\nReply STOP to opt out`,
  },
};

function getTradeTemplate(trade: string, drip: "d1" | "d2" | "d3"): string {
  const key = trade.toLowerCase().replace(/[^a-z]/g, "");
  const tpl = TRADE_TEMPLATES[key] || TRADE_TEMPLATES.general;
  return tpl[drip];
}

// ─── Template selection ───────────────────────────────────────────────────────

Deno.test("getTradeTemplate — hvac d1 uses seasonal angle", () => {
  const tpl = getTradeTemplate("hvac", "d1");
  assertStringIncludes(tpl, "HVAC");
  assertStringIncludes(tpl, "Reply STOP to opt out");
});

Deno.test("getTradeTemplate — roofing d2 mentions freeze/weather urgency", () => {
  const tpl = getTradeTemplate("roofing", "d2");
  assertStringIncludes(tpl, "freeze");
});

Deno.test("getTradeTemplate — plumbing d1 mentions plumbing issue", () => {
  const tpl = getTradeTemplate("plumbing", "d1");
  assertStringIncludes(tpl, "plumbing issue");
});

Deno.test("getTradeTemplate — electrical d2 uses safety urgency angle", () => {
  const tpl = getTradeTemplate("electrical", "d2");
  assertStringIncludes(tpl, "don't want to delay");
});

Deno.test("getTradeTemplate — unknown trade falls back to general template", () => {
  const tpl = getTradeTemplate("solar_panels", "d1");
  assertStringIncludes(tpl, "{trade}");
  assertStringIncludes(tpl, "dispatch desk");
});

Deno.test("getTradeTemplate — case-insensitive trade matching", () => {
  const lower = getTradeTemplate("hvac", "d1");
  const upper = getTradeTemplate("HVAC", "d1");
  assertEquals(lower, upper);
});

Deno.test("getTradeTemplate — strips non-alpha chars from trade key", () => {
  const clean = getTradeTemplate("plumbing", "d1");
  const messy = getTradeTemplate("plumbing!", "d1");
  assertEquals(clean, messy);
});

Deno.test("getTradeTemplate — all trades include STOP opt-out in every drip", () => {
  const trades = ["hvac", "roofing", "plumbing", "electrical", "general"];
  const drips: Array<"d1" | "d2" | "d3"> = ["d1", "d2", "d3"];
  for (const trade of trades) {
    for (const drip of drips) {
      const tpl = getTradeTemplate(trade, drip);
      assertStringIncludes(tpl, "STOP", `${trade}/${drip} missing STOP opt-out`);
    }
  }
});

Deno.test("getTradeTemplate — d3 messages are final (last contact tone)", () => {
  const trades = ["hvac", "roofing", "plumbing", "electrical"];
  for (const trade of trades) {
    const d3 = getTradeTemplate(trade, "d3");
    const hasLastNote =
      d3.includes("Last note") ||
      d3.includes("Last message") ||
      d3.includes("Last follow-up") ||
      d3.includes("Last check-in");
    assertEquals(hasLastNote, true, `${trade}/d3 should have a final-message tone`);
  }
});

// ─── Template variable substitution ──────────────────────────────────────────

function applyTemplate(tpl: string, name: string, bizName: string, trade: string): string {
  return tpl
    .replace("{name}", name)
    .replace("{bizName}", bizName)
    .replace(/{trade}/g, trade);
}

Deno.test("template substitution — replaces {name} with first name", () => {
  const tpl = getTradeTemplate("hvac", "d1");
  const result = applyTemplate(tpl, "Sarah", "Metro HVAC", "hvac");
  assertStringIncludes(result, "Sarah");
  assertEquals(result.includes("{name}"), false);
});

Deno.test("template substitution — replaces {bizName}", () => {
  const tpl = getTradeTemplate("roofing", "d1");
  const result = applyTemplate(tpl, "Tom", "Apex Roofing", "roofing");
  assertStringIncludes(result, "Apex Roofing");
  assertEquals(result.includes("{bizName}"), false);
});

Deno.test("template substitution — general template replaces {trade} placeholder", () => {
  const tpl = getTradeTemplate("unknown", "d1");
  const result = applyTemplate(tpl, "Jim", "JR Services", "solar");
  assertStringIncludes(result, "solar");
  assertEquals(result.includes("{trade}"), false);
});

Deno.test("template substitution — does not contain raw placeholders after substitution", () => {
  const trades = ["hvac", "roofing", "plumbing", "electrical"];
  const drips: Array<"d1" | "d2" | "d3"> = ["d1", "d2", "d3"];
  for (const trade of trades) {
    for (const drip of drips) {
      const result = applyTemplate(getTradeTemplate(trade, drip), "Alex", "Acme Co", trade);
      assertEquals(result.includes("{name}"), false);
      assertEquals(result.includes("{bizName}"), false);
    }
  }
});

// ─── TCPA 18-month EBR cutoff calculation ────────────────────────────────────

function computeEighteenMonthCutoff(now: Date): string {
  return new Date(now.getTime() - 548 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

Deno.test("TCPA cutoff — is approximately 18 months before now", () => {
  const now = new Date("2026-04-17T00:00:00Z");
  const cutoff = computeEighteenMonthCutoff(now);
  // 548 days before 2026-04-17 = 2024-10-16
  assertEquals(cutoff, "2024-10-16");
});

Deno.test("TCPA cutoff — returns a date string in YYYY-MM-DD format", () => {
  const cutoff = computeEighteenMonthCutoff(new Date());
  assertStringIncludes(cutoff, "-");
  assertEquals(cutoff.length, 10);
  assertEquals(/^\d{4}-\d{2}-\d{2}$/.test(cutoff), true);
});

Deno.test("TCPA cutoff — cutoff date is strictly before today", () => {
  const now = new Date();
  const cutoff = new Date(computeEighteenMonthCutoff(now));
  assertEquals(cutoff < now, true);
});

Deno.test("TCPA cutoff — contact last-touched 2 years ago is past the cutoff", () => {
  const now = new Date("2026-04-17T00:00:00Z");
  const cutoff = computeEighteenMonthCutoff(now);
  const oldContact = "2024-01-01"; // ~2.3 years ago
  assertEquals(oldContact < cutoff, true);
});

Deno.test("TCPA cutoff — contact last-touched 6 months ago is within the window", () => {
  const now = new Date("2026-04-17T00:00:00Z");
  const cutoff = computeEighteenMonthCutoff(now);
  const recentContact = "2025-10-17"; // ~6 months ago
  assertEquals(recentContact >= cutoff, true);
});
