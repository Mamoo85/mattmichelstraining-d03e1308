// Compliance waterfall — entity → OFAC + EPA ECHO + OSHA SIR + DOL WARN parallel scrub.
// Returns { pass, flags[] }. Gate before any outreach insert.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { useSourcesParallel, type SourceCall } from "./sources/use.ts";

export interface ComplianceContext {
  business_name?: string;
  full_name?: string;
  state?: string;
}

export interface ComplianceFlag {
  kind: "ofac_match" | "epa_violation" | "osha_fatality" | "dol_warn_layoff";
  source_id: string;
  evidence: Record<string, unknown>;
}

export interface ComplianceResult {
  pass: boolean;
  flags: ComplianceFlag[];
  checked: string[];
}

function nameLike(target: string, rec: any, fields: string[]): boolean {
  const t = target.trim().toLowerCase();
  if (!t) return false;
  return fields.some((f) => {
    const v = rec?.[f];
    if (typeof v !== "string") return false;
    return v.toLowerCase().includes(t);
  });
}

export async function runComplianceScrub(
  sb: SupabaseClient,
  ctx: ComplianceContext,
): Promise<ComplianceResult> {
  const target = ctx.business_name ?? ctx.full_name ?? "";
  if (!target) return { pass: true, flags: [], checked: [] };

  const calls: SourceCall[] = [
    { id: "ofac_sdn", params: {} },
    ...(ctx.state ? [{ id: "epa_echo", params: { state: ctx.state } } as SourceCall] : []),
    ...(ctx.state ? [{ id: "osha_sir", params: { state: ctx.state } } as SourceCall] : []),
    ...(ctx.state ? [{ id: "dol_warn", params: { state: ctx.state } } as SourceCall] : []),
  ];
  const out = await useSourcesParallel<any>(sb, calls);
  const flags: ComplianceFlag[] = [];

  for (const r of out.ofac_sdn?.data ?? []) {
    if (nameLike(target, r, ["name", "sdn_name", "first_name", "last_name"])) {
      flags.push({ kind: "ofac_match", source_id: "ofac_sdn", evidence: r });
    }
  }
  for (const r of out.epa_echo?.data ?? []) {
    if (nameLike(target, r, ["facility_name", "name"])) {
      flags.push({ kind: "epa_violation", source_id: "epa_echo", evidence: r });
    }
  }
  for (const r of out.osha_sir?.data ?? []) {
    if (nameLike(target, r, ["employer", "estab_name", "name"])) {
      flags.push({ kind: "osha_fatality", source_id: "osha_sir", evidence: r });
    }
  }
  for (const r of out.dol_warn?.data ?? []) {
    if (nameLike(target, r, ["company", "employer", "name"])) {
      flags.push({ kind: "dol_warn_layoff", source_id: "dol_warn", evidence: r });
    }
  }

  // OFAC = hard fail. Other flags = soft; surfaced but don't block.
  const pass = !flags.some((f) => f.kind === "ofac_match");
  return { pass, flags, checked: calls.map((c) => c.id) };
}
