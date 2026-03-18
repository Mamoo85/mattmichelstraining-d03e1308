import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Pencil, Trash2, X, Dumbbell, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import AiAssistButton from "./AiAssistButton";

interface Exercise {
  id: string;
  title: string;
  equipment_needed: string;
  the_why: string;
  client_type: string[];
  focus_area: string[];
  sport: string[];
  video_url: string;
  level: string;
}

const PRESET_CLIENT_TYPES = ["Athlete", "Lifestyle Fitness"];
const PRESET_FOCUS_AREAS = ["Mobility", "Strength", "Core Stability", "Flexibility", "Rehab", "Stability", "Posture", "Power", "Speed", "Injury Prevention", "Core"];
const PRESET_LEVELS = ["beginner", "intermediate", "advanced"];

const EMPTY: Exercise = {
  id: "",
  title: "",
  equipment_needed: "",
  the_why: "",
  client_type: [],
  focus_area: [],
  sport: [],
  video_url: "",
};

const AdminExerciseLibrary = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [sportInput, setSportInput] = useState("");

  // Collect all unique sports across exercises for global tag suggestions
  const allSports = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((e) => e.sport?.forEach((s) => set.add(s)));
    return [...set].sort();
  }, [exercises]);

  const fetchExercises = async () => {
    const { data } = await supabase
      .from("exercise_library")
      .select("id, title, equipment_needed, the_why, client_type, focus_area, sport, video_url")
      .order("title");
    if (data) setExercises(data as Exercise[]);
    setLoading(false);
  };

  useEffect(() => { fetchExercises(); }, []);

  const filtered = useMemo(() => {
    if (!search) return exercises;
    const q = search.toLowerCase();
    return exercises.filter(
      (e) => e.title.toLowerCase().includes(q) || e.equipment_needed.toLowerCase().includes(q)
    );
  }, [exercises, search]);

  const openCreate = () => { setEditing(EMPTY); setModalOpen(true); setSportInput(""); };
  const openEdit = (ex: Exercise) => { setEditing({ ...ex }); setModalOpen(true); setSportInput(""); };

  const handleAiGenerate = (result: string) => {
    try {
      // Strip markdown code fences if present
      const cleaned = result.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setEditing((prev) => ({
        ...prev,
        title: parsed.title || prev.title,
        equipment_needed: parsed.equipment_needed || "",
        the_why: parsed.the_why || "",
        client_type: parsed.client_type || [],
        focus_area: parsed.focus_area || [],
        sport: parsed.sport || [],
        video_url: parsed.video_url || prev.video_url,
      }));
    } catch {
      toast.error("Failed to parse AI result — fill in manually");
    }
  };

  const handleSave = async () => {
    if (!editing.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const payload = {
      title: editing.title.trim(),
      equipment_needed: editing.equipment_needed.trim(),
      the_why: editing.the_why.trim(),
      client_type: editing.client_type,
      focus_area: editing.focus_area,
      sport: editing.sport,
      video_url: editing.video_url.trim() || null,
    };

    if (editing.id) {
      const { error } = await supabase.from("exercise_library").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message); else toast.success("Exercise updated");
    } else {
      const { error } = await supabase.from("exercise_library").insert(payload);
      if (error) toast.error(error.message); else toast.success("Exercise created");
    }
    setSaving(false);
    setModalOpen(false);
    fetchExercises();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("exercise_library").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchExercises(); }
  };

  const toggleTag = (field: "client_type" | "focus_area" | "sport", tag: string) => {
    setEditing((prev) => ({
      ...prev,
      [field]: prev[field].includes(tag) ? prev[field].filter((t) => t !== tag) : [...prev[field], tag],
    }));
  };

  const addSportTag = () => {
    const val = sportInput.trim();
    if (!val || editing.sport.includes(val)) return;
    setEditing((prev) => ({ ...prev, sport: [...prev.sport, val] }));
    setSportInput("");
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-foreground">Exercise Library</h2>
          <p className="text-[10px] text-muted-foreground">{exercises.length} exercises</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-m2">
          <Plus size={12} /> New Exercise
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="w-full bg-background border border-border pl-9 pr-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground py-2 pr-2">Title</th>
                <th className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground py-2 pr-2 hidden md:table-cell">Equipment</th>
                <th className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground py-2 pr-2 hidden md:table-cell">Tags</th>
                <th className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ex) => (
                <tr key={ex.id} className="border-b border-border/50 hover:bg-accent/20 transition-m2">
                  <td className="py-2.5 pr-2">
                    <span className="text-xs font-bold text-foreground">{ex.title}</span>
                    <div className="flex gap-1 flex-wrap mt-1 md:hidden">
                      {ex.focus_area.map((f) => <span key={f} className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 font-bold uppercase">{f}</span>)}
                      {ex.sport?.map((s) => <span key={s} className="text-[8px] bg-accent text-accent-foreground px-1.5 py-0.5 font-bold uppercase">{s}</span>)}
                    </div>
                  </td>
                  <td className="py-2.5 pr-2 hidden md:table-cell">
                    <span className="text-[11px] text-muted-foreground">{ex.equipment_needed}</span>
                  </td>
                  <td className="py-2.5 pr-2 hidden md:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {ex.client_type.map((c) => <span key={c} className="text-[8px] bg-muted text-muted-foreground px-1.5 py-0.5 font-mono uppercase">{c}</span>)}
                      {ex.focus_area.map((f) => <span key={f} className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 font-bold uppercase">{f}</span>)}
                      {ex.sport?.map((s) => <span key={s} className="text-[8px] bg-accent text-accent-foreground px-1.5 py-0.5 font-bold uppercase">{s}</span>)}
                    </div>
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(ex)} className="p-1.5 hover:bg-accent/40 transition-m2" title="Edit"><Pencil size={13} className="text-muted-foreground" /></button>
                      <button onClick={() => handleDelete(ex.id, ex.title)} className="p-1.5 hover:bg-destructive/10 transition-m2" title="Delete"><Trash2 size={13} className="text-destructive" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">No exercises found.</div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-card border border-border shadow-m2 w-full max-w-lg max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">{editing.id ? "Edit Exercise" : "New Exercise"}</h3>
              <button onClick={() => setModalOpen(false)}><X size={16} className="text-muted-foreground" /></button>
            </div>

            {/* Title + AI */}
            <div className="flex items-end gap-2 mb-3">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Title *</label>
                <input
                  type="text"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {editing.title.trim() && (
                <AiAssistButton
                  type="exercise"
                  context={{ exerciseName: editing.title }}
                  onResult={handleAiGenerate}
                  label="AI Fill"
                />
              )}
            </div>

            {/* Equipment */}
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Equipment Needed</label>
            <input
              type="text"
              value={editing.equipment_needed}
              onChange={(e) => setEditing({ ...editing, equipment_needed: e.target.value })}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary"
            />

            {/* Video URL */}
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Video URL (YouTube/Vimeo)</label>
            <input
              type="url"
              value={editing.video_url}
              onChange={(e) => setEditing({ ...editing, video_url: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary"
            />

            {/* The Why */}
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">The Why</label>
            <textarea
              value={editing.the_why}
              onChange={(e) => setEditing({ ...editing, the_why: e.target.value })}
              rows={4}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary resize-y"
            />

            {/* Client Type */}
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Client Type</label>
            <div className="flex gap-1 flex-wrap mb-3">
              {PRESET_CLIENT_TYPES.map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => toggleTag("client_type", ct)}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                    editing.client_type.includes(ct) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {ct}
                </button>
              ))}
            </div>

            {/* Focus Area */}
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Focus Area</label>
            <div className="flex gap-1 flex-wrap mb-3">
              {PRESET_FOCUS_AREAS.map((fa) => (
                <button
                  key={fa}
                  type="button"
                  onClick={() => toggleTag("focus_area", fa)}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                    editing.focus_area.includes(fa) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {fa}
                </button>
              ))}
            </div>

            {/* Sport */}
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sport</label>
            <div className="flex gap-1 flex-wrap mb-2">
              {editing.sport.map((s) => (
                <span key={s} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest bg-accent text-accent-foreground">
                  {s}
                  <button type="button" onClick={() => toggleTag("sport", s)}><X size={10} /></button>
                </span>
              ))}
            </div>
            {/* Suggestion chips from global list */}
            {allSports.filter((s) => !editing.sport.includes(s)).length > 0 && (
              <div className="flex gap-1 flex-wrap mb-2">
                {allSports.filter((s) => !editing.sport.includes(s)).map((s) => (
                  <button key={s} type="button" onClick={() => toggleTag("sport", s)} className="px-2 py-0.5 text-[9px] font-mono uppercase bg-muted text-muted-foreground hover:text-foreground transition-m2">
                    + {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-1 mb-4">
              <input
                type="text"
                value={sportInput}
                onChange={(e) => setSportInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSportTag(); } }}
                placeholder="Type new sport & press Enter"
                className="flex-1 bg-background border border-border px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <button type="button" onClick={addSportTag} className="px-3 py-1.5 bg-muted text-muted-foreground text-[10px] font-bold uppercase hover:text-foreground transition-m2">Add</button>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-m2"
            >
              {saving ? "Saving..." : editing.id ? "Update Exercise" : "Create Exercise"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminExerciseLibrary;
