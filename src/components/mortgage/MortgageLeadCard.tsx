import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, MessageSquare, Phone, ChevronDown, ChevronUp, Check, ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ScoreBreakdown from "@/components/shared/ScoreBreakdown";
import LeadActionBar from "@/components/trade-radar/LeadActionBar";

/** Skeleton placeholder shown while the leads list is loading. */
export function MortgageLeadCardSkeleton() {
  return (
    <Card className="bg-[#0a1628] border border-[#1e3a5f]">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Skeleton className="shrink-0 w-[110px] h-[82px] rounded-md bg-[#1e3a5f]/40" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-5 w-3/4 bg-[#1e3a5f]/40" />
            <Skeleton className="h-3 w-1/2 bg-[#1e3a5f]/30" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-7 w-14 bg-[#1e3a5f]/40" />
            <Skeleton className="h-2 w-16 bg-[#1e3a5f]/30" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full bg-[#1e3a5f]/30" />
        <Skeleton className="h-4 w-5/6 bg-[#1e3a5f]/30" />
        <Skeleton className="h-16 w-full bg-[#1e3a5f]/30" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-8 w-28 bg-[#1e3a5f]/40" />
          <Skeleton className="h-8 w-24 bg-[#1e3a5f]/30" />
          <Skeleton className="h-8 w-24 bg-[#1e3a5f]/30" />
        </div>
      </CardContent>
    </Card>
  );
}

export type MortgageLead = {
  id: string;
  full_name: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  signal_type: string;
  signal_source: string;
  signal_detail: string | null;
  signal_date: string | null;
  score: number;
  signal_count: number | null;
  suggested_opener: string | null;
  best_call_window: string | null;
  created_at: string;
  pipeline_stage?: string | null;
  street_view_url?: string | null;
  intel_highlights?: any;
  year_built?: number | null;
  building_sqft?: number | null;
  last_sale_price_cents?: number | null;
  last_sale_date?: string | null;
  estimated_equity?: number | null;
  equity_range_low_cents?: number | null;
  equity_range_high_cents?: number | null;
  human_summary?: string | null;
  signal_history?: any;
};

function fmtMoney(cents?: number | null) {
  if (cents == null) return null;
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function fmtNum(n?: number | null) {
  if (n == null) return null;
  return n.toLocaleString();
}

interface Props {
  lead: MortgageLead;
  clientId: string | null;
  onMarkWorking: (lead: MortgageLead) => void;
  onDraftSms: (lead: MortgageLead) => void;
  onDraftEmail: (lead: MortgageLead) => void;
}

export default function MortgageLeadCard({ lead: l, clientId, onMarkWorking, onDraftSms, onDraftEmail }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbErrored, setThumbErrored] = useState(false);
  const [largeLoaded, setLargeLoaded] = useState(false);
  const [largeErrored, setLargeErrored] = useState(false);
  const isWorking = l.pipeline_stage === "working" || l.pipeline_stage === "claimed";
  const thumb = l.street_view_url;
  const showThumbImg = !!thumb && !thumbErrored;
  const lastSale = fmtMoney(l.last_sale_price_cents);
  const equityLow = fmtMoney(l.equity_range_low_cents);
  const equityHigh = fmtMoney(l.equity_range_high_cents);
  const sqft = fmtNum(l.building_sqft);
  const history: any[] = Array.isArray(l.signal_history) ? l.signal_history : [];
  const highlights: string[] = Array.isArray(l.intel_highlights) ? l.intel_highlights : [];

  return (
    <Card className={`bg-[#0a1628] border ${l.score >= 9 ? "border-[#00d4ff]" : "border-[#1e3a5f]"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Street View thumbnail */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 w-[110px] h-[82px] rounded-md overflow-hidden border border-[#1e3a5f] bg-[#030711] flex items-center justify-center hover:border-[#00d4ff]/60 transition-colors"
            title={thumb ? "Click for more details" : "No Street View available"}
          >
            {showThumbImg ? (
              <>
                {!thumbLoaded && <Skeleton className="absolute inset-0 bg-[#1e3a5f]/40" />}
                <img
                  src={thumb}
                  alt={l.address || "Property"}
                  className={`w-full h-full object-cover transition-opacity ${thumbLoaded ? "opacity-100" : "opacity-0"}`}
                  loading="lazy"
                  onLoad={() => setThumbLoaded(true)}
                  onError={() => { setThumbErrored(true); setThumbLoaded(true); }}
                />
              </>
            ) : (
              <ImageOff className="w-5 h-5 text-[#475569]" aria-label={thumb ? "Street View failed to load" : "No Street View available"} />
            )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-white text-base sm:text-lg truncate">{l.address || "Address pending"}</CardTitle>
                <p className="text-xs text-[#94a3b8] mt-1 flex items-center gap-1 flex-wrap">
                  <MapPin className="w-3 h-3" /> {l.city || ""} {l.zip || ""} · {l.signal_source}
                  {(l.signal_count || 1) > 1 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-[#00d4ff]/20 text-[#00d4ff] font-bold">×{l.signal_count} signals</span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-2xl font-extrabold ${l.score >= 9 ? "text-[#00d4ff]" : "text-white"}`}>{l.score}/10</p>
                <p className="text-[10px] text-[#64748b] uppercase tracking-widest">{l.signal_type.replace(/_/g, " ")}</p>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {l.signal_detail && <p className="text-sm text-[#cbd5e1] mb-3">{l.signal_detail}</p>}
        <div className="mb-3">
          <ScoreBreakdown
            score={l.score}
            signalType={l.signal_type}
            signalLabel={l.signal_type.replace(/_/g, " ")}
            signalDate={l.signal_date ?? null}
            sourceMethod={l.signal_source}
            signalCount={l.signal_count ?? null}
          />
        </div>
        {l.suggested_opener && (
          <div className="bg-[#030711] border border-[#1e3a5f] rounded p-3 mb-3">
            <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] mb-1">Suggested opener</p>
            <p className="text-sm text-[#cbd5e1] italic">"{l.suggested_opener}"</p>
          </div>
        )}

        {/* Expandable details */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between text-[11px] uppercase tracking-widest text-[#94a3b8] hover:text-[#00d4ff] py-2 mb-2 border-y border-[#1e3a5f]/40"
        >
          <span>{expanded ? "Hide" : "More"} property details</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {expanded && (
          <div className="bg-[#030711] border border-[#1e3a5f] rounded-md p-3 mb-3 space-y-3">
            {thumb && (
              <a href={thumb} target="_blank" rel="noopener noreferrer" className="block">
                <img src={thumb} alt={l.address || "Property"} className="w-full max-h-[260px] object-cover rounded border border-[#1e3a5f]" loading="lazy" />
                <p className="text-[10px] text-[#64748b] mt-1 text-center">Google Street View · click to open full size</p>
              </a>
            )}
            {l.human_summary && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] mb-1">Summary</p>
                <p className="text-sm text-[#cbd5e1]">{l.human_summary}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {l.full_name && <Detail label="Owner" value={l.full_name} />}
              {l.phone && <Detail label="Phone" value={<a href={`tel:${l.phone}`} className="text-[#00d4ff]">{l.phone}</a>} />}
              {l.email && <Detail label="Email" value={<a href={`mailto:${l.email}`} className="text-[#00d4ff] break-all">{l.email}</a>} />}
              {l.year_built != null && <Detail label="Year built" value={l.year_built} />}
              {sqft && <Detail label="Building sqft" value={sqft} />}
              {lastSale && <Detail label="Last sale" value={`${lastSale}${l.last_sale_date ? ` · ${l.last_sale_date}` : ""}`} />}
              {(equityLow || equityHigh) && <Detail label="Equity range" value={`${equityLow ?? "?"} – ${equityHigh ?? "?"}`} />}
              {l.best_call_window && <Detail label="Best call window" value={l.best_call_window} />}
            </div>
            {highlights.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] mb-1">Intel highlights</p>
                <ul className="text-sm text-[#cbd5e1] list-disc list-inside space-y-0.5">
                  {highlights.map((h, i) => <li key={i}>{String(h)}</li>)}
                </ul>
              </div>
            )}
            {history.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] mb-1">Signal history ({history.length})</p>
                <ul className="text-xs text-[#94a3b8] space-y-1">
                  {history.slice(0, 8).map((h: any, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{h.type || h.signal_type || "signal"}{h.source ? ` · ${h.source}` : ""}</span>
                      <span className="shrink-0 text-[#64748b]">{(h.date || h.signal_date || "").toString().slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => onMarkWorking(l)}
            disabled={isWorking}
            className={isWorking ? "bg-emerald-600/30 text-emerald-300 border border-emerald-600/40 cursor-default hover:bg-emerald-600/30" : "bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold"}
          >
            <Check className="w-3 h-3 mr-1" /> {isWorking ? "Working ✓" : "Mark working"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDraftSms(l)} className="border-[#1e3a5f] text-white hover:bg-[#1e3a5f]/40">
            <MessageSquare className="w-3 h-3 mr-1" /> Draft SMS
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDraftEmail(l)} className="border-[#1e3a5f] text-white hover:bg-[#1e3a5f]/40">
            ✉️ Draft email
          </Button>
          {l.best_call_window && (
            <span className="text-xs text-[#94a3b8] flex items-center gap-1 ml-auto">
              <Phone className="w-3 h-3" /> Best: {l.best_call_window}
            </span>
          )}
        </div>
        {clientId && (
          <LeadActionBar leadId={l.id} clientId={clientId} product="mortgage" />
        )}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-[#64748b]">{label}</p>
      <p className="text-[#cbd5e1]">{value}</p>
    </div>
  );
}
