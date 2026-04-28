import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, AlertCircle, Mail, MessageSquare, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * LeadDiagnosticsDrawer
 * Answers Matt's #1 question: "Why didn't this prospect get emailed?"
 *
 * Pulls every relevant signal for a single prospect:
 *  - Quality score + breakdown
 *  - Consent state (email + SMS)
 *  - Suppression / unsubscribe state
 *  - Enrichment trace (which stage filled the email, confidence)
 *  - Last 10 audit log events
 *  - Computed verdict: SENDABLE / BLOCKED + human-readable reason
 */

interface Props {
  prospectId: string | null;
  open: boolean;
  onClose: () => void;
}

interface Prospect {
  id: string;
  business_name: string;
  owner_name: string | null;
  trade: string;
  city: string | null;
  email: string | null;
  email_verified: boolean;
  phone: string | null;
  consent_for_email: boolean;
  consent_for_sms: boolean;
  unsubscribed_at: string | null;
  quality_score: number | null;
  quality_breakdown: Record<string, unknown> | null;
  enrichment_trace: unknown[] | null;
  enriched_at: string | null;
  last_emailed_at: string | null;
  email_send_count: number;
  reply_status: string | null;
  is_demo: boolean;
  territory_priority: number;
}

interface AuditEvent {
  id: string;
  channel: string;
  event: string;
  reason: string | null;
  actor: string | null;
  created_at: string;
}

interface GlobalSettings {
  cold_email_enabled: boolean;
  cold_sms_enabled: boolean;
  min_quality_score_to_send: number;
}

const EVENT_ICON: Record<string, JSX.Element> = {
  sent: <Mail className="h-3.5 w-3.5 text-emerald-500" />,
  opened: <Mail className="h-3.5 w-3.5 text-blue-500" />,
  clicked: <Mail className="h-3.5 w-3.5 text-blue-600" />,
  replied: <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />,
  unsubscribed: <XCircle className="h-3.5 w-3.5 text-rose-500" />,
  bounce: <XCircle className="h-3.5 w-3.5 text-amber-600" />,
  suppressed: <XCircle className="h-3.5 w-3.5 text-rose-600" />,
  consent_granted: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  consent_revoked: <XCircle className="h-3.5 w-3.5 text-rose-500" />,
  quiet_hours_blocked: <Clock className="h-3.5 w-3.5 text-amber-500" />,
  daily_cap_blocked: <AlertCircle className="h-3.5 w-3.5 text-amber-500" />,
};

export default function LeadDiagnosticsDrawer({ prospectId, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !prospectId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [pRes, aRes, sRes] = await Promise.all([
          supabase.from("contractor_outreach_prospects").select("*").eq("id", prospectId).single(),
          supabase
            .from("contractor_outreach_audit_log")
            .select("id, channel, event, reason, actor, created_at")
            .eq("prospect_id", prospectId)
            .order("created_at", { ascending: false })
            .limit(15),
          supabase.from("outreach_global_settings").select("*").limit(1).maybeSingle(),
        ]);
        if (cancelled) return;
        if (pRes.error) throw pRes.error;
        setProspect(pRes.data as unknown as Prospect);
        setEvents((aRes.data || []) as AuditEvent[]);
        setSettings((sRes.data as GlobalSettings) || null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, prospectId]);

  const verdict = useMemo(() => {
    if (!prospect) return null;
    const reasons: string[] = [];
    if (prospect.unsubscribed_at) reasons.push(`Unsubscribed on ${new Date(prospect.unsubscribed_at).toLocaleDateString()}`);
    if (!prospect.email) reasons.push("No email on file (enrichment did not return a verified address)");
    if (settings && !settings.cold_email_enabled) reasons.push("Global cold-email kill switch is OFF");
    if (prospect.email && !prospect.consent_for_email) reasons.push("No email consent recorded — sending under cold-outreach rules");
    if (prospect.quality_score != null && settings && prospect.quality_score < settings.min_quality_score_to_send) {
      reasons.push(`Quality score ${prospect.quality_score} below threshold ${settings.min_quality_score_to_send}`);
    }
    if (prospect.is_demo) reasons.push("Marked as demo lead");
    return {
      sendable: reasons.length === 0 || (reasons.length === 1 && reasons[0].startsWith("No email consent")),
      reasons,
    };
  }, [prospect, settings]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Lead Diagnostics
            {prospect?.email_verified && <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">Verified email</Badge>}
          </SheetTitle>
          <SheetDescription>
            Why this prospect is or isn't being contacted — every gate, in one place.
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {error && <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

        {prospect && !loading && (
          <div className="mt-6 space-y-6">
            <section>
              <h3 className="text-sm font-semibold tracking-tight">{prospect.business_name}</h3>
              <p className="text-xs text-muted-foreground">
                {prospect.trade} · {prospect.city || "—"} · Priority {prospect.territory_priority}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {prospect.email && <Badge variant="secondary" className="font-mono text-xs">{prospect.email}</Badge>}
                {prospect.phone && <Badge variant="secondary" className="font-mono text-xs">{prospect.phone}</Badge>}
              </div>
            </section>

            {/* Verdict */}
            <section className={`rounded-lg border p-3 ${verdict?.sendable ? "border-emerald-300 bg-emerald-50/60" : "border-amber-300 bg-amber-50/60"}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {verdict?.sendable
                  ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Eligible to send</>
                  : <><AlertCircle className="h-4 w-4 text-amber-600" /> Blocked from sending</>}
              </div>
              {verdict && verdict.reasons.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground space-y-1">
                  {verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </section>

            {/* Scorecard */}
            <section className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border p-2">
                <div className="text-[11px] uppercase text-muted-foreground">Quality</div>
                <div className="text-lg font-semibold">{prospect.quality_score ?? "—"}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[11px] uppercase text-muted-foreground">Sends</div>
                <div className="text-lg font-semibold">{prospect.email_send_count}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[11px] uppercase text-muted-foreground">Reply</div>
                <div className="text-lg font-semibold">{prospect.reply_status || "—"}</div>
              </div>
            </section>

            {/* Consent */}
            <section>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Consent</h4>
              <div className="flex gap-2 text-xs">
                <Badge variant={prospect.consent_for_email ? "default" : "outline"}>
                  Email {prospect.consent_for_email ? "✓" : "—"}
                </Badge>
                <Badge variant={prospect.consent_for_sms ? "default" : "outline"}>
                  SMS {prospect.consent_for_sms ? "✓" : "—"}
                </Badge>
                {prospect.unsubscribed_at && <Badge variant="destructive">Unsubscribed</Badge>}
              </div>
            </section>

            {/* Enrichment trace */}
            <section>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Enrichment trace</h4>
              {prospect.enrichment_trace && prospect.enrichment_trace.length > 0 ? (
                <ScrollArea className="h-40 rounded-md border bg-muted/30 p-2">
                  <pre className="text-[11px] leading-snug whitespace-pre-wrap font-mono">
                    {JSON.stringify(prospect.enrichment_trace, null, 2)}
                  </pre>
                </ScrollArea>
              ) : (
                <p className="text-xs text-muted-foreground">No enrichment attempts recorded yet.</p>
              )}
            </section>

            {/* Audit timeline */}
            <section>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Recent activity</h4>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No audit events yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {events.map(e => (
                    <li key={e.id} className="flex items-start gap-2 rounded-md border p-2 text-xs">
                      <div className="mt-0.5">{EVENT_ICON[e.event] ?? <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{e.event}</span>
                          <Badge variant="outline" className="text-[10px] py-0">{e.channel}</Badge>
                          <span className="text-muted-foreground ml-auto">{new Date(e.created_at).toLocaleString()}</span>
                        </div>
                        {e.reason && <div className="text-muted-foreground mt-0.5">{e.reason}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
