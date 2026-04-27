// Per-row email enrichment + Gmail send chip used inside the Fax/Postcard/SMS
// Recent Sends table (ChannelOutreachTab). Shows: enriched email + source badge,
// or a "🔍 Find Email" button if not yet enriched. Once enriched, exposes a
// "📧 Send from Gmail" button that opens GmailSendDialog.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Search, CheckCircle2 } from "lucide-react";
import GmailSendDialog from "./GmailSendDialog";

export interface LeadEmailCellProps {
  leadId: string;
  businessName: string;
  city?: string | null;
  industry?: string | null;
  enrichedEmail?: string | null;
  enrichedSource?: string | null;
  enrichedConfidence?: number | null;
  gmailSentAt?: string | null;
  onChange?: () => void;
}

const SOURCE_LABEL: Record<string, { label: string; verified: boolean }> = {
  snov: { label: "snov", verified: true },
  hunter: { label: "hunter", verified: true },
  pattern_guess: { label: "guess", verified: false },
  cache: { label: "cached", verified: true },
};

export default function LeadEmailCell(props: LeadEmailCellProps) {
  const {
    leadId, businessName, city, industry,
    enrichedEmail, enrichedSource, enrichedConfidence, gmailSentAt, onChange,
  } = props;

  const [enriching, setEnriching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleEnrich = async () => {
    setEnriching(true);
    const t = toast.loading("Looking up email…");
    try {
      const { data, error } = await supabase.functions.invoke("outreach-lead-enrich-email", {
        body: { outreach_lead_id: leadId },
      });
      if (error) throw error;
      if (data?.ok && data?.email) {
        const verified = data.source !== "pattern_guess";
        toast.success(verified
          ? `Found: ${data.email} (${data.source})`
          : `Best guess: ${data.email} — verify before sending`,
          { id: t });
        onChange?.();
      } else {
        const lastStage = Array.isArray(data?.trace) ? data.trace[data.trace.length - 1] : null;
        toast.error(`No email found${lastStage ? ` — ${lastStage.stage}` : ""}`, { id: t });
      }
    } catch (e: any) {
      toast.error(e?.message || "Enrichment failed", { id: t });
    } finally {
      setEnriching(false);
    }
  };

  const sourceMeta = enrichedSource ? SOURCE_LABEL[enrichedSource] : null;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        {enrichedEmail ? (
          <>
            <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
              ✉ {enrichedEmail}
            </span>
            {sourceMeta && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 5px",
                borderRadius: 3,
                background: sourceMeta.verified ? "#064e3b" : "#78350f",
                color: sourceMeta.verified ? "#6ee7b7" : "#fbbf24",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}>
                {sourceMeta.verified ? "✓" : "?"} {sourceMeta.label}
                {typeof enrichedConfidence === "number" && enrichedConfidence > 0 ? ` ${enrichedConfidence}%` : ""}
              </span>
            )}
            {gmailSentAt ? (
              <span style={{ fontSize: 10, color: "#10b981", display: "inline-flex", alignItems: "center", gap: 3 }}>
                <CheckCircle2 size={11} /> Sent {new Date(gmailSentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            ) : (
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                style={{
                  background: "#00d4ff", color: "#0a1628",
                  fontWeight: 700, height: 24, padding: "0 8px", fontSize: 11,
                }}
              >
                <Mail size={11} style={{ marginRight: 4 }} /> Send from Gmail
              </Button>
            )}
          </>
        ) : (
          <>
            <span style={{ fontSize: 11, color: "#64748b" }}>Email: —</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleEnrich}
              disabled={enriching}
              style={{
                color: "#00d4ff", height: 24, padding: "0 8px", fontSize: 11,
                border: "1px solid #1e3a5f",
              }}
            >
              <Search size={11} style={{ marginRight: 4 }} />
              {enriching ? "Searching…" : "Find Email"}
            </Button>
          </>
        )}
      </div>

      {dialogOpen && enrichedEmail && (
        <GmailSendDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          leadId={leadId}
          businessName={businessName}
          city={city}
          industry={industry}
          toEmail={enrichedEmail}
          onSent={() => { setDialogOpen(false); onChange?.(); }}
        />
      )}
    </>
  );
}
