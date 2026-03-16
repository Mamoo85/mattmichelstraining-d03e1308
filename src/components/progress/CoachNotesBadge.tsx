import { useState } from "react";
import { MessageSquare, Send, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CoachNote {
  id: string;
  note: string;
  created_at: string;
}

interface CoachNotesBadgeProps {
  logId: string;
  userId: string;
  notes: CoachNote[];
  isAdmin: boolean;
  onRefresh: () => Promise<void>;
}

const CoachNotesBadge = ({ logId, userId, notes, isAdmin, onRefresh }: CoachNotesBadgeProps) => {
  const [expanded, setExpanded] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase.from("coach_notes" as any).insert({
      progress_log_id: logId,
      user_id: userId,
      coach_id: user.id,
      note: newNote.trim(),
    });

    if (error) {
      toast({ title: "Failed to save note", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Note saved" });
      setNewNote("");
      await onRefresh();
    }
    setSaving(false);
  };

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId);
    const { error } = await supabase.from("coach_notes" as any).delete().eq("id", noteId);
    if (error) {
      toast({ title: "Delete failed", variant: "destructive" });
    } else {
      await onRefresh();
    }
    setDeletingId(null);
  };

  const hasNotes = notes.length > 0;

  return (
    <div className="w-full">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest transition-all ${
          hasNotes
            ? "text-primary hover:opacity-80"
            : isAdmin
            ? "text-muted-foreground hover:text-primary"
            : "hidden"
        }`}
      >
        <MessageSquare size={10} />
        {hasNotes ? `${notes.length} Coach Note${notes.length > 1 ? "s" : ""}` : "Add Note"}
      </button>

      {expanded && (
        <div className="mt-2 pl-2 border-l-2 border-primary/20 space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-xs text-foreground leading-relaxed">{n.note}</p>
                <span className="text-[9px] text-muted-foreground font-mono">
                  Coach · {format(new Date(n.created_at), "MMM d, yyyy")}
                </span>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(n.id)}
                  disabled={deletingId === n.id}
                  className="text-muted-foreground hover:text-destructive transition-all mt-0.5 flex-shrink-0"
                >
                  {deletingId === n.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                </button>
              )}
            </div>
          ))}

          {isAdmin && (
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Add a note for this athlete..."
                className="flex-1 bg-background border border-border text-xs px-2 h-7 font-mono text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newNote.trim()}
                className="h-7 w-7 flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoachNotesBadge;
