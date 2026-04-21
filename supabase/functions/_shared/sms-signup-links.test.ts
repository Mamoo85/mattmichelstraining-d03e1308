// Verifies every outbound "sign-up link" SMS contains a non-empty URL that
// points at a real, current production route on the right environment domain.
//
// Why: regressions where a contractor SMS goes out saying "here's the link:"
// with NO URL — or with a stale path that 404s — cost real money. This test
// scans the canonical SMS-sending sources and asserts:
//   1. Every URL is non-empty and absolute (or short-form domain.tld/path)
//   2. Every URL host belongs to the production environment (DWA domain)
//   3. Every URL path matches a known route in src/App.tsx
//
// Run with: deno test supabase/functions/_shared/sms-signup-links.test.ts --allow-read

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Production environment (the one all signup-link SMS must point at) ──────
const ALLOWED_HOSTS = new Set([
  "detroitwebagent.com",
  "www.detroitwebagent.com",
]);

// Canonical routes that actually exist in src/App.tsx. Update this list when
// new self-serve product pages ship — that's the whole point of the test.
const VALID_ROUTES = new Set([
  "/contractor-leads",
  "/hire-alert",          // redirects to /talent-radar but link is live
  "/talent-radar",
  "/field-service",
  "/missed-call-catch",
  "/local-marketing",
  "/get-started",
  "/lead-claimed",
  "/dead-lead-intake",
  "/roi",
]);

// Files to scan. Each entry is the source-of-truth for one outbound channel.
// Read at test time so we catch drift between the test and the live code.
const SOURCES = [
  "../draft-sms-reply/index.ts",
  "../contractor-sms-follow/index.ts",
  "../contractor-drip/index.ts",
];

// Match http(s) URLs AND short-form `domain.tld/path` (we use both in SMS).
const URL_RE =
  /\b(?:https?:\/\/)?(?:www\.)?detroitwebagent\.com(\/[A-Za-z0-9_\-/?&=#.%]*)?/g;

interface FoundLink {
  source: string;
  raw: string;
  path: string;
  host: string;
}

async function readSource(rel: string): Promise<string> {
  const url = new URL(rel, import.meta.url);
  return await Deno.readTextFile(url);
}

function extractLinks(source: string, body: string): FoundLink[] {
  const out: FoundLink[] = [];
  for (const m of body.matchAll(URL_RE)) {
    const raw = m[0];
    // Reconstruct host + path
    const withProto = raw.startsWith("http") ? raw : `https://${raw}`;
    let host = "";
    let path = "/";
    try {
      const u = new URL(withProto);
      host = u.host;
      path = u.pathname || "/";
    } catch {
      continue;
    }
    out.push({ source, raw, host, path });
  }
  return out;
}

Deno.test("every signup-link SMS source has at least one DWA URL", async () => {
  for (const rel of SOURCES) {
    const src = await readSource(rel);
    const links = extractLinks(rel, src);
    assert(
      links.length > 0,
      `${rel}: expected at least one detroitwebagent.com URL, found none. ` +
      `Did the signup link get accidentally stripped from an SMS template?`,
    );
  }
});

Deno.test("every URL host belongs to the production environment", async () => {
  for (const rel of SOURCES) {
    const src = await readSource(rel);
    for (const link of extractLinks(rel, src)) {
      assert(
        ALLOWED_HOSTS.has(link.host),
        `${rel}: URL "${link.raw}" host "${link.host}" is not in the allowed ` +
        `production set ${[...ALLOWED_HOSTS].join(", ")}. ` +
        `Sign-up SMS must never point at a preview/staging/personal domain.`,
      );
    }
  }
});

Deno.test("every URL path matches a route registered in src/App.tsx", async () => {
  for (const rel of SOURCES) {
    const src = await readSource(rel);
    for (const link of extractLinks(rel, src)) {
      // Strip query string + trailing slash for matching
      const path = link.path.split("?")[0].replace(/\/$/, "") || "/";
      assert(
        VALID_ROUTES.has(path),
        `${rel}: URL path "${path}" (from "${link.raw}") does not match any ` +
        `known route. Either the route was renamed or VALID_ROUTES is stale. ` +
        `Update VALID_ROUTES in this test if the route is intentional.`,
      );
    }
  }
});

Deno.test("no signup-promise SMS body is missing its URL", async () => {
  // Heuristic: any string literal that mentions sending/sharing a link must
  // also contain a URL on the same logical line/template. Catches the bug
  // class "Want me to send the signup link?" with no actual link present.
  const PROMISE_RE =
    /["`'][^"`']*\b(send (?:you )?(?:the|a) link|here'?s the link|sign[- ]?up link|signup link|claim it|start:|claim now|claim the)\b[^"`']*["`']/gi;

  for (const rel of SOURCES) {
    const src = await readSource(rel);
    for (const m of src.matchAll(PROMISE_RE)) {
      const literal = m[0];
      const hasUrl = URL_RE.test(literal);
      // Reset regex global state after .test()
      URL_RE.lastIndex = 0;

      // Allow the SMS-templates "Want me to send the signup link" pattern,
      // which is the question Matt asks BEFORE sending — the actual link is
      // sent in the follow-up via draft-sms-reply.ts. Recognize by phrasing.
      const isAskingPermission = /\bwant me to send\b/i.test(literal);
      if (isAskingPermission) continue;

      // Skip prompt-rule documentation strings (negative examples telling the
      // AI what NOT to write). They appear inside SYSTEM_PROMPT, never sent.
      // Heuristic: the literal is part of a regex (preceded by `/`) or a rule
      // sentence containing "Never" / "without pasting" / "don't" nearby.
      const ruleContext = src.slice(
        Math.max(0, (m.index ?? 0) - 80),
        (m.index ?? 0) + literal.length + 80,
      );
      if (
        /\b(Never|never say|without pasting|don'?t|do not)\b/i.test(ruleContext) ||
        /[/(]\s*$/.test(src.slice(0, m.index ?? 0).trimEnd())
      ) {
        continue;
      }

      assert(
        hasUrl,
        `${rel}: SMS literal promises a link but contains no URL:\n  ${literal}\n` +
        `Either inline the URL or split the promise off into a copy that ` +
        `actually carries one.`,
      );
    }
  }
});

Deno.test("draft-sms-reply SIGNUP_URLS map is complete and valid", async () => {
  const src = await readSource("../draft-sms-reply/index.ts");
  // Pull out the SIGNUP_URLS object literal
  const blockMatch = src.match(/const SIGNUP_URLS\s*=\s*{([\s\S]*?)};/);
  assert(blockMatch, "Could not locate SIGNUP_URLS map in draft-sms-reply");

  const block = blockMatch[1];
  const entries = [...block.matchAll(/(\w+):\s*"([^"]+)"/g)];
  assert(entries.length >= 4, `Expected ≥4 SIGNUP_URLS entries, got ${entries.length}`);

  for (const [, key, url] of entries) {
    assert(url.length > 0, `SIGNUP_URLS.${key} is empty`);
    const u = new URL(url);
    assert(
      ALLOWED_HOSTS.has(u.host),
      `SIGNUP_URLS.${key} host "${u.host}" not in production set`,
    );
    const path = u.pathname.replace(/\/$/, "") || "/";
    assert(
      VALID_ROUTES.has(path),
      `SIGNUP_URLS.${key} path "${path}" not in VALID_ROUTES`,
    );
  }

  // Spot-check the canonical mapping
  const map = Object.fromEntries(entries.map(([, k, v]) => [k, v]));
  assertEquals(map.contractor_leads, "https://detroitwebagent.com/contractor-leads");
});
