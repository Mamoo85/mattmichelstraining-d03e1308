

# Fix Admin Panel Freezing — Sequential Query Bottleneck

## Root Cause

The "Page Unresponsive" freeze is caused by **sequential database queries in a for-loop** inside two admin components:

- **AdminOpsCenter.tsx** — loops through **82 service tables**, awaiting each query one at a time (~82 sequential HTTP round-trips)
- **AdminClientHealth.tsx** — loops through **41 service tables** the same way (~41 sequential round-trips)

Each query takes ~100-300ms. Sequentially, that's **8-25 seconds of blocking** inside a single `queryFn`. The browser's main thread can't process user interactions (like clicking "Demo Links") while this waterfall is running, causing the "Page Unresponsive" dialog.

Secondary issue: all 80+ admin components use plain `lazy()` instead of the project's `lazyRetry()` pattern, which can cause chunk-load crashes.

## Plan

### 1. Parallelize AdminOpsCenter queries (82 → batched)
Convert the sequential `for (const svc of ALL_SERVICES) { await ... }` loop into batched `Promise.all()` — groups of 15 concurrent queries instead of 82 sequential ones. This drops the total time from ~20s to ~2s.

### 2. Parallelize AdminClientHealth queries (41 → batched)  
Same fix: convert the sequential for-loop into batched `Promise.all()` chunks.

### 3. Switch Admin.tsx lazy imports to lazyRetry()
Replace all ~80 plain `lazy()` calls with `lazyRetry()` from `@/lib/lazyRetry` to match the project standard and prevent chunk-load crashes.

### 4. Audit other sequential-query components
Check `AdminMediaVault` (sequential storage bucket listing), `AdminCommandDeck` (sequential AI triage), and `AdminM2GrowthHub` (sequential enrollment) for similar patterns — add batching where needed during data fetching.

## Files Changed
- `src/components/admin/AdminOpsCenter.tsx` — batch queries with `Promise.all()`
- `src/components/admin/AdminClientHealth.tsx` — batch queries with `Promise.all()`
- `src/pages/Admin.tsx` — switch `lazy()` → `lazyRetry()` for all imports

## Technical Detail

```text
BEFORE (blocks for ~20s):
  query table 1 → wait → query table 2 → wait → ... → query table 82 → wait → done

AFTER (completes in ~2s):
  batch 1: [table 1..15] → all in parallel → wait
  batch 2: [table 16..30] → all in parallel → wait
  ...
  batch 6: [table 76..82] → all in parallel → wait → done
```

