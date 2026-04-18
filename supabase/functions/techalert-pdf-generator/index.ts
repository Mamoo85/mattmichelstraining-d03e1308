// TechAlert PDF Generator — produces candidate dossiers and weekly briefing
// Modes:
//   POST { mode: "dossier", candidate_id: "uuid" }            → single dossier PDF
//   POST { mode: "briefing", limit?: 10, client_id?: "uuid" } → weekly briefing PDF
//   POST { mode: "batch", limit?: 10 }                        → ZIP of top-N dossiers (returns JSON manifest of base64 PDFs)
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

// DWA brand
const TEAL: [number, number, number] = [0, 212, 255];
const NAVY: [number, number, number] = [10, 22, 40];
const SLATE: [number, number, number] = [100, 116, 139];
const DARK: [number, number, number] = [15, 30, 53];

interface Candidate {
  id: string;
  name: string | null;
  full_name: string | null;
  trade: string | null;
  city: string | null;
  state: string | null;
  license_type: string | null;
  license_number: string | null;
  phone: string | null;
  email: string | null;
  score: number | null;
  current_employer: string | null;
  current_title: string | null;
  years_experience: number | null;
  qualifications_summary: string | null;
  hiring_recommendation: string | null;
  license_issued_at: string | null;
  flight_risk: string | null;
  flight_risk_proof: string | null;
  data_completeness: number | null;
  source: string | null;
  created_at: string;
}

function displayName(c: Candidate) {
  return c.full_name || c.name || "Verified Candidate";
}
function tradeLabel(c: Candidate) {
  return [c.trade, c.license_type].filter(Boolean).join(" · ") || "Skilled Trade";
}
function locLabel(c: Candidate) {
  return [c.city, c.state].filter(Boolean).join(", ") || "Metro Detroit";
}
function scoreBand(s: number | null): { label: string; color: [number, number, number] } {
  const v = s ?? 0;
  if (v >= 9) return { label: "EXCEPTIONAL", color: [34, 197, 94] };
  if (v >= 7) return { label: "STRONG", color: [0, 212, 255] };
  if (v >= 5) return { label: "MODERATE", color: [251, 191, 36] };
  return { label: "MONITOR", color: [148, 163, 184] };
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
  if (opts.maxWidth) {
    const lines = doc.splitTextToSize(s, opts.maxWidth);
    doc.text(lines, x, y);
    return (lines.length * (opts.size ?? 10)) / 2.5;
  }
  doc.text(s, x, y);
  return (opts.size ?? 10) / 2.5;
}

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  rect(doc, 0, 0, 210, 38, NAVY);
  rect(doc, 0, 38, 210, 2, TEAL);
  text(doc, "DETROIT WEB AGENCY", 15, 14, { size: 9, bold: true, color: TEAL });
  text(doc, title, 15, 24, { size: 18, bold: true, color: [255, 255, 255] });
  text(doc, subtitle, 15, 32, { size: 9, color: [203, 213, 225] });
  text(doc, "TechAlert", 195, 14, { size: 9, bold: true, color: TEAL });
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(9);
  doc.text("Confidential", 195, 22, { align: "right" });
}

function drawFooter(doc: jsPDF, pageNum: number, total: number) {
  rect(doc, 0, 285, 210, 12, [248, 250, 252]);
  text(doc, "Detroit Web Agency · TechAlert · detroitwebagent.com", 15, 292, {
    size: 8,
    color: SLATE,
  });
  text(doc, `Page ${pageNum} of ${total}`, 195, 292, { size: 8, color: SLATE });
  doc.setFontSize(8);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(`Page ${pageNum} of ${total}`, 195, 292, { align: "right" });
}

function buildDossier(c: Candidate): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, displayName(c), `${tradeLabel(c)} · ${locLabel(c)}`);

  const band = scoreBand(c.score);
  // Score badge
  rect(doc, 15, 50, 60, 28, DARK);
  rect(doc, 15, 50, 4, 28, band.color);
  text(doc, "INTELLIGENCE SCORE", 22, 58, { size: 7, bold: true, color: [148, 163, 184] });
  text(doc, `${c.score ?? 0}/10`, 22, 70, { size: 22, bold: true, color: [255, 255, 255] });
  text(doc, band.label, 45, 70, { size: 9, bold: true, color: band.color });

  // KPI strip
  const kpis = [
    ["EXPERIENCE", c.years_experience ? `${c.years_experience} yrs` : "—"],
    ["DATA QUALITY", c.data_completeness ? `${c.data_completeness}%` : "—"],
    ["FLIGHT RISK", c.flight_risk ? c.flight_risk.toUpperCase() : "STABLE"],
  ];
  kpis.forEach((k, i) => {
    const x = 80 + i * 38;
    rect(doc, x, 50, 36, 28, [248, 250, 252]);
    text(doc, k[0], x + 3, 58, { size: 7, bold: true, color: SLATE });
    text(doc, k[1], x + 3, 70, { size: 12, bold: true, color: NAVY });
  });

  // Contact section
  let y = 90;
  rect(doc, 15, y, 180, 8, NAVY);
  text(doc, "CONTACT INFORMATION", 18, y + 5.5, { size: 9, bold: true, color: TEAL });
  y += 14;
  const contacts = [
    ["Phone", c.phone || "Not on file"],
    ["Email", c.email || "Not on file"],
    ["Current Employer", c.current_employer || "Independent / Unknown"],
    ["Current Title", c.current_title || "—"],
  ];
  contacts.forEach(([label, val]) => {
    text(doc, label.toUpperCase(), 18, y, { size: 7, bold: true, color: SLATE });
    text(doc, val, 60, y, { size: 10, color: [30, 41, 59], maxWidth: 130 });
    y += 7;
  });

  // Credentials
  y += 4;
  rect(doc, 15, y, 180, 8, NAVY);
  text(doc, "CREDENTIALS", 18, y + 5.5, { size: 9, bold: true, color: TEAL });
  y += 14;
  const creds = [
    ["License Type", c.license_type || "—"],
    ["License #", c.license_number || "—"],
    ["Issued", c.license_issued_at ? new Date(c.license_issued_at).toLocaleDateString() : "—"],
  ];
  creds.forEach(([label, val]) => {
    text(doc, label.toUpperCase(), 18, y, { size: 7, bold: true, color: SLATE });
    text(doc, val, 60, y, { size: 10, color: [30, 41, 59] });
    y += 7;
  });

  // Hiring summary
  if (c.qualifications_summary || c.hiring_recommendation) {
    y += 4;
    rect(doc, 15, y, 180, 8, NAVY);
    text(doc, "HIRING INTELLIGENCE", 18, y + 5.5, { size: 9, bold: true, color: TEAL });
    y += 13;
    if (c.qualifications_summary) {
      text(doc, "QUALIFICATIONS", 18, y, { size: 7, bold: true, color: SLATE });
      y += 5;
      const h = text(doc, c.qualifications_summary, 18, y, {
        size: 9,
        color: [30, 41, 59],
        maxWidth: 175,
      });
      y += h * 1.2 + 4;
    }
    if (c.hiring_recommendation) {
      text(doc, "RECOMMENDED APPROACH", 18, y, { size: 7, bold: true, color: SLATE });
      y += 5;
      const h = text(doc, c.hiring_recommendation, 18, y, {
        size: 9,
        color: [30, 41, 59],
        maxWidth: 175,
      });
      y += h * 1.2;
    }
  }

  // Flight-risk note
  if (c.flight_risk_proof) {
    y += 6;
    rect(doc, 15, y, 180, 18, [254, 243, 199]);
    text(doc, "MOBILITY SIGNAL", 18, y + 5, { size: 7, bold: true, color: [180, 83, 9] });
    text(doc, c.flight_risk_proof, 18, y + 11, {
      size: 9,
      color: [120, 53, 15],
      maxWidth: 175,
    });
  }

  drawFooter(doc, 1, 1);
  return new Uint8Array(doc.output("arraybuffer"));
}

function buildBriefing(candidates: Candidate[], businessName: string): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Cover
  rect(doc, 0, 0, 210, 297, NAVY);
  rect(doc, 0, 90, 210, 4, TEAL);
  text(doc, "DETROIT WEB AGENCY", 15, 30, { size: 11, bold: true, color: TEAL });
  text(doc, "TechAlert", 15, 65, { size: 36, bold: true, color: [255, 255, 255] });
  text(doc, "Weekly Intelligence Briefing", 15, 78, { size: 16, color: [203, 213, 225] });
  text(doc, `Prepared for ${businessName}`, 15, 110, { size: 12, color: TEAL });
  text(doc, new Date().toLocaleDateString("en-US", { dateStyle: "full" }), 15, 118, {
    size: 10,
    color: [148, 163, 184],
  });

  rect(doc, 15, 140, 180, 50, DARK);
  text(doc, "THIS WEEK", 22, 152, { size: 9, bold: true, color: TEAL });
  text(doc, `${candidates.length}`, 22, 175, { size: 42, bold: true, color: [255, 255, 255] });
  text(doc, "qualified licensed candidates identified", 60, 172, {
    size: 11,
    color: [203, 213, 225],
  });
  text(doc, "across Metro Detroit and surrounding counties", 60, 180, {
    size: 9,
    color: [148, 163, 184],
  });

  text(doc, "CONFIDENTIAL · For internal hiring use only", 15, 280, {
    size: 8,
    color: [148, 163, 184],
  });
  text(doc, "detroitwebagent.com", 195, 280, { size: 8, color: TEAL });

  // Summary table
  doc.addPage();
  drawHeader(doc, "Top Candidates Summary", `${candidates.length} ranked by intelligence score`);
  let y = 50;
  rect(doc, 15, y, 180, 8, NAVY);
  text(doc, "#", 18, y + 5.5, { size: 8, bold: true, color: TEAL });
  text(doc, "NAME", 26, y + 5.5, { size: 8, bold: true, color: TEAL });
  text(doc, "TRADE", 80, y + 5.5, { size: 8, bold: true, color: TEAL });
  text(doc, "LOCATION", 130, y + 5.5, { size: 8, bold: true, color: TEAL });
  text(doc, "SCORE", 175, y + 5.5, { size: 8, bold: true, color: TEAL });
  y += 11;
  candidates.forEach((c, i) => {
    if (i % 2 === 0) rect(doc, 15, y - 4, 180, 8, [248, 250, 252]);
    const band = scoreBand(c.score);
    text(doc, `${i + 1}`, 18, y, { size: 9, color: SLATE });
    text(doc, displayName(c).slice(0, 28), 26, y, { size: 9, bold: true });
    text(doc, (c.trade || c.license_type || "—").slice(0, 22), 80, y, { size: 9 });
    text(doc, locLabel(c).slice(0, 22), 130, y, { size: 9 });
    text(doc, `${c.score ?? 0}`, 175, y, { size: 10, bold: true, color: band.color });
    y += 8;
  });
  drawFooter(doc, 2, candidates.length + 2);

  // One page per candidate
  candidates.forEach((c, i) => {
    doc.addPage();
    drawHeader(doc, displayName(c), `${tradeLabel(c)} · ${locLabel(c)}`);
    const band = scoreBand(c.score);

    rect(doc, 15, 50, 60, 28, DARK);
    rect(doc, 15, 50, 4, 28, band.color);
    text(doc, "SCORE", 22, 58, { size: 7, bold: true, color: [148, 163, 184] });
    text(doc, `${c.score ?? 0}/10`, 22, 70, { size: 22, bold: true, color: [255, 255, 255] });
    text(doc, band.label, 45, 70, { size: 9, bold: true, color: band.color });

    const kpis = [
      ["EXPERIENCE", c.years_experience ? `${c.years_experience} yrs` : "—"],
      ["DATA QUALITY", c.data_completeness ? `${c.data_completeness}%` : "—"],
      ["FLIGHT RISK", c.flight_risk ? c.flight_risk.toUpperCase() : "STABLE"],
    ];
    kpis.forEach((k, idx) => {
      const x = 80 + idx * 38;
      rect(doc, x, 50, 36, 28, [248, 250, 252]);
      text(doc, k[0], x + 3, 58, { size: 7, bold: true, color: SLATE });
      text(doc, k[1], x + 3, 70, { size: 12, bold: true, color: NAVY });
    });

    let yy = 90;
    rect(doc, 15, yy, 180, 8, NAVY);
    text(doc, "CONTACT", 18, yy + 5.5, { size: 9, bold: true, color: TEAL });
    yy += 13;
    [
      ["Phone", c.phone || "Not on file"],
      ["Email", c.email || "Not on file"],
      ["Employer", c.current_employer || "Independent / Unknown"],
      ["License", `${c.license_type || "—"} ${c.license_number || ""}`.trim()],
    ].forEach(([l, v]) => {
      text(doc, l.toUpperCase(), 18, yy, { size: 7, bold: true, color: SLATE });
      text(doc, v, 60, yy, { size: 10, maxWidth: 130 });
      yy += 7;
    });

    if (c.qualifications_summary) {
      yy += 4;
      rect(doc, 15, yy, 180, 8, NAVY);
      text(doc, "QUALIFICATIONS", 18, yy + 5.5, { size: 9, bold: true, color: TEAL });
      yy += 13;
      const h = text(doc, c.qualifications_summary, 18, yy, {
        size: 9,
        color: [30, 41, 59],
        maxWidth: 175,
      });
      yy += h * 1.2 + 4;
    }
    if (c.hiring_recommendation) {
      rect(doc, 15, yy, 180, 8, NAVY);
      text(doc, "RECOMMENDED APPROACH", 18, yy + 5.5, { size: 9, bold: true, color: TEAL });
      yy += 13;
      text(doc, c.hiring_recommendation, 18, yy, {
        size: 9,
        color: [30, 41, 59],
        maxWidth: 175,
      });
    }

    drawFooter(doc, i + 3, candidates.length + 2);
  });

  return new Uint8Array(doc.output("arraybuffer"));
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { mode = "briefing", candidate_id, limit = 10, client_id, business_name } =
      await req.json().catch(() => ({}));

    if (mode === "dossier") {
      if (!candidate_id) {
        return new Response(JSON.stringify({ error: "candidate_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("hire_alert_candidates")
        .select("*")
        .eq("id", candidate_id)
        .maybeSingle();
      if (error || !data) {
        return new Response(JSON.stringify({ error: error?.message || "Not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const pdf = buildDossier(data as Candidate);
      return new Response(pdf, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="dossier-${displayName(data as Candidate).replace(/\s+/g, "_")}.pdf"`,
        },
      });
    }

    // Fetch top candidates for briefing/batch
    let q = supabase
      .from("hire_alert_candidates")
      .select("*")
      .eq("is_demo_record", false)
      .neq("source", "linkedin_otw")
      .order("score", { ascending: false, nullsFirst: false })
      .limit(Math.min(Number(limit) || 10, 50));
    if (client_id) q = q.eq("client_id", client_id);
    const { data: candidates, error } = await q;
    if (error) throw error;
    const list = (candidates || []) as Candidate[];

    if (mode === "batch") {
      const dossiers = list.map((c) => ({
        candidate_id: c.id,
        name: displayName(c),
        filename: `dossier-${displayName(c).replace(/\s+/g, "_")}.pdf`,
        pdf_base64: toBase64(buildDossier(c)),
      }));
      return new Response(JSON.stringify({ count: dossiers.length, dossiers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: briefing
    const pdf = buildBriefing(list, business_name || "Your Hiring Team");
    return new Response(pdf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="TechAlert_Weekly_Briefing.pdf"`,
      },
    });
  } catch (e) {
    console.error("[techalert-pdf-generator] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
