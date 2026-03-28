import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LIFT_CATEGORIES, ALL_LIFTS } from "@/components/progress/liftConfig";
import { X, Trophy, Upload, Camera, CheckCircle, Loader2, ChevronRight, ChevronLeft, Shield } from "lucide-react";
import { toast } from "sonner";

type Step = "pick" | "weight" | "video" | "consent" | "submitting" | "done";

const MAX_VIDEO_MB = 20;

const ProveItZone = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("pick");
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("1");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedLift = ALL_LIFTS.find((l) => l.name === exercise);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`Video must be under ${MAX_VIDEO_MB}MB`);
      return;
    }
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }, []);

  const handleSubmit = async () => {
    if (!user || !videoFile || !exercise || !weight) return;
    setStep("submitting");

    try {
      const ext = videoFile.name.split(".").pop() || "mp4";
      const path = `prove_it/${user.id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("lift_videos")
        .upload(path, videoFile, { contentType: videoFile.type, upsert: false });

      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("pr_submissions" as any).insert({
        user_id: user.id,
        exercise_name: exercise,
        weight: parseFloat(weight),
        reps: parseInt(reps) || 1,
        rep_max: selectedLift?.repMax ?? 3,
        video_path: path,
        media_consent: consent,
        status: "pending",
      });

      if (insertErr) throw insertErr;

      setStep("done");
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
      setStep("consent");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-primary" />
          <span className="text-sm font-bold uppercase tracking-widest text-foreground">Prove It</span>
        </div>
        <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* STEP 1: Pick Lift */}
        {step === "pick" && (
          <div className="max-w-md mx-auto space-y-6 animate-in fade-in">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-foreground">Attempting a New Best?</h2>
              <p className="text-xs text-muted-foreground">Select your lift. You'll need to submit video proof — Coach Matt reviews every attempt before it counts.</p>
            </div>

            {LIFT_CATEGORIES.map((cat) => (
              <div key={cat.label} className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{cat.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {cat.lifts.map((lift) => (
                    <button
                      key={lift.name}
                      onClick={() => {
                        setExercise(lift.name);
                        setReps(lift.repMax.toString());
                        setStep("weight");
                      }}
                      className={`px-3 py-3 text-xs font-bold uppercase tracking-widest border transition-all text-left ${
                        exercise === lift.name
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {lift.name}
                      <span className="block text-[9px] text-muted-foreground mt-0.5 normal-case tracking-normal font-normal">
                        {lift.repMax}-Rep Max
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 2: Weight */}
        {step === "weight" && (
          <div className="max-w-md mx-auto space-y-6 animate-in fade-in">
            <button onClick={() => setStep("pick")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronLeft size={14} /> Back
            </button>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-foreground">{exercise}</h2>
              <p className="text-xs text-muted-foreground">{selectedLift?.repMax}-Rep Max Attempt</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Weight (lbs)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="225"
                  className="w-full h-14 bg-card border border-border text-center text-2xl font-bold text-foreground focus:border-primary focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Reps Completed</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  className="w-full h-14 bg-card border border-border text-center text-2xl font-bold text-foreground focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              onClick={() => setStep("video")}
              disabled={!weight || parseFloat(weight) <= 0}
              className="w-full py-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              Next: Upload Video <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 3: Video */}
        {step === "video" && (
          <div className="max-w-md mx-auto space-y-6 animate-in fade-in">
            <button onClick={() => setStep("weight")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronLeft size={14} /> Back
            </button>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-foreground">Video Proof Required</h2>
              <p className="text-xs text-muted-foreground">
                Record or upload your {exercise} attempt. Max {MAX_VIDEO_MB}MB. Coach Matt will review this before it's official.
              </p>
            </div>

            <input ref={fileRef} type="file" accept="video/*" capture="environment" onChange={handleFileChange} className="hidden" />

            {videoPreview ? (
              <div className="space-y-3">
                <video src={videoPreview} controls className="w-full aspect-video bg-black object-contain border border-border" />
                <button
                  onClick={() => { setVideoFile(null); setVideoPreview(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Remove & re-upload
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-8 border border-dashed border-border hover:border-primary/50 transition-all bg-card"
                >
                  <Camera size={24} className="text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Record</span>
                </button>
                <button
                  onClick={() => { if (fileRef.current) { fileRef.current.removeAttribute("capture"); fileRef.current.click(); } }}
                  className="flex flex-col items-center gap-2 py-8 border border-dashed border-border hover:border-primary/50 transition-all bg-card"
                >
                  <Upload size={24} className="text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Upload</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setStep("consent")}
              disabled={!videoFile}
              className="w-full py-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              Next: Review & Submit <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 4: Consent & Submit */}
        {step === "consent" && (
          <div className="max-w-md mx-auto space-y-6 animate-in fade-in">
            <button onClick={() => setStep("video")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronLeft size={14} /> Back
            </button>

            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-foreground">Confirm Submission</h2>
            </div>

            <div className="bg-card border border-border p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Lift</span>
                <span className="font-bold text-foreground">{exercise}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Weight</span>
                <span className="font-bold text-foreground">{weight} lbs</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Reps</span>
                <span className="font-bold text-foreground">{reps}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Video</span>
                <span className="font-bold text-primary">✓ Attached</span>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer p-3 border border-border bg-card hover:border-primary/40 transition-all">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 accent-primary w-4 h-4 shrink-0"
              />
              <div>
                <p className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Shield size={12} className="text-primary" /> Video Usage Permission
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                  I give Coach Matt permission to use this video for coaching reviews, social media, and promotional content.
                </p>
              </div>
            </label>

            <button
              onClick={handleSubmit}
              disabled={!consent}
              className="w-full py-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
            >
              <Trophy size={16} /> Submit for Review
            </button>

            {!consent && (
              <p className="text-[10px] text-muted-foreground text-center">You must agree to the video usage permission to submit.</p>
            )}
          </div>
        )}

        {/* SUBMITTING */}
        {step === "submitting" && (
          <div className="max-w-md mx-auto flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in">
            <Loader2 size={32} className="text-primary animate-spin" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Uploading your proof...</p>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div className="max-w-md mx-auto flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle size={32} className="text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Submitted!</h2>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Your {exercise} PR attempt is in the queue. Coach Matt will review your video and approve it before it counts. You'll get a notification when it's official.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-8 py-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProveItZone;
