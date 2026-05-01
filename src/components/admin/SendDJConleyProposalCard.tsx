import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";

/**
 * One-shot: send Pat the post-meeting proposal email.
 * Lives in /dwa-admin → Outreach. Delete after Pat replies.
 */
const SendDJConleyProposalCard = () => {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("Pat");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!email.trim()) {
      toast.error("Enter Pat's email first");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-djconley-proposal", {
        body: { recipient_email: email.trim(), first_name: firstName.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Proposal sent to ${email}`, { description: `Resend id: ${(data as any)?.resend_id || "ok"}` });
      setEmail("");
    } catch (e: any) {
      toast.error("Send failed", { description: e?.message || String(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-primary" />
          Send D.J. Conley proposal
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Post-meeting follow-up to Pat. Includes both pricing options, Forever Pricing promise, fusion example, and demo links.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input
            placeholder="First name (default: Pat)"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            type="email"
            placeholder="pat@djconley.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="md:col-span-2"
          />
        </div>
        <Button onClick={send} disabled={sending || !email.trim()} className="w-full">
          <Send className="h-4 w-4 mr-2" />
          {sending ? "Sending…" : "Send proposal email"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Sent from matt@detroitwebagent.com · BCC: matthewmichels4@gmail.com · Subject: "D.J. Conley + Detroit Web Agency — exactly what I'd build"
        </p>
      </CardContent>
    </Card>
  );
};

export default SendDJConleyProposalCard;
