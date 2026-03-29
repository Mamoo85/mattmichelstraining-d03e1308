import { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm";
import * as poseDetection from "@tensorflow-models/pose-detection";
import { Button } from "@/components/ui/button";
import { X, RotateCcw, SwitchCamera, Shield, Loader2, Zap, TrendingUp } from "lucide-react";

const MIN_CONFIDENCE = 0.4;
const FRAME_WINDOW = 5; // frames to average velocity over

interface VelocityPoint {
  x: number;
  y: number;
  t: number; // timestamp ms
  velocity: number; // px/sec
}

interface VelocityTrackerProps {
  exerciseTitle: string;
  onClose: () => void;
}

const VelocityTracker = ({ exerciseTitle, onClose }: VelocityTrackerProps) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointsRef = useRef<VelocityPoint[]>([]);
  const repVelocitiesRef = useRef<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("Loading pose model…");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [currentVelocity, setCurrentVelocity] = useState(0);
  const [peakVelocity, setPeakVelocity] = useState(0);
  const [avgVelocity, setAvgVelocity] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState<"concentric" | "eccentric" | "idle">("idle");

  // Detect rep phases based on Y direction changes
  const lastDirectionRef = useRef<"up" | "down" | null>(null);
  const directionFramesRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        await tf.setBackend("webgl");
        await tf.ready();
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        );
        if (cancelled) { detector.dispose(); return; }
        detectorRef.current = detector;
        setLoading(false);
        setStatusText("Tracking active");
      } catch (err) {
        console.error("Velocity tracker model failed:", err);
        // Fall back to WASM if WebGL unavailable
        try {
          await tf.setBackend("wasm");
          await tf.ready();
          const detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
          );
          if (cancelled) { detector.dispose(); return; }
          detectorRef.current = detector;
          setLoading(false);
          setStatusText("Tracking active");
        } catch (fallbackErr) {
          console.error("Velocity tracker fallback failed:", fallbackErr);
          setStatusText("Failed to load model. Try refreshing.");
        }
      }
    };
    init();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      detectorRef.current?.dispose();
      detectorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    let running = true;
    const loop = async () => {
      if (!running) return;
      await detectAndDraw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loading, facingMode]);

  const detectAndDraw = async () => {
    const video = webcamRef.current?.video;
    const detector = detectorRef.current;
    const canvas = canvasRef.current;
    if (!video || !detector || !canvas || video.readyState < 2) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, vw, vh);

    try {
      const poses = await detector.estimatePoses(video);
      if (!poses.length || !poses[0].keypoints) { drawOverlay(ctx, vw, vh); return; }

      const kps = poses[0].keypoints;
      const lw = kps.find((k) => k.name === "left_wrist");
      const rw = kps.find((k) => k.name === "right_wrist");
      const validL = lw && lw.score !== undefined && lw.score > MIN_CONFIDENCE;
      const validR = rw && rw.score !== undefined && rw.score > MIN_CONFIDENCE;

      let midX: number | null = null;
      let midY: number | null = null;

      if (validL && validR) { midX = (lw!.x + rw!.x) / 2; midY = (lw!.y + rw!.y) / 2; }
      else if (validL) { midX = lw!.x; midY = lw!.y; }
      else if (validR) { midX = rw!.x; midY = rw!.y; }

      if (midX !== null && midY !== null) {
        const now = performance.now();
        const points = pointsRef.current;
        let velocity = 0;

        if (points.length > 0) {
          const prev = points[points.length - 1];
          const dt = (now - prev.t) / 1000; // seconds
          if (dt > 0) {
            const dist = Math.sqrt((midX - prev.x) ** 2 + (midY - prev.y) ** 2);
            velocity = dist / dt; // px/sec

            // Normalize to approximate m/s (assume ~640px viewport ≈ 1.5m frame)
            velocity = (velocity / vw) * 1.5;
          }

          // Direction detection for rep counting
          const dy = midY - prev.y;
          const currentDir = dy < -2 ? "up" : dy > 2 ? "down" : lastDirectionRef.current;

          if (currentDir && currentDir !== lastDirectionRef.current) {
            directionFramesRef.current++;
            if (directionFramesRef.current > 3) {
              if (currentDir === "up" && lastDirectionRef.current === "down") {
                // Bottom of rep → concentric phase starting
                setPhase("concentric");
              } else if (currentDir === "down" && lastDirectionRef.current === "up") {
                // Top of rep → eccentric phase starting, count the rep
                setPhase("eccentric");
                setRepCount(c => c + 1);
                // Capture peak velocity of this rep's concentric phase
                const recentConcentricVelocities = points.slice(-30).map(p => p.velocity);
                const repPeak = Math.max(...recentConcentricVelocities);
                repVelocitiesRef.current.push(repPeak);
                const avg = repVelocitiesRef.current.reduce((a, b) => a + b, 0) / repVelocitiesRef.current.length;
                setAvgVelocity(avg);
              }
              lastDirectionRef.current = currentDir;
              directionFramesRef.current = 0;
            }
          } else {
            directionFramesRef.current = 0;
          }
        }

        // Smooth velocity display (rolling average)
        const smoothWindow = points.slice(-FRAME_WINDOW).map(p => p.velocity);
        smoothWindow.push(velocity);
        const smoothed = smoothWindow.reduce((a, b) => a + b, 0) / smoothWindow.length;

        setCurrentVelocity(smoothed);
        if (smoothed > peakVelocity) setPeakVelocity(smoothed);

        points.push({ x: midX, y: midY, t: now, velocity });
        // Keep last 120 frames (~2 sec at 60fps)
        if (points.length > 120) points.splice(0, points.length - 120);

        // Draw wrist indicator with velocity-colored ring
        const hue = Math.min(velocity * 200, 120); // 0=red(slow), 120=green(fast)
        ctx.beginPath();
        ctx.arc(midX, midY, 12, 0, 2 * Math.PI);
        ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.8)`;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw velocity trail
        drawTrail(ctx, points);
      }

      drawOverlay(ctx, vw, vh);
    } catch {
      drawOverlay(ctx, vw, vh);
    }
  };

  const drawTrail = (ctx: CanvasRenderingContext2D, points: VelocityPoint[]) => {
    if (points.length < 2) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const len = points.length;
    for (let i = Math.max(1, len - 30); i < len; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const alpha = (i - (len - 30)) / 30;
      const hue = Math.min(curr.velocity * 200, 120);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = `hsla(${hue}, 80%, 50%, ${Math.max(0.1, alpha)})`;
      ctx.stroke();
    }
  };

  const drawOverlay = (ctx: CanvasRenderingContext2D, _vw: number, _vh: number) => {
    // Minimal overlay — HUD stats are in React UI
  };

  const resetAll = useCallback(() => {
    pointsRef.current = [];
    repVelocitiesRef.current = [];
    lastDirectionRef.current = null;
    directionFramesRef.current = 0;
    setCurrentVelocity(0);
    setPeakVelocity(0);
    setAvgVelocity(0);
    setRepCount(0);
    setPhase("idle");
  }, []);

  const flipCamera = useCallback(() => {
    setFacingMode(f => f === "user" ? "environment" : "user");
    resetAll();
  }, [resetAll]);

  const velocityColor = currentVelocity > 0.8 ? "text-green-400" : currentVelocity > 0.4 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm z-10">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
            <Zap size={14} className="text-primary" /> Velocity Tracker
          </h2>
          <p className="text-[10px] text-white/60 truncate">{exerciseTitle}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 flex-shrink-0">
          <X size={20} />
        </Button>
      </header>

      {/* HUD Stats */}
      <div className="shrink-0 flex items-center justify-around px-4 py-2 bg-black/60 border-b border-white/10">
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-widest text-white/50">Speed</p>
          <p className={`text-lg font-black tabular-nums ${velocityColor}`}>
            {currentVelocity.toFixed(2)}
            <span className="text-[9px] text-white/40 ml-0.5">m/s</span>
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-widest text-white/50">Peak</p>
          <p className="text-lg font-black tabular-nums text-primary">
            {peakVelocity.toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-widest text-white/50">Avg</p>
          <p className="text-lg font-black tabular-nums text-white">
            {avgVelocity.toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-widest text-white/50">Reps</p>
          <p className="text-lg font-black tabular-nums text-white">{repCount}</p>
        </div>
      </div>

      {/* Phase indicator */}
      {phase !== "idle" && (
        <div className={`shrink-0 text-center py-1 text-[10px] font-bold uppercase tracking-widest ${
          phase === "concentric" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
        }`}>
          {phase === "concentric" ? "↑ Concentric — Push!" : "↓ Eccentric — Control"}
        </div>
      )}

      {/* Camera + Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm text-white/70">{statusText}</p>
          </div>
        )}
        <Webcam
          ref={webcamRef}
          audio={false}
          videoConstraints={{ facingMode, width: 640, height: 480 }}
          className="absolute inset-0 w-full h-full object-cover"
          mirrored={facingMode === "user"}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined }}
        />
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
          <Shield size={12} className="text-green-400" />
          <span className="text-[10px] font-medium text-green-400">On-device · No upload</span>
        </div>
      </div>

      {/* Controls */}
      <footer className="shrink-0 bg-black/80 backdrop-blur-sm px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
          <Button onClick={resetAll} size="sm" variant="outline" className="gap-1.5 text-xs font-bold uppercase tracking-widest border-white/20 text-white hover:bg-white/10 hover:text-white">
            <RotateCcw size={14} /> Reset
          </Button>
          <Button onClick={flipCamera} size="sm" variant="outline" className="gap-1.5 text-xs font-bold uppercase tracking-widest border-white/20 text-white hover:bg-white/10 hover:text-white">
            <SwitchCamera size={14} /> Flip
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default VelocityTracker;
