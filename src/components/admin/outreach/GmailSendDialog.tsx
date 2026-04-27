// Confirmation dialog that shows the message about to be sent FROM the
// operator's connected Gmail account TO an enriched lead email. Operator
// can edit subject + body before sending.
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";

export interface GmailSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  businessName: string;
  city?: string | null;
  industry?: string | null;
  toEmail: string;
  onSent?: () => void;
}

export default function GmailSendDialog(props: GmailSendDialogProps) {
  const { open, onOpenChange, leadId, businessName, city, industry, toEmail, onSent } = props;

  const defaultSubject = `Quick follow-up — ${businessName}`;
  const defaultBody = [
    `Hi,`,
    ``,
    `I'm reaching out from Detroit Web Agency. We recently sent ${businessName} a quick note about local ${industry || "service"} leads coming in${city ? ` from ${city}` : ""}.`,
    ``,
    `If you'd like, I can send over the next couple of qualified leads in your area at no cost so you can see the quality before we talk pricing.`,
    ``,
    `Just reply with a yes and I'll route them straight to you.`,
    ``,
    `— Matt Michels`,
    `Detroit Web Agency`,
    `(313) 992-1219`,
  ].join("\n");

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body required");
      return;
    }
    setSending(true);
    const t = toast.loading("Sending from your Gmail…");
    try {
      const { data, error } = await supabase.functions.invoke("outreach-gmail-send", {
        body: { outreach_lead_id: leadId, subject, body },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`Sent from ${data.from || "your Gmail"} → ${data.to}`, { id: t });
        onSent?.();
      } else if (data?.needs_connect) {
        toast.error("Connect your Gmail account first (admin → integrations).", { id: t });
      } else if (data?.needs_reconnect) {
        toast.error("Reconnect Gmail and grant the 'send' permission.", { id: t });
      } else {
        toast.error(data?.error || "Send failed", { id: t });
      }
    } catch (e: any) {
      toast.error(e?.message || "Send failed", { id: t });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: "#0f2342", border: "1px solid #1e3a5f", color: "#e2e8f0", maxWidth: 600 }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#00d4ff", display: "flex", alignItems: "center", gap: 8 }}>
            <Mail size={16} /> Send from your Gmail
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            To: <span style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{toEmail}</span>
          </div>

          <div>
            <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>
              Subject
            </label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{ background: "#0a1628", border: "1px solid #1e3a5f", color: "#e2e8f0", marginTop: 4 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>
              Body
            </label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={12}
              style={{ background: "#0a1628", border: "1px solid #1e3a5f", color: "#e2e8f0", marginTop: 4, fontFamily: "inherit", lineHeight: 1.5 }}
            />
          </div>

          <div style={{ fontSize: 10, color: "#64748b", padding: 8, background: "#0a1628", borderRadius: 4, border: "1px solid #1e3a5f" }}>
            ⚠ This sends from your connected Gmail account — recipient sees your real email address. Manual one-off only — every send is logged for compliance.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending}
              style={{ background: "#00d4ff", color: "#0a1628", fontWeight: 700 }}
            >
              <Send size={13} style={{ marginRight: 6 }} />
              {sending ? "Sending…" : "Send Now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
