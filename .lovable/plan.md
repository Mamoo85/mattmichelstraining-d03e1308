

## Live Form Tracker — Client-Side Bar Path Overlay

### What We're Building
A `<LiveFormTracker>` component that opens a full-screen camera overlay from within the Active Workout Zone. It uses the already-installed TensorFlow.js + MoveNet (same deps as `SmartCamera`) to track wrist keypoints in real-time and draws a bar path line on an HTML5 canvas overlay. Zero server cost — no video is uploaded or saved.

### Architecture
- Reuses the same TF.js + MoveNet pattern from `SmartCamera.tsx` (already in `package.json`)
- Tracks `left_wrist` and `right_wrist` keypoints, averages them as "bar position"
- Accumulates path points into a state array, draws on `<canvas>` each frame
- Line color: green if horizontal drift < threshold, red if exceeding threshold
- Privacy badge visible at all times: "Processing locally — video is not saved"

### Files

| File | Action |
|---|---|
| `src/components/workout/LiveFormTracker.tsx` | **Create** — Full-screen webcam + canvas overlay with MoveNet wrist tracking |
| `src/components/workout/ExerciseCard.tsx` | **Edit** — Add a small "Form Tracker" button (camera icon) that opens the tracker |
| `src/components/workout/ActiveWorkoutZone.tsx` | **Edit** — Add state + render for `LiveFormTracker` overlay |

### Component Design: `LiveFormTracker`

```text
┌─────────────────────────────┐
│  [X Close]    Form Tracker  │
│  ┌─────────────────────┐    │
│  │                     │    │
│  │   Webcam Feed       │    │
│  │   + Canvas Overlay  │    │
│  │   (bar path line)   │    │
│  │                     │    │
│  └─────────────────────┘    │
│  🔒 Processing locally.    │
│     Video is not saved.     │
│                             │
│  [Reset Path]  [Flip Cam]   │
└─────────────────────────────┘
```

**Key behaviors:**
- MoveNet SINGLEPOSE_LIGHTNING (fast, lightweight)
- `requestAnimationFrame` loop: detect pose → extract wrist midpoint → append to path array → redraw canvas
- Horizontal drift threshold: if abs(currentX - startX) > 15% of frame width → red line
- "Reset Path" button clears accumulated points for next rep
- "Flip Camera" toggles `facingMode` between `user` and `environment`
- Component unmount fully disposes detector + TF tensors

### Integration Points
- **ExerciseCard**: Small camera/crosshair icon button in the exercise header toolbar. Clicking dispatches a callback to the parent `ActiveWorkoutZone`.
- **ActiveWorkoutZone**: Holds `formTrackerOpen` state. When true, renders `<LiveFormTracker>` as a z-[110] overlay on top of the Zone.

