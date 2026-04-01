import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Globe, Eye, Rocket, RefreshCw, ExternalLink, Trash2 } from "lucide-react";
import { SITE_TEMPLATES, templateKeys } from "@/lib/siteTemplates";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface GeneratedSite {
  id: string;
  slug: string;
  business_name: string;
  template_key: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  lead_id: string | null;
  phone: string | null;
  email: string | null;
}

const AdminSiteBuilder = () => {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    template_key: "contractor",
    business_name: "",
    industry_detail: "",
    phone: "",
    email: "",
    address: "",
    city: "",
  });

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["admin-generated-sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_sites" as any)
        .select("id, slug, business_name, template_key, is_published, published_at, created_at, lead_id, phone, email")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as GeneratedSite[];
    },
  });

  const handleGenerate = async () => {
    if (!form.business_name.trim()) {
      toast.error("Business name is required");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-client-site", {
        body: form,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Site generated for ${form.business_name}!`);
      queryClient.invalidateQueries({ queryKey: ["admin-generated-sites"] });
      setForm({ template_key: "contractor", business_name: "", industry_detail: "", phone: "", email: "", address: "", city: "" });
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const togglePublish = async (site: GeneratedSite) => {
    try {
      const newStatus = !site.is_published;
      const { error } = await supabase
        .from("generated_sites" as any)
        .update({
          is_published: newStatus,
          published_at: newStatus ? new Date().toISOString() : null,
        })
        .eq("id", site.id);
      if (error) throw error;
      toast.success(newStatus ? "Site published!" : "Site unpublished");
      queryClient.invalidateQueries({ queryKey: ["admin-generated-sites"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
  };

  const deleteSite = async (site: GeneratedSite) => {
    if (!confirm(`Delete site for "${site.business_name}"?`)) return;
    try {
      const { error } = await supabase.from("generated_sites" as any).delete().eq("id", site.id);
      if (error) throw error;
      toast.success("Site deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-generated-sites"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  const regenerate = async (site: GeneratedSite) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-client-site", {
        body: {
          template_key: site.template_key,
          business_name: site.business_name,
          phone: site.phone || "",
          email: site.email || "",
          lead_id: site.lead_id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Site regenerated!");
      queryClient.invalidateQueries({ queryKey: ["admin-generated-sites"] });
    } catch (e: any) {
      toast.error(e.message || "Regeneration failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Generator Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Generate Client Website
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Template</Label>
              <Select value={form.template_key} onValueChange={(v) => setForm({ ...form, template_key: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templateKeys.map((key) => (
                    <SelectItem key={key} value={key}>{SITE_TEMPLATES[key].name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Business Name *</Label>
              <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="e.g. Smith's Plumbing" />
            </div>
            <div>
              <Label>Industry Detail</Label>
              <Input value={form.industry_detail} onChange={(e) => setForm({ ...form, industry_detail: e.target.value })} placeholder="e.g. Residential plumbing & drain cleaning" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@business.com" />
            </div>
            <div>
              <Label>City / Address</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Detroit, MI" />
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="w-full sm:w-auto">
            {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</> : "Generate Website"}
          </Button>
          <p className="text-xs text-muted-foreground">AI will generate all copy in ~30 seconds. Preview before publishing.</p>
        </CardContent>
      </Card>

      {/* Sites List */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Sites ({sites.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : sites.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sites generated yet. Use the form above to create one.</p>
          ) : (
            <div className="space-y-3">
              {sites.map((site) => (
                <div key={site.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{site.business_name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${site.is_published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {site.is_published ? "LIVE" : "DRAFT"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      /{site.slug} · {SITE_TEMPLATES[site.template_key]?.name || site.template_key} · {new Date(site.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="icon" asChild title="Preview">
                      <a href={`/site/${site.slug}`} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => regenerate(site)} disabled={generating} title="Regenerate">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={site.is_published ? "outline" : "default"}
                      size="sm"
                      onClick={() => togglePublish(site)}
                      title={site.is_published ? "Unpublish" : "Publish"}
                    >
                      {site.is_published ? "Unpublish" : <><Rocket className="h-3 w-3 mr-1" /> Publish</>}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteSite(site)} title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSiteBuilder;
