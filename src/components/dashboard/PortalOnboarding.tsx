import { useState, useCallback } from "react";
import { safeLocalStorage } from "@/lib/browserStorage";
import {
  X, ChevronRight, ChevronLeft, Home, TrendingUp, BookOpen, Dumbbell,
  Trophy, Timer, MessageCircle, Users, Share2, Gift, Target, Camera,
  BarChart3, Zap, Sparkles
} from "lucide-react";

const STORAGE_KEY = "m2-portal-tour-seen";

interface SlideData {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: { icon: React.ReactNode; text: string }[];
  accent?: string;
}

const SLIDES: SlideData[] = [
  {
    icon: <Zap size={28} className="text-primary" />,
    title: "Welcome to the M² Portal",
    subtitle: "Everything you need to train smarter, prove yourself, and get stronger — all in one place.",
    bullets: [
      { icon: <Sparkles size={14} />, text: "AI-powered workouts built for you" },
      { icon: <Trophy size={14} />, text: "Submit PR attempts with video proof" },
      { icon: <Users size={14} />, text: "Compete with friends on leaderboards" },
      { icon: <Target size={14} />, text: "Monthly challenges keep you locked in" },
    ],
  },
  {
    icon: <Home size={28} className="text-primary" />,
    title: "Home Tab",
    subtitle: "Your daily command center.",
    bullets: [
      { icon: <Target size={14} />, text: "See this month's focus exercise and coaching tips" },
      { icon: <BarChart3 size={14} />, text: "Quick glance at your points, level, and streaks" },
      { icon: <Dumbbell size={14} />, text: "Today's Training Card — tap to start a workout" },
      { icon: <MessageCircle size={14} />, text: "Studio check-in scanner for in-person sessions" },
    ],
  },
  {
    icon: <TrendingUp size={28} className="text-primary" />,
    title: "Progress Tab",
    subtitle: "Track every rep max over time.",
    bullets: [
      { icon: <BarChart3 size={14} />, text: "Charts for Squat, Bench, Deadlift & more" },
      { icon: <Camera size={14} />, text: "Attach video to any lift for coach review" },
      { icon: <MessageCircle size={14} />, text: "Ask Coach Matt questions on any logged lift" },
      { icon: <Trophy size={14} />, text: "See your all-time PRs and muscle heatmap" },
    ],
  },
  {
    icon: <BookOpen size={28} className="text-primary" />,
    title: "My Programs Tab",
    subtitle: "Follow structured training programs.",
    bullets: [
      { icon: <Dumbbell size={14} />, text: "View your active programs and weekly blocks" },
      { icon: <Target size={14} />, text: "Log weights and reps directly in your program" },
      { icon: <Zap size={14} />, text: "Tap any day to launch it in the Workout Portal" },
      { icon: <Sparkles size={14} />, text: "Request a custom program built just for you" },
    ],
  },
  {
    icon: <Dumbbell size={28} className="text-primary" />,
    title: "Workouts Tab",
    subtitle: "Build, browse, and share workouts.",
    bullets: [
      { icon: <Sparkles size={14} />, text: "Smart Build — AI creates a workout from your goals" },
      { icon: <Dumbbell size={14} />, text: "Manual Build — pick exercises yourself" },
      { icon: <Users size={14} />, text: "Community Bank — browse & use workouts from others" },
      { icon: <Share2 size={14} />, text: "Share your workouts to earn points" },
    ],
  },
  {
    icon: <Trophy size={28} className="text-primary" />,
    title: "Challenge Tab",
    subtitle: "Compete on the leaderboard every month.",
    bullets: [
      { icon: <Target size={14} />, text: "Join the monthly challenge — new one every month" },
      { icon: <BarChart3 size={14} />, text: "Log your reps/sets and climb the leaderboard" },
      { icon: <Trophy size={14} />, text: "Earn points for every entry and streak" },
      { icon: <Gift size={14} />, text: "Top performers get recognized by Coach Matt" },
    ],
  },
  {
    icon: <Trophy size={28} className="text-primary" />,
    title: "\"Prove It\" — PR Submissions",
    subtitle: "Think you hit a new best? Prove it.",
    bullets: [
      { icon: <Camera size={14} />, text: "Tap \"Attempting New Best\" at the bottom of your dashboard" },
      { icon: <Dumbbell size={14} />, text: "Select the lift, enter your weight and reps" },
      { icon: <Camera size={14} />, text: "Record or upload your video proof (required)" },
      { icon: <Target size={14} />, text: "Coach Matt reviews and approves it — then it's official" },
    ],
  },
  {
    icon: <Zap size={28} className="text-primary" />,
    title: "The Workout Portal",
    subtitle: "Where the real work happens.",
    bullets: [
      { icon: <Dumbbell size={14} />, text: "Tap \"Enter The Portal\" to launch your active workout" },
      { icon: <Timer size={14} />, text: "Built-in interval timer — tap the ⚡ button anytime" },
      { icon: <MessageCircle size={14} />, text: "Hold the button for instant Ask Coach chat" },
      { icon: <BarChart3 size={14} />, text: "Log sets, reps, and weights in real time" },
    ],
  },
  {
    icon: <Users size={28} className="text-primary" />,
    title: "Invite, Compete, Dominate",
    subtitle: "You don't need to be the strongest — you just have to try. We'll all get stronger together.",
    bullets: [
      { icon: <Share2 size={14} />, text: "Invite friends with your referral code" },
      { icon: <Gift size={14} />, text: "Earn gift cards toward in-person sessions with Matt" },
      { icon: <Users size={14} />, text: "Share workouts and compete on challenges together" },
      { icon: <Trophy size={14} />, text: "Build a community based on strength, toughness & bravery" },
    ],
  },
];

const PortalOnboarding = () => {
  const [visible, setVisible] = useState(() => safeLocalStorage.getItem(STORAGE_KEY) !== "1");
  const [page, setPage] = useState(0);

  const dismiss = useCallback(() => {
    safeLocalStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }, []);

  if (!visible) return null;

  const slide = SLIDES[page];
  const isLast = page === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-card border border-border w-full max-w-sm max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            {slide.icon}
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {page + 1} / {SLIDES.length}
            </span>
          </div>
          <button onClick={dismiss} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">{slide.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{slide.subtitle}</p>
          </div>

          <div className="space-y-2.5">
            {slide.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="shrink-0 w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary mt-0.5">
                  {b.icon}
                </div>
                <p className="text-xs text-foreground leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === page ? "bg-primary w-4" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2">
          {page > 0 ? (
            <button
              onClick={() => setPage(page - 1)}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={14} /> Back
            </button>
          ) : (
            <div />
          )}

          {isLast ? (
            <button
              onClick={dismiss}
              className="px-5 py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
            >
              <Zap size={12} /> Let's Go!
            </button>
          ) : (
            <button
              onClick={() => setPage(page + 1)}
              className="px-5 py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
            >
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Don't show again */}
        <div className="px-4 pb-3">
          <button
            onClick={dismiss}
            className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Don't show this again
          </button>
        </div>
      </div>
    </div>
  );
};

export default PortalOnboarding;
