import { useState, useRef, useCallback, memo } from "react";
import Webcam from "react-webcam";
import { Camera, RotateCcw, Check, Loader2, Share2, Download, Mail, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import ReactMarkdown from "react-markdown";

type Step = "intro" | "front" | "side" | "analyzing" | "results";

const INSTRUCTIONS: Record<"front" | "side", { label: string; tip: string }> = {
  front: { label: "Front View", tip: "Stand facing the camera, arms relaxed at sides, feet hip-width apart" },
  side: { label: "Side View", tip: "Turn 90° to the camera, stand naturally — don't try to fix your posture" },
};

interface SelfPostureAnalysisProps {
  open: boolean;
  onClose: () => void;
}

const SelfPostureAnalysis = memo(({ open, onClose }: SelfPostureAnalysisProps) => {
  const { user } = useAuth();
  
  const webcamRef = useRef<Webcam>(null);
  const [step, setStep] = useState<Step>("intro");
  const [frontImg, setFrontImg] = useState<string | null>(null);
  const [sideImg, setSideImg] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("intro");
    setFrontImg(null);
    setSideImg(null);
    setCaptured(false);
    setSubjectName("");
    setAnalysis(null);
    setAnalyzedAt(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const capture = useCallback(() => {
    const img = webcamRef.current?.getScreenshot();
    if (!img) return;
    if (step === "front") setFrontImg(img);
    else if (step === "side") setSideImg(img);
    setCaptured(true);
  }, [step]);

  const retake = () => setCaptured(false);

  const proceed = async () => {
    if (step === "front") {
      setCaptured(false);
      setStep("side");
      return;
    }
    if (step === "side" && frontImg && sideImg) {
      setStep("analyzing");
      try {
        const frontBase64 = frontImg.split(",")[1];
        const sideBase64 = sideImg.split(",")[1];

        const { data, error } = await supabase.functions.invoke("ai-posture-analysis", {
          body: {
            frontImageBase64: frontBase64,
            sideImageBase64: sideBase64,
            subjectName: subjectName || undefined,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setAnalysis(data.analysis);
        setAnalyzedAt(data.analyzedAt);
        setStep("results");
      } catch (err: any) {
        toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
        setStep("side");
        setCaptured(true);
      }
    }
  };

  const generatePdfHtml = () => {
    const name = subjectName || "Self";
    const date = analyzedAt ? new Date(analyzedAt).toLocaleDateString() : new Date().toLocaleDateString();
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>M² Posture Analysis - ${name}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:40px 24px;color:#1e293b;line-height:1.6;}
  h1{color:#e8621a;font-size:28px;border-bottom:3px solid #e8621a;padding-bottom:8px;margin-bottom:4px;}
  h2{color:#e8621a;margin-top:24px;font-size:18px;}
  .header{text-align:center;margin-bottom:32px;}
  .logo{font-size:36px;font-weight:900;color:#e8621a;letter-spacing:4px;}
  .sub{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:3px;}
  .meta{font-size:12px;color:#64748b;margin-bottom:24px;}
  .cta{background:#e8621a;color:white;padding:16px 24px;text-align:center;margin-top:32px;font-weight:700;font-size:14px;}
  .cta a{color:white;text-decoration:none;}
  ul{padding-left:20px;}
  li{margin-bottom:4px;}
</style></head><body>
<div class="header"><div class="logo">M²</div><div class="sub">Performance Training</div></div>
<h1>Posture Analysis Report</h1>
<div class="meta">Subject: ${name} | Date: ${date} | Analyzed by M² AI</div>
<div>${(analysis || "").replace(/\n/g, "<br>").replace(/## /g, "</div><h2>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/- /g, "• ")}</div>
<div class="cta"><a href="https://mattmichelstraining.lovable.app/shop">Ready to fix these issues? Browse M² Training Programs →</a></div>
<div style="text-align:center;margin-top:16px;font-size:11px;color:#94a3b8;">
  mattmichelstraining.com | matt@mattmichelstraining.com | (313) 806-4952
</div>
</body></html>`;
  };

  const handleDownloadPdf = () => {
    const html = generatePdfHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `M2-Posture-Analysis-${(subjectName || "Self").replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report downloaded!", description: "Open the file in a browser and print to PDF for best results." });
  };

  const handleShare = async () => {
    const text = `Check out my M² Posture Analysis results!\n\n${(analysis || "").slice(0, 500)}...\n\nGet your own free analysis at mattmichelstraining.lovable.app/dashboard`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "M² Posture Analysis", text });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!", description: "Paste and send to a friend." });
    }
  };

  const handleSendToMatt = async () => {
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: user?.id || "",
        type: "posture_request",
        title: "Posture Analysis — Review Request",
        body: `${subjectName || "A user"} wants Coach Matt to review their AI posture analysis.`,
        link: "/admin",
      });

      // Also notify admins
      const { data: adminRoles } = await supabase.from("user_roles" as any).select("user_id").eq("role", "admin");
      if (adminRoles && Array.isArray(adminRoles)) {
        const notifications = adminRoles.map((r: any) => ({
          user_id: r.user_id,
          type: "posture_request",
          title: "User Posture Review Request",
          body: `${subjectName || "A user"} requested Coach Matt review their posture analysis.`,
          link: "/admin",
        }));
        await supabase.from("notifications").insert(notifications);
      }

      toast({ title: "Sent to Coach Matt! 📬", description: "Matt will review your results and follow up." });
    } catch {
      toast({ title: "Failed to send", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-black uppercase tracking-widest text-primary">
            Posture Analysis
          </DialogTitle>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Camera size={28} className="text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Get an instant AI-powered posture analysis. We'll take two photos — front and side view — and give you a detailed report with corrective exercises.
            </p>
            <p className="text-xs text-muted-foreground">Works on yourself or a friend!</p>
            <input
              type="text"
              placeholder="Name (optional — e.g. 'John' or leave blank for self)"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground/50 rounded-lg"
            />
            <button
              onClick={() => setStep("front")}
              className="w-full py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all rounded-lg"
            >
              Start Analysis <ArrowRight size={12} className="inline ml-1" />
            </button>
          </div>
        )}

        {(step === "front" || step === "side") && (
          <div className="space-y-4">
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {INSTRUCTIONS[step].label}
              </span>
              <p className="text-xs text-muted-foreground mt-1">{INSTRUCTIONS[step].tip}</p>
            </div>

            <div className="relative aspect-[3/4] max-w-[280px] mx-auto bg-black overflow-hidden rounded-lg border border-border">
              {captured && (step === "front" ? frontImg : sideImg) ? (
                <img src={(step === "front" ? frontImg : sideImg)!} alt={`${step} view`} className="w-full h-full object-cover" />
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
                  <button onClick={retake} className="flex items-center gap-1.5 px-4 py-2 bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-all rounded-lg">
                    <RotateCcw size={12} /> Retake
                  </button>
                  <button onClick={proceed} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all rounded-lg">
                    <Check size={12} /> {step === "front" ? "Next → Side" : "Analyze"}
                  </button>
                </>
              ) : (
                <button onClick={capture} className="flex items-center gap-1.5 px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all rounded-lg">
                  <Camera size={14} /> Capture {INSTRUCTIONS[step].label}
                </button>
              )}
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Analyzing posture…
            </p>
            <p className="text-xs text-muted-foreground/60">This usually takes 10-20 seconds</p>
          </div>
        )}

        {step === "results" && analysis && (
          <div className="space-y-4">
            <div className="prose prose-sm prose-invert max-w-none text-foreground [&_h2]:text-primary [&_h2]:text-sm [&_h2]:font-black [&_h2]:uppercase [&_h2]:tracking-widest [&_h2]:mt-4 [&_h2]:mb-2 [&_strong]:text-primary [&_ul]:text-xs [&_p]:text-xs [&_li]:text-muted-foreground">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>

            {/* Action buttons */}
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center mb-3">
                Share Results
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleDownloadPdf} className="flex items-center justify-center gap-1.5 py-2.5 bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-all rounded-lg">
                  <Download size={12} /> Save Report
                </button>
                <button onClick={handleShare} className="flex items-center justify-center gap-1.5 py-2.5 bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-all rounded-lg">
                  <Share2 size={12} /> Send to Friend
                </button>
                <button onClick={handleSendToMatt} className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all rounded-lg border border-primary/20">
                  <Mail size={12} /> Send to Coach Matt for Review
                </button>
              </div>
            </div>

            {/* No upsell — this is a pure value tool for clients */}

            {/* Re-analyze */}
            <button onClick={reset} className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground transition-colors pt-1">
              Analyze Someone Else
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

SelfPostureAnalysis.displayName = "SelfPostureAnalysis";
export default SelfPostureAnalysis;
