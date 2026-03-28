import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { MessageSquare, Send, Loader2, X, Flag, HelpCircle, Pencil, Trash2, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface FeedNote {
  id: string;
  note: string;
  author_role: string;
  author_id: string;
  is_flagged: boolean;
  is_question: boolean;
  created_at: string;
}

interface ActivityItemNotesProps {
  activityType: string;
  activityId: string;
  userId: string;
}

const ActivityItemNotes = ({ activityType, activityId, userId }: ActivityItemNotesProps) => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [notes, setNotes] = useState<FeedNote[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [isFlag, setIsFlag] = useState(false);
  const [isQuestion, setIsQuestion] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from("activity_feed_notes" as any)
      .select("*")
      .eq("activity_type", activityType)
      .eq("activity_id", activityId)
      .order("created_at", { ascending: true });
    if (data) setNotes(data as any[]);
  }, [activityType, activityId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAdd = async () => {
    if (!newNote.trim() || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("activity_feed_notes" as any).insert({
        activity_type: activityType,
        activity_id: activityId,
        user_id: userId,
        author_id: user.id,
        author_role: isAdmin ? "coach" : "athlete",
        note: newNote.trim(),
        is_flagged: isFlag,
        is_question: isQuestion,
      });

      if (error) {
        toast({ title: "Failed to save note", description: error.message, variant: "destructive" });
      } else {
        // Send notification to athlete if admin is adding
        if (isAdmin && userId !== user.id) {
          await supabase.from("notifications").insert({
            user_id: userId,
            title: isFlag ? "Coach flagged your activity" : isQuestion ? "Coach has a question" : "New coach note",
            body: newNote.trim().slice(0, 100),
            type: "coach_note",
            link: "/dashboard",
          });
        }
        // If athlete is asking a question, notify admin
        if (!isAdmin && isQuestion) {
          // Get admin users to notify
          const { data: adminRoles } = await supabase
            .from("user_roles" as any)
            .select("user_id")
            .eq("role", "admin");
          if (adminRoles) {
            for (const admin of adminRoles as any[]) {
              await supabase.from("notifications").insert({
                user_id: admin.user_id,
                title: "Athlete question on activity",
                body: newNote.trim().slice(0, 100),
                type: "athlete_question",
                link: `/admin/view-user/${userId}`,
              });
            }
          }
        }
        setNewNote("");
        setShowForm(false);
        setIsFlag(false);
        setIsQuestion(false);
        await fetchNotes();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleEdit = async (noteId: string) => {
    if (!editText.trim()) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("activity_feed_notes" as any)
        .update({ note: editText.trim(), updated_at: new Date().toISOString() })
        .eq("id", noteId);
      if (error) {
        toast({ title: "Update failed", variant: "destructive" });
      } else {
        setEditingId(null);
        await fetchNotes();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setEditSaving(false);
  };

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId);
    try {
      const { error } = await supabase.from("activity_feed_notes" as any).delete().eq("id", noteId);
      if (error) {
        toast({ title: "Delete failed", variant: "destructive" });
      } else {
        await fetchNotes();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setDeletingId(null);
  };

  const hasNotes = notes.length > 0;

  return (
    <div className="w-full mt-1">
      {/* Existing notes */}
      {hasNotes && (
        <div className="space-y-1 mt-1">
          {notes.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-1.5 pl-2 py-1 border-l-2 ${
                n.is_flagged ? "border-destructive/60 bg-destructive/5" :
                n.is_question ? "border-yellow-400/60 bg-yellow-400/5" :
                "border-primary/40 bg-primary/5"
              }`}
            >
              {n.is_flagged ? (
                <Flag size={9} className="text-destructive mt-0.5 shrink-0" />
              ) : n.is_question ? (
                <HelpCircle size={9} className="text-yellow-400 mt-0.5 shrink-0" />
              ) : (
                <MessageSquare size={9} className="text-primary mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {editingId === n.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleEdit(n.id)}
                      className="flex-1 bg-background border border-border text-[10px] px-1.5 h-6 font-mono text-foreground focus:ring-1 focus:ring-primary outline-none"
                      autoFocus
                    />
                    <button onClick={() => handleEdit(n.id)} disabled={editSaving} className="h-6 w-6 flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-50">
                      {editSaving ? <Loader2 size={8} className="animate-spin" /> : <Check size={8} />}
                    </button>
                    <button onClick={() => setEditingId(null)} className="h-6 w-6 flex items-center justify-center bg-muted text-muted-foreground">
                      <X size={8} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] text-foreground leading-relaxed">{n.note}</p>
                    <span className="text-[8px] text-muted-foreground font-mono">
                      {n.author_role === "coach" ? "Coach Matt" : "Athlete"} · {format(new Date(n.created_at), "MMM d, h:mm a")}
                    </span>
                  </>
                )}
              </div>
              {isAdmin && editingId !== n.id && (
                <div className="flex gap-0.5 shrink-0">
                  <button
                    onClick={() => { setEditingId(n.id); setEditText(n.note); }}
                    className="text-muted-foreground hover:text-primary transition-all p-0.5"
                  >
                    <Pencil size={8} />
                  </button>
                  <button
                    onClick={() => handleDelete(n.id)}
                    disabled={deletingId === n.id}
                    className="text-muted-foreground hover:text-destructive transition-all p-0.5"
                  >
                    {deletingId === n.id ? <Loader2 size={8} className="animate-spin" /> : <Trash2 size={8} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add note form */}
      {showForm ? (
        <div className="mt-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setShowForm(false);
              }}
              placeholder={isAdmin ? "Add coach note..." : "Ask a question..."}
              className="flex-1 bg-background border border-border text-[10px] px-1.5 h-6 font-mono text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={saving || !newNote.trim()}
              className="h-6 w-6 flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 size={8} className="animate-spin" /> : <Send size={8} />}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewNote(""); setIsFlag(false); setIsQuestion(false); }}
              className="h-6 w-6 flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground"
            >
              <X size={8} />
            </button>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-[9px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={isFlag} onChange={(e) => setIsFlag(e.target.checked)} className="w-3 h-3 accent-destructive" />
                <Flag size={8} className="text-destructive" /> Flag
              </label>
              <label className="flex items-center gap-1 text-[9px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={isQuestion} onChange={(e) => setIsQuestion(e.target.checked)} className="w-3 h-3 accent-yellow-400" />
                <HelpCircle size={8} className="text-yellow-400" /> Question
              </label>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-0.5">
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
            >
              <MessageSquare size={8} />
              {hasNotes ? "Add note" : "Note"}
            </button>
          )}
          {!isAdmin && (
            <button
              onClick={() => { setShowForm(true); setIsQuestion(true); }}
              className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
            >
              <HelpCircle size={8} />
              Ask coach
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ActivityItemNotes;
