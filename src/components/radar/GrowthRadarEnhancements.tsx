import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Map, Filter, Bookmark, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  clientId: string;
}

const VERTICALS = ["manufacturing", "construction", "healthcare", "government"];

/**
 * Batch 3 GR-11/12/14 — Map view stub, vertical filters, saved searches.
 * Drop into GrowthRadarDashboard.
 */
export const GrowthRadarEnhancements = ({ clientId }: Props) => {
  const [vertical, setVertical] = useState<string | null>(null);
  const [searches, setSearches] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [counties, setCounties] = useState("");

  useEffect(() => {
    if (clientId) void load();
  }, [clientId]);

  const load = async () => {
    const { data } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setSearches(data || []);
  };

  const addSearch = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("saved_searches").insert({
      client_id: clientId,
      client_type: "growth_radar",
      name: name.trim(),
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      counties: counties.split(",").map((c) => c.trim()).filter(Boolean),
    });
    if (error) { toast.error("Failed"); return; }
    setName(""); setKeywords(""); setCounties("");
    await load();
    toast.success("Saved");
  };

  return (
    <div className="space-y-4">
      {/* Vertical filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Industry Vertical</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={vertical === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setVertical(null)}
          >
            All
          </Badge>
          {VERTICALS.map((v) => (
            <Badge
              key={v}
              variant={vertical === v ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => setVertical(v)}
            >
              {v}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Map placeholder */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <Map className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Michigan Signal Map</h3>
        </div>
        <div className="h-48 rounded-md bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
          Map view — pin signals by county. (MI outline + dots, coming online as signals geo-tag.)
        </div>
      </Card>

      {/* Saved searches */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bookmark className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Saved Searches</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <Input placeholder="Name (e.g. Boilers Wayne+Oakland)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Keywords, comma-sep" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          <Input placeholder="Counties, comma-sep" value={counties} onChange={(e) => setCounties(e.target.value)} />
        </div>
        <Button size="sm" onClick={addSearch} className="mb-3">
          <Plus className="h-3 w-3 mr-1" /> Save search
        </Button>
        {searches.length === 0 ? (
          <p className="text-xs text-muted-foreground">No saved searches yet.</p>
        ) : (
          <div className="space-y-1.5">
            {searches.map((s) => (
              <div key={s.id} className="text-xs p-2 rounded bg-muted/20 flex items-center justify-between">
                <span><strong>{s.name}</strong> — {s.keywords?.join(", ") || "any"} in {s.counties?.join(", ") || "all MI"}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6"
                  onClick={async () => { await supabase.from("saved_searches").delete().eq("id", s.id); await load(); }}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
