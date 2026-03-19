import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Camera, RotateCcw, Check, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface PostureCaptureProps {
  onComplete: () => void;
  onSkip: () => void;
}

type Step = "front" | "side" | "uploading" | "done";

const INSTRUCTIONS: Record<"front" | "side", { label: string; tip: string }> = {
  front: { label: "Front View", tip: "Stand facing the camera, arms relaxed at your sides" },
  side: { label: "Side View", tip: "Turn sideways to the camera, stand naturally" },
};

const PostureCapture = ({ onComplete, onSkip }: PostureCaptureProps) => {
  const { user } = useAuth();
  const webcamRef = useRef<Webcam>(null);
  const [step, setStep] = useState<Step>("front");
  const [frontImg, setFrontImg] = useState<string | null>(null);
  const [sideImg, setSideImg] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);

  const capture = useCallback(() => {
    const img = webcamRef.current?.getScreenshot();
    if (!img) return;
    if (step === "front") {
      setFrontImg(img);
      setCaptured(true);
    } else if (step === "side") {
      setSideImg(img);
      setCaptured(true);
    }
  }, [step]);

  const retake = () => setCaptured(false);

  const proceed = async () => {
    if (step === "front") {
      setCaptured(false);
      setStep("side");
      return;
    }

    if (step === "side" && frontImg && sideImg) {
      setStep("uploading");
      try {
        const userId = user?.id;
        if (!userId) throw new Error("Not authenticated");

        const toBlob = async (dataUrl: string) => {
          const res = await fetch(dataUrl);
          return res.blob();
        };

        const [frontBlob, sideBlob] = await Promise.all([toBlob(frontImg), toBlob(sideImg)]);
        const ts = Date.now();

        const [frontUp, sideUp] = await Promise.all([
          supabase.storage.from("form_checks").upload(`posture/${userId}/front-${ts}.jpg`, frontBlob, { contentType: "image/jpeg" }),
          supabase.storage.from("form_checks").upload(`posture/${userId}/side-${ts}.jpg`, sideBlob, { contentType: "image/jpeg" }),
        ]);

        if (frontUp.error) throw frontUp.error;
        if (sideUp.error) throw sideUp.error;

        const frontUrl = supabase.storage.from("form_checks").getPublicUrl(frontUp.data.path).data.publicUrl;
        const sideUrl = supabase.storage.from("form_checks").getPublicUrl(sideUp.data.path).data.publicUrl;

        const { error } = await supabase.from("posture_requests" as any).insert({
          user_id: userId,
          front_photo_url: frontUrl,
          side_photo_url: sideUrl,
          status: "pending",
        } as any);

        if (error) throw error;

        // Notify admin
        const { data: adminRoles } = await supabase.from("user_roles" as any).select("user_id").eq("role", "admin");
        if (adminRoles && Array.isArray(adminRoles)) {
          const notifications = adminRoles.map((r: any) => ({
            user_id: r.user_id,
            type: "posture_request",
            title: "New Posture Analysis Request",
            body: "A new user submitted photos for a free posture analysis.",
            link: "/admin",
          }));
          await supabase.from("notifications").insert(notifications);
        }

        toast({ title: "Photos submitted! 📸", description: "Coach Matt will review your posture and send analysis." });
        setStep("done");
        onComplete();
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
        setStep("side");
        setCaptured(true);
      }
    }
  };

  if (step === "uploading") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={28} className="animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Uploading your photos…</p>
      </div>
    );
  }

  const currentStep = step as "front" | "side";
  const currentImg = currentStep === "front" ? frontImg : sideImg;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
          {INSTRUCTIONS[currentStep].label}
        </span>
        <p className="text-xs text-muted-foreground mt-1">{INSTRUCTIONS[currentStep].tip}</p>
      </div>

      <div className="relative aspect-[3/4] max-w-[300px] mx-auto bg-black overflow-hidden border border-border">
        {captured && currentImg ? (
          <img src={currentImg} alt={`${currentStep} view`} className="w-full h-full object-cover" />
        ) : (
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "user", width: 720, height: 960 }}
            className="w-full h-full object-cover"
            mirrored
          />
        )}
      </div>

      <div className="flex gap-2 justify-center">
        {captured ? (
          <>
            <button
              onClick={retake}
              className="flex items-center gap-1.5 px-4 py-2 bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-all"
            >
              <RotateCcw size={12} /> Retake
            </button>
            <button
              onClick={proceed}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
            >
              <Check size={12} /> {currentStep === "front" ? "Next → Side" : "Submit"}
            </button>
          </>
        ) : (
          <button
            onClick={capture}
            className="flex items-center gap-1.5 px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Camera size={14} /> Capture {INSTRUCTIONS[currentStep].label}
          </button>
        )}
      </div>

      <button
        onClick={onSkip}
        className="block mx-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
};

export default PostureCapture;
