// License waterfall — name + state → all 8 license boards in parallel.
// Returns License[] with provenance. Used by Talent Radar deep-enrich + outreach compliance.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { useSourcesParallel, type SourceCall } from "./sources/use.ts";

export type LicenseKind =
  | "nursing" | "teaching" | "bar" | "cpa" | "engineer"
  | "physician" | "va_provider" | "contractor";

export interface License {
  kind: LicenseKind;
  source_id: string;
  state: string;
  name?: string;
  license_number?: string;
  status?: string;
  expires?: string;
  raw: Record<string, unknown>;
}

export interface LicenseContext {
  state: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  zip?: string;
  lookup_urls?: Partial<Record<LicenseKind, string>>;
}

function nameMatch(rec: any, ctx: LicenseContext): boolean {
  const target = (ctx.full_name ?? `${ctx.first_name ?? ""} ${ctx.last_name ?? ""}`).trim().toLowerCase();
  if (!target) return false;
  const fields = [rec?.name, rec?.full_name, `${rec?.first_name ?? ""} ${rec?.last_name ?? ""}`].filter(Boolean);
  return fields.some((f: string) => String(f).toLowerCase().includes(target));
}

export async function fetchLicenses(sb: SupabaseClient, ctx: LicenseContext): Promise<License[]> {
  const lu = ctx.lookup_urls ?? {};
  const calls: SourceCall[] = [
    { id: "state_nursing_boards", params: { lookup_url: lu.nursing ?? "" } },
    { id: "state_teaching_boards", params: { lookup_url: lu.teaching ?? "" } },
    { id: "state_bar_associations", params: { lookup_url: lu.bar ?? "" } },
    { id: "state_cpa_boards", params: { lookup_url: lu.cpa ?? "" } },
    { id: "ncees_engineers", params: {} },
    { id: "abms_certmatters", params: {} },
    { id: "va_provider_db", params: { zip: ctx.zip ?? "" } },
    { id: "state_contractor_licenses", params: { lookup_url: lu.contractor ?? "" } },
  ];
  const out = await useSourcesParallel<any>(sb, calls);

  const map = (kind: LicenseKind, src: string, rows: any[]): License[] =>
    (rows ?? []).filter((r) => nameMatch(r, ctx)).map((r) => ({
      kind, source_id: src, state: ctx.state,
      name: r?.name ?? r?.full_name,
      license_number: r?.license_number ?? r?.number ?? r?.id,
      status: r?.status,
      expires: r?.expires ?? r?.expiration_date,
      raw: r,
    }));

  return [
    ...map("nursing", "state_nursing_boards", out.state_nursing_boards?.data ?? []),
    ...map("teaching", "state_teaching_boards", out.state_teaching_boards?.data ?? []),
    ...map("bar", "state_bar_associations", out.state_bar_associations?.data ?? []),
    ...map("cpa", "state_cpa_boards", out.state_cpa_boards?.data ?? []),
    ...map("engineer", "ncees_engineers", out.ncees_engineers?.data ?? []),
    ...map("physician", "abms_certmatters", out.abms_certmatters?.data ?? []),
    ...map("va_provider", "va_provider_db", out.va_provider_db?.data ?? []),
    ...map("contractor", "state_contractor_licenses", out.state_contractor_licenses?.data ?? []),
  ];
}
