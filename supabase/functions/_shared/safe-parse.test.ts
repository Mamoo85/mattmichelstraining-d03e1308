// Sprint E — defensive parser tests. Every malformed shape should yield
// `{ ok: false, reason }` instead of throwing.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  asEmail,
  parseEnrichmentTrace,
  parseHunterDomainSearch,
  parseSnovDomainSearch,
  parseSnovVerifier,
  parseSnovToken,
  parseApolloMatch,
  parsePdlPersonEnrich,
  parsePdlPersonSearch,
  safeJson,
} from "./safe-parse.ts";

const garbage: unknown[] = [null, undefined, "", 0, false, [], {}, "string", 42, [1, 2, 3]];

Deno.test("asEmail rejects all garbage and lower-cases valid", () => {
  for (const g of garbage) assertEquals(asEmail(g), null);
  assertEquals(asEmail("Foo@Bar.COM"), "foo@bar.com");
  assertEquals(asEmail("not-an-email"), null);
  assertEquals(asEmail("a@b"), null);
  assertEquals(asEmail("x".repeat(260) + "@a.com"), null);
});

Deno.test("parseEnrichmentTrace coerces any input to safe array", () => {
  for (const g of garbage) {
    const r = parseEnrichmentTrace(g);
    assert(Array.isArray(r));
  }
  assertEquals(parseEnrichmentTrace([{ a: 1 }, "junk", null, { b: 2 }]).length, 2);
});

Deno.test("parseHunterDomainSearch handles every malformed shape", () => {
  for (const g of garbage) assertEquals(parseHunterDomainSearch(g).ok, false);
  assertEquals(parseHunterDomainSearch({ data: { emails: [{ value: "bad" }] } }).ok, false);
  const ok = parseHunterDomainSearch({
    data: { emails: [{ value: "ceo@acme.com", confidence: 90, first_name: "A", position: "CEO" }] },
  });
  assert(ok.ok);
  if (ok.ok) assertEquals(ok.value[0].email, "ceo@acme.com");
});

Deno.test("parseSnovDomainSearch handles v1 + v2 envelopes + bad rows", () => {
  for (const g of garbage) assertEquals(parseSnovDomainSearch(g).ok, false);
  const v1 = parseSnovDomainSearch({ emails: [{ email: "a@b.com", smtp_status: "valid" }] });
  assert(v1.ok && v1.value[0].confidence === 80);
  const v2 = parseSnovDomainSearch({ data: { emails: [{ email: "a@b.com", smtp_status: "unknown" }] } });
  assert(v2.ok && v2.value[0].confidence === 55);
});

Deno.test("parseSnovVerifier maps results", () => {
  assertEquals(parseSnovVerifier({ data: { result: "deliverable" } }).ok, true);
  assertEquals(parseSnovVerifier({ result: "risky" }).ok, true);
  assertEquals(parseSnovVerifier({}).ok, false);
});

Deno.test("parseSnovToken / parseApolloMatch / parsePdl* never throw", () => {
  for (const g of garbage) {
    assertEquals(parseSnovToken(g).ok, false);
    assertEquals(parseApolloMatch(g).ok, false);
    assertEquals(parsePdlPersonEnrich(g).ok, false);
    assertEquals(parsePdlPersonSearch(g).ok, false);
  }
  assert(parseSnovToken({ access_token: "abc", expires_in: 3600 }).ok);
  assert(parseApolloMatch({ person: { email: "x@y.com" } }).ok);
  assert(parsePdlPersonEnrich({ data: { work_email: "w@x.com" } }).ok);
  assert(parsePdlPersonSearch({ data: [{ work_email: "w@x.com" }] }).ok);
});

Deno.test("safeJson handles empty / non-JSON / valid bodies", async () => {
  const empty = await safeJson(new Response(""));
  assertEquals(empty.ok, false);
  const html = await safeJson(new Response("<html>nope</html>"));
  assertEquals(html.ok, false);
  const ok = await safeJson(new Response(JSON.stringify({ a: 1 })));
  assert(ok.ok);
});
