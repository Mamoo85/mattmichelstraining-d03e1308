// Multi-radar PDF exporter for Growth Radar + Demand Radar.
// Talent Radar continues to use techalert-pdf-generator (already specialized).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TEAL: [number, number, number] = [0, 212, 255];
const NAVY: [number, number, number] = [10, 22, 40];
const SLATE: [number, number, number] = [100, 116, 139];
const DARK: [number, number, number] = [15, 30, 53];

function sanitize(s: string | null | undefined): string {
  if (!s) return "";
  // Strip emoji + control chars; keep printable ASCII + Latin-1
  return s
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}]/gu, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rect(doc: jsPDF, x: number, y: number, w: number, h: number, fill: [number, number, number]) {
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.rect(x, y, w, h, "F");
}

function text(
  doc: jsPDF,
  s: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: [number, number, number]; maxWidth?: number } = {},
) {
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(opts.size ?? 10);
  const c = opts.color ?? [30, 41, 59];
  doc.setTextColor(c[0], c[1], c[2]);
  const safe = sanitize(s);
  if (opts.maxWidth) {
    const lines = doc.splitTextToSize(safe, opts.maxWidth);
    doc.text(lines, x, y);
    return (lines.length * (opts.size ?? 10)) / 2.5;
  }
  doc.text(safe, x, y);
  return (opts.size ?? 10) / 2.5;
}

function header(doc: jsPDF, title: string, subtitle: string) {
  rect(doc, 0, 0, 210, 38, NAVY);
  rect(doc, 0, 38, 210, 2, TEAL);
  text(doc, "DETROIT WEB AGENCY", 15, 14, { size: 9, bold: true, color: TEAL });
  text(doc, title, 15, 24, { size: 18, bold: true, color: [255, 255, 255] });
  text(doc, subtitle, 15, 32, { size: 9, color: [203, 213, 225] });
}

function footer(doc: jsPDF, page: number, total: number) {
  rect(doc, 0, 285, 210, 12, [248, 250, 252]);
  text(doc, "Detroit Web Agency · detroitwebagent.com", 15, 292, { size: 8, color: SLATE });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(`Page ${page} of ${total}`, 195, 292, { align: "right" });
}

interface Signal {
  id: string;
  company_name: string | null;
  location: string | null;
  county: string | null;
  vertical: string | null;
  signal_type: string | null;
  industry: string | null;
  expansion_type: string | null;
  hiring_count: number | null;
  predicted_needs: string[] | string | null;
  confidence: number | null;
  recommended_pitch: string | null;
  source_urls: string[] | null;
  detected_at: string;
}

function buildSignalReport(
  radar: "growth" | "demand",
  signals: Signal[],
  businessName: string,
): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const radarTitle = radar === "growth" ? "Growth Radar" : "Demand Radar";

  // Cover
  rect(doc, 0, 0, 210, 297, NAVY);
  rect(doc, 0, 90, 210, 4, TEAL);
  text(doc, "DETROIT WEB AGENCY", 15, 30, { size: 11, bold: true, color: TEAL });
  text(doc, radarTitle, 15, 65, { size: 36, bold: true, color: [255, 255, 255] });
  text(doc, "Intelligence Briefing", 15, 78, { size: 16, color: [203, 213, 225] });
  text(doc, `Prepared for ${businessName}`, 15, 110, { size: 12, color: TEAL });
  text(doc, new Date().toLocaleDateString("en-US", { dateStyle: "full" }), 15, 118, {
    size: 10, color: [148, 163, 184],
  });

  rect(doc, 15, 140, 180, 50, DARK);
  text(doc, "THIS REPORT", 22, 152, { size: 9, bold: true, color: TEAL });
  text(doc, `${signals.length}`, 22, 175, { size: 42, bold: true, color: [255, 255, 255] });
  text(doc, radar === "growth" ? "expansion signals" : "demand signals", 60, 172, {
    size: 11, color: [203, 213, 225],
  });
  text(doc, "across Michigan", 60, 180, { size: 9, color: [148, 163, 184] });

  text(doc, "CONFIDENTIAL · For internal sales use only", 15, 280, {
    size: 8, color: [148, 163, 184],
  });
  text(doc, "detroitwebagent.com", 195, 280, { size: 8, color: TEAL });

  // Per-signal pages
  signals.forEach((s, i) => {
    doc.addPage();
    header(
      doc,
      s.company_name || "Unidentified Company",
      `${s.signal_type || s.vertical || "Signal"} · ${s.county || s.location || "Michigan"}`,
    );

    // Confidence badge
    const conf = s.confidence ?? 0;
    const band: [number, number, number] =
      conf >= 8 ? [34, 197, 94] : conf >= 6 ? [251, 191, 36] : [148, 163, 184];
    rect(doc, 15, 50, 60, 28, DARK);
    rect(doc, 15, 50, 4, 28, band);
    text(doc, "CONFIDENCE", 22, 58, { size: 7, bold: true, color: [148, 163, 184] });
    text(doc, `${conf}/10`, 22, 70, { size: 22, bold: true, color: [255, 255, 255] });

    // KPI strip
    const kpis = [
      ["VERTICAL", s.vertical || s.industry || "—"],
      ["TYPE", s.signal_type || s.expansion_type || "—"],
      ["DETECTED", new Date(s.detected_at).toLocaleDateString()],
    ];
    kpis.forEach((k, idx) => {
      const x = 80 + idx * 38;
      rect(doc, x, 50, 36, 28, [248, 250, 252]);
      text(doc, k[0], x + 3, 58, { size: 7, bold: true, color: SLATE });
      text(doc, k[1].slice(0, 18), x + 3, 70, { size: 11, bold: true, color: NAVY });
    });

    let y = 90;
    if (s.predicted_needs) {
      rect(doc, 15, y, 180, 8, NAVY);
      text(doc, "PREDICTED NEEDS", 18, y + 5.5, { size: 9, bold: true, color: TEAL });
      y += 13;
      const needs = Array.isArray(s.predicted_needs) ? s.predicted_needs.join(" · ") : s.predicted_needs;
      const h = text(doc, needs, 18, y, { size: 10, color: [30, 41, 59], maxWidth: 175 });
      y += h * 1.2 + 6;
    }

    if (s.recommended_pitch) {
      rect(doc, 15, y, 180, 8, NAVY);
      text(doc, "RECOMMENDED APPROACH", 18, y + 5.5, { size: 9, bold: true, color: TEAL });
      y += 13;
      const h = text(doc, s.recommended_pitch, 18, y, { size: 10, color: [30, 41, 59], maxWidth: 175 });
      y += h * 1.2 + 6;
    }

    if (s.source_urls?.length) {
      rect(doc, 15, y, 180, 8, NAVY);
      text(doc, "SOURCES", 18, y + 5.5, { size: 9, bold: true, color: TEAL });
      y += 13;
      for (const url of s.source_urls.slice(0, 5)) {
        text(doc, url, 18, y, { size: 8, color: [37, 99, 235], maxWidth: 175 });
        y += 5;
      }
    }

    footer(doc, i + 2, signals.length + 1);
  });

  return new Uint8Array(doc.output("arraybuffer"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { radar, ids, business_name } = await req.json();
    if (!radar || !["growth", "demand"].includes(radar)) {
      return new Response(JSON.stringify({ error: "radar must be growth or demand" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const table = radar === "demand" ? "demand_radar_signals" : "industry_pulse_signals";
    let q = supabase.from(table as any).select("*").order("confidence", { ascending: false }).limit(50);
    if (Array.isArray(ids) && ids.length) q = q.in("id", ids);
    const { data, error } = await q;
    if (error) throw error;

    const pdf = buildSignalReport(radar, (data || []) as Signal[], business_name || "Your Team");
    return new Response(pdf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${radar}-radar-briefing.pdf"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
