// Simulates the deterministic safety-net pipeline used by draft-sms-reply
// for inbound SMS asking for a sign-up link. We do NOT call the live AI
// gateway here — its output is non-deterministic. Instead we replay the
// exact post-processing logic from draft-sms-reply/index.ts against a
// matrix of plausible AI base drafts + inbound messages, and assert that
// for every "wants link" inbound the final reply EITHER:
//   (a) contains a real http(s) URL from SIGNUP_URLS, under 320 chars, OR
//   (b) is a single clarifying question (only when intent is ambiguous).
//
// This guards against regressions where the AI produces "I'll send the
// link!" with no URL, or where the classifier silently picks a wrong product.
//
// Run: deno test supabase/functions/_shared/sms-signup-link-draft.test.ts

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifySignupProduct,
  SIGNUP_URLS,
  wantsSignupLink,
} from "./signup-classifier.ts";

const SMS_MAX_LEN = 320;
const URL_REGEX = /https?:\/\/[^\s]+/i;
const VALID_URLS = new Set(Object.values(SIGNUP_URLS));

// Mirror of the post-processing block in draft-sms-reply/index.ts.
// Pure function — no network, no DB.
function applySafetyNet(opts: {
  aiBaseDraft: string;
  inboundText: string;
  inboundContextText?: string;
}): { draft: string; action: string } {
  let draft = opts.aiBaseDraft.trim();
  const inboundText = opts.inboundText.toLowerCase();
  const draftLower = draft.toLowerCase();

  const draftPromisesLink =
    /\b(send (you )?(the|a) link|i'?ll send|here'?s the link|sign[- ]?up link)\b/
      .test(draftLower);
  const wantsLink = wantsSignupLink(inboundText) || draftPromisesLink;
  const hasUrl = /https?:\/\//i.test(draft);

  const classification = classifySignupProduct(
    opts.inboundContextText || opts.inboundText,
  );

  if (wantsLink && !hasUrl) {
    if (classification.ambiguous) {
      draft =
        "Quick check before I send the link — is this for getting more jobs (Contractor Leads), hiring techs (TechAlert), running your crew (FieldDesk), or catching missed calls?";
      return { draft, action: "ambiguous_clarifier_inserted" };
    }
    draft = `${draft} ${classification.url}`.trim();
    return { draft, action: "url_auto_appended" };
  }
  return { draft, action: wantsLink ? "url_already_present_skipped" : "no_link_needed" };
}

// --- Test scenarios: each simulates an inbound + a plausible AI base draft.
// "expectUrl" cases must end up with a valid SIGNUP_URLS link.
// "allowClarifier" cases may legitimately fall back to the clarifying question.

type Case = {
  name: string;
  inbound: string;
  inboundContext?: string;
  // Range of AI drafts the gateway might realistically return, including
  // the worst case where the model "promises" a link but forgets to paste it.
  aiDrafts: string[];
  expectUrl: true | "allow_clarifier";
  expectedProduct?: keyof typeof SIGNUP_URLS;
};

const CASES: Case[] = [
  {
    name: "techalert: 'send me the techalert link'",
    inbound: "send me the techalert link",
    aiDrafts: [
      "Sure — here's TechAlert.",
      "I'll send the link!",
      "TechAlert is $149/mo, alerts you when licensed techs come available.",
    ],
    expectUrl: true,
    expectedProduct: "techalert",
  },
  {
    name: "techalert: hiring electricians (link promised)",
    inbound: "I'm looking to hire an electrician",
    aiDrafts: [
      "I'll send you the sign-up link.",
      "Here's the TechAlert link:",
    ],
    expectUrl: true,
    expectedProduct: "techalert",
  },
  {
    name: "fielddesk: explicit product name",
    inbound: "how do I sign up for fielddesk",
    aiDrafts: [
      "FieldDesk is $199/mo — dispatch + mobile tech app.",
      "Here's the link:",
      "Sign-up link coming your way.",
    ],
    expectUrl: true,
    expectedProduct: "fielddesk",
  },
  {
    name: "fielddesk: replacing eWay-CRM",
    inbound: "we use eWay-CRM and hate it",
    aiDrafts: [
      "Yeah eWay is brutal. FieldDesk works in a boiler room — I'll send the link.",
    ],
    expectUrl: true,
    expectedProduct: "fielddesk",
  },
  {
    name: "missed_call: missing calls on roofs (link promised)",
    inbound: "I keep missing calls when on roofs",
    aiDrafts: [
      "Send me your number and I'll send the link.",
      "Here's the sign-up link:",
    ],
    expectUrl: true,
    expectedProduct: "missed_call",
  },
  {
    name: "dead_lead_reactivation: old quotes",
    inbound: "I have a stack of old quotes that never closed",
    aiDrafts: [
      "We can reactivate those — I'll text the sign-up link.",
    ],
    expectUrl: true,
  },
  {
    name: "contractor_leads: pay per lead",
    inbound: "pay per lead — what's the link",
    aiDrafts: [
      "$399/mo flat, exclusive territory.",
      "Sign-up link incoming.",
    ],
    expectUrl: true,
    expectedProduct: "contractor_leads",
  },
  {
    name: "contractor_leads: roofing leads in Warren",
    inbound: "send me roofing leads in Warren",
    aiDrafts: [
      "Roofing in Warren is open. I'll send the link.",
    ],
    expectUrl: true,
    expectedProduct: "contractor_leads",
  },
  {
    name: "ambiguous: bare 'send me the link'",
    inbound: "send me the link",
    aiDrafts: [
      "Sure thing — here's the link!",
      "I'll send it over.",
    ],
    expectUrl: "allow_clarifier",
  },
  {
    name: "ambiguous: 'sign me up'",
    inbound: "sign me up",
    aiDrafts: [
      "Sweet — I'll send the link.",
    ],
    expectUrl: "allow_clarifier",
  },
  {
    name: "context disambiguates: 'we use eWay' then 'send the link'",
    inbound: "send the link",
    inboundContext: "we use eWay-CRM and hate it \n send the link",
    aiDrafts: [
      "I'll send the link.",
    ],
    expectUrl: true,
    expectedProduct: "fielddesk",
  },
  {
    name: "AI already pasted a URL — must be preserved and valid",
    inbound: "send me the contractor leads link",
    aiDrafts: [
      `$399/mo flat. ${SIGNUP_URLS.contractor_leads}`,
    ],
    expectUrl: true,
    expectedProduct: "contractor_leads",
  },
];

function assertValidLinkReply(draft: string, expected?: keyof typeof SIGNUP_URLS) {
  assert(draft.length > 0, "draft must not be empty");
  assert(
    draft.length <= SMS_MAX_LEN,
    `draft exceeds ${SMS_MAX_LEN} chars (${draft.length}): ${draft}`,
  );
  const m = draft.match(URL_REGEX);
  assert(m, `draft must contain an http(s) URL: ${draft}`);
  // Strip trailing punctuation Twilio sometimes inherits
  const url = m[0].replace(/[).,!?]+$/, "");
  assert(
    VALID_URLS.has(url),
    `URL "${url}" is not in canonical SIGNUP_URLS registry`,
  );
  if (expected) {
    assertEquals(
      url,
      SIGNUP_URLS[expected],
      `expected ${expected} URL, got ${url}`,
    );
  }
}

function isClarifier(draft: string): boolean {
  return /quick check before i send the link/i.test(draft);
}

for (const c of CASES) {
  for (const baseDraft of c.aiDrafts) {
    Deno.test(`[${c.name}] AI draft: "${baseDraft.slice(0, 40)}..."`, () => {
      const { draft, action } = applySafetyNet({
        aiBaseDraft: baseDraft,
        inboundText: c.inbound,
        inboundContextText: c.inboundContext,
      });

      // Always under SMS limit
      assert(
        draft.length <= SMS_MAX_LEN,
        `final draft exceeds ${SMS_MAX_LEN} chars (${draft.length})`,
      );

      if (c.expectUrl === true) {
        assertValidLinkReply(draft, c.expectedProduct);
        assert(
          action === "url_auto_appended" || action === "url_already_present_skipped",
          `expected URL action, got ${action}`,
        );
      } else {
        // allow_clarifier: either URL or clarifier is acceptable, but
        // NEVER a "promise without link" — that's the regression we're guarding.
        if (URL_REGEX.test(draft)) {
          assertValidLinkReply(draft);
        } else {
          assert(
            isClarifier(draft),
            `ambiguous case must produce clarifier OR URL, got: ${draft}`,
          );
          assertEquals(action, "ambiguous_clarifier_inserted");
        }
      }
    });
  }
}

// --- Registry-level invariants ---

Deno.test("every SIGNUP_URLS entry is http(s) and under SMS budget", () => {
  for (const [product, url] of Object.entries(SIGNUP_URLS)) {
    assert(URL_REGEX.test(url), `${product} URL is not http(s): ${url}`);
    assert(url.length < SMS_MAX_LEN, `${product} URL alone exceeds SMS budget`);
  }
});

Deno.test("clarifier fallback fits in one SMS", () => {
  const { draft } = applySafetyNet({
    aiBaseDraft: "I'll send the link.",
    inboundText: "send me the link",
  });
  assert(isClarifier(draft));
  assert(draft.length <= SMS_MAX_LEN);
});
