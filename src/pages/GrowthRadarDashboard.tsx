import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Download, Radar } from "lucide-react";

type Signal = {
  id: string;
  source: string;
  signal_type: string;
  company_name: string;
  county: string | null;
  vertical: string | null;
  value_usd: number | null;
  predicted_needs: string[] | null;
  recommended_pitch: string | null;
  source_url: string | null;
  confidence: number;
  detected_at: string;
};

const GrowthRadarDashboard = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [minConfidence, setMinConfidence] = useState(7);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("growth_radar_signals" as any)
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(200);
      setSignals((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => signals.filter((s) => (s.confidence || 0) >= minConfidence),
    [signals, minConfidence]
  );

  const exportCSV = () => {
    const rows = [
      ["Company", "County", "Vertical", "Type", "Value USD", "Confidence", "Pitch", "Source URL", "Detected"],
      ...filtered.map((s) => [
        s.company_name,
        s.county || "",
        s.vertical || "",
        s.signal_type,
        s.value_usd ? String(s.value_usd) : "",
        String(s.confidence),
        (s.recommended_pitch || "").replace(/"/g, '""'),
        s.source_url || "",
        s.detected_at,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `growth-radar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Radar className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Growth Radar</h1>
              <p className="text-sm text-muted-foreground">
                {filtered.length} qualified expansion signals (confidence ≥ {minConfidence})
              </p>
            </div>
          </div>
          <Button onClick={exportCSV} disabled={!filtered.length} variant="outline">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>

        <Card className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Min confidence: {minConfidence}/10
            </span>
            <Slider
              value={[minConfidence]}
              min={1}
              max={10}
              step={1}
              onValueChange={(v) => setMinConfidence(v[0])}
              className="flex-1"
            />
          </div>
        </Card>

        {loading ? (
          <p className="text-muted-foreground">Loading signals…</p>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No signals matching this confidence threshold. Lower the slider or check back tomorrow.
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div>
                    <div className="font-semibold text-base">{s.company_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.county || "MI"} · {s.signal_type}
                      {s.value_usd ? ` · $${Math.round(s.value_usd).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <Badge variant={s.confidence >= 8 ? "default" : "secondary"}>
                    CONF {s.confidence}/10
                  </Badge>
                </div>
                {s.recommended_pitch && (
                  <p className="text-sm text-foreground/80 leading-relaxed">{s.recommended_pitch}</p>
                )}
                {s.source_url && (
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary mt-2 inline-block hover:underline"
                  >
                    View source →
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GrowthRadarDashboard;
