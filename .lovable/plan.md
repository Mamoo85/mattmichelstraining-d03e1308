

## Plan: Timer Enhancements, AI Queue Fix, and Domain Clarification

### 1. Interval Timer — Visual & Feature Upgrades

**A. Inner Round Warning Sound**
Add a configurable "warning" setting (default: 10 seconds) that plays a distinct alert beep partway through each work phase — alerting the user that the round is about to end. New config field `warning` added to `TimerConfig`. In the `tick()` function, when `phase === "work"` and `secondsLeft === warning`, fire a new `warningBeep()` sound + vibration.

**B. Sound Picker Dropdown (~20 options)**
Add a sound theme selector to the setup screen. Each theme defines different frequencies/patterns for countdown, work, rest, warning, and complete sounds. Themes include: Classic Beep, Boxing Bell, Whistle, Air Horn, Buzzer, Digital Chime, Military, Arcade, Zen Bowl, Stadium Horn, Double Tap, Siren Pulse, Xylophone, Drum Roll, Synth Wave, Metal Clang, Cricket, Foghorn, Laser, and Sonar Ping. All synthesized via Web Audio API (no external files needed). Stored as a `soundTheme` state with a `<select>` dropdown in the controls area.

**C. Completion Screen — Coach Matt Motivational Messaging**
Replace the simple "All X rounds complete" text with a richer done screen featuring:
- Randomized "atta boy" messages in Coach Matt's voice (e.g., "Beast mode. That's how it's done.", "Crushed it. No shortcuts, no excuses.")
- A training philosophy callout: "Next session — flip the script. Go from endurance to strength. Balance builds champions."
- M2 logo displayed on the completion screen

**D. Minor Visual Polish**
- Keep the existing dark theme with orange accent
- Ensure the M2 logo appears in the header bar
- Keep the existing layout largely the same — it's already solid

### 2. AI Copilot Queue — Auto-Approve Non-User-Facing Results

The "AI_COPILOT" entries in the approval queue are from the admin-only performance analysis tool. It analyzes athlete data for stagnation and ghost trials. Since this is purely an admin insight tool (not sent to users), these results should NOT be queued for approval.

**Fix**: In `supabase/functions/ai-admin-assist/index.ts`, add `ai_copilot` to a list of action types that skip the queue and return results directly. This prevents empty/confusing queue entries. Other admin-only types like `blog_draft`, `generate_ad`, `client_summary` will also be auto-returned since you review them manually in their respective UI panels anyway.

### 3. Domain Clarification

The screenshot shows the invite link going to `mattmichelstraining.lovable.app` — this is the default staging subdomain. If you own `mattmichelstraining.com`, connecting that custom domain would be more professional and trustworthy for clients. You can set this up in Project Settings → Domains. The `.lovable.app` URL will continue to work but would redirect to your custom domain once configured. I'll include a note about this in my response but no code changes needed.

### Files to Modify
- **`src/components/workout/useTimerAudio.ts`** — Add `warningBeep()` export + sound theme system with ~20 synthesized themes
- **`src/components/workout/IntervalTimer.tsx`** — Add warning config, sound theme dropdown, richer done screen with Coach Matt messaging and logo
- **`supabase/functions/ai-admin-assist/index.ts`** — Skip queue for `ai_copilot`, `blog_draft`, `generate_ad`, `client_summary`, `schedule_suggest` action types (return directly)

### Technical Details
- Sound themes are pure Web Audio API synthesis — different oscillator frequencies, waveforms, and timing patterns per theme. No external audio files.
- Warning alert triggers at a configurable number of seconds before the work phase ends.
- The AI queue bypass uses a simple `Set` check before the insert logic — types in the skip list return `{ result }` instead of `{ queued: true, result }`.

