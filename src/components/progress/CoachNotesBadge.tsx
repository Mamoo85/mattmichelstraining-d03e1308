import { useState } from "react";
import { MessageSquare, Send, Trash2, Loader2, Pencil, X, Check } from "lucide-react";
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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
      setShowAddForm(false);
      await onRefresh();
    }
    setSaving(false);
  };

  const handleEdit = async (noteId: string) => {
    if (!editText.trim()) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("coach_notes" as any)
      .update({ note: editText.trim(), updated_at: new Date().toISOString() })
      .eq("id", noteId);
    if (error) {
      toast({ title: "Update failed", variant: "destructive" });
    } else {
      setEditingId(null);
      await onRefresh();
    }
    setEditSaving(false);
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
      {/* Always show notes when they exist — no toggle needed */}
      {hasNotes && (
        <div className="mt-1.5 space-y-1.5">
          {notes.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-2 pl-2.5 py-1.5 border-l-2 border-primary/40"
              style={{ background: "hsl(var(--primary) / 0.04)" }}
            >
              <MessageSquare size={10} className="text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {editingId === n.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleEdit(n.id)}
                      className="flex-1 bg-background border border-border text-xs px-2 h-7 font-mono text-foreground focus:ring-1 focus:ring-primary outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleEdit(n.id)}
                      disabled={editSaving}
                      className="h-7 w-7 flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      {editSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="h-7 w-7 flex items-center justify-center bg-muted text-muted-foreground"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-foreground leading-relaxed">{n.note}</p>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      Coach Matt · {format(new Date(n.created_at), "MMM d, yyyy")}
                    </span>
                  </>
                )}
              </div>
              {isAdmin && editingId !== n.id && (
                <div className="flex gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => { setEditingId(n.id); setEditText(n.note); }}
                    className="text-muted-foreground hover:text-primary transition-all p-0.5"
                  >
                    <Pencil size={9} />
                  </button>
                  <button
                    onClick={() => handleDelete(n.id)}
                    disabled={deletingId === n.id}
                    className="text-muted-foreground hover:text-destructive transition-all p-0.5"
                  >
                    {deletingId === n.id ? <Loader2 size={9} className="animate-spin" /> : <Trash2 size={9} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Admin add note button/form */}
      {isAdmin && (
        <div className="mt-1.5">
          {showAddForm ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") setShowAddForm(false);
                }}
                placeholder="Leave a note for this athlete..."
                className="flex-1 bg-background border border-border text-xs px-2 h-7 font-mono text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newNote.trim()}
                className="h-7 w-7 flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewNote(""); }}
                className="h-7 w-7 flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
            >
              <MessageSquare size={10} />
              {hasNotes ? "Add another note" : "Add coach note"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CoachNotesBadge;
