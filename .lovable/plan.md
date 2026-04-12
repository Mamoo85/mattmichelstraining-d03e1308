

# Fixing Findings 5, 7, and 8

Finding 6 is **already resolved** — the `trg_email_to_comms_log` trigger exists on `email_send_log`, and both `system_comms_log` and `email_send_log` tables are in the database. No action needed.

---

## Finding 5: Add `ADMIN_PHONE` Secret

The hardcoded fallback `+13138064952` is fine as a safety net, but the env var should actually be set so it's configurable without code changes.

**Action**: Use the `add_secret` tool to set `ADMIN_PHONE` = `+13138064952`. This makes it explicit in the secrets list and changeable later without redeploying code. No code changes needed — the existing `??` fallback pattern is correct.

---

## Finding 7: Stripe `expires_at` Buffer

Add a 30-second buffer to prevent edge-case rejections when the Stripe API receives the request slightly after the 30-minute minimum.

**File**: `supabase/functions/create-contractor-ppl-checkout/index.ts`

Change line 107 from:
```ts
expires_at: Math.floor(now.getTime() / 1000) + 1800,
```
To:
```ts
expires_at: Math.floor(Date.now() / 1000) + 1830, // 30.5 min — buffer for network latency
```

Using `Date.now()` instead of the stale `now` variable ensures freshest timestamp. The extra 30 seconds prevents Stripe from rejecting sessions that arrive a few seconds late.

---

## Finding 8: PPL Lock Race Condition

Replace the two-step read-then-update with an atomic `UPDATE ... WHERE` that only succeeds if the lead is still available. This eliminates the TOCTOU window entirely.

**File**: `supabase/functions/create-contractor-ppl-checkout/index.ts`

Replace the current flow (read lead → check status → separate update) with:

1. First, fetch the lead for display info (trade, city) — keep existing SELECT.
2. Replace the separate lock-acquisition UPDATE (lines 84-88) with an atomic conditional update:

```ts
// Atomic lock: only succeeds if lead is still available
const { data: locked, error: lockErr } = await sb
  .from("contractor_leads")
  .update({
    status: "pending_checkout",
    checkout_locked_by: contractor_id,
    lock_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })
  .eq("id", lead_id)
  .neq("status", "sold")
  .or(`checkout_locked_by.is.null,checkout_locked_by.eq.${contractor_id},lock_expires_at.lt.${new Date().toISOString()}`)
  .select("id")
  .maybeSingle();

if (!locked) {
  return new Response(
    JSON.stringify({ error: "lead_claimed", redirect: "/lead-claimed" }),
    { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

This ensures only one contractor can acquire the lock — the UPDATE only matches rows that are not sold AND either unlocked, locked by the same contractor, or have an expired lock.

---

## Summary

| Finding | Action | Risk |
|---------|--------|------|
| 5 — Hardcoded phone | Add `ADMIN_PHONE` secret | Zero risk |
| 6 — Email trigger | **Already fixed** — no action | N/A |
| 7 — Stripe expiry | Use `Date.now()` + 1830s buffer | Zero risk |
| 8 — Race condition | Atomic conditional UPDATE | Low risk, big safety gain |

### Deploy
After code changes, redeploy `create-contractor-ppl-checkout`.

