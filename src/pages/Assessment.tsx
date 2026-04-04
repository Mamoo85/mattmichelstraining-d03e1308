import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Upload, Camera, X, CheckCircle2, Loader2, ImagePlus, Video } from "lucide-react";
import SEOHead from "@/components/layout/SEOHead";
import AppNavbar from "@/components/layout/AppNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STEPS = ["Baseline & Damage Report", "Environment", "Visual Check"];

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25MB

interface FormData {
  age: string;
  height: string;
  weight: string;
  dailyActivity: string;
  injuryHistory: string;
  equipmentAccess: string;
  goals: string;
}

interface MediaFiles {
  front: File | null;
  back: File | null;
  side: File | null;
  video: File | null;
}

const Assessment = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<FormData>({
    age: "", height: "", weight: "", dailyActivity: "",
    injuryHistory: "", equipmentAccess: "", goals: "",
  });

  const [media, setMedia] = useState<MediaFiles>({ front: null, back: null, side: null, video: null });
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const fileRefs = {
    front: useRef<HTMLInputElement>(null),
    back: useRef<HTMLInputElement>(null),
    side: useRef<HTMLInputElement>(null),
    video: useRef<HTMLInputElement>(null),
  };

  const updateForm = (key: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleFileSelect = useCallback((key: keyof MediaFiles, file: File | null) => {
    if (!file) return;
    const isVideo = key === "video";
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_PHOTO_SIZE;
    const expectedType = isVideo ? "video/" : "image/";

    if (!file.type.startsWith(expectedType)) {
      toast({ title: `Please upload ${isVideo ? "a video" : "an image"} file.`, variant: "destructive" });
      return;
    }
    if (file.size > maxSize) {
      toast({ title: `File must be under ${isVideo ? "25MB" : "5MB"}.`, variant: "destructive" });
      return;
    }
    setMedia((prev) => ({ ...prev, [key]: file }));
    setPreviews((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));
  }, []);

  const removeFile = (key: keyof MediaFiles) => {
    setMedia((prev) => ({ ...prev, [key]: null }));
    setPreviews((prev) => { const n = { ...prev }; delete n[key]; return n; });
    const ref = fileRefs[key];
    if (ref.current) ref.current.value = "";
  };

  // Step validation
  const canAdvance = () => {
    if (step === 0) return form.injuryHistory.trim().length > 0;
    if (step === 1) return true;
    if (step === 2) return media.front && media.back && media.side;
    return true;
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user!.id}/${folder}_${Date.now()}.${ext}`;
    if (path.includes('..')) throw new Error('Invalid path');
    const { error } = await supabase.storage.from("assessments").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // Upload media
      const photoPaths: string[] = [];
      for (const key of ["front", "back", "side"] as const) {
        if (media[key]) photoPaths.push(await uploadFile(media[key]!, key));
      }
      let videoPath: string | null = null;
      if (media.video) videoPath = await uploadFile(media.video, "squat_video");

      // Insert assessment
      const { error } = await supabase.from("intake_assessments").insert({
        user_id: user.id,
        age: form.age ? parseInt(form.age, 10) : null,
        height: form.height || null,
        weight: form.weight || null,
        daily_activity: form.dailyActivity || null,
        injury_history: form.injuryHistory,
        equipment_access: form.equipmentAccess || null,
        goals: form.goals || null,
        posture_photos: photoPaths,
        squat_video: videoPath,
      });

      if (error) throw error;

      toast({ title: "Assessment sent to Coach Matt. Your custom block will be ready in 24 hours." });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const PhotoUploadZone = ({ label, fileKey }: { label: string; fileKey: "front" | "back" | "side" }) => (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {previews[fileKey] ? (
        <div className="relative">
          <img src={previews[fileKey]} alt={label} className="w-28 h-36 object-cover rounded-lg border border-border" />
          <button onClick={() => removeFile(fileKey)} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRefs[fileKey].current?.click()}
          className="w-28 h-36 border-2 border-dashed border-primary/30 hover:border-primary/60 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors"
        >
          <ImagePlus size={24} className="text-primary/40" />
          <span className="text-[10px] text-muted-foreground">Required</span>
        </button>
      )}
      <input ref={fileRefs[fileKey]} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(fileKey, e.target.files[0])} />
    </div>
  );

  return (
    <>
      <SEOHead title="Pro Assessment | M2 Performance" description="Complete your intake assessment for personalized coaching from Coach Matt." path="/assessment" />
      <AppNavbar />
      <div className="min-h-screen bg-background pt-20 pb-32 px-4">
        <div className="max-w-xl mx-auto">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${i <= step ? "text-primary" : "text-muted-foreground"}`}>{s}</span>
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
              <Card className="border-border bg-card">
                <CardContent className="pt-6 space-y-5">

                  {step === 0 && (
                    <>
                      <h2 className="text-xl font-black text-foreground">Baseline & Damage Report</h2>
                      <p className="text-sm text-muted-foreground">Tell me everything so I can build the right program from day one.</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">Age</label>
                          <Input type="number" value={form.age} onChange={(e) => updateForm("age", e.target.value)} placeholder="e.g. 28" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">Height</label>
                          <Input value={form.height} onChange={(e) => updateForm("height", e.target.value)} placeholder="5'10&quot;" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">Weight</label>
                          <Input value={form.weight} onChange={(e) => updateForm("weight", e.target.value)} placeholder="185 lbs" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">Daily Activity Level</label>
                        <Input value={form.dailyActivity} onChange={(e) => updateForm("dailyActivity", e.target.value)} placeholder="Desk job, walk 30 min/day..." />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">
                          Injury History & Chronic Pain <span className="text-destructive">*</span>
                        </label>
                        <p className="text-[11px] text-muted-foreground mb-1">Do not leave anything out. Previous surgeries, nagging aches, mobility restrictions — all of it.</p>
                        <Textarea
                          value={form.injuryHistory}
                          onChange={(e) => updateForm("injuryHistory", e.target.value)}
                          placeholder="List every injury, surgery, or chronic issue..."
                          className="min-h-[140px]"
                          required
                        />
                      </div>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <h2 className="text-xl font-black text-foreground">Your Environment</h2>
                      <p className="text-sm text-muted-foreground">Help me understand what you're working with and where you want to go.</p>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">Available Equipment</label>
                        <Textarea
                          value={form.equipmentAccess}
                          onChange={(e) => updateForm("equipmentAccess", e.target.value)}
                          placeholder="Full gym, home dumbbells only, barbell + rack..."
                          className="min-h-[100px]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">12-Week Definition of Success</label>
                        <Textarea
                          value={form.goals}
                          onChange={(e) => updateForm("goals", e.target.value)}
                          placeholder="What does winning look like in 12 weeks? Be specific."
                          className="min-h-[120px]"
                        />
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <h2 className="text-xl font-black text-foreground">Visual Check</h2>
                      <p className="text-sm text-muted-foreground">Upload 3 posture photos and 1 squat video so I can see how you move.</p>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-3">
                          📸 Posture Photos (Front, Back, Side) <span className="text-destructive">*</span>
                        </label>
                        <div className="flex gap-4 justify-center">
                          <PhotoUploadZone label="Front" fileKey="front" />
                          <PhotoUploadZone label="Back" fileKey="back" />
                          <PhotoUploadZone label="Side" fileKey="side" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
                          🎥 Bodyweight Squat Video (15 seconds, side angle)
                        </label>
                        {previews.video ? (
                          <div className="relative inline-block">
                            <video src={previews.video} controls className="w-full max-w-xs rounded-lg border border-border" />
                            <button onClick={() => removeFile("video")} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md">
                              <X size={12} />
                            </button>
                            <p className="text-[10px] text-primary font-bold mt-1">✓ Video attached</p>
                          </div>
                        ) : (
                          <button
                            onClick={() => fileRefs.video.current?.click()}
                            className="w-full border-2 border-dashed border-primary/30 hover:border-primary/60 rounded-lg p-6 flex flex-col items-center gap-2 transition-colors"
                          >
                            <Video size={28} className="text-primary/40" />
                            <span className="text-sm text-muted-foreground">Tap to upload or record</span>
                            <span className="text-[10px] text-muted-foreground">Max 25MB</span>
                          </button>
                        )}
                        <input ref={fileRefs.video} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect("video", e.target.files[0])} />
                      </div>
                    </>
                  )}

                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-1">
              <ArrowLeft size={16} /> Back
            </Button>

            {step < 2 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()} className="gap-1">
                Next <ArrowRight size={16} />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canAdvance() || submitting} className="gap-1">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {submitting ? "Sending..." : "Submit Assessment"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Assessment;
