import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Rocket, Plus, Trash2, ExternalLink, Search,
  Globe, FileText, BarChart3, Flame, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";

/* ── Types ── */
interface SeoPage {
  id: string;
  slug: string;
  page_title: string;
  meta_description: string;
  h1_heading: string;
  target_audience: string;
  created_at: string;
}

/* ── Quick-add form state ── */
interface QuickAdd {
  keyword: string;
  location: string;
  target_audience: string;
}

const EMPTY_FORM: QuickAdd = { keyword: "", location: "", target_audience: "" };

/* ── Suggested seed keywords ── */
const SEED_KEYWORDS = [
  { keyword: "youth hockey strength", location: "Grosse Pointe", audience: "Youth athletes ages 12-17" },
  { keyword: "baseball rotational power", location: "Detroit", audience: "High school baseball players" },
  { keyword: "soccer speed training", location: "St Clair Shores", audience: "Youth soccer players" },
  { keyword: "lacrosse conditioning", location: "Grosse Pointe", audience: "High school lacrosse athletes" },
  { keyword: "youth athlete strength", location: "Harper Woods", audience: "Youth athletes ages 10-15" },
  { keyword: "basketball vertical jump", location: "Detroit", audience: "High school basketball players" },
  { keyword: "football combine prep", location: "Grosse Pointe", audience: "High school football players" },
  { keyword: "swimming dryland training", location: "Grosse Pointe", audience: "Competitive swimmers ages 12-18" },
];

const AdminSeoGenerator = () => {
  const queryClient = useQueryClient();

  /* ── Quick-add state ── */
  const [form, setForm] = useState<QuickAdd>(EMPTY_FORM);
  const [generating, setGenerating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SeoPage | null>(null);

  /* ── Fetch existing pages ── */
  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["admin-seo-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seo_landing_pages")
        .select("id, slug, page_title, meta_description, h1_heading, target_audience, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SeoPage[];
    },
  });

  /* ── Stats ── */
  const totalPages = pages.length;
  const thisMonth = pages.filter((p) => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  /* ── Quick-add generate ── */
  const handleQuickGenerate = useCallback(async () => {
    if (!form.keyword.trim()) {
      toast({ title: "Keyword required", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const payload = [{
        keyword: form.keyword.trim(),
        location: form.location.trim() || undefined,
        target_audience: form.target_audience.trim() || "General fitness enthusiasts",
      }];
      const { data, error } = await supabase.functions.invoke("generate-seo-pages", {
        body: { pages: payload },
      });
      if (error) throw error;

      const result = data?.results?.[0];
      if (result?.status === "created") {
        toast({ title: "Page Created", description: `/${result.slug} is live` });
        setForm(EMPTY_FORM);
        queryClient.invalidateQueries({ queryKey: ["admin-seo-pages"] });
      } else if (result?.status === "skipped_duplicate") {
        toast({ title: "Duplicate", description: "This page already exists", variant: "destructive" });
      } else {
        toast({ title: "Error", description: result?.status || "Unknown error", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Generation Failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [form, queryClient]);

  /* ── Bulk generate (legacy JSON) ── */
  const handleBulkGenerate = useCallback(async () => {
    let parsed: unknown[];
    try {
      parsed = JSON.parse(bulkInput);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Must be a non-empty array");
    } catch (e: any) {
      toast({ title: "Invalid JSON", description: e.message, variant: "destructive" });
      return;
    }
    setBulkLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-seo-pages", {
        body: { pages: parsed },
      });
      if (error) throw error;

      const created = (data?.results || []).filter((r: any) => r.status === "created").length;
      const skipped = (data?.results || []).filter((r: any) => r.status === "skipped_duplicate").length;
      const errors = (data?.results || []).filter((r: any) => r.status !== "created" && r.status !== "skipped_duplicate").length;

      toast({
        title: "Bulk Generation Complete",
        description: `${created} created · ${skipped} skipped${errors > 0 ? ` · ${errors} errors` : ""}`,
      });
      setBulkInput("");
      setBulkOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-seo-pages"] });
    } catch (e: any) {
      toast({ title: "Generation Failed", description: e.message, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  }, [bulkInput, queryClient]);

  /* ── Delete page ── */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("seo_landing_pages")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: `/${deleteTarget.slug} removed` });
      queryClient.invalidateQueries({ queryKey: ["admin-seo-pages"] });
    }
    setDeleteTarget(null);
  }, [deleteTarget, queryClient]);

  /* ── Use seed keyword ── */
  const useSeed = (seed: typeof SEED_KEYWORDS[0]) => {
    setForm({ keyword: seed.keyword, location: seed.location, target_audience: seed.audience });
  };

  /* ── Filtered pages ── */
  const filtered = searchTerm
    ? pages.filter((p) =>
        p.page_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.target_audience.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : pages;

  return (
    <div className="space-y-6">
      {/* ── Stats Row ── */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-border">
          <CardContent className="p-4 flex flex-col items-center gap-1">
            <Globe size={16} className="text-primary" />
            <span className="text-xl font-black text-foreground">{totalPages}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Total Pages</span>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex flex-col items-center gap-1">
            <Flame size={16} className="text-primary" />
            <span className="text-xl font-black text-foreground">{thisMonth}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">This Month</span>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex flex-col items-center gap-1">
            <BarChart3 size={16} className="text-primary" />
            <span className="text-xl font-black text-foreground">{SEED_KEYWORDS.length}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Suggested</span>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Generate ── */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Rocket size={16} className="text-primary" />
            SEO Ignite — Quick Generate
          </CardTitle>
          <CardDescription className="text-xs">
            Enter a keyword and let AI create a fully optimized landing page targeting your local area.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              placeholder="Keyword *"
              value={form.keyword}
              onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
              disabled={generating}
              className="text-xs"
            />
            <Input
              placeholder="Location (optional)"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              disabled={generating}
              className="text-xs"
            />
            <Input
              placeholder="Target Audience"
              value={form.target_audience}
              onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
              disabled={generating}
              className="text-xs"
            />
          </div>

          {/* Seed suggestions */}
          <div className="flex flex-wrap gap-1.5">
            {SEED_KEYWORDS.map((s) => (
              <button
                key={s.keyword + s.location}
                onClick={() => useSeed(s)}
                className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors rounded-full border border-border"
              >
                {s.keyword}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleQuickGenerate}
              disabled={generating || !form.keyword.trim()}
              className="flex-1 font-bold uppercase tracking-widest text-xs"
            >
              {generating ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Generating…
                </>
              ) : (
                <>
                  <Plus size={14} className="mr-1" />
                  Generate Page
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkOpen(true)}
              className="text-xs font-bold uppercase tracking-widest"
            >
              Bulk JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Existing Pages ── */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              Live Pages
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">{filtered.length}</Badge>
          </div>
          <div className="relative mt-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search pages…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-8"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={16} className="animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">
              {searchTerm ? "No pages match your search." : "No SEO pages generated yet. Use the form above to create your first one."}
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filtered.map((page) => (
                <div
                  key={page.id}
                  className="flex items-start gap-3 p-3 bg-muted/30 border border-border rounded-lg hover:border-primary/30 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{page.page_title}</p>
                    <p className="text-[10px] text-primary font-mono truncate">/training/{page.slug}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[8px] px-1.5 py-0">{page.target_audience}</Badge>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(page.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={`/training/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => setDeleteTarget(page)}
                      className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Bulk JSON Dialog ── */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-widest">Bulk JSON Generator</DialogTitle>
            <DialogDescription className="text-xs">
              Paste a JSON array of pages. Each entry needs <code className="text-primary">keyword</code>, optional <code className="text-primary">location</code>, and <code className="text-primary">target_audience</code>.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={`[\n  { "keyword": "youth hockey strength", "location": "Grosse Pointe", "target_audience": "Youth athletes ages 12-17" }\n]`}
            rows={8}
            className="w-full bg-muted border border-border px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-y rounded-md"
            disabled={bulkLoading}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} className="text-xs">Cancel</Button>
            <Button
              onClick={handleBulkGenerate}
              disabled={bulkLoading || !bulkInput.trim()}
              className="text-xs font-bold uppercase tracking-widest"
            >
              {bulkLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              {bulkLoading ? "Generating…" : "Ignite All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <ConfirmActionModal
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          onConfirm={handleDelete}
          title="Delete SEO Page"
          description={`Permanently remove /training/${deleteTarget.slug}? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
        />
      )}
    </div>
  );
};

export default AdminSeoGenerator;
