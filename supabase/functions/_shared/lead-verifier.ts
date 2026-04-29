// Agent 2 (Verifier): Deterministic substring verification of extracted claims against the original source.
// No LLM. Pure string matching to confirm each claim's source_excerpt actually exists in the source text.

import type { ExtractedClaim } from "./lead-extractor.ts";

export interface VerifiedClaim extends ExtractedClaim {
  verifier_grounded: boolean;
  verifier_citation_match: boolean;
  verifier_reason?: string;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function verifyClaims(args: {
  sourceText: string;
  claims: ExtractedClaim[];
}): VerifiedClaim[] {
  const sourceNorm = normalize(args.sourceText);

  return args.claims.map((c) => {
    const excerptNorm = normalize(c.source_excerpt || "");
    if (!excerptNorm || excerptNorm.length < 8) {
      return { ...c, verifier_grounded: false, verifier_citation_match: false, verifier_reason: "excerpt_too_short" };
    }

    const citationMatch = sourceNorm.includes(excerptNorm);
    if (!citationMatch) {
      return { ...c, verifier_grounded: false, verifier_citation_match: false, verifier_reason: "excerpt_not_in_source" };
    }

    // Address grounding: at least street-number portion should appear in excerpt or source
    const addrTokens = (c.address || "").toLowerCase().match(/\d+/g) || [];
    const addrInSource = addrTokens.length > 0 && addrTokens.some((t) => sourceNorm.includes(t));
    if (!addrInSource) {
      return { ...c, verifier_grounded: false, verifier_citation_match: true, verifier_reason: "address_not_in_source" };
    }

    return { ...c, verifier_grounded: true, verifier_citation_match: true };
  });
}

export function verificationStats(verified: VerifiedClaim[]) {
  const total = verified.length;
  const grounded = verified.filter((v) => v.verifier_grounded).length;
  return { total, grounded, rejection_rate: total ? 1 - grounded / total : 0 };
}
