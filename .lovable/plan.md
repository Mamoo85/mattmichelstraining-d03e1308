I found the issue: this Lovable session is attached to project `0b29f43e-9e42-4097-9d97-f85f419ccc8e`, whose current git remote is Lovable’s private repo, and its latest visible commit is `7c1fe6ae5 Updated PWA asset versions`. The PR #448 edge functions you named (`dwa-ad-factory`, `dwa-ad-renderer`) are not present here, so I am likely looking at the Lovable mirror/project repo, not the GitHub repo/branch where Claude Code just merged that work.

Recommended recovery plan:

1. Protect the Claude Code work first
   - In Claude Code, confirm the GitHub repo URL, current branch, and latest commit for PR #448.
   - Do not overwrite or reconnect anything until you know where that code lives.

2. Identify the “new git” you noticed
   - Check whether Lovable created/attached a new private git remote or whether Claude Code is using `mamoo85/m2training` directly.
   - Compare commit history: the repo I can see ends at the M2 logo/PWA work, not the AI voiceover work.

3. Bring the missing code into this Lovable project
   - Best option: paste the GitHub PR/commit URL or the branch name here.
   - I can then locate/copy the exact files or you can upload/paste the two function files if this Lovable project cannot access that GitHub repo.

4. Verify before deploying
   - Once the files exist in this project, I’ll verify `supabase/functions/dwa-ad-factory/index.ts` and `supabase/functions/dwa-ad-renderer/index.ts` are actually present and contain the voiceover changes.

5. Deploy/test only after repo alignment
   - Deploy the two backend functions.
   - Run the dry run `{ "dryRun": true, "productIndex": 3 }` and confirm `voiceoverScript`.
   - Run the full `{ "force": true, "productIndex": 3 }`, confirm `audioUrl` and `mp4Url`, download the MP4, and inspect for an audio track.

What you should do now: send me the GitHub repo/PR link or latest Claude Code commit SHA for PR #448. If you can, also paste the output from Claude Code of `git remote -v`, `git branch --show-current`, and `git log --oneline -5`.