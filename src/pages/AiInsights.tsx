import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, Heart, Dumbbell, Zap, RefreshCw, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import ZoneThemeWrapper from "@/components/zone/ZoneThemeWrapper";
import { safeLocalStorage } from "@/lib/browserStorage";
import SEOHead from "@/components/layout/SEOHead";

const CACHE_KEY = "m2-ai-insights-cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 min

interface InsightsData {
  recovery: string;
  mobility: string;
  liftTips: string;
  recentActivities: { description: string; activity_type: string; intensity: string; logged_at: string }[];
}

const AiInsights = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightsData | null>(null);

  const fetchInsights = useCallback(async (force = false) => {
    if (!user) return;

    // Check cache
    if (!force) {
      const cached = safeLocalStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.ts < CACHE_TTL) {
            setInsights(parsed.data);
            setLoading(false);
            return;
          }
        } catch { /* stale cache */ }
      }
    }

    setLoading(true);
    try {
      // Fetch recent activity logs
      const { data: activities } = await supabase
        .from("activity_logs" as any)
        .select("description, activity_type, intensity, logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(10) as any;

      // Fetch recent lift logs for context
      const { data: lifts } = await supabase
        .from("progress_logs")
        .select("exercise_name, weight, reps, logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(15);

      const context = {
        activities: activities || [],
        lifts: lifts || [],
      };

      // Call AI for insights
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-athlete-stream`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Based on my recent training data, give me personalized insights in 4 sections. Use markdown formatting with headers.

## 🔄 Recovery Recommendations
What I should focus on for recovery based on my recent sessions.

## 🧘 Mobility & Rolling
Specific mobility exercises, stretches, and foam rolling I should do based on the muscles I've been working.

## 💪 Lift Tips
Form cues and training tips based on my recent lifts.

## ⚡ Training Load Analysis
Am I overtraining certain areas? What balance adjustments should I make?

My recent activities: ${JSON.stringify(context.activities)}
My recent lifts: ${JSON.stringify(context.lifts)}`,
            },
          ],
        }),
      });

      if (!resp.ok) throw new Error("Failed to get insights");

      let accumulated = "";
      if (resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, idx);
            textBuffer = textBuffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) accumulated += delta;
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      }

      // Parse sections
      const sections = accumulated.split(/##\s+/);
      const findSection = (emoji: string) => {
        const s = sections.find(s => s.includes(emoji));
        return s ? s.replace(/^[^\n]*\n/, "").trim() : "";
      };

      const data: InsightsData = {
        recovery: findSection("🔄") || findSection("Recovery") || "No data yet — log some activities first!",
        mobility: findSection("🧘") || findSection("Mobility") || "Log workouts to get mobility recommendations.",
        liftTips: findSection("💪") || findSection("Lift") || "Log some lifts to get personalized tips.",
        recentActivities: (activities as any[]) || [],
      };

      // Add training load if found
      const trainingLoad = findSection("⚡") || findSection("Training Load");
      if (trainingLoad) {
        data.liftTips += "\n\n---\n\n## ⚡ Training Load\n" + trainingLoad;
      }

      setInsights(data);
      safeLocalStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch (e: any) {
      toast({ title: "Couldn't load insights", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const CARDS = [
    { key: "recovery", title: "Recovery", subtitle: "What your body needs right now", icon: Heart, color: "#22c55e", content: insights?.recovery },
    { key: "mobility", title: "Mobility & Rolling", subtitle: "Stay loose and injury-free", icon: Zap, color: "#00f0ff", content: insights?.mobility },
    { key: "liftTips", title: "Lift Tips & Load", subtitle: "Form cues and training balance", icon: Dumbbell, color: "#f97316", content: insights?.liftTips },
  ];

  return (
    <ZoneThemeWrapper className="min-h-screen pb-24" style={{ background: "#0a0a0a", color: "#e5e5e5" }}>
      <SEOHead title="AI Insights | M² Performance" description="Your personalized AI training insights" />

      <header className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3" style={{ background: "rgba(10,10,10,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
          <ArrowLeft size={16} style={{ color: "#fafafa" }} />
        </button>
        <div className="flex-1">
          <p className="text-sm font-black" style={{ color: "#fafafa" }}>AI Insights</p>
          <p className="text-[10px]" style={{ color: "#737373" }}>Personalized to your training</p>
        </div>
        <button
          onClick={() => fetchInsights(true)}
          disabled={loading}
          className="h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: "rgba(168,85,247,0.15)" }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} style={{ color: "#a855f7" }} />
        </button>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Hero */}
        <div className="rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(249,115,22,0.06))", border: "1px solid rgba(168,85,247,0.15)" }}>
          <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}>
            <Brain size={26} color="#fff" />
          </div>
          <p className="text-sm font-black" style={{ color: "#fafafa" }}>Your AI Coach</p>
          <p className="text-[11px] mt-1" style={{ color: "#737373" }}>Recommendations based on your entire training history</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={24} className="animate-spin" style={{ color: "#a855f7" }} />
            <p className="text-xs" style={{ color: "#525252" }}>Analyzing your training data...</p>
          </div>
        ) : (
          <>
            {CARDS.map(card => {
              const Icon = card.icon;
              return (
                <div key={card.key} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${card.color}25` }}>
                  <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${card.color}15` }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${card.color}18` }}>
                      <Icon size={16} style={{ color: card.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider" style={{ color: card.color }}>{card.title}</p>
                      <p className="text-[10px]" style={{ color: "#525252" }}>{card.subtitle}</p>
                    </div>
                  </div>
                  <div className="px-4 py-3 prose prose-sm prose-invert max-w-none text-[12px] leading-relaxed" style={{ color: "#a3a3a3" }}>
                    <ReactMarkdown>{card.content || "No data yet."}</ReactMarkdown>
                  </div>
                </div>
              );
            })}

            {/* Recent activities */}
            {insights?.recentActivities && insights.recentActivities.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#a3a3a3" }}>Recent Activities</p>
                </div>
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  {insights.recentActivities.slice(0, 5).map((a, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>
                        {a.activity_type}
                      </span>
                      <p className="text-[11px] flex-1 truncate" style={{ color: "#e5e5e5" }}>{a.description}</p>
                      <span className="text-[9px] shrink-0" style={{ color: "#525252" }}>
                        {new Date(a.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </ZoneThemeWrapper>
  );
};

export default AiInsights;
