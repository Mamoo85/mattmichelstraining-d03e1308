import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Shield, Scale, FileText, CheckCircle } from "lucide-react";

export default function AIHandbook() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ businessName: "", email: "", phone: "", industry: "", state: "MI", employeeCount: "" });

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-handbook-checkout", { body: { ...form, employeeCount: parseInt(form.employeeCount) || undefined } });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Shield, title: "State Law Compliance", desc: "Auto-updated with your state's latest labor law changes" },
    { icon: Scale, title: "Anti-Harassment Policies", desc: "Legally sound policies that protect your business" },
    { icon: FileText, title: "PTO & Leave Policies", desc: "FMLA, sick leave, and PTO templates customized to your business" },
    { icon: BookOpen, title: "Safety & Conduct", desc: "OSHA-aligned workplace safety and conduct guidelines" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Shield size={16} /> HR Compliance Automation
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4">AI Employee Handbook Generator</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stop paying lawyers $2-5K for handbook updates. Our AI agent scrapes your state's labor laws monthly and delivers a compliance-ready employee handbook — automatically.
          </p>
          <div className="mt-4 text-3xl font-black text-primary">$99/mo</div>
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
            <h2 className="text-lg font-bold text-center">Start Your Handbook Service</h2>
            <Input placeholder="Business Name *" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
            <Input placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
              <Input placeholder="State (e.g. MI)" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
            <Input placeholder="# of Employees" value={form.employeeCount} onChange={(e) => setForm({ ...form, employeeCount: e.target.value })} />
            <Button className="w-full font-bold" size="lg" onClick={handleCheckout} disabled={loading || !form.businessName || !form.email}>
              {loading ? "Processing..." : "Subscribe — $99/mo"}
            </Button>
            <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
              <CheckCircle size={12} className="text-green-400" /> Cancel anytime • First report within 48 hours
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
