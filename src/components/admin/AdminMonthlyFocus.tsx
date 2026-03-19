import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Plus, Trophy, Flame, Check, X, Sparkles, Eye, Pencil, Trash2, Calendar,
} from "lucide-react";

/* ───────── MONTHLY CHALLENGES ───────── */

interface Challenge {
  id: string;
  title: string;
  description: string;
  metric_label: string;
  month: number;
  year: number;
  is_active: boolean;
}

/* ───────── MONTHLY FOCUS ───────── */

interface Focus {
  id: string;
  month: number;
  year: number;
  title: string;
  topic: string;
  reasoning: string;
  biomechanics: string[];
  common_mistakes: string[];
  exercises: string[];
  challenge_metric: string;
  metric_label: string;
  target_goal: number;
  matt_quote: string;
  status: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const AdminMonthlyFocus = () => {
  const { user } = useAuth();
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());

  // Challenge state
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengeLoading, setChallengeLoading] = useState(true);
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [newChallenge, setNewChallenge] = useState({ title: "", description: "", metric_label: "reps" });
  const [savingChallenge, setSavingChallenge] = useState(false);
  const [generatingChallenge, setGeneratingChallenge] = useState(false);
  const [challengeTopicInput, setChallengeTopicInput] = useState("");

  // Focus state
  const [focus, setFocus] = useState<Focus | null>(null);
  const [focusLoading, setFocusLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingFocus, setEditingFocus] = useState(false);
  const [editFocus, setEditFocus] = useState<Partial<Focus>>({});
  const [topicInput, setTopicInput] = useState("");

  // Load data
  useEffect(() => {
    loadChallenges();
    loadFocus();
  }, [selMonth, selYear]);

  const loadChallenges = async () => {
    setChallengeLoading(true);
    const { data } = await supabase
      .from("monthly_challenges")
      .select("*")
      .eq("month", selMonth)
      .eq("year", selYear);
    setChallenges((data as any[]) || []);
    setChallengeLoading(false);
  };

  const loadFocus = async () => {
    setFocusLoading(true);
    const { data } = await supabase
      .from("monthly_focus")
      .select("*")
      .eq("month", selMonth)
      .eq("year", selYear)
      .maybeSingle();
    setFocus(data as any);
    setFocusLoading(false);
  };

  /* ── Challenge CRUD ── */
  const handleCreateChallenge = async () => {
    if (!newChallenge.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    setSavingChallenge(true);
    const { error } = await supabase.from("monthly_challenges").insert({
      title: newChallenge.title,
      description: newChallenge.description,
      metric_label: newChallenge.metric_label,
      month: selMonth,
      year: selYear,
      created_by: user?.id,
    } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "Challenge created" });
      setNewChallenge({ title: "", description: "", metric_label: "reps" });
      setShowNewChallenge(false);
      loadChallenges();
    }
    setSavingChallenge(false);
  };

  const toggleChallengeActive = async (c: Challenge) => {
    await supabase.from("monthly_challenges").update({ is_active: !c.is_active } as any).eq("id", c.id);
    loadChallenges();
  };

  const deleteChallenge = async (id: string) => {
    if (!confirm("Delete this challenge?")) return;
    await supabase.from("monthly_challenges").delete().eq("id", id);
    loadChallenges();
  };

  /* ── Challenge AI Generation ── */
  const handleGenerateChallenge = async () => {
    setGeneratingChallenge(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-monthly-challenge", {
        body: { month: selMonth, year: selYear, topic: challengeTopicInput.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "🔥 Challenge generated!", description: "Review and activate below." });
      loadChallenges();
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    }
    setGeneratingChallenge(false);
  };


  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-monthly-focus", {
        body: { month: selMonth, year: selYear, topic: topicInput.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Focus generated!", description: "Review and approve below." });
      loadFocus();
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  const handleApproveFocus = async () => {
    if (!focus) return;
    const { error } = await supabase
      .from("monthly_focus")
      .update({ status: "published", approved_by: user?.id, approved_at: new Date().toISOString() } as any)
      .eq("id", focus.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Focus published!" }); loadFocus(); }
  };

  const handleUnpublishFocus = async () => {
    if (!focus) return;
    await supabase.from("monthly_focus").update({ status: "draft" } as any).eq("id", focus.id);
    toast({ title: "Unpublished" }); loadFocus();
  };

  const startEditFocus = () => {
    if (!focus) return;
    setEditFocus({
      title: focus.title,
      topic: focus.topic,
      reasoning: focus.reasoning,
      biomechanics: focus.biomechanics || [],
      common_mistakes: focus.common_mistakes || [],
      exercises: focus.exercises,
      challenge_metric: focus.challenge_metric || "",
      metric_label: (focus as any).metric_label || "reps",
      target_goal: (focus as any).target_goal || 0,
      matt_quote: focus.matt_quote,
    });
    setEditingFocus(true);
  };

  const handleSaveFocusEdit = async () => {
    if (!focus) return;
    const { error } = await supabase
      .from("monthly_focus")
      .update({
        title: editFocus.title,
        topic: editFocus.topic,
        reasoning: editFocus.reasoning,
        biomechanics: editFocus.biomechanics,
        common_mistakes: editFocus.common_mistakes,
        exercises: editFocus.exercises,
        challenge_metric: editFocus.challenge_metric,
        metric_label: editFocus.metric_label,
        target_goal: editFocus.target_goal,
        matt_quote: editFocus.matt_quote,
      } as any)
      .eq("id", focus.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Focus updated" }); setEditingFocus(false); loadFocus(); }
  };

  const deleteFocus = async () => {
    if (!focus || !confirm("Delete this focus?")) return;
    await supabase.from("monthly_focus").delete().eq("id", focus.id);
    setFocus(null);
    toast({ title: "Focus deleted" });
  };

  return (
    <div className="space-y-8">
      {/* Month/Year Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Calendar size={16} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Month:</span>
        <div className="flex gap-1 flex-wrap">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              onClick={() => setSelMonth(i + 1)}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-all ${
                selMonth === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <Input
          type="number"
          value={selYear}
          onChange={(e) => setSelYear(parseInt(e.target.value) || now.getFullYear())}
          className="w-20 h-8 text-xs font-mono"
        />
      </div>

      {/* ═══════ MONTHLY CHALLENGES ═══════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
              Monthly Challenge — {MONTHS[selMonth - 1]} {selYear}
            </h2>
          </div>
          <button
            onClick={() => setShowNewChallenge(!showNewChallenge)}
            className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Plus size={12} /> New Challenge
          </button>
        </div>

        {/* AI Challenge Generator */}
        <div className="bg-card border border-border p-4 mb-4 space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
            AI Challenge Generator
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Push-ups, Wall Sits, Burpees…"
              value={challengeTopicInput}
              onChange={(e) => setChallengeTopicInput(e.target.value)}
              className="flex-1"
            />
            <button
              onClick={handleGenerateChallenge}
              disabled={generatingChallenge}
              className="flex items-center gap-1.5 bg-accent text-accent-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all shrink-0"
            >
              {generatingChallenge ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generatingChallenge ? "Cooking…" : "AI Generate"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">Leave blank for a surprise. AI writes a funny 2-3 sentence challenge in Matt's voice.</p>
        </div>

        {/* New Challenge Form (manual) */}
        {showNewChallenge && (
          <div className="bg-card border border-border p-5 mb-4 space-y-3">
            <Input
              placeholder="Challenge title (e.g., 30-Day Push-Up Challenge)"
              value={newChallenge.title}
              onChange={(e) => setNewChallenge(p => ({ ...p, title: e.target.value }))}
            />
            <Textarea
              placeholder="Description — what's the challenge, rules, motivation..."
              value={newChallenge.description}
              onChange={(e) => setNewChallenge(p => ({ ...p, description: e.target.value }))}
              rows={3}
            />
            <Input
              placeholder="Metric label (e.g., reps, miles, minutes)"
              value={newChallenge.metric_label}
              onChange={(e) => setNewChallenge(p => ({ ...p, metric_label: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateChallenge}
                disabled={savingChallenge}
                className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
              >
                {savingChallenge ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Create
              </button>
              <button
                onClick={() => setShowNewChallenge(false)}
                className="bg-muted text-muted-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Challenge List */}
        {challengeLoading ? (
          <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-primary" /></div>
        ) : challenges.length === 0 ? (
          <div className="bg-muted p-5 text-center text-sm text-muted-foreground">
            No challenge for {MONTHS[selMonth - 1]} {selYear}. Create one above.
          </div>
        ) : (
          <div className="space-y-3">
            {challenges.map((c) => (
              <div key={c.id} className="bg-card border border-border p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-foreground">{c.title}</h3>
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${
                      c.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Metric: {c.metric_label}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleChallengeActive(c)}
                    className="p-1.5 bg-muted text-muted-foreground hover:text-foreground transition-all"
                    title={c.is_active ? "Deactivate" : "Activate"}
                  >
                    {c.is_active ? <X size={12} /> : <Check size={12} />}
                  </button>
                  <button
                    onClick={() => deleteChallenge(c.id)}
                    className="p-1.5 bg-muted text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════ MONTHLY FOCUS ═══════ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Flame size={16} className="text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            Monthly Focus — {MONTHS[selMonth - 1]} {selYear}
          </h2>
        </div>

        {/* Topic Input + Generate Button */}
        <div className="bg-card border border-border p-4 mb-4 space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
            This Month's Focus
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Side Plank, Ankle Mobility, Dead Hang…"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              className="flex-1"
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all shrink-0"
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Generate Focus Module
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">Leave blank to let AI pick a topic for this month.</p>
        </div>

        {focusLoading ? (
          <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-primary" /></div>
        ) : !focus ? (
          <div className="bg-muted p-5 text-center">
            <Sparkles size={20} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No focus content for this month. Enter a topic and generate above.</p>
          </div>
        ) : editingFocus ? (
          /* ── Editing Mode ── */
          <div className="bg-card border border-border p-5 space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Title</label>
              <Input value={editFocus.title || ""} onChange={(e) => setEditFocus(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Topic</label>
              <Input value={editFocus.topic || ""} onChange={(e) => setEditFocus(p => ({ ...p, topic: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">The Why (Matt's voice)</label>
              <Textarea
                value={editFocus.reasoning || ""}
                onChange={(e) => setEditFocus(p => ({ ...p, reasoning: e.target.value }))}
                rows={4}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                Biomechanics — Perfect Form (one per line)
              </label>
              <Textarea
                value={(editFocus.biomechanics || []).join("\n")}
                onChange={(e) => setEditFocus(p => ({ ...p, biomechanics: e.target.value.split("\n").filter(Boolean) }))}
                rows={4}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                Common Mistakes (one per line)
              </label>
              <Textarea
                value={(editFocus.common_mistakes || []).join("\n")}
                onChange={(e) => setEditFocus(p => ({ ...p, common_mistakes: e.target.value.split("\n").filter(Boolean) }))}
                rows={4}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                Exercises (one per line)
              </label>
              <Textarea
                value={(editFocus.exercises || []).join("\n")}
                onChange={(e) => setEditFocus(p => ({ ...p, exercises: e.target.value.split("\n").filter(Boolean) }))}
                rows={5}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Challenge Metric</label>
              <Input value={editFocus.challenge_metric || ""} onChange={(e) => setEditFocus(p => ({ ...p, challenge_metric: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Metric Label</label>
                <Input value={editFocus.metric_label || "reps"} onChange={(e) => setEditFocus(p => ({ ...p, metric_label: e.target.value }))} placeholder="reps, seconds, minutes" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Target Goal (number)</label>
                <Input type="number" value={editFocus.target_goal || 0} onChange={(e) => setEditFocus(p => ({ ...p, target_goal: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Matt's Quote</label>
              <Input value={editFocus.matt_quote || ""} onChange={(e) => setEditFocus(p => ({ ...p, matt_quote: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveFocusEdit}
                className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 flex items-center gap-1"
              >
                <Check size={12} /> Save
              </button>
              <button
                onClick={() => setEditingFocus(false)}
                className="bg-muted text-muted-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── Preview Mode ── */
          <div className="bg-card border border-border overflow-hidden">
            {/* Status bar */}
            <div className="px-4 py-2.5 bg-muted flex items-center gap-2">
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${
                focus.status === "published" ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground"
              }`}>
                {focus.status}
              </span>
              <div className="ml-auto flex gap-1">
                <button onClick={startEditFocus} className="p-1.5 bg-background text-muted-foreground hover:text-foreground transition-all" title="Edit">
                  <Pencil size={12} />
                </button>
                {focus.status === "draft" ? (
                  <button
                    onClick={handleApproveFocus}
                    className="p-1.5 bg-primary text-primary-foreground hover:opacity-90 transition-all flex items-center gap-1 px-3 text-[10px] font-bold uppercase tracking-widest"
                  >
                    <Eye size={12} /> Approve & Publish
                  </button>
                ) : (
                  <button
                    onClick={handleUnpublishFocus}
                    className="p-1.5 bg-muted text-muted-foreground hover:text-foreground transition-all px-3 text-[10px] font-bold uppercase tracking-widest"
                  >
                    Unpublish
                  </button>
                )}
                <button onClick={deleteFocus} className="p-1.5 bg-background text-muted-foreground hover:text-destructive transition-all" title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Content preview */}
            <div className="p-5 space-y-4">
              <h3 className="text-lg font-black uppercase tracking-tight text-foreground">{focus.title}</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{focus.topic}</p>

              {/* The Why */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">The Why</span>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{focus.reasoning}</div>
              </div>

              {/* Biomechanics */}
              {(focus.biomechanics?.length ?? 0) > 0 && (
                <div className="bg-muted p-4 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">Perfect Form</span>
                  {focus.biomechanics.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Common Mistakes */}
              {(focus.common_mistakes?.length ?? 0) > 0 && (
                <div className="bg-destructive/5 border border-destructive/10 p-4 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-destructive block">What to Avoid</span>
                  {focus.common_mistakes.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-destructive mt-0.5">✗</span>
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Exercises */}
              {focus.exercises.length > 0 && (
                <div className="bg-muted p-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">Exercises</span>
                  {focus.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-primary font-bold text-sm w-5">{i + 1}.</span>
                      <span className="text-sm text-foreground font-mono">{ex}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Challenge Metric */}
              {focus.challenge_metric && (
                <div className="bg-primary/5 border border-primary/10 p-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Challenge Goal</span>
                  <p className="text-sm font-semibold text-foreground">{focus.challenge_metric}</p>
                </div>
              )}

              {focus.matt_quote && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                  "{focus.matt_quote}" — Matt
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMonthlyFocus;
