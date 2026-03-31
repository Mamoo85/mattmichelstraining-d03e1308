import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, DollarSign, Calendar, Target, CheckCircle } from "lucide-react";

export default function AIGrantFinder() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ businessName: "", email: "", phone: "", industry: "", employeeCount: "", annualRevenue: "", location: "Michigan" });

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-grant-finder-checkout", { body: { ...form, employeeCount: parseInt(form.employeeCount) || undefined } });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Search, title: "Weekly Grant Scan", desc: "AI searches grants.gov, SBA, MEDC, and local programs every week" },
    { icon: Target, title: "Matched to You", desc: "Filtered by your industry, size, location, and revenue" },
    { icon: Calendar, title: "Deadline Tracking", desc: "Never miss an application deadline with priority-ranked alerts" },
    { icon: DollarSign, title: "Free Money", desc: "Grants don't need to be repaid — this is non-dilutive capital" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <DollarSign size={16} /> Free Capital Discovery
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4">AI Grant Finder</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Grant consultants charge $3-5K per application. Our AI agent scans hundreds of grant databases weekly and delivers curated opportunities matched to your business — for $149/mo.
          </p>
          <div className="mt-4 text-3xl font-black text-primary">$149/mo</div>
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
            <h2 className="text-lg font-bold text-center">Start Finding Grants</h2>
            <Input placeholder="Business Name *" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
            <Input placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="# Employees" value={form.employeeCount} onChange={(e) => setForm({ ...form, employeeCount: e.target.value })} />
              <Input placeholder="Annual Revenue" value={form.annualRevenue} onChange={(e) => setForm({ ...form, annualRevenue: e.target.value })} />
            </div>
            <Input placeholder="Location (e.g. Michigan)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Button className="w-full font-bold" size="lg" onClick={handleCheckout} disabled={loading || !form.businessName || !form.email}>
              {loading ? "Processing..." : "Subscribe — $149/mo"}
            </Button>
            <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
              <CheckCircle size={12} className="text-green-400" /> First report within 7 days • Cancel anytime
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
