import { Button } from "@/components/ui/button";
import { Download, FileText, Mail, MessageSquare, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type RadarKind = "talent" | "growth" | "demand";

export interface ExportRecord {
  id: string;
  // Free-form display fields used to build CSV / SMS / Email previews
  name?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  trade?: string | null;
  license_type?: string | null;
  city?: string | null;
  county?: string | null;
  vertical?: string | null;
  signal_type?: string | null;
  score?: number | null;
  availability_score?: number | null;
  confidence?: number | null;
  recommended_pitch?: string | null;
  predicted_needs?: string | string[] | null;
  source_url?: string | null;
  phone?: string | null;
  email?: string | null;
  detected_at?: string | null;
  first_seen_at?: string | null;
}

interface Props {
  radar: RadarKind;
  records: ExportRecord[];
  /** Optional client id for PDF scoping (talent radar) */
  clientId?: string;
  /** Optional business name for PDF cover */
  businessName?: string;
  className?: string;
}

const RADAR_TITLES: Record<RadarKind, string> = {
  talent: "Talent Radar",
  growth: "Growth Radar",
  demand: "Demand Radar",
};

function escapeCsv(v: unknown): string {
  const s = v == null ? "" : Array.isArray(v) ? v.join(" | ") : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function recordTitle(r: ExportRecord): string {
  return r.full_name || r.name || r.company_name || "Untitled";
}
function recordSubtitle(r: ExportRecord): string {
  return [r.trade || r.license_type || r.signal_type || r.vertical, r.city || r.county]
    .filter(Boolean)
    .join(" · ");
}
function recordScore(r: ExportRecord): number | null {
  return r.score ?? r.availability_score ?? r.confidence ?? null;
}

export const RadarExportBar = ({
  radar,
  records,
  clientId,
  businessName,
  className = "",
}: Props) => {
  const [pdfLoading, setPdfLoading] = useState(false);
  const empty = !records.length;
  const title = RADAR_TITLES[radar];

  const exportCsv = () => {
    if (empty) return;
    const headers = [
      "Name / Company",
      "Type",
      "Location",
      "Score",
      "Pitch / Notes",
      "Phone",
      "Email",
      "Source URL",
      "Detected",
    ];
    const rows = records.map((r) => [
      recordTitle(r),
      r.trade || r.license_type || r.signal_type || r.vertical || "",
      [r.city, r.county].filter(Boolean).join(", "),
      recordScore(r) ?? "",
      r.recommended_pitch || (Array.isArray(r.predicted_needs) ? r.predicted_needs.join("; ") : r.predicted_needs || ""),
      r.phone || "",
      r.email || "",
      r.source_url || "",
      r.detected_at || r.first_seen_at || "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${radar}-radar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${records.length} rows to CSV`);
  };

  const exportPdf = async () => {
    if (empty) return;
    setPdfLoading(true);
    try {
      // Talent Radar uses the existing techalert-pdf-generator briefing mode
      if (radar === "talent") {
        const { data, error } = await supabase.functions.invoke("techalert-pdf-generator", {
          body: {
            mode: "briefing",
            limit: Math.min(records.length, 25),
            client_id: clientId,
            business_name: businessName,
          },
        });
        if (error) throw error;
        // Edge function returns binary PDF; supabase-js gives us a Blob
        const blob = data instanceof Blob ? data : new Blob([data as any], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        return;
      }

      // Growth + Demand use the multi-radar exporter
      const { data, error } = await supabase.functions.invoke("radar-export-pdf", {
        body: {
          radar,
          ids: records.slice(0, 25).map((r) => r.id),
          business_name: businessName,
        },
      });
      if (error) throw error;
      const blob = data instanceof Blob ? data : new Blob([data as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "PDF export failed");
    } finally {
      setPdfLoading(false);
    }
  };

  const exportEmail = () => {
    if (empty) return;
    const top = records.slice(0, 5);
    const lines = top.map((r, i) => {
      const score = recordScore(r);
      const sub = recordSubtitle(r);
      return `${i + 1}. ${recordTitle(r)}${sub ? ` — ${sub}` : ""}${score ? ` (Score ${score})` : ""}${r.recommended_pitch ? `\n   ${r.recommended_pitch}` : ""}`;
    });
    const body = encodeURIComponent(
      `${title} — Top ${top.length} ${radar === "talent" ? "Candidates" : "Signals"}\n\n${lines.join("\n\n")}\n\n— Sent from Detroit Web Agency · detroitwebagent.com`,
    );
    const subject = encodeURIComponent(`${title}: ${top.length} ${radar === "talent" ? "candidates" : "signals"} for review`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const exportSms = () => {
    if (empty) return;
    const top = records[0];
    const score = recordScore(top);
    const sub = recordSubtitle(top);
    const more = records.length > 1 ? ` (+${records.length - 1} more)` : "";
    const msg = `${title}: ${recordTitle(top)}${sub ? ` — ${sub}` : ""}${score ? ` · ${score}/10` : ""}${more}. Full list: detroitwebagent.com`;
    const body = encodeURIComponent(msg.slice(0, 320));
    window.location.href = `sms:?body=${body}`;
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 p-3 rounded-lg bg-card border border-border ${className}`}
    >
      <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">
        Export {records.length}:
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={exportPdf}
        disabled={empty || pdfLoading}
        className="h-8"
      >
        {pdfLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
        PDF
      </Button>
      <Button size="sm" variant="outline" onClick={exportCsv} disabled={empty} className="h-8">
        <Download className="h-3.5 w-3.5 mr-1.5" />
        CSV
      </Button>
      <Button size="sm" variant="outline" onClick={exportEmail} disabled={empty} className="h-8">
        <Mail className="h-3.5 w-3.5 mr-1.5" />
        Email
      </Button>
      <Button size="sm" variant="outline" onClick={exportSms} disabled={empty} className="h-8">
        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
        SMS
      </Button>
    </div>
  );
};

export default RadarExportBar;
