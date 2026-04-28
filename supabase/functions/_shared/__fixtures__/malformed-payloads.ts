// Versioned malformed-payload corpus for smoke-testing enrichment edge functions.
// Any new edge function should adopt this battery in one import to verify it
// never throws unhandled, never mutates DB on bad input, and always returns
// a structured JSON error.
//
// Sprint K — Enhancement #1: shared fixtures library.

export interface MalformedCase {
  name: string;
  // Body to send (string => raw, otherwise JSON.stringify'd by the test runner)
  body: string | Record<string, unknown> | null;
  // Headers to send (defaults to application/json)
  headers?: Record<string, string>;
  // What we expect: function must NOT 500 with an unhandled crash.
  // Acceptable outcomes are 400 (validation), 404 (not found), or 500 with
  // a JSON error body — anything but a thrown stack trace.
  expectStatusOneOf: number[];
  // Description (printed in test output)
  description: string;
}

export const MALFORMED_PROSPECT_PAYLOADS: MalformedCase[] = [
  {
    name: "empty_body",
    body: "",
    expectStatusOneOf: [400, 500],
    description: "Empty request body should be rejected cleanly",
  },
  {
    name: "null_body",
    body: null,
    expectStatusOneOf: [400, 500],
    description: "Null body should not crash json parsing",
  },
  {
    name: "non_json_body",
    body: "<html>nope</html>",
    expectStatusOneOf: [400, 500],
    description: "HTML body should not crash json parsing",
  },
  {
    name: "truncated_json",
    body: '{"prospect_id": "abc',
    expectStatusOneOf: [400, 500],
    description: "Truncated JSON should not crash",
  },
  {
    name: "wrong_type_for_id",
    body: { prospect_id: 12345 },
    expectStatusOneOf: [400, 404, 500],
    description: "Number where string expected",
  },
  {
    name: "array_instead_of_object",
    body: "[]",
    expectStatusOneOf: [400, 500],
    description: "Array body when object expected",
  },
  {
    name: "missing_required_field",
    body: { foo: "bar" },
    expectStatusOneOf: [400, 500],
    description: "Missing prospect_id",
  },
  {
    name: "oversized_string",
    body: { prospect_id: "x".repeat(100_000) },
    expectStatusOneOf: [400, 404, 500],
    description: "100KB string field should not crash",
  },
  {
    name: "null_prospect_id",
    body: { prospect_id: null },
    expectStatusOneOf: [400, 500],
    description: "Explicit null id",
  },
  {
    name: "deeply_nested_garbage",
    body: { prospect_id: { nested: { deeply: ["bad"] } } },
    expectStatusOneOf: [400, 500],
    description: "Nested object where string expected",
  },
  {
    name: "sql_injection_attempt",
    body: { prospect_id: "'; DROP TABLE contractor_outreach_prospects; --" },
    expectStatusOneOf: [400, 404, 500],
    description: "SQL injection string — should be safely rejected by typed client",
  },
  {
    name: "prototype_pollution_attempt",
    body: { __proto__: { polluted: true }, prospect_id: "test" },
    expectStatusOneOf: [400, 404, 500],
    description: "Prototype pollution attempt",
  },
];

export const MALFORMED_STATEWIDE_PAYLOADS: MalformedCase[] = [
  {
    name: "empty_body",
    body: "",
    expectStatusOneOf: [200, 400], // statewide-enrich tolerates empty body (uses defaults)
    description: "Empty body uses defaults",
  },
  {
    name: "negative_limit",
    body: { limit: -100 },
    expectStatusOneOf: [200, 400],
    description: "Negative limit should be clamped or rejected",
  },
  {
    name: "huge_limit",
    body: { limit: 1_000_000 },
    expectStatusOneOf: [200, 400],
    description: "Huge limit should be clamped",
  },
  {
    name: "tiers_wrong_type",
    body: { tiers: "primary" }, // should be array
    expectStatusOneOf: [200, 400, 500],
    description: "Tiers as string instead of array",
  },
  {
    name: "max_seconds_string",
    body: { max_seconds: "ninety" },
    expectStatusOneOf: [200, 400, 500],
    description: "Non-numeric max_seconds",
  },
  {
    name: "non_json_body",
    body: "garbage",
    expectStatusOneOf: [200, 400, 500],
    description: "Non-JSON body should fall back to defaults or error cleanly",
  },
];

// Mock provider responses — fed to safe-parse to verify parsers never throw.
export const MALFORMED_PROVIDER_RESPONSES: unknown[] = [
  null,
  undefined,
  "",
  "<html>error page</html>",
  "{partial json",
  [],
  { data: null },
  { data: { emails: null } },
  { data: { emails: [null, undefined, 1, "string"] } },
  { data: { emails: [{ value: null }, { value: 12345 }, { value: "not-an-email" }] } },
  { data: { emails: [{ value: "x".repeat(500) + "@example.com" }] } }, // oversized
  { data: { emails: [{ value: "valid@example.com", confidence: "high" }] } }, // wrong type for confidence
  { person: null },
  { person: { email: null } },
  { person: { email: "javascript:alert(1)" } }, // injection attempt
];
