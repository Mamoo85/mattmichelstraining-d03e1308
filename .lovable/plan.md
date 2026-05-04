## Deploy mortgage-radar-am-digest + trigger today's email

Claude (in your other tool) confirmed: the `last_signal_at` fix is committed to the repo but not live, because Lovable only auto-deploys functions Lovable itself touches — external git commits sit dormant. I can deploy it directly.

### Steps

1. **Deploy `mortgage-radar-am-digest`** using the latest code from the repo (the version that queries `last_signal_at >= since24h` and includes the 7-day tier-3 fallback + per-client debug traces).

2. **Trigger today's digest** by POSTing to the function and report back the response (`digests_sent`, `client_traces` per client, `outcome`, `resend_response`).

3. **Confirm result**: you should see `digests_sent: 1` (or up to 3 depending on active clients) with `outcome: "email_sent"` for each mortgage radar client.

### Notes

- No code changes needed — the fix is already in `supabase/functions/mortgage-radar-am-digest/index.ts` on `main`.
- This unblocks today's email without waiting on the GitHub Actions / PAT situation.
- Future Claude commits to other edge functions will still need a "please deploy X" nudge until you generate a Lovable-org-scoped PAT (the long-term fix Claude described).

Approve and I'll deploy + trigger immediately.