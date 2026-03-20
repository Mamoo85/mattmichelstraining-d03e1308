import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2, UserPlus, Crown, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PUBLISHED_DOMAIN = "https://m2training.lovable.app";

// Custom tier: $99.99 → $19.99 = $80.00 off, forever
// Basic tier: $14.99 → free = 100% off, forever
const PRESETS = [
  {
    key: "vip",
    label: "Generate $20 VIP Link",
    desc: "Custom Tier → $19.99/mo forever",
    detail: "Gives one client the full Custom tier ($99.99/mo) at $19.99/mo for life. Includes personalized programs, biomechanics analysis, and 1-on-1 assessments. Perfect for loyal in-person clients you want to keep at a VIP rate. Single-use — cannot be shared.",
    icon: Crown,
    params: {
      discount_type: "fixed",
      discount_value: 80,
      duration: "forever",
      max_redemptions: 1,
    },
    codePrefix: "VIP",
  },
  {
    key: "community",
    label: "Generate Free Basic Link",
    desc: "Basic Tier → $0/mo forever",
    detail: "Gives one client the Basic tier ($14.99/mo) completely free, forever. Includes portal access, workout logging, unlimited form checks, and the exercise library. Use for young athletes, community members, or anyone you want to give free access to. Single-use — cannot be shared.",
    icon: Users,
    params: {
      discount_type: "percent",
      discount_value: 100,
      duration: "forever",
      max_redemptions: 1,
    },
    codePrefix: "COMM",
  },
] as const;

const AdminClientOnboarding = () => {
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generatePromo = async (preset: (typeof PRESETS)[number]) => {
    setLoading(preset.key);
    setGeneratedUrl(null);
    setGeneratedCode(null);
    setCopied(false);

    try {
      const uniqueCode = `${preset.codePrefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { data, error } = await supabase.functions.invoke("create-stripe-promo", {
        body: {
          code: uniqueCode,
          ...preset.params,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const code = data?.code || uniqueCode;
      const url = `${PUBLISHED_DOMAIN}/pricing?promo=${code}`;
      setGeneratedUrl(url);
      setGeneratedCode(code);
      toast({ title: "Promo link generated", description: `Code: ${code}` });
    } catch (e: any) {
      toast({ title: "Failed to generate promo", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-primary" />
          <CardTitle className="text-sm">In-Person Client Onboarding</CardTitle>
        </div>
        <CardDescription className="text-[11px]">
          Generate a single-use Stripe promo link to hand a client on the spot. Each code works once and creates a permanent discount tied to that client's subscription.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isLoading = loading === preset.key;
            return (
              <Button
                key={preset.key}
                variant="outline"
                className="h-auto flex flex-col items-start gap-1.5 p-4 text-left"
                onClick={() => generatePromo(preset)}
                disabled={!!loading}
              >
                <div className="flex items-center gap-2">
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                  <span className="text-xs font-bold">{preset.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{preset.desc}</span>
                <span className="text-[10px] text-muted-foreground/70 leading-relaxed">{preset.detail}</span>
              </Button>
            );
          })}
        </div>

        {generatedUrl && (
          <div className="space-y-2 animate-in fade-in-50 slide-in-from-bottom-2 duration-200">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Ready — Code: {generatedCode}
            </p>
            <div className="flex items-stretch gap-1.5">
              <input
                type="text"
                readOnly
                value={generatedUrl}
                className="flex-1 bg-muted border border-border px-3 py-2 text-xs font-mono rounded-md select-all focus:outline-none focus:ring-1 focus:ring-primary"
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
