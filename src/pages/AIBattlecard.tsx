import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Swords, Eye, Target, MessageCircle, CheckCircle } from "lucide-react";

export default function AIBattlecard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ businessName: "", email: "", phone: "", industry: "", competitorNames: "", competitorUrls: "" });

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-battlecard-checkout", {
        body: {
          ...form,
          competitorNames: form.competitorNames.split(",").map(s => s.trim()).filter(Boolean),
          competitorUrls: form.competitorUrls.split(",").map(s => s.trim()).filter(Boolean),
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
    { icon: Eye, title: "Competitor Weaknesses", desc: "Extracted from their bad reviews and website gaps" },
    { icon: Target, title: "Your Advantages", desc: "Clear talking points for why customers should choose you" },
    { icon: MessageCircle, title: "Objection Handlers", desc: "\"When they say X, you say Y\" — ready for your sales team" },
    { icon: Swords, title: "Updated Monthly", desc: "Fresh intelligence as competitors change pricing and offerings" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Swords size={16} /> Competitive Intelligence
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4">AI Competitive Battlecard</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Know your competitors' weaknesses before your next sales call. AI scrapes their reviews, website, and pricing monthly — delivers a one-page battlecard your team can use today.
          </p>
          <div className="mt-4 text-3xl font-black text-primary">$39/mo</div>
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
            <h2 className="text-lg font-bold text-center">Get Your First Battlecard</h2>
            <Input placeholder="Your Business Name *" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
            <Input placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            <Input placeholder="Competitor Names (comma-separated)" value={form.competitorNames} onChange={(e) => setForm({ ...form, competitorNames: e.target.value })} />
            <Input placeholder="Competitor Websites (comma-separated)" value={form.competitorUrls} onChange={(e) => setForm({ ...form, competitorUrls: e.target.value })} />
            <Button className="w-full font-bold" size="lg" onClick={handleCheckout} disabled={loading || !form.businessName || !form.email}>
              {loading ? "Processing..." : "Subscribe — $39/mo"}
            </Button>
            <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
              <CheckCircle size={12} className="text-green-400" /> First battlecard within 48 hours • Cancel anytime
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
