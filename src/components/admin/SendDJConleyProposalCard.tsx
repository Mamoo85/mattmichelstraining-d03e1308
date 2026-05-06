import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Send, Zap } from "lucide-react";

const SendDJConleyProposalCard = () => {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("Pat");
  const [sending, setSending] = useState<"v1" | "v3" | null>(null);

  const sendVersion = async (version: "v1" | "v3") => {
    if (!email.trim()) {
      toast.error("Enter Pat's email first");
      return;
    }
    setSending(version);
    const fn = version === "v3" ? "send-djconley-proposal-v3" : "send-djconley-proposal";
    try {
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { recipient_email: email.trim(), first_name: firstName.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Proposal ${version} sent to ${email}`, {
        description: `Resend id: ${(data as any)?.resend_id || "ok"}`,
      });
      setEmail("");
    } catch (e: any) {
      toast.error("Send failed", { description: e?.message || String(e) });
    } finally {
      setSending(null);
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
          v1 = original 10-section feature email · v3 = executive closer (2 new demos, Stellantis ROI, single YES close)
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
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => sendVersion("v1")}
            disabled={!!sending || !email.trim()}
          >
            <Send className="h-4 w-4 mr-2" />
            {sending === "v1" ? "Sending…" : "Send v1 (original)"}
          </Button>
          <Button
            onClick={() => sendVersion("v3")}
            disabled={!!sending || !email.trim()}
          >
            <Zap className="h-4 w-4 mr-2" />
            {sending === "v3" ? "Sending…" : "Send v3 (closer) ⚡"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Both send from matt@detroitwebagent.com · BCC: matthewmichels4@gmail.com · Also CC'd: patrick.michels@gmail.com
        </p>
      </CardContent>
    </Card>
  );
};

export default SendDJConleyProposalCard;
