import { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, Loader2, X } from "lucide-react";

const CORE_KEYPOINTS = [
  "left_shoulder",
  "right_shoulder",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
];

const CONFIDENCE_THRESHOLD = 0.5;
const ALIGNMENT_DURATION_MS = 2000;
const DETECTION_INTERVAL_MS = 200;
const COUNTDOWN_SECONDS = 3;
const CENTER_MARGIN = 0.15; // 15% margin from edges

interface SmartCameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

type CameraState = "guide" | "loading" | "detecting" | "aligned" | "countdown" | "captured";

const SmartCamera = ({ onCapture, onClose }: SmartCameraProps) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const alignedSinceRef = useRef<number | null>(null);
  const detectionLoopRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<CameraState>("guide");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [statusText, setStatusText] = useState("Loading pose model…");

  const startCamera = () => {
    setState("loading");
    setStatusText("Loading pose model…");
  };

  // Initialize TF.js + MoveNet (only after guide is dismissed)
  useEffect(() => {
    if (state === "guide") return;
    let cancelled = false;

    const init = async () => {
      try {
        await tf.ready();
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          }
        );
        if (cancelled) {
          detector.dispose();
          return;
        }
        detectorRef.current = detector;
        setModelReady(true);
        setState("detecting");
        setStatusText("Position the athlete in the frame");
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
    if (!modelReady || state === "countdown" || state === "captured") return;

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
  }, [modelReady, state]);

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

      // Draw skeleton lines
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
        if (
          kpA?.score &&
          kpA.score > CONFIDENCE_THRESHOLD &&
          kpB?.score &&
          kpB.score > CONFIDENCE_THRESHOLD
        ) {
          ctx.beginPath();
          ctx.moveTo(kpA.x, kpA.y);
          ctx.lineTo(kpB.x, kpB.y);
          ctx.stroke();
        }
      }

      // Check alignment: all core keypoints visible + centered
      const coreKps = keypoints.filter(
        (kp) =>
          CORE_KEYPOINTS.includes(kp.name || "") &&
          kp.score !== undefined &&
          kp.score > CONFIDENCE_THRESHOLD
      );

      const allVisible = coreKps.length === CORE_KEYPOINTS.length;

      const allCentered =
        allVisible &&
        coreKps.every(
          (kp) =>
            kp.x > videoWidth * CENTER_MARGIN &&
            kp.x < videoWidth * (1 - CENTER_MARGIN) &&
            kp.y > videoHeight * CENTER_MARGIN &&
            kp.y < videoHeight * (1 - CENTER_MARGIN)
        );

      const isAligned = allVisible && allCentered;

      if (isAligned) {
        if (!alignedSinceRef.current) {
          alignedSinceRef.current = Date.now();
          setState("aligned");
          setStatusText("Hold still…");
        } else if (Date.now() - alignedSinceRef.current >= ALIGNMENT_DURATION_MS) {
          startCountdown();
        }
      } else {
        alignedSinceRef.current = null;
        if (!allVisible) {
          setStatusText(
            `Visible: ${coreKps.length}/${CORE_KEYPOINTS.length} keypoints — adjust position`
          );
        } else {
          setStatusText("Move to center of frame");
        }
        setState((s) => (s === "aligned" ? "detecting" : s));
      }
    } catch (err) {
      // Silently continue detection loop
    }
  };

  const startCountdown = useCallback(() => {
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
      setCapturedImage(screenshot);
      setState("captured");
      setStatusText("Capture complete!");
    } else {
      setState("detecting");
      setStatusText("Capture failed — try again");
      alignedSinceRef.current = null;
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    alignedSinceRef.current = null;
    setState("detecting");
    setStatusText("Position the athlete in the frame");
    setCountdown(COUNTDOWN_SECONDS);
  };

  const handleUseCapture = async () => {
    if (!capturedImage) return;

    // Convert base64 to File
    const res = await fetch(capturedImage);
    const blob = await res.blob();
    const file = new File([blob], `smart-capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });

    onCapture(file);
  };

  const borderColor =
    state === "aligned" || state === "countdown"
      ? "border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.4)]"
      : state === "captured"
        ? "border-primary"
        : "border-border";

  if (state === "guide") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
        >
          <X size={24} />
        </Button>

        <h2 className="text-white text-xl font-bold mb-6">Positioning Guide</h2>

        <div className="flex flex-col sm:flex-row gap-6 max-w-2xl w-full mb-8">
          {/* Front View */}
          <div className="flex-1 border border-border/40 rounded-lg p-4 bg-white/5">
            <p className="text-white text-sm font-semibold text-center mb-3">Front View</p>
            <svg viewBox="0 0 120 200" className="w-full max-w-[140px] mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth="1.5">
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
            <ul className="text-white/70 text-xs space-y-1">
              <li>• Face camera directly</li>
              <li>• Arms at sides, relaxed</li>
              <li>• Feet shoulder-width apart</li>
              <li>• Full body visible head to toe</li>
            </ul>
          </div>

          {/* Side View */}
          <div className="flex-1 border border-border/40 rounded-lg p-4 bg-white/5">
            <p className="text-white text-sm font-semibold text-center mb-3">Side View</p>
            <svg viewBox="0 0 120 200" className="w-full max-w-[140px] mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth="1.5">
              <ellipse cx="55" cy="30" rx="14" ry="17" className="text-primary" />
              <line x1="55" y1="47" x2="58" y2="110" className="text-primary" />
              <line x1="55" y1="65" x2="40" y2="100" className="text-primary" />
              <line x1="58" y1="110" x2="55" y2="160" className="text-primary" />
              <line x1="55" y1="160" x2="50" y2="195" className="text-primary" />
              {/* slight forward lean hint */}
              <line x1="58" y1="110" x2="62" y2="160" className="text-muted-foreground" strokeDasharray="3 3" />
            </svg>
            <ul className="text-white/70 text-xs space-y-1">
              <li>• Stand sideways to camera</li>
              <li>• Natural posture, don't flex</li>
              <li>• Arms relaxed at sides</li>
              <li>• Keep feet together or natural</li>
            </ul>
          </div>
        </div>

        <p className="text-white/50 text-xs text-center mb-4 max-w-md">
          The camera will auto-capture when all keypoints are detected and centered for 2 seconds.
        </p>

        <Button onClick={startCamera} className="gap-2">
          <Camera size={16} />
          Start Camera
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
      >
        <X size={24} />
      </Button>

      {/* Camera area */}
      <div
        className={`relative w-full max-w-2xl aspect-[3/4] border-4 rounded-lg overflow-hidden transition-all duration-300 ${borderColor}`}
      >
        {state === "captured" && capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.92}
              videoConstraints={{
                facingMode: "environment",
                width: 720,
                height: 960,
              }}
              mirrored={false}
              className="w-full h-full object-cover"
            />

            {/* Canvas overlay for keypoints */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Body outline guide */}
            <svg
              viewBox="0 0 200 300"
              className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              {/* Head */}
              <ellipse cx="100" cy="55" rx="18" ry="22" className="text-white" />
              {/* Torso */}
              <line x1="100" y1="77" x2="100" y2="160" className="text-white" />
              {/* Shoulders */}
              <line x1="65" y1="95" x2="135" y2="95" className="text-white" />
              {/* Arms */}
              <line x1="65" y1="95" x2="50" y2="145" className="text-white" />
              <line x1="135" y1="95" x2="150" y2="145" className="text-white" />
              {/* Hips */}
              <line x1="75" y1="160" x2="125" y2="160" className="text-white" />
              {/* Legs */}
              <line x1="75" y1="160" x2="70" y2="230" className="text-white" />
              <line x1="125" y1="160" x2="130" y2="230" className="text-white" />
              {/* Lower legs */}
              <line x1="70" y1="230" x2="65" y2="285" className="text-white" />
              <line x1="130" y1="230" x2="135" y2="285" className="text-white" />
            </svg>

            {/* Countdown overlay */}
            {state === "countdown" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="text-8xl font-black text-white drop-shadow-2xl animate-pulse">
                  {countdown}
                </span>
              </div>
            )}
          </>
        )}

        {/* Loading overlay */}
        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="animate-spin text-white" size={40} />
          </div>
        )}
      </div>

      {/* Status text */}
      <p className="text-white text-sm mt-4 text-center px-4 min-h-[2rem]">
        {statusText}
      </p>

      {/* Action buttons */}
      {state === "captured" && (
        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={handleRetake} className="gap-2">
            <RotateCcw size={16} />
            Retake
          </Button>
          <Button onClick={handleUseCapture} className="gap-2">
            <Check size={16} />
            Use This &amp; Analyze
          </Button>
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
        </div>
      )}
    </div>
  );
};

export default SmartCamera;
