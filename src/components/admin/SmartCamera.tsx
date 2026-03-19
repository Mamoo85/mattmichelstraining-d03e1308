import { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, Loader2, X, ChevronRight, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CORE_KEYPOINTS = [
  "left_shoulder", "right_shoulder",
  "left_hip", "right_hip",
  "left_knee", "right_knee",
  "left_ankle", "right_ankle",
];

const CONFIDENCE_THRESHOLD = 0.5;
const ALIGNMENT_DURATION_MS = 2000;
const DETECTION_INTERVAL_MS = 200;
const COUNTDOWN_SECONDS = 3;
const CENTER_MARGIN = 0.15;

type AngleType = "front" | "side" | "back";

const ANGLES: { key: AngleType; label: string; instruction: string }[] = [
  { key: "front", label: "Front View", instruction: "Face the camera directly" },
  { key: "side", label: "Side View", instruction: "Turn sideways to the camera" },
  { key: "back", label: "Back View", instruction: "Turn your back to the camera" },
];

interface SmartCameraProps {
  onCapture: (files: File[]) => void;
  onClose: () => void;
}

type CameraState = "guide" | "loading" | "detecting" | "aligned" | "countdown" | "captured";

// --- Angle guide SVGs ---
const FrontSvg = () => (
  <svg viewBox="0 0 120 200" className="w-full max-w-[100px] mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
    <ellipse cx="60" cy="30" rx="14" ry="17" className="text-primary" />
    <line x1="60" y1="47" x2="60" y2="110" className="text-primary" />
    <line x1="35" y1="65" x2="85" y2="65" className="text-primary" />
    <line x1="35" y1="65" x2="25" y2="100" className="text-primary" />
    <line x1="85" y1="65" x2="95" y2="100" className="text-primary" />
    <line x1="45" y1="110" x2="75" y2="110" className="text-primary" />
    <line x1="45" y1="110" x2="40" y2="160" className="text-primary" />
    <line x1="75" y1="110" x2="80" y2="160" className="text-primary" />
    <line x1="40" y1="160" x2="35" y2="195" className="text-primary" />
    <line x1="80" y1="160" x2="85" y2="195" className="text-primary" />
  </svg>
);

const SideSvg = () => (
  <svg viewBox="0 0 120 200" className="w-full max-w-[100px] mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
    <ellipse cx="55" cy="30" rx="14" ry="17" className="text-primary" />
    <line x1="55" y1="47" x2="58" y2="110" className="text-primary" />
    <line x1="55" y1="65" x2="40" y2="100" className="text-primary" />
    <line x1="58" y1="110" x2="55" y2="160" className="text-primary" />
    <line x1="55" y1="160" x2="50" y2="195" className="text-primary" />
  </svg>
);

const BackSvg = () => (
  <svg viewBox="0 0 120 200" className="w-full max-w-[100px] mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
    <ellipse cx="60" cy="30" rx="14" ry="17" className="text-muted-foreground" />
    <line x1="60" y1="47" x2="60" y2="110" className="text-muted-foreground" />
    <line x1="35" y1="65" x2="85" y2="65" className="text-muted-foreground" />
    <line x1="35" y1="65" x2="25" y2="100" className="text-muted-foreground" />
    <line x1="85" y1="65" x2="95" y2="100" className="text-muted-foreground" />
    <line x1="45" y1="110" x2="75" y2="110" className="text-muted-foreground" />
    <line x1="45" y1="110" x2="40" y2="160" className="text-muted-foreground" />
    <line x1="75" y1="110" x2="80" y2="160" className="text-muted-foreground" />
    <line x1="40" y1="160" x2="35" y2="195" className="text-muted-foreground" />
    <line x1="80" y1="160" x2="85" y2="195" className="text-muted-foreground" />
    {/* X marks on back to indicate rear */}
    <line x1="50" y1="75" x2="70" y2="95" className="text-primary" strokeWidth="1" strokeDasharray="2 2" />
    <line x1="70" y1="75" x2="50" y2="95" className="text-primary" strokeWidth="1" strokeDasharray="2 2" />
  </svg>
);

const angleSvgMap: Record<AngleType, () => JSX.Element> = {
  front: FrontSvg,
  side: SideSvg,
  back: BackSvg,
};

const SmartCamera = ({ onCapture, onClose }: SmartCameraProps) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const alignedSinceRef = useRef<number | null>(null);
  const detectionLoopRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<CameraState>("guide");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [modelReady, setModelReady] = useState(false);
  const [statusText, setStatusText] = useState("Loading pose model…");

  // Multi-angle state
  const [currentAngleIdx, setCurrentAngleIdx] = useState(0);
  const [captures, setCaptures] = useState<Record<AngleType, string | null>>({
    front: null,
    side: null,
    back: null,
  });
  const [reviewMode, setReviewMode] = useState(false);

  const currentAngle = ANGLES[currentAngleIdx];

  const startCamera = () => {
    setState("loading");
    setStatusText("Loading pose model…");
  };

  // Initialize TF.js + MoveNet (only after guide is dismissed)
  useEffect(() => {
    if (state === "guide") return;
    if (detectorRef.current) return; // already initialized
    let cancelled = false;

    const init = async () => {
      try {
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
        setModelReady(true);
        setState("detecting");
        setStatusText(`${currentAngle.instruction}`);
      } catch (err) {
        console.error("Failed to load pose model:", err);
        setStatusText("Failed to load pose model. Try refreshing.");
      }
    };

    init();

    return () => {
      cancelled = true;
      detectorRef.current?.dispose();
      detectorRef.current = null;
      if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [state === "guide"]);

  // Detection loop
  useEffect(() => {
    if (!modelReady || state === "countdown" || state === "captured" || reviewMode) return;

    let lastRun = 0;
    let running = true;

    const loop = (timestamp: number) => {
      if (!running) return;
      if (timestamp - lastRun >= DETECTION_INTERVAL_MS) {
        lastRun = timestamp;
        detect();
      }
      detectionLoopRef.current = requestAnimationFrame(loop);
    };

    detectionLoopRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
    };
  }, [modelReady, state, reviewMode]);

  const detect = async () => {
    const video = webcamRef.current?.video;
    const detector = detectorRef.current;
    const canvas = canvasRef.current;

    if (!video || !detector || !canvas || video.readyState < 2) return;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    try {
      const poses = await detector.estimatePoses(video);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, videoWidth, videoHeight);

      if (!poses.length || !poses[0].keypoints) {
        alignedSinceRef.current = null;
        setState((s) => (s === "aligned" ? "detecting" : s));
        setStatusText("No person detected — step into frame");
        return;
      }

      const keypoints = poses[0].keypoints;

      // Draw keypoints
      for (const kp of keypoints) {
        if (kp.score && kp.score > CONFIDENCE_THRESHOLD) {
          ctx.beginPath();
          ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = "hsl(var(--primary))";
          ctx.fill();
        }
      }

      // Draw skeleton
      const connections: [string, string][] = [
        ["left_shoulder", "right_shoulder"],
        ["left_shoulder", "left_hip"],
        ["right_shoulder", "right_hip"],
        ["left_hip", "right_hip"],
        ["left_hip", "left_knee"],
        ["right_hip", "right_knee"],
        ["left_knee", "left_ankle"],
        ["right_knee", "right_ankle"],
      ];

      ctx.strokeStyle = "hsl(var(--primary) / 0.7)";
      ctx.lineWidth = 2;

      for (const [a, b] of connections) {
        const kpA = keypoints.find((k) => k.name === a);
        const kpB = keypoints.find((k) => k.name === b);
        if (kpA?.score && kpA.score > CONFIDENCE_THRESHOLD && kpB?.score && kpB.score > CONFIDENCE_THRESHOLD) {
          ctx.beginPath();
          ctx.moveTo(kpA.x, kpA.y);
          ctx.lineTo(kpB.x, kpB.y);
          ctx.stroke();
        }
      }

      // Alignment check
      const coreKps = keypoints.filter(
        (kp) => CORE_KEYPOINTS.includes(kp.name || "") && kp.score !== undefined && kp.score > CONFIDENCE_THRESHOLD
      );
      const allVisible = coreKps.length === CORE_KEYPOINTS.length;
      const allCentered = allVisible && coreKps.every(
        (kp) => kp.x > videoWidth * CENTER_MARGIN && kp.x < videoWidth * (1 - CENTER_MARGIN) &&
                kp.y > videoHeight * CENTER_MARGIN && kp.y < videoHeight * (1 - CENTER_MARGIN)
      );
      const isAligned = allVisible && allCentered;

      if (isAligned) {
        if (!alignedSinceRef.current) {
          alignedSinceRef.current = Date.now();
          setState("aligned");
          setStatusText("Hold still…");
        } else if (Date.now() - alignedSinceRef.current >= ALIGNMENT_DURATION_MS) {
          triggerCountdown();
        }
      } else {
        alignedSinceRef.current = null;
        if (!allVisible) {
          setStatusText(`Visible: ${coreKps.length}/${CORE_KEYPOINTS.length} keypoints — adjust position`);
        } else {
          setStatusText("Move to center of frame");
        }
        setState((s) => (s === "aligned" ? "detecting" : s));
      }
    } catch {
      // Silently continue
    }
  };

  const triggerCountdown = useCallback(() => {
    setState("countdown");
    setCountdown(COUNTDOWN_SECONDS);
    let remaining = COUNTDOWN_SECONDS;

    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        captureFrame();
      }
    }, 1000);
  }, []);

  const captureFrame = () => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (screenshot) {
      const angle = ANGLES[currentAngleIdx].key;
      setCaptures((prev) => ({ ...prev, [angle]: screenshot }));
      setState("captured");
      setStatusText(`${ANGLES[currentAngleIdx].label} captured!`);
    } else {
      setState("detecting");
      setStatusText("Capture failed — try again");
      alignedSinceRef.current = null;
    }
  };

  const handleRetakeAngle = () => {
    const angle = ANGLES[currentAngleIdx].key;
    setCaptures((prev) => ({ ...prev, [angle]: null }));
    alignedSinceRef.current = null;
    setState("detecting");
    setStatusText(ANGLES[currentAngleIdx].instruction);
    setCountdown(COUNTDOWN_SECONDS);
  };

  const handleNextAngle = () => {
    const nextIdx = currentAngleIdx + 1;
    if (nextIdx < ANGLES.length) {
      setCurrentAngleIdx(nextIdx);
      alignedSinceRef.current = null;
      setState("detecting");
      setStatusText(ANGLES[nextIdx].instruction);
      setCountdown(COUNTDOWN_SECONDS);
    } else {
      // All angles captured — show review
      setReviewMode(true);
    }
  };

  const handleRetakeFromReview = (angleIdx: number) => {
    const angle = ANGLES[angleIdx].key;
    setCaptures((prev) => ({ ...prev, [angle]: null }));
    setCurrentAngleIdx(angleIdx);
    setReviewMode(false);
    alignedSinceRef.current = null;
    setState("detecting");
    setStatusText(ANGLES[angleIdx].instruction);
    setCountdown(COUNTDOWN_SECONDS);
  };

  const handleFinish = async () => {
    const files: File[] = [];
    for (const angle of ANGLES) {
      const img = captures[angle.key];
      if (!img) continue;
      const res = await fetch(img);
      const blob = await res.blob();
      files.push(new File([blob], `smart-capture-${angle.key}-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }
    onCapture(files);
  };

  const capturedCount = ANGLES.filter((a) => captures[a.key]).length;

  const borderColor =
    state === "aligned" || state === "countdown"
      ? "border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.4)]"
      : state === "captured"
        ? "border-primary"
        : "border-border";

  // --- GUIDE SCREEN ---
  if (state === "guide") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4 z-50 text-white hover:bg-white/20">
          <X size={24} />
        </Button>

        <h2 className="text-white text-xl font-bold mb-2">Multi-Angle Capture</h2>
        <p className="text-white/60 text-sm mb-6 text-center max-w-md">
          You'll capture 3 angles in sequence — front, side, and back — for a complete biomechanics assessment.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 max-w-2xl w-full mb-8">
          {ANGLES.map((angle, i) => {
            const Svg = angleSvgMap[angle.key];
            return (
              <div key={angle.key} className="flex-1 border border-border/40 rounded-lg p-4 bg-white/5">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-[10px]">{i + 1}</Badge>
                  <p className="text-white text-sm font-semibold">{angle.label}</p>
                </div>
                <Svg />
                <p className="text-white/60 text-xs text-center mt-2">{angle.instruction}</p>
              </div>
            );
          })}
        </div>

        <p className="text-white/50 text-xs text-center mb-4 max-w-md">
          Each angle auto-captures when keypoints are detected and centered for 2 seconds.
        </p>

        <Button onClick={startCamera} className="gap-2">
          <Camera size={16} />
          Start Capture Sequence
        </Button>
      </div>
    );
  }

  // --- REVIEW SCREEN ---
  if (reviewMode) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4 z-50 text-white hover:bg-white/20">
          <X size={24} />
        </Button>

        <h2 className="text-white text-xl font-bold mb-6">Review All Captures</h2>

        <div className="flex flex-col sm:flex-row gap-4 max-w-3xl w-full mb-6">
          {ANGLES.map((angle, i) => (
            <div key={angle.key} className="flex-1 border border-border/40 rounded-lg overflow-hidden bg-white/5">
              <p className="text-white text-xs font-semibold text-center py-2 bg-white/5">{angle.label}</p>
              {captures[angle.key] ? (
                <img src={captures[angle.key]!} alt={angle.label} className="w-full aspect-[3/4] object-cover" />
              ) : (
                <div className="w-full aspect-[3/4] flex items-center justify-center">
                  <ImageIcon className="text-muted-foreground" size={32} />
                </div>
              )}
              <div className="p-2 flex justify-center">
                <Button size="sm" variant="ghost" onClick={() => handleRetakeFromReview(i)} className="text-xs text-white/70 hover:text-white hover:bg-white/10 gap-1">
                  <RotateCcw size={12} />
                  Retake
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X size={16} />
            Cancel
          </Button>
          <Button onClick={handleFinish} disabled={capturedCount === 0} className="gap-2">
            <Check size={16} />
            Use All {capturedCount} &amp; Analyze
          </Button>
        </div>
      </div>
    );
  }

  // --- CAMERA SCREEN ---
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4 z-50 text-white hover:bg-white/20">
        <X size={24} />
      </Button>

      {/* Angle progress indicator */}
      <div className="flex items-center gap-2 mb-3">
        {ANGLES.map((angle, i) => (
          <div key={angle.key} className="flex items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
              i === currentAngleIdx
                ? "border-primary bg-primary text-primary-foreground"
                : captures[angle.key]
                  ? "border-green-500 bg-green-500/20 text-green-400"
                  : "border-border/40 text-white/40"
            }`}>
              {captures[angle.key] ? "✓" : i + 1}
            </div>
            {i < ANGLES.length - 1 && (
              <div className={`w-6 h-0.5 ${captures[angle.key] ? "bg-green-500/50" : "bg-border/30"}`} />
            )}
          </div>
        ))}
      </div>

      <p className="text-white text-xs font-semibold mb-2">{currentAngle.label}</p>

      {/* Camera area */}
      <div className={`relative w-full max-w-2xl aspect-[3/4] border-4 rounded-lg overflow-hidden transition-all duration-300 ${borderColor}`}>
        {state === "captured" && captures[currentAngle.key] ? (
          <img src={captures[currentAngle.key]!} alt="Captured" className="w-full h-full object-cover" />
        ) : (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.92}
              videoConstraints={{ facingMode: "environment", width: 720, height: 960 }}
              mirrored={false}
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

            {/* Body outline guide */}
            <svg viewBox="0 0 200 300" className="absolute inset-0 w-full h-full pointer-events-none opacity-20" fill="none" stroke="currentColor" strokeWidth="1">
              <ellipse cx="100" cy="55" rx="18" ry="22" className="text-white" />
              <line x1="100" y1="77" x2="100" y2="160" className="text-white" />
              <line x1="65" y1="95" x2="135" y2="95" className="text-white" />
              <line x1="65" y1="95" x2="50" y2="145" className="text-white" />
              <line x1="135" y1="95" x2="150" y2="145" className="text-white" />
              <line x1="75" y1="160" x2="125" y2="160" className="text-white" />
              <line x1="75" y1="160" x2="70" y2="230" className="text-white" />
              <line x1="125" y1="160" x2="130" y2="230" className="text-white" />
              <line x1="70" y1="230" x2="65" y2="285" className="text-white" />
              <line x1="130" y1="230" x2="135" y2="285" className="text-white" />
            </svg>

            {state === "countdown" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="text-8xl font-black text-white drop-shadow-2xl animate-pulse">{countdown}</span>
              </div>
            )}
          </>
        )}

        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="animate-spin text-white" size={40} />
          </div>
        )}
      </div>

      {/* Status text */}
      <p className="text-white text-sm mt-4 text-center px-4 min-h-[2rem]">{statusText}</p>

      {/* Action buttons */}
      {state === "captured" && (
        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={handleRetakeAngle} className="gap-2">
            <RotateCcw size={16} />
            Retake
          </Button>
          {currentAngleIdx < ANGLES.length - 1 ? (
            <Button onClick={handleNextAngle} className="gap-2">
              <ChevronRight size={16} />
              Next: {ANGLES[currentAngleIdx + 1].label}
            </Button>
          ) : (
            <Button onClick={handleNextAngle} className="gap-2">
              <Check size={16} />
              Review All
            </Button>
          )}
        </div>
      )}

      {state === "detecting" && (
        <div className="flex gap-3 mt-4">
          <Button
            variant="outline"
            onClick={captureFrame}
            className="gap-2 text-white border-white/30 hover:bg-white/10"
          >
            <Camera size={16} />
            Manual Capture
          </Button>
          {capturedCount > 0 && (
            <Button
              variant="outline"
              onClick={() => setReviewMode(true)}
              className="gap-2 text-white border-white/30 hover:bg-white/10"
            >
              <Check size={16} />
              Skip to Review ({capturedCount}/{ANGLES.length})
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartCamera;
