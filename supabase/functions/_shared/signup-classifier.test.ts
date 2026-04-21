// Tests for the product-to-URL signup classifier.
// Run: deno test supabase/functions/_shared/signup-classifier.test.ts

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifySignupProduct,
  SIGNUP_URLS,
  wantsSignupLink,
} from "./signup-classifier.ts";

// --- High-confidence single-product matches ---

Deno.test("classifies 'send me the techalert link'", () => {
  const r = classifySignupProduct("send me the techalert link");
  assertEquals(r.product, "techalert");
  assertEquals(r.url, SIGNUP_URLS.techalert);
  assert(r.confidence >= 0.6, `confidence ${r.confidence} too low`);
  assert(!r.ambiguous);
});

Deno.test("classifies 'I'm looking to hire an electrician'", () => {
  const r = classifySignupProduct("I'm looking to hire an electrician");
  assertEquals(r.product, "techalert");
  assert(!r.ambiguous);
});

Deno.test("classifies 'how do I sign up for fielddesk'", () => {
  const r = classifySignupProduct("how do I sign up for fielddesk");
  assertEquals(r.product, "fielddesk");
  assert(!r.ambiguous);
});

Deno.test("classifies 'we use eWay-CRM and hate it'", () => {
  const r = classifySignupProduct("we use eWay-CRM and hate it");
  assertEquals(r.product, "fielddesk");
});

Deno.test("classifies 'I keep missing calls when on roofs'", () => {
  const r = classifySignupProduct("I keep missing calls when on roofs");
  assertEquals(r.product, "missed_call");
});

Deno.test("classifies 'I have a stack of old quotes that never closed'", () => {
  const r = classifySignupProduct("I have a stack of old quotes that never closed");
  assertEquals(r.product, "dead_lead_reactivation");
});

Deno.test("classifies 'send me roofing leads in Warren'", () => {
  const r = classifySignupProduct("send me roofing leads in Warren");
  assertEquals(r.product, "contractor_leads");
});

Deno.test("classifies 'pay per lead — what's the link'", () => {
  const r = classifySignupProduct("pay per lead — what's the link");
  assertEquals(r.product, "contractor_leads");
  assert(!r.ambiguous);
});

Deno.test("classifies 'I want a new website'", () => {
  const r = classifySignupProduct("I want a new website");
  assertEquals(r.product, "web_design");
});

// --- Ambiguous / low-confidence — must NOT silently default ---

Deno.test("ambiguous: 'send me the link' alone is unclassifiable", () => {
  const r = classifySignupProduct("send me the link");
  assert(r.ambiguous, "expected ambiguous, got " + JSON.stringify(r));
  assertEquals(r.confidence, 0);
});

Deno.test("ambiguous: 'sign me up' alone is unclassifiable", () => {
  const r = classifySignupProduct("sign me up");
  assert(r.ambiguous);
});

Deno.test("ambiguous: empty string", () => {
  const r = classifySignupProduct("");
  assert(r.ambiguous);
  assertEquals(r.confidence, 0);
});

Deno.test("ambiguous: bare 'crm' (overlaps fielddesk + general)", () => {
  const r = classifySignupProduct("do you have a crm?");
  // crm alone is weight 0.4 → confidence < 0.45 → ambiguous
  assert(r.ambiguous, `expected ambiguous, got conf ${r.confidence}`);
});

// --- Tied-product detection ---

Deno.test("tie: 'I need leads and want to hire techs' flags ambiguous tie", () => {
  const r = classifySignupProduct("I need leads and want to hire techs");
  assert(r.ambiguous);
  assert(
    (r.tiedWith && r.tiedWith.length > 0) || r.confidence < 0.45,
    "expected tie or low confidence, got " + JSON.stringify(r),
  );
});

// --- wantsSignupLink intent detection ---

Deno.test("wantsSignupLink detects common phrasings", () => {
  for (
    const phrase of [
      "send me the link",
      "sign me up",
      "how do I get started",
      "where do I sign up",
      "hook me up",
      "set me up",
      "I want to enroll",
    ]
  ) {
    assert(wantsSignupLink(phrase), `should detect: "${phrase}"`);
  }
});

Deno.test("wantsSignupLink ignores non-intent text", () => {
  for (
    const phrase of [
      "what does it cost",
      "do you do roofing",
      "I'll think about it",
    ]
  ) {
    assert(!wantsSignupLink(phrase), `should NOT detect: "${phrase}"`);
  }
});

// --- All URLs are non-empty production URLs ---

Deno.test("all SIGNUP_URLS use detroitwebagent.com production host", () => {
  for (const [product, url] of Object.entries(SIGNUP_URLS)) {
    assert(url.startsWith("https://detroitwebagent.com/"), `${product}: ${url}`);
    assert(url.length > "https://detroitwebagent.com/".length, `${product} URL is empty`);
  }
});
