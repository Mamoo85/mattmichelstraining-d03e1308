import { memo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Copy, Check, Loader2, Trash2, MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SeoPageConfig {
  id: string;
  trade: string;
  city: string;
  slug: string;
  page_data: Record<string, unknown>;
  created_at: string;
}

const AdminSeoPages = memo(() => {
  const qc = useQueryClient();
  const [trade, setTrade] = useState("");
  const [city, setCity] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SeoPageConfig | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: pages = [], isLoading } = useQuery<SeoPageConfig[]>({
    queryKey: ["seo-page-configs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seo_page_configs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("seo_page_configs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-page-configs"] });
      toast.success("Deleted");
    },
    onError: () => toast.error("Delete failed"),
  });

  const handleGenerate = async () => {
    if (!trade.trim() || !city.trim()) { toast.error("Enter both trade and city"); return; }
    setGenerating(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-seo-page-config", {
        body: { trade: trade.trim(), city: city.trim() },
      });
      if (error) throw error;
      setResult(data as SeoPageConfig);
      qc.invalidateQueries({ queryKey: ["seo-page-configs"] });
      toast.success("Page config generated and saved");
    } catch (err) {
      toast.error("Generation failed. Check Supabase logs.");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!result?.page_data) return;
    navigator.clipboard.writeText(JSON.stringify(result.page_data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#e8621a]/10 flex items-center justify-center">
          <MapPin size={18} className="text-[#e8621a]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Programmatic Local SEO</h2>
          <p className="text-sm text-slate-400">Generate landing page configs for any trade + city combo</p>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Trade / Industry</Label>
              <Input
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="e.g. Roofing"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">City</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Warren, MI"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating || !trade || !city}
              className="bg-[#e8621a] hover:bg-[#d4551a] text-white font-semibold"
            >
              {generating ? <Loader2 size={16} className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />}
              {generating ? "Generating..." : "Generate Page Config"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result?.page_data && (
        <Card className="bg-slate-900 border-[#e8621a]/30">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-white text-base">
              <span className="text-[#e8621a]">{result.trade}</span> in {result.city}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={handleCopy} className="text-slate-400 hover:text-white">
              {copied ? <Check size={14} className="text-green-400 mr-1" /> : <Copy size={14} className="mr-1" />}
              {copied ? "Copied" : "Copy JSON"}
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-slate-300 bg-slate-950 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96">
              {JSON.stringify(result.page_data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Saved Configs ({pages.length})
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-slate-800 rounded-lg animate-pulse" />)}
          </div>
        ) : pages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 py-10 text-center">
            <p className="text-slate-500 text-sm">No configs yet. Generate your first one above.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="text-left py-2.5 px-4 text-slate-400 font-medium">Slug</th>
                  <th className="text-left py-2.5 px-4 text-slate-400 font-medium">Trade</th>
                  <th className="text-left py-2.5 px-4 text-slate-400 font-medium">City</th>
                  <th className="text-left py-2.5 px-4 text-slate-400 font-medium">Created</th>
                  <th className="py-2.5 px-4" />
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-[#e8621a] font-mono text-xs">{page.slug}</td>
                    <td className="py-3 px-4 text-slate-300">{page.trade}</td>
                    <td className="py-3 px-4 text-slate-300">{page.city}</td>
                    <td className="py-3 px-4 text-slate-500">{new Date(page.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setResult(page)}
                          className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                          title="View JSON"
                        >
                          <ExternalLink size={13} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(page.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

AdminSeoPages.displayName = "AdminSeoPages";
export default AdminSeoPages;
