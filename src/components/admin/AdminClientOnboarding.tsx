import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2, UserPlus, LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PUBLISHED_DOMAIN = "https://www.mattmichelstraining.com";

const AdminClientOnboarding = () => {
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateLink = async () => {
    setLoading(true);
    setGeneratedUrl(null);
    setCopied(false);

    try {
      const { data, error } = await supabase.functions.invoke("admin-user-manage", {
        body: {
          action: "create_ip_invite",
          label: label.trim() || null,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const url = `${PUBLISHED_DOMAIN}/auth?ip=${data.token}`;
      setGeneratedUrl(url);
      toast({ title: "Invite link ready", description: "Copy and text it to your client." });
      setLabel("");
    } catch (e: any) {
      toast({ title: "Failed to generate link", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast({ title: "Copied — text it to your client" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-primary" />
          <CardTitle className="text-sm">In-Person Client Invite</CardTitle>
        </div>
        <CardDescription className="text-[11px]">
          Generate a one-time invite link and text it to your client. When they sign up through the link they'll automatically get Basic-tier access, welcome workouts, and zero popups or trial banners.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Client Name (optional — for your reference)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Jake S."
            className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
          />
        </div>

        <Button onClick={generateLink} disabled={loading} className="w-full">
          {loading ? <Loader2 size={14} className="animate-spin mr-2" /> : <LinkIcon size={14} className="mr-2" />}
          Generate Invite Link
        </Button>

        {generatedUrl && (
          <div className="space-y-2 animate-in fade-in-50 slide-in-from-bottom-2 duration-200">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Ready — copy & text to your client
            </p>
            <div className="flex items-stretch gap-1.5">
              <input
                type="text"
                readOnly
                value={generatedUrl}
                className="flex-1 bg-muted border border-border px-3 py-2 text-xs font-mono select-all focus:outline-none focus:ring-1 focus:ring-primary"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button size="sm" variant="secondary" onClick={copyToClipboard} className="px-3">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminClientOnboarding;
