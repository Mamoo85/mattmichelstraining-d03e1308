import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProvenanceSource {
  source?: string;
  field?: string;
  url?: string;
  fetched_at?: string;
}

const SOURCE_MAP: Record<string, { icon: string; label: string }> = {
  bseed: { icon: "🏗️", label: "BSEED Detroit Permits" },
  permit: { icon: "🏗️", label: "BSEED Detroit Permits" },
  sonar: { icon: "📋", label: "Public Record Scan" },
  perplexity: { icon: "📋", label: "Public Record Scan" },
  mi_sos: { icon: "🏛️", label: "MI Secretary of State" },
  llc: { icon: "🏛️", label: "MI Secretary of State" },
  noaa: { icon: "☁️", label: "NOAA Storm Events" },
  storm: { icon: "☁️", label: "NOAA Storm Events" },
  sam: { icon: "🏛️", label: "SAM.gov Federal Contracts" },
  sam_gov: { icon: "🏛️", label: "SAM.gov Federal Contracts" },
  fred: { icon: "📈", label: "FRED Mortgage Rates" },
  census: { icon: "🗺️", label: "Census ACS Demographics" },
  hud: { icon: "🏘️", label: "HUD Fair Market Rents" },
  epa: { icon: "♻️", label: "EPA ECHO Violations" },
  npi: { icon: "⚕️", label: "NPI Healthcare Registry" },
  arcgis: { icon: "🗺️", label: "Detroit ArcGIS Parcels" },
};

function classify(s: ProvenanceSource): { icon: string; label: string } | null {
  const key = (s.source || s.field || "").toLowerCase();
  for (const k of Object.keys(SOURCE_MAP)) {
    if (key.includes(k)) return SOURCE_MAP[k];
  }
  return null;
}

export function SourceIconRow({ sources }: { sources: ProvenanceSource[] | null | undefined }) {
  if (!sources?.length) return null;
  const seen = new Set<string>();
  const items: Array<{ icon: string; label: string }> = [];
  for (const s of sources) {
    const c = classify(s);
    if (!c) continue;
    if (seen.has(c.label)) continue;
    seen.add(c.label);
    items.push(c);
  }
  if (!items.length) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5 text-base">
        {items.map((it) => (
          <Tooltip key={it.label}>
            <TooltipTrigger asChild>
              <span className="cursor-help leading-none">{it.icon}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-popover border-border">
              <span className="text-xs font-mono">{it.label}</span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
