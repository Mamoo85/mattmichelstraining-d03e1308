// _shared/hunter.ts — Hunter.io email finder.
// Used as the second tier in the email extraction waterfall (Apollo → Hunter → Firecrawl).
// Free tier: 25 domain searches/month. Paid: $49/mo for 500.

import { assertDwaBudget, BudgetExceeded } from "./dwa-budget-gate.ts";

const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || Deno.env.get("HUNTER_IO_API_KEY") || "";
const HUNTER_BASE = "https://api.hunter.io/v2";


export interface HunterContact {
  email: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  confidence: number; // 0-100
  linkedin?: string;
  phone_number?: string;
}

/** Find the highest-confidence email for a domain, filtered to decision-maker titles. */
export async function hunterFindEmail(domain: string): Promise<HunterContact | null> {
  if (!HUNTER_API_KEY || !domain) return null;
  try {
    const res = await fetch(
      `${HUNTER_BASE}/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_API_KEY}&limit=10`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const emails: any[] = data?.data?.emails || [];
    if (!emails.length) return null;

    // Prefer owner/president/GM titles; fall back to highest-confidence email
    const ownerTitles = ["owner", "president", "gm", "general manager", "principal", "director", "founder", "vp", "vice president"];
    const ownerContact = emails.find((e) => {
      const pos = (e.position || "").toLowerCase();
      return ownerTitles.some((t) => pos.includes(t));
    });

    const best = ownerContact || emails.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
    if (!best?.value) return null;

    return {
      email: best.value,
      first_name: best.first_name,
      last_name: best.last_name,
      position: best.position,
      confidence: best.confidence || 0,
      linkedin: best.linkedin,
      phone_number: best.phone_number,
    };
  } catch {
    return null;
  }
}

/** Verify a known email address is valid and deliverable. */
export async function hunterVerifyEmail(email: string): Promise<{ deliverable: boolean; score: number } | null> {
  if (!HUNTER_API_KEY || !email) return null;
  try {
    const res = await fetch(
      `${HUNTER_BASE}/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      deliverable: data?.data?.result === "deliverable",
      score: data?.data?.score || 0,
    };
  } catch {
    return null;
  }
}
