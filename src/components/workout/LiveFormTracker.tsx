import { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm";
import * as poseDetection from "@tensorflow-models/pose-detection";
import { Button } from "@/components/ui/button";
import { X, RotateCcw, SwitchCamera, Shield, Loader2 } from "lucide-react";

const DRIFT_THRESHOLD = 0.15; // 15% of frame width
const MIN_CONFIDENCE = 0.4;

interface PathPoint {
  x: number;
  y: number;
  drifted: boolean;
}

interface LiveFormTrackerProps {
  exerciseTitle: string;
  onClose: () => void;
}

const LiveFormTracker = ({ exerciseTitle, onClose }: LiveFormTrackerProps) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const pathRef = useRef<PathPoint[]>([]);
  const startXRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("Loading pose model…");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [pathVersion, setPathVersion] = useState(0); // force re-render on reset

  // Init TF.js + MoveNet
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
        if (cancelled) {
          detector.dispose();
          return;
        }
        detectorRef.current = detector;
        setLoading(false);
        setStatusText("Tracking active");
      } catch (err) {
        console.error("Form tracker model failed:", err);
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
          console.error("Form tracker fallback failed:", fallbackErr);
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

  // Detection + drawing loop
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
      if (!poses.length || !poses[0].keypoints) {
        drawPath(ctx, vw);
        return;
      }

      const kps = poses[0].keypoints;
      const lw = kps.find((k) => k.name === "left_wrist");
      const rw = kps.find((k) => k.name === "right_wrist");

      const validL = lw && lw.score !== undefined && lw.score > MIN_CONFIDENCE;
      const validR = rw && rw.score !== undefined && rw.score > MIN_CONFIDENCE;

      let midX: number | null = null;
      let midY: number | null = null;

      if (validL && validR) {
        midX = (lw!.x + rw!.x) / 2;
        midY = (lw!.y + rw!.y) / 2;
      } else if (validL) {
        midX = lw!.x;
        midY = lw!.y;
      } else if (validR) {
        midX = rw!.x;
        midY = rw!.y;
      }

      if (midX !== null && midY !== null) {
        // Draw wrist indicator
        ctx.beginPath();
        ctx.arc(midX, midY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = "hsl(var(--primary))";
        ctx.fill();
        ctx.strokeStyle = "hsl(var(--primary-foreground))";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Track path
        if (startXRef.current === null) startXRef.current = midX;
        const drift = Math.abs(midX - startXRef.current) / vw;
        const drifted = drift > DRIFT_THRESHOLD;

        pathRef.current.push({ x: midX, y: midY, drifted });
      }

      drawPath(ctx, vw);
    } catch {
      drawPath(ctx, vw);
    }
  };

  const drawPath = (ctx: CanvasRenderingContext2D, _vw: number) => {
    const points = pathRef.current;
    if (points.length < 2) return;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = curr.drifted ? "hsl(0, 80%, 55%)" : "hsl(142, 76%, 46%)";
      ctx.stroke();
    }
  };

  const resetPath = useCallback(() => {
    pathRef.current = [];
    startXRef.current = null;
    setPathVersion((v) => v + 1);
  }, []);

  const flipCamera = useCallback(() => {
    setFacingMode((f) => (f === "user" ? "environment" : "user"));
    resetPath();
  }, [resetPath]);

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm z-10">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white truncate">Form Tracker</h2>
          <p className="text-[10px] text-white/60 truncate">{exerciseTitle}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 flex-shrink-0">
          <X size={20} />
        </Button>
      </header>

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

        {/* Privacy badge */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
          <Shield size={12} className="text-green-400" />
          <span className="text-[10px] font-medium text-green-400">Processing locally — video is not saved</span>
        </div>
      </div>

      {/* Controls */}
      <footer className="shrink-0 bg-black/80 backdrop-blur-sm px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
          <Button
            onClick={resetPath}
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs font-bold uppercase tracking-widest border-white/20 text-white hover:bg-white/10 hover:text-white"
          >
            <RotateCcw size={14} /> Reset Path
          </Button>
          <Button
            onClick={flipCamera}
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs font-bold uppercase tracking-widest border-white/20 text-white hover:bg-white/10 hover:text-white"
          >
            <SwitchCamera size={14} /> Flip Cam
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default LiveFormTracker;
