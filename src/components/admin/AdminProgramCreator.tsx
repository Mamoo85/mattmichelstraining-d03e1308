import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Sparkles, Check, X, Link2, ExternalLink, ChevronDown, ChevronRight,
  Package, DollarSign, AlertTriangle
} from "lucide-react";

const CATEGORIES = ["Athlete", "Lifestyle Fitness"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const SPORTS = ["Baseball", "Football", "Basketball", "Volleyball", "Golf"];

interface DraftWorkout {
  week_number: number;
  day_number: number;
  exercise_id: string;
  prescribed_sets_reps: string;
  coach_instructions: string;
  sort_order: number;
}

interface DraftProgram {
  title: string;
  description: string;
  workouts: DraftWorkout[];
  category: string;
  level: string;
  sport: string | null;
  valid_exercises: number;
  invalid_exercises: number;
}

interface ProgramInventory {
  id: string;
  title: string;
  category: string;
  level: string;
  sport: string | null;
  price: number;
  is_active: boolean;
  status: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
}

const AdminProgramCreator = () => {
  // --- AI Generator ---
  const [category, setCategory] = useState("Athlete");
  const [level, setLevel] = useState("Beginner");
  const [sport, setSport] = useState("");
  const [description, setDescription] = useState("");
  const [weeks, setWeeks] = useState(8);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<DraftProgram | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchResults, setBatchResults] = useState<any[] | null>(null);

  // --- Approval ---
  const [price, setPrice] = useState(49);
  const [saving, setSaving] = useState(false);

  // --- Inventory ---
  const [inventory, setInventory] = useState<ProgramInventory[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [stripeProductInput, setStripeProductInput] = useState("");
  const [stripePriceInput, setStripePriceInput] = useState("");

  // --- Exercise map for names ---
  const [exerciseMap, setExerciseMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchInventory();
    fetchExercises();
  }, []);

  const fetchInventory = async () => {
    setLoadingInv(true);
    const { data } = await supabase
      .from("training_programs")
      .select("id, title, category, level, sport, price, is_active, status, stripe_product_id, stripe_price_id")
      .order("created_at", { ascending: false });
    setInventory((data as ProgramInventory[]) || []);
    setLoadingInv(false);
  };

  const fetchExercises = async () => {
    const { data } = await supabase.from("exercise_library").select("id, title");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((e: any) => { map[e.id] = e.title; });
      setExerciseMap(map);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setDraft(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-program", {
        body: { category, level, sport: sport || null, weeks, daysPerWeek, description },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDraft(data as DraftProgram);
      toast({ title: "Program drafted!", description: `${data.valid_exercises} exercises across ${weeks} weeks.` });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleBatchGenerate = async () => {
    setBatchGenerating(true);
    setBatchResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("batch-generate-programs");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBatchResults(data.results || []);
      const successes = (data.results || []).filter((r: any) => r.status === "success").length;
      toast({ title: "Batch complete", description: `${successes} programs generated successfully.` });
      fetchInventory();
    } catch (e: any) {
      toast({ title: "Batch failed", description: e.message, variant: "destructive" });
    } finally {
      setBatchGenerating(false);
    }
  };

  const handleApproveAndSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      // 1. Create the training program as "pending_approval"
      const { data: prog, error: progError } = await supabase
        .from("training_programs")
        .insert({
          title: draft.title,
          description: draft.description,
          category: draft.category,
          level: draft.level,
          sport: draft.sport,
          price,
          is_active: false,
          status: "pending_approval",
        })
        .select("id")
        .single();

      if (progError || !prog) throw new Error(progError?.message || "Failed to save program");

      // 2. Insert all workouts
      const workoutRows = draft.workouts.map((w) => ({
        program_id: prog.id,
        exercise_id: w.exercise_id,
        week_number: w.week_number,
        day_number: w.day_number,
        prescribed_sets_reps: w.prescribed_sets_reps,
        coach_instructions: w.coach_instructions,
        sort_order: w.sort_order,
      }));

      if (workoutRows.length > 0) {
        const { error: wError } = await supabase.from("program_workouts").insert(workoutRows);
        if (wError) throw new Error(wError.message);
      }

      toast({ title: "Program saved!", description: "Review in the inventory below, then publish when ready." });
      setDraft(null);
      fetchInventory();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    const prog = inventory.find((p) => p.id === id);
    if (!prog) return;
    if (!prog.stripe_product_id || !prog.stripe_price_id) {
      toast({ title: "Link Stripe first", description: "Connect a Stripe product & price before publishing.", variant: "destructive" });
      return;
    }
    await supabase.from("training_programs").update({ status: "published", is_active: true }).eq("id", id);
    toast({ title: "Published!" });
    fetchInventory();
  };

  const handleUnpublish = async (id: string) => {
    await supabase.from("training_programs").update({ status: "draft", is_active: false }).eq("id", id);
    toast({ title: "Unpublished" });
    fetchInventory();
  };

  const handleLinkStripe = async (id: string) => {
    if (!stripeProductInput.trim() || !stripePriceInput.trim()) {
      toast({ title: "Both Stripe IDs required", variant: "destructive" });
      return;
    }
    setLinkingId(id);
    const { error } = await supabase.from("training_programs").update({
      stripe_product_id: stripeProductInput.trim(),
      stripe_price_id: stripePriceInput.trim(),
    }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Stripe linked!" });
      setStripeProductInput("");
      setStripePriceInput("");
    }
    setLinkingId(null);
    fetchInventory();
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      pending_approval: "bg-amber-500/15 text-amber-400",
      published: "bg-emerald-500/15 text-emerald-400",
    };
    return (
      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${colors[status] || colors.draft}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  // Group draft workouts by week/day
  const groupedWorkouts = draft
    ? draft.workouts.reduce<Record<string, DraftWorkout[]>>((acc, w) => {
        const key = `W${w.week_number}D${w.day_number}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(w);
        return acc;
      }, {})
    : {};

  return (
    <div className="space-y-8">
      {/* AI Generator */}
      <div className="bg-card shadow-m2 p-5">
        <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-primary" /> AI Program Generator
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Level</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          {category === "Athlete" && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sport</label>
              <select value={sport} onChange={(e) => setSport(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
                <option value="">General</option>
                {SPORTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Weeks</label>
            <input type="number" min={1} max={16} value={weeks} onChange={(e) => setWeeks(parseInt(e.target.value) || 8)}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Days/Week</label>
            <input type="number" min={1} max={7} value={daysPerWeek} onChange={(e) => setDaysPerWeek(parseInt(e.target.value) || 3)}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Special Instructions (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Focus on rotational power for pitchers, include extra hip mobility..."
            className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary h-20 resize-none" />
        </div>

        <button onClick={handleGenerate} disabled={generating}
          className="bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50">
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generating ? "Generating…" : "Generate Program"}
        </button>

        <button onClick={handleBatchGenerate} disabled={batchGenerating}
          className="bg-accent text-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50 ml-2">
          {batchGenerating ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
          {batchGenerating ? "Generating All…" : "Batch Generate All Empty"}
        </button>
      </div>

      {/* Batch Results */}
      {batchResults && (
        <div className="bg-card shadow-m2 p-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Batch Results</h2>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {batchResults.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.status === "success" ? "bg-emerald-400" : r.status === "skipped" ? "bg-muted-foreground" : "bg-destructive"}`} />
                <span className="font-bold text-foreground truncate">{r.title}</span>
                <span className="text-muted-foreground">{r.status}{r.workouts ? ` (${r.workouts} exercises)` : ""}{r.reason ? ` — ${r.reason}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft Preview */}
      {draft && (
        <div className="bg-card shadow-m2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400" /> Draft Preview — Requires Your Approval
            </h2>
            <button onClick={() => setDraft(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>

          <div className="mb-4 space-y-1">
            <h3 className="text-base font-bold text-foreground">{draft.title}</h3>
            <p className="text-xs text-muted-foreground">{draft.description}</p>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span>{draft.category}</span><span>·</span><span>{draft.level}</span>
              {draft.sport && <><span>·</span><span>{draft.sport}</span></>}
              <span>·</span><span className="text-primary">{draft.valid_exercises} exercises</span>
              {draft.invalid_exercises > 0 && <span className="text-destructive">({draft.invalid_exercises} invalid, removed)</span>}
            </div>
          </div>

          {/* Workout breakdown */}
          <div className="max-h-[400px] overflow-y-auto space-y-2 mb-4">
            {Object.entries(groupedWorkouts).map(([key, exercises]) => (
              <div key={key} className="border border-border p-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">{key}</h4>
                <div className="space-y-1">
                  {exercises.sort((a, b) => a.sort_order - b.sort_order).map((ex, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-muted-foreground font-mono w-4 flex-shrink-0">{ex.sort_order}</span>
                      <div className="flex-1">
                        <span className="font-bold text-foreground">{exerciseMap[ex.exercise_id] || ex.exercise_id}</span>
                        <span className="text-primary ml-2">{ex.prescribed_sets_reps}</span>
                        {ex.coach_instructions && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 italic">"{ex.coach_instructions}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Approval */}
          <div className="border-t border-border pt-4 flex items-end gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Price ($)</label>
              <input type="number" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-24 bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <button onClick={handleApproveAndSave} disabled={saving}
              className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? "Saving…" : "Approve & Save to Inventory"}
            </button>
          </div>
        </div>
      )}

      {/* Program Inventory */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Package size={16} className="text-primary" /> Program Inventory ({inventory.length})
        </h2>

        {loadingInv ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
        ) : inventory.length === 0 ? (
          <div className="bg-card shadow-m2 p-8 text-center text-xs text-muted-foreground">No programs yet.</div>
        ) : (
          <div className="space-y-2">
            {inventory.map((p) => (
              <div key={p.id} className="bg-card shadow-m2">
                <div className="p-3 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                  <div className="text-muted-foreground flex-shrink-0">
                    {expandedId === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-bold text-foreground truncate">{p.title}</h3>
                      {statusBadge(p.status)}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>{p.category}</span><span>·</span><span>{p.level}</span>
                      {p.sport && <><span>·</span><span>{p.sport}</span></>}
                      <span>·</span>
                      <span className="font-mono text-primary">${p.price}</span>
                      <span>·</span>
                      {p.stripe_price_id ? (
                        <span className="text-emerald-400 flex items-center gap-0.5"><Link2 size={9} /> Stripe linked</span>
                      ) : (
                        <span className="text-amber-400">No Stripe</span>
                      )}
                    </div>
                  </div>
                </div>

                {expandedId === p.id && (
                  <div className="border-t border-border p-3 space-y-3">
                    {/* Stripe linking */}
                    <div className="bg-muted p-3 space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <DollarSign size={10} /> Stripe Connection
                      </h4>
                      {p.stripe_product_id && (
                        <div className="text-[10px] text-muted-foreground space-y-0.5">
                          <p>Product: <span className="font-mono text-foreground">{p.stripe_product_id}</span></p>
                          <p>Price: <span className="font-mono text-foreground">{p.stripe_price_id}</span></p>
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <input value={stripeProductInput} onChange={(e) => setStripeProductInput(e.target.value)}
                          placeholder="prod_xxx" className="flex-1 min-w-[120px] bg-background border border-border px-2 py-1.5 text-[10px] text-foreground font-mono outline-none focus:ring-1 focus:ring-primary" />
                        <input value={stripePriceInput} onChange={(e) => setStripePriceInput(e.target.value)}
                          placeholder="price_xxx" className="flex-1 min-w-[120px] bg-background border border-border px-2 py-1.5 text-[10px] text-foreground font-mono outline-none focus:ring-1 focus:ring-primary" />
                        <button onClick={() => handleLinkStripe(p.id)} disabled={linkingId === p.id}
                          className="bg-primary text-primary-foreground px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50">
                          {linkingId === p.id ? <Loader2 size={10} className="animate-spin" /> : "Link"}
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {p.status !== "published" ? (
                        <button onClick={() => handlePublish(p.id)}
                          className="bg-emerald-600 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 flex items-center gap-1.5">
                          <Check size={12} /> Publish to Store
                        </button>
                      ) : (
                        <button onClick={() => handleUnpublish(p.id)}
                          className="bg-muted text-muted-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground flex items-center gap-1.5">
                          <X size={12} /> Unpublish
                        </button>
                      )}
                      <a href={`https://dashboard.stripe.com/products/${p.stripe_product_id}`} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground ${!p.stripe_product_id ? "opacity-30 pointer-events-none" : ""}`}>
                        <ExternalLink size={10} /> Stripe
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProgramCreator;
