import { useState } from "react";
import { Phone, Mail, Voicemail, Copy, Check, AlertTriangle, Download, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BuyerChip, FreshnessBadge, TierBadge, ScoreBars, EquityPanel, MetricsRow, TcpaBadge, IntelPanel, type MarketplaceLead } from "./GoldenTicketCard";
import { SourceIconRow } from "./SourceIconRow";
import { EnrichmentProvenancePanel } from "./EnrichmentProvenancePanel";
import { cn } from "@/lib/utils";

interface UnlockedLead extends MarketplaceLead {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

interface Props {
  lead: UnlockedLead;
  onExportPdf?: () => void;
  onShare?: () => void;
  className?: string;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(`${label} copied`);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-intel-teal hover:text-intel-teal/80"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function UnlockedDossierCard({ lead, onExportPdf, onShare, className }: Props) {
  const opener = lead.suggested_opener || {};
  const locationLine = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");

  return (
    <Card className={cn(
      "relative overflow-hidden bg-gradient-to-br from-card via-card to-background border-intel-teal/40 shadow-2xl shadow-intel-teal/10",
      className
    )}>
      {/* UNLOCKED stamp */}
      <div className="absolute top-3 right-3 z-10 px-3 py-1 bg-emerald-500/15 border-2 border-emerald-500/60 rounded font-mono text-xs font-bold text-emerald-400 uppercase tracking-widest animate-seal-stamp">
        ✓ UNLOCKED
      </div>

      <div className="px-4 pt-4 pb-3 border-b border-border/40 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <TierBadge tier={lead.signal_strength_tier} />
          <FreshnessBadge days={lead.days_on_radar} />
          {lead.buyer_type && <BuyerChip>{lead.buyer_type}</BuyerChip>}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {lead.human_summary && (
          <p className="text-sm text-foreground leading-relaxed">{lead.human_summary}</p>
        )}

        {/* Contact dossier */}
        <IntelPanel title="Owner Contact">
          <div className="space-y-2">
            {lead.full_name && <div className="font-bold text-base">{lead.full_name}</div>}
            <div className="text-xs text-muted-foreground">{locationLine}</div>
            {lead.phone && (
              <div className="flex items-center justify-between pt-1">
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-intel-teal font-mono text-sm hover:underline">
                  <Phone className="w-3.5 h-3.5" /> {lead.phone}
                </a>
                <CopyButton text={lead.phone} label="Phone" />
              </div>
            )}
            {lead.email && (
              <div className="flex items-center justify-between">
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-intel-teal font-mono text-sm hover:underline truncate">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{lead.email}</span>
                </a>
                <CopyButton text={lead.email} label="Email" />
              </div>
            )}
          </div>
        </IntelPanel>

        <ScoreBars score={lead.score} percentile={lead.score_percentile} />
        <EquityPanel lead={lead} />
        <MetricsRow lead={lead} />

        <EnrichmentProvenancePanel leadId={lead.id} />

        {/* TCPA banner — REQUIRED above opener */}
        <div className="flex items-start gap-2 p-2.5 border border-orange-500/40 bg-orange-500/10 rounded">
          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-orange-200/90 leading-snug">
            <span className="font-bold uppercase tracking-wider">TCPA notice:</span> Verify Established Business Relationship or written consent before sending these scripts to this number. Manual send only — DWA does not auto-text on your behalf.
          </p>
        </div>

        {/* Suggested openers */}
        {opener.sms && (
          <IntelPanel title="Suggested SMS Opener">
            <div className="font-mono text-xs text-foreground/90 leading-relaxed">{opener.sms}</div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SourceIconRow sources={lead.provenance_sources} />
                <TcpaBadge clear={lead.tcpa_clear} />
              </div>
              <CopyButton text={opener.sms} label="SMS" />
            </div>
          </IntelPanel>
        )}
        {opener.email_subject && opener.email_body && (
          <IntelPanel title="Suggested Email">
            <div className="text-xs font-bold text-foreground mb-1">{opener.email_subject}</div>
            <div className="font-mono text-xs text-foreground/80 leading-relaxed whitespace-pre-line">{opener.email_body}</div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SourceIconRow sources={lead.provenance_sources} />
                <TcpaBadge clear={lead.tcpa_clear} />
              </div>
              <CopyButton text={`Subject: ${opener.email_subject}\n\n${opener.email_body}`} label="Email" />
            </div>
          </IntelPanel>
        )}
        {opener.voicemail && (
          <IntelPanel title="Suggested Voicemail">
            <div className="flex items-start gap-2">
              <Voicemail className="w-4 h-4 text-intel-teal flex-shrink-0 mt-0.5" />
              <div className="font-mono text-xs text-foreground/90 leading-relaxed">{opener.voicemail}</div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SourceIconRow sources={lead.provenance_sources} />
                <TcpaBadge clear={lead.tcpa_clear} />
              </div>
              <CopyButton text={opener.voicemail} label="Voicemail" />
            </div>
          </IntelPanel>
        )}

        <div className="flex items-center justify-between pt-1">
          <TcpaBadge clear={lead.tcpa_clear} />
          <div className="flex gap-2">
            {onExportPdf && (
              <Button variant="outline" size="sm" onClick={onExportPdf} className="text-xs">
                <Download className="w-3 h-3 mr-1" /> PDF
              </Button>
            )}
            {onShare && (
              <Button variant="outline" size="sm" onClick={onShare} className="text-xs">
                <Share2 className="w-3 h-3 mr-1" /> Share
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
