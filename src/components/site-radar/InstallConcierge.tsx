import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, Mail, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface Props {
  clientId: string;
}

type Status = "not_installed" | "pending" | "live" | string;

export default function InstallConcierge({ clientId }: Props) {
  const [status, setStatus] = useState<Status>("not_installed");
  const [platform, setPlatform] = useState<string>("");
  const [domain, setDomain] = useState("");
  const [webmasterEmail, setWebmasterEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from as any)("field_crm_clients")
        .select("install_status, install_platform, business_url")
        .eq("id", clientId)
        .maybeSingle();
      if (data) {
        setStatus(data.install_status || "not_installed");
        setPlatform(data.install_platform || "");
        setDomain(data.business_url || "");
      }
      setLoading(false);
    })();
  }, [clientId]);

  const sendToWebmaster = async () => {
    if (!webmasterEmail.trim() || !domain.trim()) {
      toast.error("Domain and webmaster email required");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("siteradar-install-concierge", {
        body: {
          client_id: clientId,
          domain: domain.trim(),
          webmaster_email: webmasterEmail.trim(),
        },
      });
      if (error) throw error;
      toast.success("Install request sent to your webmaster");
      setStatus("pending");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;

  const statusBadge = () => {
    if (status === "live")
      return <Badge className="bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="mr-1 h-3 w-3" />Live</Badge>;
    if (status === "pending")
      return <Badge className="bg-amber-500/15 text-amber-400"><Clock className="mr-1 h-3 w-3" />Pending webmaster</Badge>;
    return <Badge className="bg-slate-500/15 text-slate-400"><AlertCircle className="mr-1 h-3 w-3" />Not installed</Badge>;
  };

  return (
    <Card className="border-cyan-900/40 bg-[#0a1628]/80 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-cyan-400" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Install concierge — we handle the tech
          </p>
        </div>
        {statusBadge()}
      </div>

      {status === "live" ? (
        <p className="text-sm text-emerald-400">
          ✓ Tracking is live{platform ? ` on ${platform}` : ""}. You're all set.
        </p>
      ) : (
        <>
          <p className="mb-4 text-xs text-slate-500">
            Enter your webmaster's email and we'll send them the snippet plus a 90-second walkthrough — pre-branded and ready to paste. You don't touch a thing.
          </p>

          <label className="mb-1 block text-[11px] uppercase text-slate-400">Your domain</label>
          <Input
            type="text"
            placeholder="acme.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="mb-3 border-slate-700 bg-[#030711] text-slate-200"
          />

          <label className="mb-1 block text-[11px] uppercase text-slate-400">Webmaster email</label>
          <Input
            type="email"
            placeholder="webmaster@acme.com"
            value={webmasterEmail}
            onChange={(e) => setWebmasterEmail(e.target.value)}
            className="mb-4 border-slate-700 bg-[#030711] text-slate-200"
          />

          <Button
            onClick={sendToWebmaster}
            disabled={sending || !webmasterEmail.trim() || !domain.trim()}
            className="bg-cyan-400 text-slate-900 hover:bg-cyan-300"
          >
            <Mail className="mr-1 h-4 w-4" />
            {sending ? "Sending…" : "Send install request"}
          </Button>

          <p className="mt-3 text-[10px] text-slate-500">
            Status flips to <span className="text-emerald-400">Live</span> automatically the moment your first visitor pings.
          </p>
        </>
      )}
    </Card>
  );
}
