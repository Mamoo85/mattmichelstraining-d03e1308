// Talent Ingest — provenance.ts
import type { ProvenanceEntry } from "./types.ts";

export function appendProvenance(
  existing: ProvenanceEntry[] | null | undefined,
  incoming: ProvenanceEntry,
): ProvenanceEntry[] {
  const arr = Array.isArray(existing) ? existing : [];
  const dup = arr.some(
    (e) =>
      e.source === incoming.source &&
      (e.source_record_id ?? null) === (incoming.source_record_id ?? null),
  );
  if (dup) return arr;
  return [...arr, incoming];
}
