import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Radar } from "lucide-react";

interface Props {
  radar: "demand" | "buyer";
}

export default function RadarSetup({ radar }: Props) {
  const [params] = useSearchParams();
  const tokenParam = params.get("token") || "";
  const emailParam = (params.get("email") || "").toLowerCase();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [form, setForm] = useState({
    company_name: "",
    target_buyer_titles: "",
    sender_name: "",
    sender_phone: "",
    sender_email: "",
  });

  useEffect(() => {
    (async () => {
      let q = (supabase.from as any)("industry_pulse_clients").select("*");
      if (tokenParam) q = q.eq("dashboard_token", tokenParam);
      else if (emailParam) q = q.eq("email", emailParam);
      else { setLoading(false); return; }

      const { data } = await q.maybeSingle();
      if (data) {
        setClient(data);
        setForm({
          company_name: data.company_name || "",
          target_buyer_titles: (data.target_buyer_titles || []).join(", "),
          sender_name: data.sender_name || "",
          sender_phone: data.sender_phone || "",
          sender_email: data.sender_email || data.email || "",
        });
      }
      setLoading(false);
    })();
  }, [tokenParam, emailParam]);

  async function save() {
    if (!client) return;
    setSaving(true);
    const titles = form.target_buyer_titles
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const { error } = await (supabase.from as any)("industry_pulse_clients")
      .update({
        company_name: form.company_name,
        target_buyer_titles: titles,
        sender_name: form.sender_name,
        sender_phone: form.sender_phone,
        sender_email: form.sender_email,
      })
      .eq("id", client.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save — try again");
      return;
    }
    toast.success("Saved! Open your dashboard to see fit scores tailored to your team.");
  }

  const dashHref = radar === "buyer"
    ? `/my-buyer-radar?token=${tokenParam}`
    : `/my-demand-radar?email=${encodeURIComponent(emailParam)}${tokenParam ? `&token=${tokenParam}` : ""}`;
  const title = radar === "buyer" ? "Buyer Radar Setup" : "Demand Radar Setup";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030711] text-white flex items-center justify-center">
        <Loader2 className="animate-spin w-6 h-6 text-[#00d4ff]" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#030711] text-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <Radar className="w-10 h-10 text-[#00d4ff] mx-auto mb-3" />
          <p className="font-semibold mb-1">Subscription not found</p>
          <p className="text-sm text-[#94a3b8]">Open this page from your welcome email link (must include token or email).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <SEOHead title={title} description="Configure your buyer profile so we can tailor fit scores." />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Radar className="w-5 h-5 text-[#00d4ff]" />
            <h1 className="text-2xl font-bold">{title}</h1>
          </div>
          <p className="text-sm text-[#94a3b8]">
            Tell us who you sell to. We'll use this to score every signal for fit and draft tailored openers.
          </p>
        </header>

        <Card className="bg-[#0a1628] border-[#1e3a5f]">
          <CardContent className="p-5 space-y-5">
            <div>
              <Label htmlFor="company_name" className="text-xs uppercase tracking-widest text-[#94a3b8]">Your company</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="AmeriSteel"
                className="mt-1.5 bg-[#030711] border-[#1e3a5f] text-white"
              />
            </div>

            <div>
              <Label htmlFor="target_buyer_titles" className="text-xs uppercase tracking-widest text-[#94a3b8]">
                Target buyer titles (comma-separated)
              </Label>
              <Input
                id="target_buyer_titles"
                value={form.target_buyer_titles}
                onChange={(e) => setForm({ ...form, target_buyer_titles: e.target.value })}
                placeholder="VP Procurement, Plant Manager, Director of Operations"
                className="mt-1.5 bg-[#030711] border-[#1e3a5f] text-white"
              />
              <p className="text-[11px] text-[#64748b] mt-1.5">Used for LinkedIn search openers.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sender_name" className="text-xs uppercase tracking-widest text-[#94a3b8]">Your name</Label>
                <Input
                  id="sender_name"
                  value={form.sender_name}
                  onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                  placeholder="Tripp Smith"
                  className="mt-1.5 bg-[#030711] border-[#1e3a5f] text-white"
                />
              </div>
              <div>
                <Label htmlFor="sender_phone" className="text-xs uppercase tracking-widest text-[#94a3b8]">Phone</Label>
                <Input
                  id="sender_phone"
                  value={form.sender_phone}
                  onChange={(e) => setForm({ ...form, sender_phone: e.target.value })}
                  placeholder="(313) 555-1234"
                  className="mt-1.5 bg-[#030711] border-[#1e3a5f] text-white"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sender_email" className="text-xs uppercase tracking-widest text-[#94a3b8]">Reply-to email</Label>
              <Input
                id="sender_email"
                value={form.sender_email}
                onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
                placeholder="you@company.com"
                className="mt-1.5 bg-[#030711] border-[#1e3a5f] text-white"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={save}
                disabled={saving}
                className="bg-[#00d4ff] text-[#030711] hover:bg-[#22d3ee] font-bold"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                Save settings
              </Button>
              <a href={dashHref} className="text-sm text-[#00d4ff] font-semibold underline-offset-4 hover:underline">
                Open my dashboard →
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
