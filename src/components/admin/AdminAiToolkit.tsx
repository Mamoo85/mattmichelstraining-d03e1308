import { useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Loader2, Camera, Zap, ScanLine, Activity, Brain, Utensils,
  ArrowRight, X, Crosshair, Gauge, ShieldAlert, Video,
  FileText, ChefHat,
} from "lucide-react";

/* Lazy-load existing AI tools */
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
  | "interval-timer"
  | "injury-risk"
  | "video-form-review"
  | "parent-report"
  | "meal-prep";

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
    key: "injury-risk" as const,
    label: "Injury Risk Predictor",
    desc: "Analyzes 30-day training volume, recovery scores, and movement patterns to flag overtraining and predict injury risk.",
    icon: ShieldAlert,
    color: "text-red-600",
    badge: "Analytics AI",
  },
  {
    key: "video-form-review" as const,
    label: "Video Form Review",
    desc: "Upload or paste a video URL — AI gives rep-by-rep coaching cues, grades form A-F, and flags safety concerns.",
    icon: Video,
    color: "text-indigo-500",
    badge: "Vision AI",
  },
  {
    key: "parent-report" as const,
    label: "Parent Progress Report",
    desc: "Auto-generates a monthly report for a youth athlete's parents with PRs, attendance, coach notes, and growth areas.",
    icon: FileText,
    color: "text-cyan-500",
    badge: "Report AI",
  },
  {
    key: "meal-prep" as const,
    label: "AI Meal Prep Planner",
    desc: "Generates a 7-day meal plan with grocery list and prep instructions based on macro targets and dietary restrictions.",
    icon: ChefHat,
    color: "text-lime-600",
    badge: "Nutrition AI",
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

/* ── Usage display ── */
const UsageBadge = ({ usage }: { usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number; model: string } | null }) => {
  if (!usage) return null;
  return (
    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground bg-muted/50 border border-border px-3 py-2">
      <span>Model: <strong className="text-foreground">{usage.model}</strong></span>
      <span>Prompt: <strong className="text-foreground">{usage.prompt_tokens.toLocaleString()}</strong> tokens</span>
      <span>Completion: <strong className="text-foreground">{usage.completion_tokens.toLocaleString()}</strong> tokens</span>
      <span>Total: <strong className="text-foreground">{usage.total_tokens.toLocaleString()}</strong> tokens</span>
    </div>
  );
};

/* ── Inline tool UIs for new AI features ── */

const InjuryRiskTool = () => {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [usage, setUsage] = useState<any>(null);

  const run = async () => {
    if (!userId.trim()) return toast.error("Paste an athlete user ID");
    setLoading(true);
    setResult("");
    setUsage(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-injury-risk", {
        body: { clientUserId: userId.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.analysis);
      if (data?.usage) setUsage(data.usage);
    } catch (e: any) {
      toast.error(e.message || "Failed to analyze");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Paste athlete user_id" className="max-w-sm text-xs font-mono" />
        <Button size="sm" onClick={run} disabled={loading} className="text-xs">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
          {loading ? "Analyzing…" : "Run Analysis"}
        </Button>
      </div>
      {result && (
        <>
          <UsageBadge usage={usage} />
          <Card>
            <CardContent className="pt-4 prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{result}</ReactMarkdown>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

const VideoFormReviewTool = () => {
  const [videoUrl, setVideoUrl] = useState("");
  const [exercise, setExercise] = useState("Back Squat");
  const [athlete, setAthlete] = useState("Athlete");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [usage, setUsage] = useState<any>(null);

  const run = async () => {
    if (!videoUrl.trim()) return toast.error("Paste a video URL");
    setLoading(true);
    setResult("");
    setUsage(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-video-form-review", {
        body: { videoUrl: videoUrl.trim(), exerciseName: exercise, athleteName: athlete },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.review);
      if (data?.usage) setUsage(data.usage);
    } catch (e: any) {
      toast.error(e.message || "Failed to review");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Video URL (public)" className="text-xs sm:col-span-3" />
        <Input value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="Exercise name" className="text-xs" />
        <Input value={athlete} onChange={(e) => setAthlete(e.target.value)} placeholder="Athlete name" className="text-xs" />
        <Button size="sm" onClick={run} disabled={loading} className="text-xs">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
          {loading ? "Reviewing…" : "Review Form"}
        </Button>
      </div>
      {result && (
        <>
          <UsageBadge usage={usage} />
          <Card>
            <CardContent className="pt-4 prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{result}</ReactMarkdown>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

const ParentReportTool = () => {
  const [childId, setChildId] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [usage, setUsage] = useState<any>(null);

  const run = async () => {
    if (!childId.trim()) return toast.error("Paste athlete user ID");
    setLoading(true);
    setResult("");
    setUsage(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-parent-report", {
        body: { childUserId: childId.trim(), month: Number(month), year: Number(year) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.report);
      if (data?.usage) setUsage(data.usage);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <Input value={childId} onChange={(e) => setChildId(e.target.value)} placeholder="Athlete user_id" className="text-xs font-mono sm:col-span-2" />
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {new Date(2000, i).toLocaleString("en-US", { month: "long" })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" className="text-xs" />
      </div>
      <Button size="sm" onClick={run} disabled={loading} className="text-xs">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
        {loading ? "Generating…" : "Generate Report"}
      </Button>
      {result && (
        <>
          <UsageBadge usage={usage} />
          <Card>
            <CardContent className="pt-4 prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{result}</ReactMarkdown>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

const MealPrepTool = () => {
  const [calories, setCalories] = useState("2500");
  const [protein, setProtein] = useState("180");
  const [carbs, setCarbs] = useState("280");
  const [fat, setFat] = useState("80");
  const [meals, setMeals] = useState("4");
  const [restrictions, setRestrictions] = useState("none");
  const [goal, setGoal] = useState("muscle gain");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const run = async () => {
    setLoading(true);
    setResult("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-meal-prep", {
        body: {
          calories: Number(calories),
          proteinG: Number(protein),
          carbsG: Number(carbs),
          fatG: Number(fat),
          meals: Number(meals),
          dietaryRestrictions: restrictions,
          athleteGoal: goal,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.mealPlan);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate meal plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Calories</Label>
          <Input value={calories} onChange={(e) => setCalories(e.target.value)} className="text-xs" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Protein (g)</Label>
          <Input value={protein} onChange={(e) => setProtein(e.target.value)} className="text-xs" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Carbs (g)</Label>
          <Input value={carbs} onChange={(e) => setCarbs(e.target.value)} className="text-xs" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Fat (g)</Label>
          <Input value={fat} onChange={(e) => setFat(e.target.value)} className="text-xs" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Meals/Day</Label>
          <Select value={meals} onValueChange={setMeals}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n} meals</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Goal</Label>
          <Select value={goal} onValueChange={setGoal}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["muscle gain", "fat loss", "performance", "maintenance"].map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Restrictions</Label>
          <Input value={restrictions} onChange={(e) => setRestrictions(e.target.value)} placeholder="e.g., dairy-free" className="text-xs" />
        </div>
      </div>
      <Button size="sm" onClick={run} disabled={loading} className="text-xs">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <ChefHat size={14} />}
        {loading ? "Generating…" : "Generate Meal Plan"}
      </Button>
      {result && (
        <Card>
          <CardContent className="pt-4 prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{result}</ReactMarkdown>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

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
                <Input value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="Exercise name" className="max-w-xs text-xs" />
                <LiveFormTracker exerciseTitle={exerciseName} onClose={close} />
              </div>
            )}

            {activeTool === "velocity-tracker" && (
              <div className="space-y-2">
                <Input value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="Exercise name" className="max-w-xs text-xs" />
                <VelocityTracker exerciseTitle={exerciseName} onClose={close} />
              </div>
            )}

            {activeTool === "workout-scanner" && <WorkoutScanner />}
            {activeTool === "posture-capture" && <PostureCapture onComplete={close} onSkip={close} />}

            {activeTool === "exercise-sub" && (
              <div className="space-y-2">
                <Input value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="Exercise to substitute" className="max-w-xs text-xs" />
                <AiExerciseSubstitution exerciseName={exerciseName} onClose={close} />
              </div>
            )}

            {activeTool === "recovery-advisor" && (
              <div className="space-y-2">
                <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Paste athlete user_id" className="max-w-xs text-xs font-mono" />
                {userId ? <AiRecoveryAdvisor userId={userId} /> : <p className="text-xs text-muted-foreground">Enter a user ID above to load their recovery data.</p>}
              </div>
            )}

            {activeTool === "intake-analyzer" && <AiIntakeAnalyzer />}
            {activeTool === "interval-timer" && <IntervalTimer onClose={close} />}

            {/* New AI Tools */}
            {activeTool === "injury-risk" && <InjuryRiskTool />}
            {activeTool === "video-form-review" && <VideoFormReviewTool />}
            {activeTool === "parent-report" && <ParentReportTool />}
            {activeTool === "meal-prep" && <MealPrepTool />}
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default AdminAiToolkit;
