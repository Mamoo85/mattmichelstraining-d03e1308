import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Printer, Download, Copy, Eye, RefreshCw,
} from "lucide-react";

const MATT_PHOTO = "https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/6z5o71kv_19405.jpg";
const DWA_BADGE = "https://customer-assets.emergentagent.com/job_docs-claude-v2/artifacts/1dhqg3eh_25239.png";
const BASE_URL = "https://detroitwebagent.com";

type RecipientType = "healthcare-agency" | "trades-agency" | "nursing-home" | "contractor" | "supply-house";

interface PostcardConfig {
  type: RecipientType;
  label: string;
  headline: string;
  body: string;
  offer: string;
  qrPath: string;
  accentColor: string;
}

const POSTCARD_VARIANTS: PostcardConfig[] = [
  {
    type: "healthcare-agency",
    label: "Healthcare Staffing Agency",
    headline: "We Find Licensed Nurses\nBefore Anyone Else",
    body: "We invented a way to identify newly certified CNAs, LPNs, and RNs across Michigan — often within hours. Your competitors don't have this.\n\nYour first 10 names are free. Verified. With contact info.",
    offer: "FREE 10 VERIFIED NURSE NAMES",
    qrPath: "/staffing?industry=healthcare&src=postcard",
    accentColor: "#10b981",
  },
  {
    type: "trades-agency",
    label: "Trades Staffing Agency",
    headline: "We Find Licensed Techs\nBefore Your Competitors",
    body: "We invented a proprietary system that identifies newly licensed HVAC techs, plumbers, electricians, and boiler operators across Michigan.\n\nYour first 10 names are free. Verified. With direct contact info.",
    offer: "FREE 10 LICENSED TECH NAMES",
    qrPath: "/staffing?industry=trades&src=postcard",
    accentColor: "#3b82f6",
  },
  {
    type: "nursing-home",
    label: "Nursing Home / Facility",
    headline: "Struggling to\nFind Nurses?",
    body: "We invented a way to find newly licensed CNAs, LPNs, and RNs in your area — before they even start applying to jobs. Verified names with contact info, delivered daily.\n\nYour first 10 candidates are free. No strings.",
    offer: "FREE 10 NURSE CANDIDATES",
    qrPath: "/staffing?industry=healthcare&src=postcard-facility",
    accentColor: "#10b981",
  },
  {
    type: "contractor",
    label: "HVAC / Plumbing / Electrical Contractor",
    headline: "Need Licensed Techs?\nWe Find Them First.",
    body: "We invented a way to identify newly licensed tradespeople in Michigan before they hit the job boards. Verified names, availability scores, direct contact info.\n\nYour first 10 names are free.",
    offer: "FREE 10 LICENSED NAMES",
    qrPath: "/go/techalert?src=postcard",
    accentColor: "#3b82f6",
  },
  {
    type: "supply-house",
    label: "Supply House / Equipment Distributor",
    headline: "Know Who's Buying\nBefore They Call",
    body: "We invented a system that detects which companies are expanding — based on hiring patterns — and predicts what equipment they'll need next. You get the intel before your competitors.\n\nFirst month free.",
    offer: "FREE MONTH — DEMAND RADAR",
    qrPath: "/demand-radar?src=postcard",
    accentColor: "#06b6d4",
  },
];

function generatePostcardHTML(config: PostcardConfig, city: string, recipientName: string): string {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(BASE_URL + config.qrPath + "&city=" + city.toLowerCase().replace(/\s+/g, "-"))}`;
  const headlineLines = config.headline.split("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Inter',sans-serif; }
.card { width:6in; height:4in; position:relative; overflow:hidden; background:#0d1117; color:#e6edf3; display:flex; }
.left { flex:1; padding:0.4in 0.35in; display:flex; flex-direction:column; justify-content:space-between; }
.right { width:1.8in; background:#161b22; border-left:3px solid ${config.accentColor}; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0.3in 0.2in; gap:12px; }
.headline { font-size:22px; font-weight:900; line-height:1.15; letter-spacing:-0.5px; margin-bottom:10px; }
.headline span { color:${config.accentColor}; }
.body-text { font-size:9.5px; color:#8b949e; line-height:1.55; margin-bottom:12px; }
.offer-badge { display:inline-block; background:${config.accentColor}15; border:1.5px solid ${config.accentColor}40; color:${config.accentColor}; font-size:9px; font-weight:800; padding:5px 12px; border-radius:4px; letter-spacing:0.5px; margin-bottom:10px; }
.matt-section { display:flex; align-items:center; gap:10px; background:#161b22; border:1px solid #30363d; border-radius:8px; padding:8px 10px; }
.matt-photo { width:40px; height:40px; border-radius:8px; object-fit:cover; border:1.5px solid #30363d; }
.matt-text { font-size:8.5px; color:#8b949e; line-height:1.4; }
.matt-text strong { color:#e6edf3; font-size:9px; }
.matt-text .phone { color:${config.accentColor}; font-weight:700; font-size:10px; }
.qr-box img { border-radius:8px; border:2px solid #30363d; }
.qr-label { font-size:8px; color:#8b949e; text-align:center; font-weight:600; text-transform:uppercase; letter-spacing:1px; }
.qr-action { font-size:10px; color:${config.accentColor}; font-weight:800; text-align:center; }
.badge-img { width:55px; height:55px; border-radius:50%; border:1.5px solid #30363d; }
.city-tag { font-size:7px; color:#484f58; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:4px; }
${recipientName ? `.recipient { font-size:8px; color:#484f58; margin-bottom:6px; }` : ""}
</style></head><body>
<div class="card">
  <div class="left">
    <div>
      <div class="city-tag">${city || "Michigan"}</div>
      ${recipientName ? `<div class="recipient">For: ${recipientName}</div>` : ""}
      <div class="headline">${headlineLines[0]}<br><span>${headlineLines[1] || ""}</span></div>
      <div class="body-text">${config.body.replace(/\n\n/g, "<br><br>")}</div>
      <div class="offer-badge">${config.offer}</div>
    </div>
    <div class="matt-section">
      <img src="${MATT_PHOTO}" class="matt-photo" alt="Matt">
      <div class="matt-text">
        <strong>Matt Michels</strong> — Founder<br>
        Don't believe it works? Text me.<br>
        I'll call you personally and prove it.<br>
        <span class="phone">(313) 992-1219</span>
      </div>
    </div>
  </div>
  <div class="right">
    <img src="${DWA_BADGE}" class="badge-img" alt="DWA">
    <div class="qr-label">Scan to claim</div>
    <div class="qr-box"><img src="${qrUrl}" width="120" height="120" alt="QR"></div>
    <div class="qr-action">FREE ${config.type.includes("supply") ? "MONTH" : "10 NAMES"}</div>
    <div style="font-size:7px;color:#484f58;text-align:center;">detroitwebagent.com</div>
  </div>
</div>
</body></html>`;
}

export default function AdminPostcardOps() {
  const [selectedType, setSelectedType] = useState<RecipientType>("healthcare-agency");
  const [city, setCity] = useState("Metro Detroit");
  const [recipientName, setRecipientName] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");

  const config = POSTCARD_VARIANTS.find(v => v.type === selectedType)!;

  function generatePreview() {
    const html = generatePostcardHTML(config, city, recipientName);
    setPreviewHtml(html);
    toast.success("Postcard generated!");
  }

  function copyHTML() {
    const html = generatePostcardHTML(config, city, recipientName);
    navigator.clipboard.writeText(html);
    toast.success("HTML copied to clipboard — paste into print tool");
  }

  function downloadHTML() {
    const html = generatePostcardHTML(config, city, recipientName);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `postcard-${selectedType}-${city.toLowerCase().replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("HTML file downloaded");
  }

  function generateBatch() {
    const cities = ["Metro Detroit", "Grand Rapids", "Lansing", "Ann Arbor", "Flint", "Kalamazoo", "Traverse City", "Saginaw"];
    const allHtml = cities.map(c => generatePostcardHTML(config, c, "")).join("\n<div style='page-break-after:always'></div>\n");
    const blob = new Blob([`<!DOCTYPE html><html><head><style>@page{size:6in 4in;margin:0}@media print{.card{page-break-after:always}}</style></head><body>${allHtml}</body></html>`], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `postcard-batch-${selectedType}-all-cities.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Generated ${cities.length} postcards for all Michigan cities`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white/40 text-xs uppercase tracking-wide mb-1">Postcard Operations</h2>
          <p className="text-white/60 text-sm">Generate print-ready postcards for every audience and city in Michigan.</p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide font-semibold block mb-1">Audience</label>
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value as RecipientType)}
            className="w-full bg-[#161b22] border border-[#30363d] text-white text-sm rounded-lg px-3 py-2"
          >
            {POSTCARD_VARIANTS.map(v => (
              <option key={v.type} value={v.type}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide font-semibold block mb-1">City</label>
          <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Metro Detroit" className="bg-[#161b22] border-[#30363d] text-white text-sm" />
        </div>
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide font-semibold block mb-1">Recipient (optional)</label>
          <Input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Acme Staffing LLC" className="bg-[#161b22] border-[#30363d] text-white text-sm" />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={generatePreview} className="bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30 text-sm flex-1">
            <Eye className="w-3 h-3 mr-1" /> Preview
          </Button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={copyHTML} size="sm" className="bg-white/5 text-white/50 border border-white/10 hover:bg-white/10">
          <Copy className="w-3 h-3 mr-1" /> Copy HTML
        </Button>
        <Button onClick={downloadHTML} size="sm" className="bg-white/5 text-white/50 border border-white/10 hover:bg-white/10">
          <Download className="w-3 h-3 mr-1" /> Download Single
        </Button>
        <Button onClick={generateBatch} size="sm" className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
          <Printer className="w-3 h-3 mr-1" /> Generate All Cities ({POSTCARD_VARIANTS.find(v => v.type === selectedType)?.label})
        </Button>
        <Button onClick={() => {
          POSTCARD_VARIANTS.forEach(v => {
            const cities = ["Metro Detroit", "Grand Rapids", "Lansing", "Ann Arbor", "Flint", "Kalamazoo"];
            const allHtml = cities.map(c => generatePostcardHTML(v, c, "")).join("\n<div style='page-break-after:always'></div>\n");
            const blob = new Blob([`<!DOCTYPE html><html><head><style>@page{size:6in 4in;margin:0}</style></head><body>${allHtml}</body></html>`], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `batch-${v.type}.html`; a.click(); URL.revokeObjectURL(url);
          });
          toast.success("Generated all postcard variants for all cities!");
        }} size="sm" className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30">
          <RefreshCw className="w-3 h-3 mr-1" /> Generate EVERYTHING (5 types x 8 cities)
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-5 gap-2">
        {POSTCARD_VARIANTS.map(v => (
          <button
            key={v.type}
            onClick={() => setSelectedType(v.type)}
            className={`p-2 rounded-lg border text-center transition-colors ${selectedType === v.type ? "border-[#00d4ff]/50 bg-[#00d4ff]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
          >
            <div className="text-white text-xs font-bold">{v.label.split(" ")[0]}</div>
            <div className="text-white/30 text-[9px]">{v.offer}</div>
          </button>
        ))}
      </div>

      {/* Preview */}
      {previewHtml && (
        <div>
          <p className="text-white/30 text-[10px] uppercase tracking-wide font-semibold mb-2">Preview (6" x 4" postcard)</p>
          <div className="border border-[#30363d] rounded-lg overflow-hidden" style={{ maxWidth: 660 }}>
            <iframe
              srcDoc={previewHtml}
              style={{ width: "6in", height: "4in", border: "none", transform: "scale(0.9)", transformOrigin: "top left" }}
              title="Postcard Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
