import { assertEquals, assert, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildFingerprint } from "./fingerprint.ts";
import { normalize } from "./normalize.ts";

Deno.test("fingerprint — deterministic for same license", async () => {
  const raw = { source: "s", full_name: "Jane Smith", license_type: "RN", license_number: "rn-123" };
  const a = await buildFingerprint(normalize(raw), raw);
  const b = await buildFingerprint(normalize(raw), raw);
  assertEquals(a, b);
  assert(a && a.length === 32);
});

Deno.test("fingerprint — license priority over email/phone", async () => {
  const r1 = { source: "s", full_name: "Jane", license_type: "RN", license_number: "X1", email: "a@b.com", phone: "3135551234" };
  const r2 = { source: "s", full_name: "Jane", license_type: "RN", license_number: "X1", email: "different@x.com", phone: "9995551234" };
  const a = await buildFingerprint(normalize(r1), r1);
  const b = await buildFingerprint(normalize(r2), r2);
  assertEquals(a, b);
});

Deno.test("fingerprint — different licenses → different fingerprints", async () => {
  const r1 = { source: "s", full_name: "Jane", license_type: "RN", license_number: "A1" };
  const r2 = { source: "s", full_name: "Jane", license_type: "RN", license_number: "A2" };
  const a = await buildFingerprint(normalize(r1), r1);
  const b = await buildFingerprint(normalize(r2), r2);
  assertNotEquals(a, b);
});

Deno.test("fingerprint — falls back to email then phone then name+trade+state", async () => {
  const r1 = { source: "s", full_name: "Jane Doe", email: "Jane@Example.com" };
  const r2 = { source: "s", full_name: "Jane Doe", phone: "(313) 555-1234" };
  const r3 = { source: "s", full_name: "Jane Doe", trade: "RN", state: "MI" };
  assert(await buildFingerprint(normalize(r1), r1));
  assert(await buildFingerprint(normalize(r2), r2));
  assert(await buildFingerprint(normalize(r3), r3));
});

Deno.test("fingerprint — no keys → null", async () => {
  const raw = { source: "s", full_name: "Jane Doe" };
  const fp = await buildFingerprint(normalize(raw), raw);
  assertEquals(fp, null);
});

Deno.test("fingerprint — email case-insensitive", async () => {
  const r1 = { source: "s", full_name: "X", email: "Foo@Bar.COM" };
  const r2 = { source: "s", full_name: "X", email: "foo@bar.com" };
  assertEquals(await buildFingerprint(normalize(r1), r1), await buildFingerprint(normalize(r2), r2));
});
