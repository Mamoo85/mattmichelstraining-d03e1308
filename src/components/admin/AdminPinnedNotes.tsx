import { useState, useEffect } from "react";
import { Pin, Plus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface PinnedNote {
  id: string;
  note: string;
  created_at: string;
}

const AdminPinnedNotes = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<PinnedNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);

  // Use localStorage for simplicity — admin-only, single-user
  const STORAGE_KEY = "m2_admin_pinned_notes";

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setNotes(JSON.parse(stored)); } catch {}
    }
    setLoading(false);
  }, []);

  const persist = (updated: PinnedNote[]) => {
    setNotes(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    const note: PinnedNote = {
      id: crypto.randomUUID(),
      note: newNote.trim(),
      created_at: new Date().toISOString(),
    };
    persist([note, ...notes]);
    setNewNote("");
    toast({ title: "Note pinned" });
  };

  const removeNote = (id: string) => {
    persist(notes.filter((n) => n.id !== id));
  };

  if (loading) return null;

  return (
    <div className="bg-card border border-border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Pin size={14} className="text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Pinned Reminders</h3>
      </div>

      <div className="flex gap-2">
        <input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNote()}
          placeholder="Pin a reminder for later…"
          className="flex-1 bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
        />
        <button
          onClick={addNote}
          disabled={!newNote.trim()}
          className="bg-primary text-primary-foreground px-3 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-m2 flex items-center gap-1"
        >
          <Plus size={12} /> Pin
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">No pinned notes yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start gap-2 bg-muted/30 px-3 py-2 group">
              <Pin size={10} className="text-primary mt-1 flex-shrink-0" />
              <p className="text-xs text-foreground flex-1 leading-relaxed">{n.note}</p>
              <button
                onClick={() => removeNote(n.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-m2 flex-shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPinnedNotes;
