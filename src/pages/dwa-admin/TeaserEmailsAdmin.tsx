import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const PRODUCTS = [
  { slug: "siteradar", label: "SiteRadar" },
  { slug: "missed-call", label: "Missed-Call Catch" },
  { slug: "demand-radar", label: "Demand Radar" },
  { slug: "buyer-radar", label: "Buyer Radar" },
  { slug: "industry-pulse", label: "Industry Pulse" },
];

export default function TeaserEmailsAdmin() {
  const { toast } = useToast();
  const [slug, setSlug] = useState("siteradar");
  const [vars, setVars] = useState({
    company: "AmeriSteel",
    ceo_first_name: "Tripp",
    recent_signal: "OEM RFQ activity in your NAICS",
    city: "Detroit",
  });
  const [to, setTo] = useState("");
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const subjectPreview = useMemo(() => {
    if (!preview) return "";
    return preview.subject;
  }, [preview]);

  async function loadPreview() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-teaser-email", {
      body: { slug, vars, preview: true },
    });
    setBusy(false);
    if (error || !data?.ok) {
      toast({ title: "Preview failed", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    setPreview({ subject: data.subject, html: data.html });
  }

  async function sendTest() {
    if (!to) {
      toast({ title: "Enter a recipient", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-teaser-email", {
      body: { slug, to, vars },
    });
    setBusy(false);
    if (error || !data?.ok) {
      toast({ title: "Send failed", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Sent ✅", description: `${to} (${data.messageId})` });
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-2">Teaser Emails</h1>
      <p className="text-muted-foreground mb-6">
        Personalized cold-email teasers for the 5 DWA flagship products. 7-day free trial CTA included.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4 p-5 border rounded-lg bg-card">
          <div>
            <Label>Product</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {PRODUCTS.map((p) => (
                <Button
                  key={p.slug}
                  variant={slug === p.slug ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setSlug(p.slug); setPreview(null); }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>Company</Label>
            <Input value={vars.company} onChange={(e) => setVars({ ...vars, company: e.target.value })} />
          </div>
          <div>
            <Label>CEO first name</Label>
            <Input value={vars.ceo_first_name} onChange={(e) => setVars({ ...vars, ceo_first_name: e.target.value })} />
          </div>
          <div>
            <Label>City</Label>
            <Input value={vars.city} onChange={(e) => setVars({ ...vars, city: e.target.value })} />
          </div>
          <div>
            <Label>Recent signal</Label>
            <Textarea
              rows={2}
              value={vars.recent_signal}
              onChange={(e) => setVars({ ...vars, recent_signal: e.target.value })}
            />
          </div>

          <Button onClick={loadPreview} disabled={busy} className="w-full">
            {busy ? "Loading…" : "Preview"}
          </Button>

          <div className="border-t pt-4 space-y-2">
            <Label>Send test to</Label>
            <Input
              placeholder="ceo@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <Button onClick={sendTest} disabled={busy || !to} variant="secondary" className="w-full">
              Send real email
            </Button>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden bg-white">
          {preview ? (
            <>
              <div className="p-3 border-b bg-muted text-sm">
                <div className="font-semibold text-foreground">Subject:</div>
                <div className="text-muted-foreground">{subjectPreview}</div>
              </div>
              <iframe
                title="email-preview"
                srcDoc={preview.html}
                className="w-full"
                style={{ height: 720, border: 0 }}
              />
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              Click <strong>Preview</strong> to render the email.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
