import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Check, X, Edit3, Loader2, Plus, Trash2, BookOpen } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";

/* ─── DRAFTS QUEUE ─── */
const DraftsQueue = () => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { data: drafts, isLoading } = useQuery({
    queryKey: ["coach-ai-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_ai_drafts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["draft-profiles"],
    queryFn: async () => {
      const ids = [...new Set((drafts || []).map((d: any) => d.user_id))];
      if (!ids.length) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .in("user_id", ids);
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p; });
      return map;
    },
    enabled: !!drafts?.length,
  });
  const profiles = profilesQuery.data || {};

  const updateDraft = useMutation({
    mutationFn: async ({ id, status, admin_edit }: { id: string; status: string; admin_edit?: string }) => {
      const updates: any = { status, reviewed_at: new Date().toISOString() };
      if (admin_edit !== undefined) updates.admin_edit = admin_edit;
      const { error } = await supabase.from("coach_ai_drafts").update(updates).eq("id", id);
      if (error) throw error;

      // If approving, send notification to the athlete
      if (status === "approved") {
        const draft = drafts?.find((d: any) => d.id === id);
        if (draft) {
          await supabase.from("notifications").insert({
            user_id: draft.user_id,
            type: "coach_answer",
            title: "Coach Matt Answered",
            body: `Your question has been answered: "${(draft.question as string).slice(0, 60)}..."`,
            link: "/dashboard",
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-ai-drafts"] });
      toast({ title: "Draft updated" });
      setEditingId(null);
    },
  });

  const pending = (drafts || []).filter((d: any) => d.status === "pending");
  const reviewed = (drafts || []).filter((d: any) => d.status !== "pending");

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
        Pending Review ({pending.length})
      </h3>
      {pending.length === 0 && <p className="text-xs text-muted-foreground">No pending drafts</p>}
      {pending.map((d: any) => {
        const p = profiles[d.user_id];
        const name = p?.athlete_name || p?.full_name || p?.email || "Unknown";
        return (
          <div key={d.id} className="border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{name}</span>
              <span className="text-[9px] text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
            </div>
            <div className="bg-muted p-2 text-xs">{d.question}</div>
            {editingId === d.id ? (
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-background border border-border p-2 text-xs min-h-[100px]"
              />
            ) : (
              <div className="bg-primary/5 border-l-2 border-primary p-2 text-xs prose prose-xs max-w-none">
                <ReactMarkdown>{d.ai_answer}</ReactMarkdown>
              </div>
            )}
            <div className="flex gap-1.5">
              <button
                onClick={() => updateDraft.mutate({ id: d.id, status: "approved", admin_edit: editingId === d.id ? editText : undefined })}
                className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90"
              >
                <Check size={12} /> {editingId === d.id ? "Save & Approve" : "Approve"}
              </button>
              {editingId !== d.id && (
                <button
                  onClick={() => { setEditingId(d.id); setEditText(d.ai_answer); }}
                  className="flex items-center gap-1 bg-muted text-foreground px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90"
                >
                  <Edit3 size={12} /> Edit
                </button>
              )}
              <button
                onClick={() => updateDraft.mutate({ id: d.id, status: "rejected" })}
                className="flex items-center gap-1 bg-destructive text-destructive-foreground px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90"
              >
                <X size={12} /> Reject
              </button>
            </div>
          </div>
        );
      })}

      {reviewed.length > 0 && (
        <>
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground pt-4">History</h3>
          {reviewed.slice(0, 20).map((d: any) => {
            const p = profiles[d.user_id];
            const name = p?.athlete_name || p?.full_name || "Unknown";
            return (
              <div key={d.id} className="border border-border p-2 opacity-70">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{name}</span>
                  <span className={`text-[9px] font-bold uppercase ${d.status === "approved" ? "text-green-600" : "text-destructive"}`}>
                    {d.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{d.question}</p>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

/* ─── COACHING DOCUMENTS MANAGER ─── */
const DocsManager = () => {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingDoc, setEditingDoc] = useState<any>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["coaching-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaching_documents")
        .select("id, title, content, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingDoc) {
        const { error } = await supabase
          .from("coaching_documents")
          .update({ title, content })
          .eq("id", editingDoc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("coaching_documents")
          .insert({ title, content });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coaching-documents"] });
      setTitle(""); setContent(""); setEditingDoc(null);
      toast({ title: editingDoc ? "Document updated" : "Document added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coaching_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coaching-documents"] });
      toast({ title: "Document deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="border border-border p-3 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
          {editingDoc ? "Edit Document" : "Add Coaching Document"}
        </h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Deadlift Recovery Protocol)"
          className="w-full bg-muted px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Content — coaching knowledge, protocols, advice..."
          className="w-full bg-muted px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground min-h-[120px]"
        />
        <div className="flex gap-2">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!content.trim() || saveMutation.isPending}
            className="flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {editingDoc ? "Update" : "Add"}
          </button>
          {editingDoc && (
            <button
              onClick={() => { setEditingDoc(null); setTitle(""); setContent(""); }}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
        Knowledge Base ({docs?.length || 0} documents)
      </h3>
      {isLoading && <Loader2 size={16} className="animate-spin text-primary" />}
      {(docs || []).map((d: any) => (
        <div key={d.id} className="border border-border p-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground truncate">{d.title || "Untitled"}</p>
            <p className="text-[10px] text-muted-foreground line-clamp-2">{d.content}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => { setEditingDoc(d); setTitle(d.title || ""); setContent(d.content); }}
              className="p-1.5 text-muted-foreground hover:text-foreground"
            >
              <Edit3 size={12} />
            </button>
            <button
              onClick={() => deleteMutation.mutate(d.id)}
              className="p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── COMBINED COMPONENT ─── */
const AdminCoachAiQueue = () => (
  <Tabs defaultValue="queue" className="w-full">
    <TabsList className="bg-muted/50 h-auto gap-0.5 mb-4">
      <TabsTrigger value="queue" className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
        AI Drafts Queue
      </TabsTrigger>
      <TabsTrigger value="docs" className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
        <BookOpen size={12} className="mr-1" /> Knowledge Base
      </TabsTrigger>
    </TabsList>
    <TabsContent value="queue"><DraftsQueue /></TabsContent>
    <TabsContent value="docs"><DocsManager /></TabsContent>
  </Tabs>
);

export default AdminCoachAiQueue;
