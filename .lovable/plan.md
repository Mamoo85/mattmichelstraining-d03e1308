

# Build Error Fix Plan

All errors fall into 5 patterns. Here's the fix for each.

---

## Error Pattern 1: `.then().catch()` on PromiseLike (2 files)

**File**: `create-contractor-ppl-checkout/index.ts` — lines 52 and 76

Same bug we fixed in `_shared/twilio.ts`. Wrap in `Promise.resolve()`.

```ts
// Before
}).then(() => {}).catch(() => {});
// After  
}); // fire-and-forget, no .then/.catch needed — just drop the chain
```

Actually the simplest fix: just remove `.then(() => {}).catch(() => {})` entirely since these are fire-and-forget inserts where we don't care about the result.

---

## Error Pattern 2: Duplicate `bcc` property (4 files)

**Files**: `financial-advisor-content-sender`, `franchise-ops-sender`, `grant-finder-sender`, `handbook-sender`

All have the same bug — two `bcc` keys in the same object literal:
```ts
to: [client.email], bcc: ["matthewmichels4@gmail.com"],
subject: `...`,
bcc: ["matthewmichels@gmail.com"],  // DUPLICATE — delete this line
```

Fix: Remove the duplicate `bcc` line in each file, keep the first one (`matthewmichels4@gmail.com`).

---

## Error Pattern 3: `fitness-report-generator` type errors (1 file)

The function signature `sendReminderToTrainers(sb: ReturnType<typeof createClient>)` causes a type mismatch because the generic `createClient()` call at line 93 produces `SupabaseClient<any, "public", ...>` while the function expects the bare return type.

Fix: Change the parameter type to `sb: any` (these are internal service functions, not public APIs — strict typing adds no value here). This resolves all 7 errors in one change.

---

## Error Pattern 4: `free-report-drip` unknown error type (1 file)

Line 246: `e.message` used after `catch (e: unknown)` but then accessing `.message` without narrowing.

Fix: Change `e.message` to `msg` (the `msg` variable is already declared on line 245 as `const msg = e instanceof Error ? e.message : String(e)`).

---

## Error Pattern 5: `han-upsell` SupabaseClient type mismatch (1 file)

Same pattern as fitness-report-generator. Functions `isSubscriber` and `alreadyInSequence` use `ReturnType<typeof createClient>` which doesn't match the actual client instance.

Fix: Change both function signatures to accept `sb: any`.

---

## Summary

| File | Fix |
|------|-----|
| `create-contractor-ppl-checkout/index.ts` | Remove `.then().catch()` on 2 fire-and-forget inserts |
| `financial-advisor-content-sender/index.ts` | Delete duplicate `bcc` line |
| `franchise-ops-sender/index.ts` | Delete duplicate `bcc` line |
| `grant-finder-sender/index.ts` | Delete duplicate `bcc` line |
| `handbook-sender/index.ts` | Delete duplicate `bcc` line |
| `fitness-report-generator/index.ts` | Change param type to `any` |
| `free-report-drip/index.ts` | Use `msg` instead of `e.message` |
| `han-upsell/index.ts` | Change param types to `any` |

8 files, all one-line fixes. No logic changes — purely type/syntax corrections.

