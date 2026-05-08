import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Download, Radar } from "lucide-react";
import { RadarExportBar } from "@/components/shared/RadarExportBar";
import LeadDetailDrawer, { type LeadDetail } from "@/components/radar/LeadDetailDrawer";

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

const SIGNAL_TYPE_COLORS: Record<string, string> = {
  new_business_entity: "#06b6d4",
  sba_loan_approved: "#10b981",
  warn_act_notice: "#ef4444",
  rd_grant_awarded: "#8b5cf6",
  major_building_permit: "#f59e0b",
  healthcare_expansion: "#ec4899",
  hospitality_permit: "#a855f7",
  school_rfp: "#3b82f6",
};

const GrowthRadarDashboard = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [minConfidence, setMinConfidence] = useState(7);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);

  useEffect(() => {
    (async () => {
      // Deterministic tie-break + raised cap so high-volume signal types
      // (e.g. building permits, school RFPs) don't squeeze rarer types
      // (warn_act_notice, healthcare_expansion) out of the result set.
      const { data } = await supabase
        .from("growth_radar_signals" as any)
        .select("*")
        .order("confidence",  { ascending: false })
        .order("detected_at", { ascending: false })
        .order("id",          { ascending: true })
        .limit(500);
      setSignals((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const allTypes = useMemo(
    () => Array.from(new Set(signals.map((s) => s.signal_type).filter(Boolean))).sort(),
    [signals]
  );

  const filtered = useMemo(
    () =>
      signals.filter(
        (s) =>
          (s.confidence || 0) >= minConfidence &&
          (activeTypes.length === 0 || activeTypes.includes(s.signal_type)),
      ),
    [signals, minConfidence, activeTypes]
  );

  const toggleType = (t: string) =>
    setActiveTypes((curr) => (curr.includes(t) ? curr.filter((x) => x !== t) : [...curr, t]));

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
        </div>

        <RadarExportBar radar="growth" records={filtered as any} className="mb-4" />

        <Card className="p-4 mb-6 space-y-3">
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
          {allTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
              <span className="text-[11px] text-muted-foreground self-center mr-1">Type:</span>
              {allTypes.map((t) => {
                const active = activeTypes.includes(t);
                const color = SIGNAL_TYPE_COLORS[t] || "#64748b";
                return (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
                    style={{
                      background: active ? `${color}30` : "transparent",
                      color: active ? color : "hsl(var(--muted-foreground))",
                      border: `1px solid ${active ? `${color}60` : "hsl(var(--border))"}`,
                    }}
                  >
                    {t.replace(/_/g, " ")}
                  </button>
                );
              })}
              {activeTypes.length > 0 && (
                <button
                  onClick={() => setActiveTypes([])}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  clear
                </button>
              )}
            </div>
          )}
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
              <Card
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedLead({
                  id: s.id,
                  company_name: s.company_name,
                  location: s.county,
                  signal_type: s.signal_type,
                  confidence: s.confidence,
                  recommended_pitch: s.recommended_pitch,
                  source_urls: s.source_url ? [s.source_url] : [],
                  detected_at: (s as any).detected_at,
                })}
                className="p-4 cursor-pointer hover:border-primary/40 transition"
              >
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
