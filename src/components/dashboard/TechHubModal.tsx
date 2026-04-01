import { memo, useState, lazy, Suspense } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Camera, Dumbbell, Wrench, Apple, Heart, ScanLine, Brain, Sparkles, ArrowRight, Loader2,
} from "lucide-react";

const SelfPostureAnalysis = lazy(() => import("./SelfPostureAnalysis"));

interface TechTool {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  action: "posture" | "navigate";
  route?: string;
}

const TOOLS: TechTool[] = [
  {
    key: "posture",
    label: "Posture Analysis",
    description: "AI-powered front + side photo analysis with corrective exercises and a shareable report.",
    icon: Camera,
    color: "#00f0ff",
    action: "posture",
  },
  {
    key: "generate",
    label: "AI Workout Generator",
    description: "Describe your goals and equipment — get a custom workout built by Coach Matt's AI in seconds.",
    icon: Sparkles,
    color: "#a855f7",
    action: "navigate",
    route: "/dashboard?tab=workouts",
  },
  {
    key: "fixit",
    label: "Fix It Engine",
    description: "Describe a pain point or tight area — get a corrective protocol with mobility and rehab exercises.",
    icon: Wrench,
    color: "#22c55e",
    action: "navigate",
    route: "/dashboard?tab=workouts",
  },
  {
    key: "nutrition",
    label: "Food Scanner",
    description: "Snap a photo of your meal — get instant macro breakdown, calorie count, and nutrition coaching.",
    icon: Apple,
    color: "#f97316",
    action: "navigate",
    route: "/dashboard?tab=home",
  },
  {
    key: "recovery",
    label: "Recovery Advisor",
    description: "AI analyzes your sleep, soreness, and energy trends to recommend recovery strategies.",
    icon: Heart,
    color: "#ec4899",
    action: "navigate",
    route: "/dashboard?tab=progress",
  },
  {
    key: "scanner",
    label: "Workout Scanner",
    description: "Photograph a whiteboard workout or handwritten plan — AI converts it into a trackable session.",
    icon: ScanLine,
    color: "#3b82f6",
    action: "navigate",
    route: "/dashboard?tab=workouts",
  },
];

interface TechHubModalProps {
  open: boolean;
  onClose: () => void;
}

const TechHubModal = memo(({ open, onClose }: TechHubModalProps) => {
  const [postureOpen, setPostureOpen] = useState(false);

  const handleToolClick = (tool: TechTool) => {
    if (tool.action === "posture") {
      onClose();
      // Small delay so dialog animation doesn't clash
      setTimeout(() => setPostureOpen(true), 200);
    } else if (tool.route) {
      onClose();
      window.location.href = tool.route;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-primary">
              <Brain size={16} /> M² Technology
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground -mt-2 mb-3">
            AI-powered tools you can use on yourself or show a friend. Every tool generates shareable results.
          </p>

          <div className="space-y-2">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.key}
                  onClick={() => handleToolClick(tool)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl transition-all hover:bg-muted/50 active:scale-[0.98] text-left border border-transparent hover:border-border"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${tool.color}22` }}
                  >
                    <Icon size={18} style={{ color: tool.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{tool.label}</span>
                      <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">
                      {tool.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Upsell footer */}
          <div className="border-t border-border pt-3 mt-2">
            <p className="text-[10px] text-muted-foreground text-center">
              All tools included with your M² membership. Show a friend?{" "}
              <span className="text-primary font-bold">They get one free analysis.</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        <SelfPostureAnalysis open={postureOpen} onClose={() => setPostureOpen(false)} />
      </Suspense>
    </>
  );
});

TechHubModal.displayName = "TechHubModal";
export default TechHubModal;
