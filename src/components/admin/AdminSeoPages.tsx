import { useState, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, ExternalLink, Trash2 } from "lucide-react";

const BULK_PAGES = [
  { slug: "personal-trainer-grosse-pointe-mi", keyword: "personal trainer Grosse Pointe MI", location: "Grosse Pointe MI", service_type: "personal training" },
  { slug: "personal-trainer-harper-woods-mi", keyword: "personal trainer Harper Woods MI", location: "Harper Woods MI", service_type: "personal training" },
  { slug: "online-personal-trainer-michigan", keyword: "online personal trainer Michigan", location: "Michigan", service_type: "online coaching" },
  { slug: "strength-coach-detroit", keyword: "strength coach Detroit", location: "Detroit MI", service_type: "strength coaching" },
  { slug: "powerlifting-coach-metro-detroit", keyword: "powerlifting coach Metro Detroit", location: "Metro Detroit MI", service_type: "powerlifting" },
  { slug: "personal-trainer-st-clair-shores", keyword: "personal trainer St Clair Shores MI", location: "St Clair Shores MI", service_type: "personal training" },
  { slug: "online-fitness-coach-michigan", keyword: "online fitness coach Michigan", location: "Michigan", service_type: "online coaching" },
  { slug: "personal-training-grosse-pointe-park", keyword: "personal training Grosse Pointe Park", location: "Grosse Pointe Park MI", service_type: "personal training" },
  { slug: "strength-training-metro-detroit", keyword: "strength training Metro Detroit", location: "Metro Detroit MI", service_type: "strength training" },
  { slug: "personal-trainer-eastpointe-mi", keyword: "personal trainer Eastpointe MI", location: "Eastpointe MI", service_type: "personal training" },
];

const AdminSeoPages = memo(() => {
  const qc = useQueryClient();
  const [form, setForm] = useState({ keyword: "", location: "", service_type: "", slug: "" });
  const [generating, setGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["seo-landing-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seo_landing_pages")
        .select("id, slug, page_title, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const generatePage = async (params: { slug: string; keyword: string; location: string; service_type: string }) => {
    const { data, error } = await supabase.functions.invoke("generate-seo-page", { body: params });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const singleMutation = useMutation({
    mutationFn: generatePage,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["seo-landing-pages"] });
      toast({ title: `Page created: /training/${data.slug}` });
      setForm({ keyword: "", location: "", service_type: "", slug: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seo_landing_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-landing-pages"] });
      toast({ title: "Page deleted" });
    },
  });

  const handleBulk = async () => {
    setGenerating(true);
    for (let i = 0; i < BULK_PAGES.length; i++) {
      setBulkProgress(`Generating ${i + 1} of ${BULK_PAGES.length}...`);
      try {
        await generatePage(BULK_PAGES[i]);
      } catch (e: any) {
        console.error(`Failed: ${BULK_PAGES[i].slug}`, e);
      }
      if (i < BULK_PAGES.length - 1) await new Promise((r) => setTimeout(r, 2000));
    }
    setBulkProgress(null);
    setGenerating(false);
    qc.invalidateQueries({ queryKey: ["seo-landing-pages"] });
    toast({ title: "Bulk generation complete!" });
  };

  return (
    <div className="space-y-6">
      {/* Generate Form */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Generate SEO Page</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Keyword *" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
            <Input placeholder="Location *" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input placeholder="Service Type" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} />
            <Input placeholder="Slug *" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              disabled={!form.keyword || !form.location || !form.slug || singleMutation.isPending}
              onClick={() => singleMutation.mutate(form)}
            >
              {singleMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-1" /> Generating...</> : "Generate Page"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={generating}>
                  {generating ? bulkProgress : "Bulk Generate (10 pages)"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Bulk Generate</AlertDialogTitle>
                  <AlertDialogDescription>This will generate 10 SEO landing pages. Continue?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulk}>Generate All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Existing Pages */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading pages...</p>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Slug</TableHead>
                <TableHead className="text-[10px]">Page Title</TableHead>
                <TableHead className="text-[10px]">Created</TableHead>
                <TableHead className="text-[10px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs font-mono">{p.slug}</TableCell>
                  <TableCell className="text-xs">{p.page_title || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                        <a href={`/training/${p.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /></a>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 size={12} /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete page?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently remove /{p.slug}.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {pages.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">No pages yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
});

AdminSeoPages.displayName = "AdminSeoPages";
export default AdminSeoPages;
