import WaitlistGate from "@/components/WaitlistGate";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Shield, Scale, FileText } from "lucide-react";

export default function AIHandbook() {
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

        <div className="max-w-lg mx-auto">
          <WaitlistGate productName="AI Employee Handbook" description="AI-generated employee handbooks, HR policies, and onboarding documents customized to your business." price="See pricing" />
        </div>
      </div>
    </div>
  );
}
