

# Smart Auto-Capture Camera for Biomechanics Module

## Overview
Add a camera component with real-time pose detection that auto-captures a frame when the athlete is properly positioned, then hands it off to the existing `analyze-biomechanics` edge function.

## Important Consideration
TensorFlow.js + MoveNet is a **heavy dependency** (~15-20MB of model files downloaded at runtime). This is acceptable since the camera is admin-only and used on-demand. The model loads lazily when the camera is opened.

## Changes

### 1. Install dependencies
- `react-webcam` — camera feed
- `@tensorflow/tfjs` — TF runtime
- `@tensorflow-models/pose-detection` — MoveNet model

### 2. Create `src/components/admin/SmartCamera.tsx`
A self-contained camera component with:

**Camera Feed**: `react-webcam` with `facingMode: "environment"`, mirrored off, 720p resolution.

**Pose Overlay**: A translucent body outline SVG centered on the feed showing where the athlete should stand. Canvas overlay draws detected keypoints in real-time.

**Pose Detection Loop**: 
- Load MoveNet (SinglePose.Lightning — fastest variant) on mount
- Run detection every ~200ms on the video element
- Check if core keypoints (shoulders, hips, knees, ankles — 8 points) are all visible with confidence > 0.5 AND within the center 70% of the frame

**Auto-Capture Logic**:
- Track consecutive "aligned" frames. After 2 seconds of continuous alignment (~10 frames at 200ms), start a visible 3-2-1 countdown overlay
- During countdown, border turns green with a pulsing glow
- At 0, capture frame via `webcam.getScreenshot()`, freeze the feed

**Handoff**: 
- Display captured image with "Use This" / "Retake" buttons
- "Use This" converts the base64 to a Blob, uploads to `biomechanics_media` bucket, then calls the existing `analyze-biomechanics` edge function
- Props: `onCapture(file: File)` callback, `clientUserId: string`

### 3. Update `AdminBiomechanics.tsx`
- Add a "Smart Capture" button next to the existing file input
- When clicked, render `SmartCamera` in a full-screen dialog/drawer
- On capture, the same `handleUploadAndAnalyze` flow runs with the captured file
- Keep the manual file upload as a fallback option

### 4. Cleanup
- TF model is disposed on component unmount
- Camera stream is released on unmount
- Detection loop is cancelled via `requestAnimationFrame` cleanup

## Architecture
```text
┌─────────────────────────────┐
│   SmartCamera Component     │
│  ┌───────────────────────┐  │
│  │   react-webcam feed   │  │
│  │   + canvas overlay    │  │
│  │   + body outline SVG  │  │
│  └───────────────────────┘  │
│  MoveNet detection loop     │
│  → alignment check          │
│  → countdown → capture      │
│  → onCapture(file)          │
└──────────────┬──────────────┘
               │
    AdminBiomechanics.tsx
    handleUploadAndAnalyze(file)
               │
    analyze-biomechanics edge fn
```

## Files
- **New**: `src/components/admin/SmartCamera.tsx`
- **Edit**: `src/components/admin/AdminBiomechanics.tsx` (add Smart Capture button + dialog)
- **Edit**: `package.json` (add 3 dependencies)

## Scope
- No database changes
- No edge function changes
- Admin-only, lazy-loaded

