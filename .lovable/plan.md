

## Dual FAB: Hold-and-Slide to Timer or Coach Chat

Replace the current floating "Ask Coach Matt" bubble with a single FAB that reveals two radial options on long-press. The user holds the button, then slides their finger/cursor to either the **Timer** icon or the **Chat** icon to activate one.

### How It Works (UX)

```text
       (resting state)
           [M²]          ← single FAB, bottom-right

       (long-press / hold)
    [⏱ Timer]            ← slides up-left
           [M²]          ← origin, pulsing
    [💬 Chat]            ← slides up-right

  User drags toward one → that feature activates
  Release without target → menu closes
```

### Technical Plan

**1. Create `DualFab.tsx`** (`src/components/dashboard/DualFab.tsx`)
- Single floating button (bottom-right, `fixed`, same position as current `AskCoachBubble`)
- On `pointerdown` + 300ms hold, expand two arc options (Timer icon top-left, Chat icon top-right) with a spring animation
- Track `pointermove` to highlight whichever option the pointer is nearest
- On `pointerup`:
  - If over Timer → call `toggleTimer()` from the existing `useTimer` hook (opens the global `IntervalTimer`)
  - If over Chat → set state to open the existing `AskCoachBubble` chat panel inline
  - If over neither → collapse menu, no action
- Tap (no hold) → default to opening the coach chat (preserves current quick-tap behavior)
- Uses CSS transforms + transitions for the radial reveal — no animation library needed
- Haptic feedback via `navigator.vibrate` on expand and selection (already used in IntervalTimer)

**2. Inline the chat panel from `AskCoachBubble`**
- Extract the chat panel JSX from `AskCoachBubble` into the `DualFab` component (or render `AskCoachBubble`'s panel conditionally)
- Keep all existing chat logic (fetch drafts, send question, display approved answers) unchanged

**3. Update `Dashboard.tsx`**
- Replace `<AskCoachBubble />` with `<DualFab />`
- Import `useTimer` is already available via context in the tree

**4. Files changed**
| File | Change |
|---|---|
| `src/components/dashboard/DualFab.tsx` | New — dual FAB with hold-and-slide gesture |
| `src/components/dashboard/AskCoachBubble.tsx` | Export the chat panel as a separate sub-component, or keep and render from DualFab |
| `src/pages/Dashboard.tsx` | Swap `AskCoachBubble` → `DualFab` |

No changes to `IntervalTimer`, `useTimer`, or `App.tsx` — the FAB just calls the existing `toggleTimer()` to open the global timer overlay.

