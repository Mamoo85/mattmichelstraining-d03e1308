// Tests for outreach-blocklist.ts — domain extraction and blocklist logic.
// isBlocked/recordOutreach are tested with a lightweight mock Supabase client.
// Run: deno test supabase/functions/_shared/outreach-blocklist.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isBlocked, recordOutreach } from "./outreach-blocklist.ts";

// ── Mock Supabase builder ────────────────────────────────────────────────────

interface MockRow {
  reason: string;
  blocked_until: string | null;
  phone?: string | null;
  email?: string | null;
  domain?: string | null;
  business_name?: string | null;
}

function mockSupabase(rows: MockRow[], queryError: string | null = null) {
  const insertedRows: unknown[] = [];
  return {
    _inserted: insertedRows,
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            or(_cond: string) {
              return {
                limit(_n: number) {
                  return Promise.resolve(
                    queryError
                      ? { data: null, error: { message: queryError } }
                      : { data: rows, error: null },
                  );
                },
              };
            },
          };
        },
        insert(row: unknown) {
          insertedRows.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

// ── isBlocked: no identifiers ────────────────────────────────────────────────

Deno.test("isBlocked: returns blocked=false when no identifiers provided", async () => {
  const sb = mockSupabase([]);
  const result = await isBlocked(sb, {});
  assertEquals(result.blocked, false);
});

Deno.test("isBlocked: returns blocked=false when all identifiers are null", async () => {
  const sb = mockSupabase([]);
  const result = await isBlocked(sb, { phone: null, email: null, business_name: null });
  assertEquals(result.blocked, false);
});

// ── isBlocked: not in blocklist ──────────────────────────────────────────────

Deno.test("isBlocked: returns blocked=false when DB returns empty rows", async () => {
  const sb = mockSupabase([]);
  const result = await isBlocked(sb, { phone: "+13139921219" });
  assertEquals(result.blocked, false);
});

// ── isBlocked: permanent block (blocked_until=null) ──────────────────────────

Deno.test("isBlocked: blocked=true for permanent block (blocked_until null)", async () => {
  const sb = mockSupabase([{
    reason: "paying_client",
    blocked_until: null,
    phone: "+13139921219",
  }]);
  const result = await isBlocked(sb, { phone: "+13139921219" });
  assertEquals(result.blocked, true);
  assertEquals(result.reason, "paying_client");
  assertEquals(result.matched_on, "phone");
});

// ── isBlocked: time-based block ───────────────────────────────────────────────

Deno.test("isBlocked: blocked=true when blocked_until is in the future", async () => {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const sb = mockSupabase([{
    reason: "recent_outreach",
    blocked_until: future,
    email: "test@example.com",
  }]);
  const result = await isBlocked(sb, { email: "test@example.com" });
  assertEquals(result.blocked, true);
  assertEquals(result.matched_on, "email");
});

Deno.test("isBlocked: blocked=false when blocked_until is in the past", async () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const sb = mockSupabase([{
    reason: "recent_outreach",
    blocked_until: past,
    phone: "+13139921219",
  }]);
  const result = await isBlocked(sb, { phone: "+13139921219" });
  assertEquals(result.blocked, false);
});

// ── isBlocked: matched_on field ───────────────────────────────────────────────

Deno.test("isBlocked: matched_on=domain when matched via domain derived from email", async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const sb = mockSupabase([{
    reason: "paying_client",
    blocked_until: future,
    domain: "example.com",
  }]);
  const result = await isBlocked(sb, { email: "owner@example.com" });
  assertEquals(result.blocked, true);
  assertEquals(result.matched_on, "domain");
});

Deno.test("isBlocked: matched_on=business_name when matched via business", async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const sb = mockSupabase([{
    reason: "paying_client",
    blocked_until: future,
    business_name: "acme corp",
  }]);
  const result = await isBlocked(sb, { business_name: "Acme Corp" });
  assertEquals(result.blocked, true);
  assertEquals(result.matched_on, "business_name");
});

// ── isBlocked: DB error fails open ────────────────────────────────────────────

Deno.test("isBlocked: returns blocked=false on DB error (fail-open)", async () => {
  const sb = mockSupabase([], "connection refused");
  const result = await isBlocked(sb, { phone: "+13139921219" });
  assertEquals(result.blocked, false);
});

// ── recordOutreach: no-op with empty identifiers ─────────────────────────────

Deno.test("recordOutreach: does nothing when all identifiers are null", async () => {
  const sb = mockSupabase([]);
  await recordOutreach(sb, { phone: null, email: null, business_name: null, agent: "test" });
  assertEquals(sb._inserted.length, 0);
});

// ── recordOutreach: inserts a 90-day cooldown row ────────────────────────────

Deno.test("recordOutreach: inserts a row with reason=recent_outreach", async () => {
  const sb = mockSupabase([]);
  await recordOutreach(sb, { phone: "+13139921219", agent: "tom-autonomous" });
  assertEquals(sb._inserted.length, 1);
  const row = sb._inserted[0] as Record<string, unknown>;
  assertEquals(row.reason, "recent_outreach");
  assertEquals(row.source_agent, "tom-autonomous");
  assertEquals(row.phone, "+13139921219");
});

Deno.test("recordOutreach: blocked_until is approximately 90 days from now", async () => {
  const sb = mockSupabase([]);
  const before = Date.now();
  await recordOutreach(sb, { email: "test@acme.com", agent: "test" });
  const after = Date.now();
  const row = sb._inserted[0] as Record<string, unknown>;
  const blockedUntil = new Date(row.blocked_until as string).getTime();
  const expected = 90 * 24 * 60 * 60 * 1000;
  assert(blockedUntil >= before + expected - 1000);
  assert(blockedUntil <= after + expected + 1000);
});

Deno.test("recordOutreach: extracts domain from email and stores it", async () => {
  const sb = mockSupabase([]);
  await recordOutreach(sb, { email: "boss@acme.com", agent: "test" });
  const row = sb._inserted[0] as Record<string, unknown>;
  assertEquals(row.domain, "acme.com");
  assertEquals(row.email, "boss@acme.com");
});

Deno.test("recordOutreach: normalises email to lowercase", async () => {
  const sb = mockSupabase([]);
  await recordOutreach(sb, { email: "BOSS@Acme.COM", agent: "test" });
  const row = sb._inserted[0] as Record<string, unknown>;
  assertEquals(row.email, "boss@acme.com");
});

// ── Domain extraction edge cases (via recordOutreach) ────────────────────────

Deno.test("recordOutreach: strips https:// prefix from domain", async () => {
  const sb = mockSupabase([]);
  await recordOutreach(sb, { domain: "https://acme.com/path", agent: "test" });
  const row = sb._inserted[0] as Record<string, unknown>;
  assertEquals(row.domain, "acme.com");
});

Deno.test("recordOutreach: strips www. prefix from domain", async () => {
  const sb = mockSupabase([]);
  await recordOutreach(sb, { domain: "www.acme.com", agent: "test" });
  const row = sb._inserted[0] as Record<string, unknown>;
  assertEquals(row.domain, "acme.com");
});
