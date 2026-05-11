// Deno unit tests for canonical QA validator.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateCandidate } from "./canonical-qa.ts";

const baseMapping = {
  entity_type: "place" as const,
  event_category: "permit" as const,
  scope: "address" as const,
  default_score: 7,
};

Deno.test("rejects rows missing scope-required address", () => {
  const res = validateCandidate({ zip: "48226", occurred_at: new Date().toISOString() }, baseMapping);
  assertEquals(res.ok, false);
  assertEquals(res.severity, "reject");
  assert(res.reasons.includes("missing_address_for_scope"));
});

Deno.test("rejects rows with invalid email", () => {
  const res = validateCandidate(
    { address: "123 Main", city: "Detroit", state: "MI", zip: "48226", email: "not-an-email", occurred_at: new Date().toISOString() },
    baseMapping,
  );
  assertEquals(res.ok, false);
  assert(res.reasons.includes("invalid_email"));
});

Deno.test("rejects future-dated events (>24h ahead)", () => {
  const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const res = validateCandidate(
    { address: "1 Woodward", city: "Detroit", state: "MI", zip: "48226", occurred_at: future },
    baseMapping,
  );
  assertEquals(res.ok, false);
  assert(res.reasons.includes("future_occurred_at"));
});

Deno.test("rejects invalid lat/lon out of range", () => {
  const res = validateCandidate(
    { address: "1 Woodward", zip: "48226", lat: 200, lon: 0, occurred_at: new Date().toISOString() },
    baseMapping,
  );
  assertEquals(res.ok, false);
  assert(res.reasons.includes("invalid_lat"));
});

Deno.test("rejects invalid zip / state formats", () => {
  const res = validateCandidate(
    { address: "1 Woodward", city: "Detroit", state: "Michigan", zip: "ABCDE", occurred_at: new Date().toISOString() },
    baseMapping,
  );
  assertEquals(res.ok, false);
  assert(res.reasons.includes("invalid_zip"));
  assert(res.reasons.includes("invalid_state"));
});

Deno.test("warns (quarantines) low-completeness permit rows", () => {
  // Just the scope minimum — passes schema but below 35% permit floor
  const res = validateCandidate(
    { address: "1 Woodward", occurred_at: new Date().toISOString() },
    baseMapping,
  );
  assertEquals(res.ok, false);
  assertEquals(res.severity, "warn");
  assert(res.reasons.some((r) => r.startsWith("low_completeness_")));
});

Deno.test("passes a complete permit row", () => {
  const res = validateCandidate(
    {
      address: "1 Woodward Ave",
      city: "Detroit",
      state: "MI",
      zip: "48226",
      county: "Wayne",
      external_id: "PERMIT-2026-0001",
      title: "ROOF REPLACEMENT",
      occurred_at: new Date().toISOString(),
      estimated_value: 18500,
      url: "https://example.gov/permit/1",
    },
    baseMapping,
  );
  assertEquals(res.ok, true);
  assertEquals(res.severity, "pass");
  assert(res.completeness >= 35);
});

Deno.test("person entity needs name or email", () => {
  const res = validateCandidate(
    { phone: "313-555-1212" },
    { entity_type: "person", event_category: "enrichment", scope: "company", default_score: 5 },
  );
  assertEquals(res.ok, false);
  assert(res.reasons.includes("missing_person_identity"));
});

Deno.test("area entity accepts zip-only", () => {
  const res = validateCandidate(
    { zip: "48226", state: "MI", title: "Severe thunderstorm watch", occurred_at: new Date().toISOString() },
    { entity_type: "area", event_category: "weather", scope: "zip", default_score: 6 },
  );
  assertEquals(res.ok, true);
});

Deno.test("rejects negative estimated_value", () => {
  const res = validateCandidate(
    { address: "1 Woodward", zip: "48226", estimated_value: -100, occurred_at: new Date().toISOString() },
    baseMapping,
  );
  assertEquals(res.ok, false);
  assert(res.reasons.includes("invalid_estimated_value"));
});
