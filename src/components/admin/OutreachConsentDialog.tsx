import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, X } from "lucide-react";

interface Props {
  prospectId: string | null;
  prospectName?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function OutreachConsentDialog({ prospectId, prospectName, onClose, onSaved }: Props) {
  const [source, setSource] = useState<"reply" | "click" | "verbal" | "written">("reply");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!prospectId) return null;

  async function save() {
    setSaving(true);
    const now = new Date().toISOString();
    const { error: uErr } = await (supabase as any)
      .from("contractor_outreach_prospects")
      .update({
        consent_for_sms: true,
        consent_source: source,
        consent_timestamp: now,
        notes: notes || null,
      })
      .eq("id", prospectId);
    if (uErr) { setSaving(false); toast.error(uErr.message); return; }

    await (supabase as any).from("contractor_outreach_audit_log").insert({
      prospect_id: prospectId,
      channel: "sms",
      event: "consent_granted",
      reason: `Source: ${source}${notes ? " — " + notes : ""}`,
      actor: "admin",
    });

    setSaving(false);
    toast.success("SMS consent recorded — prospect is now eligible for SMS");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-slate-950 border border-emerald-700/40 rounded-lg w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-foreground">Mark SMS Consent</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Recording consent for <b className="text-foreground">{prospectName || "this prospect"}</b>.
          This is your TCPA defense file — only mark consent if they actually replied, clicked, or said yes.
        </p>

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

          <div className="bg-amber-950/30 border border-amber-700/30 rounded p-2.5 text-[11px] text-amber-200">
            ⚠️ Consent expires after 18 months (TCPA EBR rule). System will block SMS automatically after that.
          </div>

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
