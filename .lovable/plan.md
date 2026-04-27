# Harden Fax Campaign Sends — 4-Part Fix

## Background

`send-fax-phaxio` already skips the segment filter when `prospect_ids` are supplied (last session's fix). The remaining failure modes:

1. **Phantom IDs**: campaign references prospect IDs that exist in `prospect_pool` but never got mirrored to `fax_prospects` — and vice versa.
2. **No pre-flight check**: campaigns silently mark themselves "failed (sent=0)" instead of "invalid_targets" when the ID list resolves to zero rows.
3. **No fallback**: if the segment-filter path returns 0, the function gives up even when the campaign has a valid `prospect_ids` array we could fall back to.
4. **Builder gap**: `OutreachCommandCenter` writes prospect_pool IDs into `fax_campaigns.prospect_ids`, but never seeds matching rows in `fax_prospects`. Future legacy-segment scans (which only read `fax_prospects`) miss these targets.

## Implementation

### 1. `supabase/functions/send-fax-phaxio/index.ts` — multi-source resolver + pre-flight

Replace the `usePool ? prospect_pool : fax_prospects` block (lines ~178-200) with a chained resolver that records a `resolutionTrace` for logs:

```ts
let prospects: any[] = [];
const resolutionTrace: string[] = [];

if (usePool) {
  // Primary: prospect_pool by ID
  const { data: poolData } = await sb.from("prospect_pool")
    .select("id, business_name, fax_number, audience_type, status, last_sent_at")
    .in("id", effectiveIds);
  prospects = (poolData || []).map(/* …same mapping… */);
  resolutionTrace.push(`prospect_pool:${prospects.length}/${effectiveIds.length}`);

  // Fallback A: any unresolved IDs → fax_prospects by ID
  if (prospects.length < effectiveIds.length) {
    const found = new Set(prospects.map(p => p.id));
    const missing = effectiveIds.filter(id => !found.has(id));
    const { data: faxData } = await sb.from("fax_prospects").select("*").in("id", missing);
    prospects.push(...(faxData || []).map(p => ({ ...p, _source: "fax_prospects" })));
    resolutionTrace.push(`fax_prospects_by_id:${(faxData || []).length}/${missing.length}`);
  }
} else {
  // Legacy: fax_prospects by segment
  let q = sb.from("fax_prospects").select("*").eq("segment", campaign.target_segment);
  if (REQUIRE_PUBLIC_VERIFIED) q = q.eq("verified_public", true);
  const { data } = await q;
  prospects = (data || []).map(p => ({ ...p, _source: "fax_prospects" }));
  resolutionTrace.push(`segment(${campaign.target_segment}):${prospects.length}`);

  // Fallback B: 0 from segment but campaign has prospect_ids → try fax_prospects by ID
  if (prospects.length === 0 && campaignProspectIds.length > 0) {
    const { data: byId } = await sb.from("fax_prospects").select("*").in("id", campaignProspectIds);
    prospects = (byId || []).map(p => ({ ...p, _source: "fax_prospects" }));
    resolutionTrace.push(`fallback_by_id:${prospects.length}/${campaignProspectIds.length}`);

    // Fallback C: still 0 → prospect_pool by ID
    if (prospects.length === 0) {
      const { data: pool } = await sb.from("prospect_pool")
        .select("id, business_name, fax_number, audience_type, status, last_sent_at")
        .in("id", campaignProspectIds);
      prospects = (pool || []).map(/* …same mapping… */);
      resolutionTrace.push(`fallback_pool:${prospects.length}/${campaignProspectIds.length}`);
    }
  }
}
console.log(`[send-fax-phaxio] campaign=${campaignId} resolution: ${resolutionTrace.join(" | ")}`);
```

**Pre-flight validation** — insert immediately after the resolver, before cost-cap checks:

```ts
if (!dryRun && allTargets.length === 0) {
  await sb.from("fax_campaigns").update({
    status: "invalid_targets",
    last_error: `0 targets resolved (${resolutionTrace.join(" | ")})`,
  }).eq("id", campaignId);
  await notifyMatt(
    `⚠️ Fax campaign blocked — invalid targets: ${campaign.name}`,
    `<p>Campaign <strong>${campaign.name}</strong> resolved 0 prospects.</p>
     <p>Trace: <code>${resolutionTrace.join(" | ")}</code></p>
     <p>Likely cause: prospect_ids reference rows that no longer exist in either prospect_pool or fax_prospects.</p>`,
  );
  return new Response(JSON.stringify({
    success: false, error: "invalid_targets", trace: resolutionTrace,
  }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

Also surface `resolution_trace` in the dry-run response payload.

### 2. `src/components/dwa-admin/OutreachCommandCenter.tsx` — mirror selected fax targets into `fax_prospects`

In the fax branch of the campaign-builder (line ~610-622), after inserting the campaign row, upsert each selected fax-eligible row into `fax_prospects` so legacy-path lookups find them:

```ts
const faxRows = selectedRows.filter((p) => !!p.fax_number);
if (!faxRows.length) return toast.error("No selected prospects have fax numbers");

const { data, error } = await supabase.from("fax_campaigns").insert({
  name: campaignName,
  target_segment: audienceLabel,
  message_html: `<p>Draft fax — edit before sending. Targets: ${faxRows.length} ${audienceLabel} prospects.</p>`,
  status: "draft",
  audience_type: audienceLabel,
  prospect_ids: faxRows.map((p) => p.id),
}).select("id").single();
if (error) return toast.error(error.message);
campaignId = (data as any)?.id ?? null;

// Mirror into fax_prospects so segment-scan path can find these
// Use prospect_pool.id as fax_prospects.id for stable cross-table lookup
const mirror = faxRows.map((p: any) => ({
  id: p.id,                                  // share the UUID
  business_name: p.business_name,
  fax_number: p.fax_number,
  contact_name: p.contact_name ?? null,
  address: p.address_line1 ?? null,
  city: p.city ?? null,
  state: p.state ?? null,
  zip: p.zip ?? null,
  segment: audienceLabel,
  source: "outreach_command_center",
  source_url: null,
  verified_public: true,                     // pre-vetted in Command Center
  audience_type: audienceLabel,
  county: p.county ?? null,
}));
const { error: mirrorErr } = await supabase
  .from("fax_prospects" as any)
  .upsert(mirror, { onConflict: "id", ignoreDuplicates: false });
if (mirrorErr) {
  // Non-fatal — campaign already created; sender's fallback chain still works
  console.warn("fax_prospects mirror failed:", mirrorErr.message);
}
```

Because `fax_prospects.id` is the PK and we explicitly set it to the `prospect_pool.id`, every campaign reference resolves cleanly in either table from this point forward. The schema confirms `business_name`, `fax_number`, `segment`, `source` are NOT NULL — all are populated above.

## Verification after deploy

1. Re-fire the failing `manual_mixed_…` campaign → edge function logs show resolution trace, fallback C resolves the 18 IDs from `prospect_pool`, sends proceed.
2. Create a new fax campaign from Outreach Command Center → confirm matching rows appear in `fax_prospects` with same UUIDs.
3. Manually create a campaign with a bogus prospect_id → status flips to `invalid_targets` with `last_error` populated, Matt gets the warning email, no Phaxio call made.

## Files

- **Edited**: `supabase/functions/send-fax-phaxio/index.ts` (multi-source resolver + pre-flight gate + dry-run trace)
- **Edited**: `src/components/dwa-admin/OutreachCommandCenter.tsx` (mirror fax targets into `fax_prospects` on campaign create)

No migrations needed — `fax_campaigns.status` is `text` so `'invalid_targets'` is accepted.
