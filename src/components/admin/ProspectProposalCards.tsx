import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Send, ExternalLink } from "lucide-react";

interface ProspectCardProps {
  title: string;
  subtitle: string;
  defaultEmail: string;
  defaultName: string;
  functionName: string;
  demos: { label: string; url: string }[];
  products: string[];
  accentColor?: string;
}

function ProspectCard({
  title,
  subtitle,
  defaultEmail,
  defaultName,
  functionName,
  demos,
  products,
  accentColor = "text-primary",
}: ProspectCardProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [firstName, setFirstName] = useState(defaultName);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!email.trim()) {
      toast.error("Enter recipient email first");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { recipient_email: email.trim(), first_name: firstName.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Proposal sent to ${email}`, {
        description: `Resend id: ${(data as any)?.resend_id || "ok"}`,
      });
    } catch (e: any) {
      toast.error("Send failed", { description: e?.message || String(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="md:col-span-2"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {products.map((p) => (
            <Badge key={p} variant="outline" className="text-[10px] px-2 py-0">
              {p}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {demos.map((d) => (
            <a
              key={d.url}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              {d.label}
            </a>
          ))}
        </div>

        <Button
          className="w-full"
          onClick={send}
          disabled={sending || !email.trim()}
        >
          <Send className="h-4 w-4 mr-2" />
          {sending ? "Sending…" : "Send Proposal Email"}
        </Button>

        <p className="text-[11px] text-muted-foreground">
          Sends from matt@detroitwebagent.com · BCC: matthewmichels4@gmail.com
        </p>
      </CardContent>
    </Card>
  );
}

const ProspectProposalCards = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 mb-2">
      <h3 className="text-sm font-semibold">Re-Engagement Proposals</h3>
      <Badge className="text-[10px]">$499 pricing — updated</Badge>
    </div>
    <p className="text-xs text-muted-foreground -mt-2 mb-4">
      Corrected pricing ($499, not $1,499). Each email includes demo links, tailored product stack, free 3-month add-ons, and YES A / YES B / tweak CTAs.
    </p>

    <ProspectCard
      title="Stewart Dental — Dr. Robert Stewart"
      subtitle="Dental practice, Grosse Pointe · Stack: Missed-Call Catch, TechAlert, SiteRadar, Review Automation"
      defaultEmail=""
      defaultName="Dr. Stewart"
      functionName="send-stewart-dental-proposal"
      demos={[
        { label: "Demo A — Teal/Clinical", url: "https://detroitwebagent.com/demo-dental" },
        { label: "Demo B — Warm/Family", url: "https://detroitwebagent.com/demo-dental-alt1" },
        { label: "Demo C — Nordic/Minimal", url: "https://detroitwebagent.com/demo-dental-alt2" },
      ]}
      products={["Missed-Call Catch", "Talent Radar", "SiteRadar", "Review Automation", "Admin Panel"]}
    />

    <ProspectCard
      title="Youngblood Automation"
      subtitle="Industrial automation distributor, Detroit · Stack: SiteRadar, Buyer Radar, Demand Radar, FieldDesk"
      defaultEmail=""
      defaultName="there"
      functionName="send-youngblood-proposal"
      demos={[
        { label: "Demo A — Dark/Industrial", url: "https://detroitwebagent.com/demo-youngblood" },
        { label: "Demo B — Steel & Fire", url: "https://detroitwebagent.com/demo-youngblood-alt1" },
        { label: "Demo C — Precision Grid", url: "https://detroitwebagent.com/demo-youngblood-alt2" },
      ]}
      products={["SiteRadar", "Buyer Radar", "Demand Radar", "FieldDesk CRM", "Admin Panel"]}
    />
  </div>
);

export default ProspectProposalCards;
