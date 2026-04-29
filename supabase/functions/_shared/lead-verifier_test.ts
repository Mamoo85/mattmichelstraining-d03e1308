// Deno tests for the deterministic lead verifier (Agent 2).
// Run: deno test --allow-env supabase/functions/_shared/lead-verifier_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyClaims, verificationStats } from "./lead-verifier.ts";
import type { ExtractedClaim } from "./lead-extractor.ts";

const SOURCE = `Wayne County BSEED permit issued 2026-04-15 for property at 1234 Main St Detroit MI 48201.
Owner: John Smith. Estimated cost $45,000. Work: roof replacement after storm damage.`;

function claim(over: Partial<ExtractedClaim>): ExtractedClaim {
  return {
    address: "1234 Main St",
    signal_type: "permit",
    signal_detail: "roof replacement",
    source_excerpt: "permit issued 2026-04-15 for property at 1234 Main St",
    source_offset: 21,
    ...over,
  };
}

Deno.test("verifyClaims: grounded when excerpt + address number both appear", () => {
  const out = verifyClaims({ sourceText: SOURCE, claims: [claim({})] });
  assertEquals(out[0].verifier_grounded, true);
  assertEquals(out[0].verifier_citation_match, true);
});

Deno.test("verifyClaims: rejects excerpt shorter than 8 chars", () => {
  const out = verifyClaims({ sourceText: SOURCE, claims: [claim({ source_excerpt: "short" })] });
  assertEquals(out[0].verifier_grounded, false);
  assertEquals(out[0].verifier_reason, "excerpt_too_short");
});

Deno.test("verifyClaims: rejects when excerpt is not in source (hallucination)", () => {
  const out = verifyClaims({
    sourceText: SOURCE,
    claims: [claim({ source_excerpt: "permit for 9999 Fake Avenue Pontiac" })],
  });
  assertEquals(out[0].verifier_grounded, false);
  assertEquals(out[0].verifier_citation_match, false);
  assertEquals(out[0].verifier_reason, "excerpt_not_in_source");
});

Deno.test("verifyClaims: rejects when address number is missing from source", () => {
  const out = verifyClaims({
    sourceText: SOURCE,
    claims: [claim({ address: "9999 Fake St" })],
  });
  assertEquals(out[0].verifier_grounded, false);
  assertEquals(out[0].verifier_reason, "address_not_in_source");
});

Deno.test("verifyClaims: case + whitespace insensitive citation matching", () => {
  const out = verifyClaims({
    sourceText: SOURCE,
    claims: [claim({ source_excerpt: "PERMIT  ISSUED   2026-04-15 for property AT 1234 Main St" })],
  });
  assertEquals(out[0].verifier_grounded, true);
});

Deno.test("verificationStats: counts grounded vs total + rejection rate", () => {
  const out = verifyClaims({
    sourceText: SOURCE,
    claims: [claim({}), claim({ source_excerpt: "totally fabricated content" })],
  });
  const stats = verificationStats(out);
  assertEquals(stats.total, 2);
  assertEquals(stats.grounded, 1);
  assertEquals(stats.rejection_rate, 0.5);
});
