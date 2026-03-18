import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, BookOpen, Sparkles } from "lucide-react";
import AiAssistButton from "./AiAssistButton";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Article {
  id: string;
  title: string;
  slug: string;
  body: string;
  cover_image_url: string | null;
  category: string;
  is_published: boolean;
  author: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

const CATEGORIES = ["general", "injury-prevention", "youth-development", "training-fundamentals", "recovery", "nutrition", "parent-guide"];

const emptyArticle = (): Partial<Article> => ({
  title: "",
  slug: "",
  body: "",
  cover_image_url: "",
  category: "general",
  is_published: false,
  author: "Coach Matt",
});

const AdminLearnEditor = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [rawIdea, setRawIdea] = useState("");

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["admin-learn-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learn_articles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Article[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (article: Partial<Article>) => {
      const slug = article.slug || article.title!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const payload = {
        title: article.title,
        slug,
        body: article.body || "",
        cover_image_url: article.cover_image_url || null,
        category: article.category || "general",
        is_published: article.is_published || false,
        author: article.author || "Coach Matt",
        updated_at: new Date().toISOString(),
        ...(article.is_published && !article.published_at ? { published_at: new Date().toISOString() } : {}),
      };

      if (article.id) {
        const { error } = await supabase.from("learn_articles").update(payload).eq("id", article.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("learn_articles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-learn-articles"] });
      setModalOpen(false);
      setEditing(null);
      toast.success("Article saved");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("learn_articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-learn-articles"] });
      toast.success("Article deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, publish }: { id: string; publish: boolean }) => {
      const update: any = { is_published: publish, updated_at: new Date().toISOString() };
      if (publish) update.published_at = new Date().toISOString();
      const { error } = await supabase.from("learn_articles").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-learn-articles"] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  const openNew = () => {
    setEditing(emptyArticle());
    setModalOpen(true);
  };

  const openEdit = (article: Article) => {
    setEditing({ ...article });
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Learn Hub Articles</h3>
        </div>
        <button
          onClick={openNew}
          className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-1.5"
        >
          <Plus size={12} /> New Article
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Create and manage articles for the /learn page. Draft articles are only visible to you.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : articles.length === 0 ? (
        <div className="bg-card shadow-m2 p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No articles yet. Write your first one.</p>
          <button onClick={openNew} className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2">
            <Plus size={12} className="inline mr-1" /> Create Article
          </button>
        </div>
      ) : (
        <div className="bg-card shadow-m2 divide-y divide-border">
          {articles.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/10 transition-m2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground truncate">{a.title}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 ${
                    a.is_published ? "bg-green-600/20 text-green-400" : "bg-muted text-muted-foreground"
                  }`}>
                    {a.is_published ? "Published" : "Draft"}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5">
                    {a.category}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {a.author} · Updated {new Date(a.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => togglePublish.mutate({ id: a.id, publish: !a.is_published })}
                  className="p-2 hover:bg-muted transition-m2"
                  title={a.is_published ? "Unpublish" : "Publish"}
                >
                  {a.is_published ? <EyeOff size={14} className="text-muted-foreground" /> : <Eye size={14} className="text-primary" />}
                </button>
                <button onClick={() => openEdit(a)} className="p-2 hover:bg-muted transition-m2">
                  <Pencil size={14} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => { if (confirm("Delete this article?")) deleteMutation.mutate(a.id); }}
                  className="p-2 hover:bg-destructive/10 transition-m2"
                >
                  <Trash2 size={14} className="text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!v) { setModalOpen(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-widest text-foreground">
              {editing?.id ? "Edit Article" : "New Article"}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Title *</label>
                <input
                  value={editing.title || ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  placeholder="Article title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Category</label>
                  <select
                    value={editing.category || "general"}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.replace(/-/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Author</label>
                  <input
                    value={editing.author || "Coach Matt"}
                    onChange={(e) => setEditing({ ...editing, author: e.target.value })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Cover Image URL</label>
                <input
                  value={editing.cover_image_url || ""}
                  onChange={(e) => setEditing({ ...editing, cover_image_url: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Body Content *</label>
                <textarea
                  value={editing.body || ""}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-64 font-mono"
                  placeholder="Write your article here... Markdown is supported."
                />
                <p className="text-[9px] text-muted-foreground mt-1">Supports Markdown formatting (bold, headers, links, lists).</p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.is_published || false}
                    onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                    className="accent-primary"
                  />
                  <span className="text-xs font-bold text-foreground">Publish immediately</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setModalOpen(false); setEditing(null); }}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-widest bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveMutation.mutate(editing)}
                  disabled={!editing.title?.trim() || saveMutation.isPending}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  {editing.id ? "Save Changes" : "Create Article"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLearnEditor;
