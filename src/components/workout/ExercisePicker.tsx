import { useState, useEffect, useMemo, memo } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ExercisePickerProps {
  onSelect: (id: string, title: string) => void;
  onCancel: () => void;
}

const ExercisePicker = memo(({ onSelect, onCancel }: ExercisePickerProps) => {
  const [query, setQuery] = useState("");
  const [exercises, setExercises] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("exercise_library")
        .select("id, title")
        .order("title");
      if (data) setExercises(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => exercises.filter((e) =>
    e.title.toLowerCase().includes(query.toLowerCase())
  ), [exercises, query]);

  return (
    <div className="bg-card border border-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center bg-background border border-border px-3 h-12">
          <Search size={16} className="text-muted-foreground mr-2 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search exercises…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <button onClick={onCancel} className="h-12 w-12 flex items-center justify-center text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[240px] overflow-y-auto divide-y divide-border">
        {loading ? (
          <p className="text-xs text-muted-foreground p-3">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">No exercises found</p>
        ) : (
          filtered.map((ex) => (
            <button
              key={ex.id}
              onClick={() => onSelect(ex.id, ex.title)}
              className="w-full text-left p-3 text-sm text-foreground hover:bg-muted transition-colors min-h-[44px]"
            >
              {ex.title}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default ExercisePicker;
