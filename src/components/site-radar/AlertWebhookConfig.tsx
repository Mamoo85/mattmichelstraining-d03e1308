import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell, Save, Send } from "lucide-react";

interface Props {
  clientId: string;
}

export default function AlertWebhookConfig({ clientId }: Props) {
  const [url, setUrl] = useState("");
  const [minScore, setMinScore] = useState<number>(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from as any)("field_crm_clients")
        .select("alert_webhook_url, alert_webhook_min_score")
        .eq("id", clientId)
        .maybeSingle();
      if (data) {
        setUrl(data.alert_webhook_url || "");
        setMinScore(data.alert_webhook_min_score ?? 60);
      }
      setLoading(false);
    })();
  }, [clientId]);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase.from as any)("field_crm_clients")
      .update({
        alert_webhook_url: url.trim() || null,
        alert_webhook_min_score: minScore,
      })
      .eq("id", clientId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Webhook saved");
  };

  const test = async () => {
    if (!url.trim()) {
      toast.error("Save a webhook URL first");
      return;
    }
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("siteradar-webhook-alert", {
        body: {
          client_id: clientId,
          test: true,
          payload: {
            company: "Acme Industries (TEST)",
            intent_score: 92,
            pages: ["/pricing", "/contact"],
            triggered: "Test alert from SiteRadar dashboard",
          },
        },
      });
      if (error) throw error;
      toast.success("Test alert sent — check your channel");
    } catch (e: any) {
      toast.error(e?.message || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="border-cyan-900/40 bg-[#0a1628]/80 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-cyan-400" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Real-time alerts
        </p>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        We'll POST a JSON payload to your Slack, Teams, Discord, or Zapier webhook the moment a high-intent visitor arrives.
      </p>

      <label className="mb-1 block text-[11px] uppercase text-slate-400">Webhook URL</label>
      <Input
        type="url"
        placeholder="https://hooks.slack.com/services/..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="mb-3 border-slate-700 bg-[#030711] text-slate-200"
      />

      <label className="mb-1 block text-[11px] uppercase text-slate-400">
        Min intent score to fire ({minScore})
      </label>
      <input
        type="range"
        min={20}
        max={100}
        step={5}
        value={minScore}
        onChange={(e) => setMinScore(Number(e.target.value))}
        className="mb-4 w-full accent-cyan-400"
      />

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="bg-cyan-400 text-slate-900 hover:bg-cyan-300">
          <Save className="mr-1 h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button onClick={test} disabled={testing || !url.trim()} variant="outline" className="border-slate-700 text-slate-200">
          <Send className="mr-1 h-4 w-4" />
          {testing ? "Sending…" : "Send test"}
        </Button>
      </div>
    </Card>
  );
}
