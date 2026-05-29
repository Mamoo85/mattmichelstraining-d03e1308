import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { X, Search, Dumbbell, Wrench, Plus } from "lucide-react";

interface AddExerciseModalProps {
  protocolId: string;
  currentCount: number;
  onClose: () => void;
  onAdded: () => void;
}

const AddExerciseModal = ({ protocolId, currentCount, onClose, onAdded }: AddExerciseModalProps) => {
  const [tab, setTab] = useState<"exercise" | "fixit" | "custom">("exercise");
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [customSets, setCustomSets] = useState("3");
  const [customReps, setCustomReps] = useState("10");
  const [customNotes, setCustomNotes] = useState("");

  const { data: exercises = [] } = useQuery({
    queryKey: ["exercise-library-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select("id, title, equipment_needed, level, is_fix_it, focus_area")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const filtered = exercises.filter((ex) => {
    const matchesSearch = !search.trim() || ex.title.toLowerCase().includes(search.toLowerCase());
    if (tab === "fixit") return ex.is_fix_it && matchesSearch;
    if (tab === "exercise") return !ex.is_fix_it && matchesSearch;
    return matchesSearch;
  });

  const handleAddLibraryExercise = async (ex: typeof exercises[0]) => {
    try {
      const { error } = await supabase.from("protocol_exercises").insert({
        protocol_id: protocolId,
        exercise_name: ex.title,
        exercise_library_id: ex.id,
        sets: 3,
        reps: "10",
        sort_order: currentCount + 1,
      });
      if (error) throw error;
      toast({ title: `Added: ${ex.title}` });
      onAdded();
    } catch (err: any) {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    }
  };

  const handleAddCustom = async () => {
    if (!customName.trim()) return;
    try {
      const { error } = await supabase.from("protocol_exercises").insert({
        protocol_id: protocolId,
        exercise_name: customName.trim(),
        sets: parseInt(customSets) || 3,
        reps: customReps || "10",
        notes: customNotes || null,
        sort_order: currentCount + 1,
      });
      if (error) throw error;
      toast({ title: `Added: ${customName}` });
      setCustomName("");
      setCustomNotes("");
      onAdded();
    } catch (err: any) {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-lg p-5 space-y-4 shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Add Exercise</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 shrink-0">
          {([
            { key: "exercise" as const, label: "Exercise Library", icon: Dumbbell },
            { key: "fixit" as const, label: "Fix It Library", icon: Wrench },
            { key: "custom" as const, label: "Custom", icon: Plus },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                tab === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {tab !== "custom" ? (
          <>
            {/* Search */}
            <div className="relative shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${tab === "fixit" ? "Fix It" : "exercise"} library...`}
                className="w-full bg-background border border-border pl-9 pr-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No exercises found</p>
              ) : (
                filtered.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => handleAddLibraryExercise(ex)}
                    className="w-full text-left bg-muted/30 hover:bg-primary/10 p-2.5 transition-colors group"
                  >
                    <span className="text-xs font-bold text-foreground group-hover:text-primary block">{ex.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {ex.equipment_needed} · {ex.level}
                      {ex.focus_area?.length > 0 && ` · ${ex.focus_area.slice(0, 2).join(", ")}`}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Exercise Name</label>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                placeholder="e.g. Banded Hip Distraction"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sets</label>
                <input value={customSets} onChange={(e) => setCustomSets(e.target.value)} type="number"
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Reps</label>
                <input value={customReps} onChange={(e) => setCustomReps(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Notes</label>
              <textarea value={customNotes} onChange={(e) => setCustomNotes(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-16 resize-none"
                placeholder="Coaching cues or instructions..." />
            </div>
            <button
              onClick={handleAddCustom}
              disabled={!customName.trim()}
              className="w-full h-10 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={14} /> Add Custom Exercise
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddExerciseModal;
