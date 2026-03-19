import { useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Camera, Zap, ScanLine, Activity, Brain, Utensils,
  ArrowRight, X, Crosshair, Gauge,
} from "lucide-react";

/* Lazy-load all AI tools */
const LiveFormTracker = lazy(() => import("@/components/workout/LiveFormTracker"));
const VelocityTracker = lazy(() => import("@/components/workout/VelocityTracker"));
const WorkoutScanner = lazy(() => import("@/components/workout/WorkoutScanner"));
const PostureCapture = lazy(() => import("@/components/dashboard/PostureCapture"));
const AiExerciseSubstitution = lazy(() => import("@/components/workout/AiExerciseSubstitution"));
const AiRecoveryAdvisor = lazy(() => import("@/components/progress/AiRecoveryAdvisor"));
const AiIntakeAnalyzer = lazy(() => import("@/components/programs/AiIntakeAnalyzer"));
const IntervalTimer = lazy(() => import("@/components/workout/IntervalTimer"));

type ActiveTool =
  | null
  | "form-tracker"
  | "velocity-tracker"
  | "workout-scanner"
  | "posture-capture"
  | "exercise-sub"
  | "recovery-advisor"
  | "intake-analyzer"
  | "interval-timer";

const TOOLS = [
  {
    key: "form-tracker" as const,
    label: "Bar Path Tracker",
    desc: "Live TF.js MoveNet camera overlay — tracks bar path drift in real time. Turns red if horizontal drift exceeds 15%.",
    icon: Crosshair,
    color: "text-red-500",
    badge: "Camera AI",
  },
  {
    key: "velocity-tracker" as const,
    label: "Velocity Tracker",
    desc: "Real-time bar speed measurement (m/s) with rep counting, fatigue alerts, and velocity-loss warnings.",
    icon: Gauge,
    color: "text-amber-500",
    badge: "Camera AI",
  },
  {
    key: "workout-scanner" as const,
    label: "Workout Scanner",
    desc: "Snap a photo of a whiteboard or workout card — AI reads it and parses exercises, sets, and reps into structured data.",
    icon: ScanLine,
    color: "text-blue-500",
    badge: "Vision AI",
  },
  {
    key: "posture-capture" as const,
    label: "Posture Assessment Camera",
    desc: "Guided front + side photo capture for AI postural analysis. Feeds into the Biomechanics engine for corrective programs.",
    icon: Camera,
    color: "text-emerald-500",
    badge: "Vision AI",
  },
  {
    key: "exercise-sub" as const,
    label: "AI Exercise Substitution",
    desc: "Given an exercise and a reason (injury, equipment, etc.), AI suggests alternatives with matching movement patterns.",
    icon: Brain,
    color: "text-purple-500",
    badge: "LLM",
  },
  {
    key: "recovery-advisor" as const,
    label: "AI Recovery Advisor",
    desc: "Analyzes an athlete's recent training log, sleep, and readiness data to suggest recovery protocols and load adjustments.",
    icon: Activity,
    color: "text-teal-500",
    badge: "LLM",
  },
  {
    key: "intake-analyzer" as const,
    label: "AI Intake Analyzer",
    desc: "Athlete intake questionnaire — AI builds a recommended program based on age, sport, goals, experience, and equipment.",
    icon: Zap,
    color: "text-orange-500",
    badge: "LLM",
  },
  {
    key: "interval-timer" as const,
    label: "Interval Timer",
    desc: "Configurable work/rest/rounds interval timer with audio cues for HIIT, Tabata, and circuit training protocols.",
    icon: ArrowRight,
    color: "text-pink-500",
    badge: "Utility",
  },
];

const ToolLoader = () => (
  <div className="flex justify-center py-20">
    <Loader2 className="animate-spin text-primary" size={28} />
  </div>
);

const AdminAiToolkit = () => {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [exerciseName, setExerciseName] = useState("Back Squat");
  const [userId, setUserId] = useState("");

  const close = () => setActiveTool(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-foreground tracking-display uppercase">AI Toolkit</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Every AI-powered tool on the platform — test, demo, or use on behalf of a client.
        </p>
      </div>

      {/* Tool Grid */}
      {!activeTool && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card
                key={tool.key}
                className="cursor-pointer hover:border-primary/50 transition-all group"
                onClick={() => setActiveTool(tool.key)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Icon size={20} className={tool.color} />
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest">
                      {tool.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-xs font-bold mt-2 group-hover:text-primary transition-colors">
                    {tool.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{tool.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Active Tool View */}
      {activeTool && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={close} className="text-xs gap-1">
              <X size={14} /> Back to Toolkit
            </Button>
            <Badge className="text-[10px] uppercase tracking-widest">
              {TOOLS.find((t) => t.key === activeTool)?.label}
            </Badge>
          </div>

          <Suspense fallback={<ToolLoader />}>
            {activeTool === "form-tracker" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={exerciseName}
                    onChange={(e) => setExerciseName(e.target.value)}
                    placeholder="Exercise name"
                    className="max-w-xs text-xs"
                  />
                </div>
                <LiveFormTracker exerciseTitle={exerciseName} onClose={close} />
              </div>
            )}

            {activeTool === "velocity-tracker" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={exerciseName}
                    onChange={(e) => setExerciseName(e.target.value)}
                    placeholder="Exercise name"
                    className="max-w-xs text-xs"
                  />
                </div>
                <VelocityTracker exerciseTitle={exerciseName} onClose={close} />
              </div>
            )}

            {activeTool === "workout-scanner" && <WorkoutScanner />}

            {activeTool === "posture-capture" && (
              <PostureCapture onComplete={close} onSkip={close} />
            )}

            {activeTool === "exercise-sub" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={exerciseName}
                    onChange={(e) => setExerciseName(e.target.value)}
                    placeholder="Exercise to substitute"
                    className="max-w-xs text-xs"
                  />
                </div>
                <AiExerciseSubstitution exerciseName={exerciseName} onClose={close} />
              </div>
            )}

            {activeTool === "recovery-advisor" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Paste athlete user_id"
                    className="max-w-xs text-xs font-mono"
                  />
                </div>
                {userId ? (
                  <AiRecoveryAdvisor userId={userId} />
                ) : (
                  <p className="text-xs text-muted-foreground">Enter a user ID above to load their recovery data.</p>
                )}
              </div>
            )}

            {activeTool === "intake-analyzer" && <AiIntakeAnalyzer />}

            {activeTool === "interval-timer" && <IntervalTimer onClose={close} />}
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default AdminAiToolkit;
