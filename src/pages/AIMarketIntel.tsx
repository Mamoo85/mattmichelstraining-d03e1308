import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, TrendingUp, Eye, Newspaper, CheckCircle } from "lucide-react";

export default function AIMarketIntel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ businessName: "", email: "", phone: "", industry: "", focusTopics: "", competitors: "", location: "Michigan" });

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-market-intel-checkout", {
        body: {
          ...form,
          focusTopics: form.focusTopics.split(",").map(s => s.trim()).filter(Boolean),
          competitors: form.competitors.split(",").map(s => s.trim()).filter(Boolean),
        },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Newspaper, title: "Industry News Digest", desc: "Top stories from your industry, delivered every Monday morning" },
    { icon: Eye, title: "Competitor Tracking", desc: "New locations, price changes, hiring — know before your customers do" },
    { icon: TrendingUp, title: "Market Trends", desc: "Economic data and trends relevant to your business decisions" },
    { icon: Brain, title: "Actionable Insights", desc: "Each brief ends with one specific thing you should do this week" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Brain size={16} /> Executive Intelligence
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4">AI Weekly Market Intelligence</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Consulting firms charge $500+/mo for market briefs. Our AI agent scans news, competitor moves, and economic data — delivers a 2-minute read every Monday for $49/mo.
          </p>
          <div className="mt-4 text-3xl font-black text-primary">$49/mo</div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {features.map((f) => (
            <Card key={f.title} className="border-border/40 bg-card/60">
              <CardContent className="p-5 flex gap-4">
                <f.icon className="text-primary shrink-0 mt-1" size={22} />
                <div>
                  <h3 className="font-bold text-sm">{f.title}</h3>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-primary/30 max-w-lg mx-auto">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-center">Get Your Monday Brief</h2>
            <Input placeholder="Business Name *" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
            <Input placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            <Input placeholder="Focus Topics (comma-separated)" value={form.focusTopics} onChange={(e) => setForm({ ...form, focusTopics: e.target.value })} />
            <Input placeholder="Competitors to Watch (comma-separated)" value={form.competitors} onChange={(e) => setForm({ ...form, competitors: e.target.value })} />
            <Input placeholder="Location (e.g. Michigan)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Button className="w-full font-bold" size="lg" onClick={handleCheckout} disabled={loading || !form.businessName || !form.email}>
              {loading ? "Processing..." : "Subscribe — $49/mo"}
            </Button>
            <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
              <CheckCircle size={12} className="text-green-400" /> First brief next Monday • Cancel anytime
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
