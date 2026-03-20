

## Haptic Feedback & Micro-Animations on Set Completion

### What Changes

**ExerciseCard.tsx** — Add three effects when a set is completed:

1. **Haptic feedback**: Call `navigator.vibrate(50)` on set complete (short pulse). Falls back silently on unsupported devices.

2. **Checkmark pulse animation**: When a set is marked complete, the check button gets a CSS keyframe "pop" — scale up to 1.3 then back to 1.0 with a brief glow burst. Managed via a `justCompleted` state that clears after 600ms.

3. **Confetti burst on last set**: When the final set in an exercise is completed, spawn ~20 tiny colored particles that shoot outward from the button using absolutely-positioned `<span>` elements with randomized trajectories. Auto-cleanup after 1 second. Lightweight CSS-only animation, no external library.

**tailwind.config.ts** — Add two keyframes:
- `set-pop`: scale 1→1.3→1 with opacity pulse (400ms)  
- `confetti-burst`: translate + rotate + fade out (800ms)

### Files Modified
- `src/components/workout/ExerciseCard.tsx`
- `tailwind.config.ts`

