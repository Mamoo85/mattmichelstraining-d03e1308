import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, X, Mail, MessageSquare } from "lucide-react";

interface Props {
  prospectId: string | null;
  prospectName?: string;
  /** Which channel(s) to capture consent for. Defaults to "sms" for back-compat. */
  channel?: "sms" | "email" | "both";
  onClose: () => void;
  onSaved: () => void;
}

export default function OutreachConsentDialog({ prospectId, prospectName, channel = "sms", onClose, onSaved }: Props) {
  const [source, setSource] = useState<"reply" | "click" | "verbal" | "written">("reply");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!prospectId) return null;

  const grantsSms = channel === "sms" || channel === "both";
  const grantsEmail = channel === "email" || channel === "both";

  async function save() {
    setSaving(true);
    const now = new Date().toISOString();

    const update: Record<string, unknown> = {};
    if (grantsSms) {
      update.consent_for_sms = true;
      update.consent_source = source;
      update.consent_timestamp = now;
    }
    if (grantsEmail) {
      update.consent_for_email = true;
      update.consent_email_source = source;
      update.consent_email_timestamp = now;
    }
    if (notes) update.notes = notes;

    const { error: uErr } = await (supabase as any)
      .from("contractor_outreach_prospects")
      .update(update)
      .eq("id", prospectId);
    if (uErr) { setSaving(false); toast.error(uErr.message); return; }

    const auditRows: Array<Record<string, unknown>> = [];
    if (grantsSms) auditRows.push({
      prospect_id: prospectId, channel: "sms", event: "consent_granted",
      reason: `Source: ${source}${notes ? " — " + notes : ""}`, actor: "admin",
    });
    if (grantsEmail) auditRows.push({
      prospect_id: prospectId, channel: "email", event: "consent_granted",
      reason: `Source: ${source}${notes ? " — " + notes : ""}`, actor: "admin",
    });
    if (auditRows.length) {
      await (supabase as any).from("contractor_outreach_audit_log").insert(auditRows);
    }

    setSaving(false);
    toast.success(
      grantsSms && grantsEmail ? "Email + SMS consent recorded"
      : grantsEmail ? "Email consent recorded"
      : "SMS consent recorded — prospect is now eligible for SMS"
    );
    onSaved();
    onClose();
  }

  const title = grantsSms && grantsEmail ? "Mark Email + SMS Consent"
    : grantsEmail ? "Mark Email Consent"
    : "Mark SMS Consent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-slate-950 border border-emerald-700/40 rounded-lg w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Recording consent for <b className="text-foreground">{prospectName || "this prospect"}</b>.
          This is your TCPA / CAN-SPAM defense file — only mark consent if they actually replied, clicked, or said yes.
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3 text-[10px]">
          {grantsEmail && <span className="px-2 py-1 rounded bg-cyan-500/15 text-cyan-300 inline-flex items-center gap-1"><Mail size={10}/>Email</span>}
          {grantsSms && <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 inline-flex items-center gap-1"><MessageSquare size={10}/>SMS</span>}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Consent source</label>
            <select
              value={source}
              onChange={e => setSource(e.target.value as any)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground"
            >
              <option value="reply">Email reply (replied INTERESTED, etc.)</option>
              <option value="click">Clicked claim/buy link in email</option>
              <option value="verbal">Verbal — phone call</option>
              <option value="written">Written — signed form / web form</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Replied 'yes send me HVAC leads' on 4/27"
              className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground"
            />
          </div>

          {grantsSms && (
            <div className="bg-amber-950/30 border border-amber-700/30 rounded p-2.5 text-[11px] text-amber-200">
              ⚠️ SMS consent expires after 18 months (TCPA EBR rule). System will block SMS automatically after that.
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 text-sm font-bold px-4 py-2 rounded bg-emerald-500 text-slate-900 hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Record Consent"}
            </button>
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 rounded border border-border text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
