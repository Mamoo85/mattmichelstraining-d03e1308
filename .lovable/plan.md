## Build error root cause

```
fetch repository: git-remote fetch failed:
commit f5f65fffc036a47043386ed60c1e938e7bb82795 not found in any remote
```

The Lovable build infrastructure is trying to check out a specific commit SHA (`f5f65ff…`) that no longer exists on the remote. This happens when the branch history was rewritten (force-push, rebase, or a Lovable internal sync) after the build job recorded that SHA. The repo itself is fine — the build worker just has a stale pointer.

This is **not** a code bug. Nothing in `src/`, `supabase/`, or config is broken. No file edit will fix it directly.

## Fix

The reliable fix is to force the build worker to refresh its commit pointer by producing a new HEAD commit. The simplest, lowest-risk way to do that inside Lovable is a no-op edit on a single safe file.

### Step 1 — Trigger a fresh commit
Append a dated marker line to `RESTORE_POINT.md` (a doc-only file, not referenced by any build/runtime code):

```
<!-- build-refresh: 2026-05-06 -->
```

That's the entire change. It updates HEAD to a new SHA that exists on the remote, and the next build will fetch successfully.

### Step 2 — Verify
After the commit lands, the next preview/publish build should fetch cleanly. If the same stale-SHA error appears again with a *different* SHA, that indicates a Lovable infra issue (not repo state) and the right action is to retry the build or contact Lovable support — no further code change will help.

## What this plan deliberately does NOT do

The user message bundles ~60 unrelated feature requests (A/B testing, trial auditors, enrichment dashboards, DJ Conley proposal v2, click-tracking tables, etc.). Those are large multi-day epics and are **out of scope** for unblocking the build. Once the build is green, we can scope those as separate plans — happy to start with the highest-priority one (my recommendation: the trial-link end-to-end auditor + StartTrial alias normalization, since broken trial CTAs are the most revenue-impacting item in the list).

Approve and I'll make the one-line edit to unblock the build, then ask which feature epic to tackle next.