import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileCheck, AlertTriangle, Calendar, Shield, CheckCircle } from "lucide-react";

export default function AIPermitMonitor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ businessName: "", email: "", industry: "", city: "" });

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-permit-monitor-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const features = [
    { icon: FileCheck, title: "Permit Tracking", desc: "All your required permits and licenses monitored in one place" },
    { icon: Calendar, title: "Renewal Reminders", desc: "60/30/7-day alerts before any permit expires" },
    { icon: AlertTriangle, title: "New Requirements", desc: "AI scrapes municipal sites for regulatory changes in your area" },
    { icon: Shield, title: "Compliance Reports", desc: "Monthly compliance status digest delivered to your inbox" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <FileCheck size={16} /> Permit Compliance Automation
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4">AI Permit & License Monitor</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Never miss a permit renewal again. Our AI agent tracks all your business permits, scrapes municipal sites for changes, and sends you reminders before deadlines hit.
          </p>
          <div className="mt-4 text-3xl font-black text-primary">$79/mo</div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {features.map((f) => (
            <Card key={f.title} className="border-border/40 bg-card/60">
              <CardContent className="p-5 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><f.icon size={20} className="text-primary" /></div>
                <div><h3 className="font-bold text-sm">{f.title}</h3><p className="text-xs text-muted-foreground mt-1">{f.desc}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="max-w-md mx-auto border-primary/30">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">Start Your 7-Day Free Trial</h2>
            <Input placeholder="Business Name" value={form.businessName} onChange={e => setForm(p => ({ ...p, businessName: e.target.value }))} />
            <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            <Input placeholder="Industry (e.g. Restaurant, Construction)" value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} />
            <Input placeholder="City" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
            <Button onClick={handleCheckout} disabled={loading || !form.email || !form.businessName} className="w-full font-bold">
              {loading ? "Processing..." : "Start Free Trial — $79/mo"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">7-day free trial. Cancel anytime.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
