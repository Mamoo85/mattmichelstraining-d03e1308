import { useState } from "react";
import { Sparkles, Loader2, ArrowRight, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SPORTS = ["Baseball", "Football", "Basketball", "Volleyball", "Golf", "Soccer", "Hockey", "Lacrosse", "Swimming", "Track & Field", "Tennis", "General Fitness"];
const EXPERIENCE = ["Never trained before", "Some gym experience (<1 year)", "Intermediate (1-3 years)", "Advanced (3+ years)"];
const EQUIPMENT_OPTIONS = ["Full gym", "Home gym (dumbbells, bench, rack)", "Dumbbells only", "Bodyweight only", "School/team weight room", "Resistance bands + bodyweight"];

const AiIntakeAnalyzer = () => {
  const { user } = useAuth();
  const [age, setAge] = useState("");
  const [sport, setSport] = useState("");
  const [experience, setExperience] = useState("");
  const [goals, setGoals] = useState("");
  const [equipment, setEquipment] = useState("");
  const [injuries, setInjuries] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("3");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!age || !experience || !goals) {
      toast({ title: "Fill in required fields", description: "Age, experience, and goals are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-athlete-assist", {
        body: {
          type: "intake_analyzer",
          context: { age, sport, experience, goals, equipment, injuries, daysPerWeek, additionalNotes },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.queued) {
        setResult("✅ Your intake analysis has been submitted for Coach Matt's review. You'll get a notification when your personalized recommendation is ready.");
      } else {
        setResult(data.result);
      }
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-card shadow-m2 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={18} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground">AI Program Finder</h3>
        <span className="text-[10px] text-muted-foreground">Tell us about your athlete — we'll recommend the right program</span>
      </div>

      {!result ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Age *</label>
              <input type="number" min={8} max={80} value={age} onChange={(e) => setAge(e.target.value)}
                placeholder="14"
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sport</label>
              <select value={sport} onChange={(e) => setSport(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select sport...</option>
                {SPORTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Experience *</label>
              <select value={experience} onChange={(e) => setExperience(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select...</option>
                {EXPERIENCE.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Days/Week</label>
              <select value={daysPerWeek} onChange={(e) => setDaysPerWeek(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
                {["2", "3", "4", "5", "6"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Equipment Available</label>
              <select value={equipment} onChange={(e) => setEquipment(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select...</option>
                {EQUIPMENT_OPTIONS.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Goals *</label>
              <textarea value={goals} onChange={(e) => setGoals(e.target.value)}
                placeholder="e.g., Get stronger for football season, prevent knee injuries, improve speed..."
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary h-16 resize-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Injury History</label>
              <textarea value={injuries} onChange={(e) => setInjuries(e.target.value)}
                placeholder="e.g., Sprained ankle last year, shoulder tightness..."
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary h-12 resize-none" />
            </div>
          </div>

          <button onClick={handleAnalyze} disabled={loading}
            className="w-full bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? "Analyzing..." : "Find My Program"}
          </button>
        </>
      ) : (
        <div>
          <div className="prose prose-sm max-w-none text-foreground mb-4">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
          <button onClick={() => setResult(null)}
            className="text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-m2">
            ← Try Different Answers
          </button>
        </div>
      )}
    </div>
  );
};

export default AiIntakeAnalyzer;
