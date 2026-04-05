import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Phone, CheckCircle, Clock, ArrowRight, MessageSquare, MapPin, Globe, Shield } from "lucide-react";

export default function AdDigitalFoundation() {
  const [params] = useSearchParams();
  const success = params.get("success") === "1";
  const source = params.get("utm_source") || "direct";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    businessName: "",
    website: "",
  });
  const [submitting, setSubmitting] = useState(false);

  if (success) {
    return (
      <div className="min-h-screen bg-[#1e293b] flex items-center justify-center px-4">
        <div className="max-w-md text-center text-white">
          <CheckCircle className="mx-auto mb-4 text-green-400" size={48} />
          <h1 className="text-3xl font-black mb-3">You're In!</h1>
          <p className="text-slate-300 mb-6">
            Matt will reach out today to start building your site. 7-day free trial — no charge until day 8.
          </p>
          <a href="tel:+13138064952" className="inline-flex items-center gap-2 text-[#e8621a] font-bold text-lg">
            <Phone size={18} /> (313) 806-4952
          </a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) {
      toast.error("Email and business name are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-foundation-checkout", {
        body: { ...form, plan: "standard" },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong. Call (313) 806-4952");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Website + Google Posts + Missed Call Text-Back | M² Development"
        description="Custom website, automatic Google posts 3x/week, and instant text-back for missed calls. $99/mo. 7-day free trial."
        path="/ad/digital-foundation"
      />

      {/* No navigation — pure conversion page */}
      <div className="min-h-screen bg-[#1e293b]">
        {/* Floating header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <p className="text-[#e8621a] font-black text-sm tracking-wider uppercase">M² Development</p>
          <a href="tel:+13138064952" className="text-white/70 text-sm flex items-center gap-1.5 hover:text-white">
            <Phone size={12} /> (313) 806-4952
          </a>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-12 grid lg:grid-cols-2 gap-12 items-start">
          {/* Left — Value prop */}
          <div className="text-white">
            <p className="text-[#e8621a] text-xs font-bold uppercase tracking-widest mb-4">
              Stop losing customers
            </p>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-5">
              Your website, Google presence, and missed calls — <span className="text-[#e8621a]">handled.</span>
            </h1>
            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
              One package. One monthly price. Zero manual work from you.
            </p>

            <div className="space-y-5 mb-10">
              {[
                { icon: Globe, title: "Custom Website", desc: "Built for your business. Mobile-first. Fast." },
                { icon: MapPin, title: "Google Auto-Posts 3x/Week", desc: "AI posts to your Google Business Profile. More visibility." },
                { icon: MessageSquare, title: "Missed Call Text-Back", desc: "Every missed call gets an instant text. Never lose a lead." },
                { icon: Shield, title: "Hosting & Maintenance", desc: "SSL, updates, edits. Your site stays live and sharp." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#e8621a]/20 flex items-center justify-center shrink-0">
                    <item.icon size={18} className="text-[#e8621a]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{item.title}</p>
                    <p className="text-slate-400 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10">
              <img src="/images/matt-boat.jpg" alt="Matt" className="w-12 h-12 rounded-full object-cover" />
              <div>
                <p className="text-sm font-bold">Matt Michels</p>
                <p className="text-xs text-slate-400">Grosse Pointe, MI — 10+ years B2B sales. I build this stuff and I answer my phone.</p>
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-[#e8621a] mb-1">7-Day Free Trial</p>
              <p className="text-3xl font-black text-[#1e293b]">$1,500 setup + $99/mo</p>
              <p className="text-sm text-slate-500 mt-1">Everything included. Cancel anytime.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="name" className="text-xs font-bold text-slate-600">Your Name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Smith" className="border-slate-200" />
              </div>
              <div>
                <Label htmlFor="email" className="text-xs font-bold text-slate-600">Email <span className="text-red-500">*</span></Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@business.com" className="border-slate-200" />
              </div>
              <div>
                <Label htmlFor="businessName" className="text-xs font-bold text-slate-600">Business Name <span className="text-red-500">*</span></Label>
                <Input id="businessName" required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Smith Roofing" className="border-slate-200" />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs font-bold text-slate-600">Phone</Label>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(313) 555-1234" className="border-slate-200" />
              </div>
              <div>
                <Label htmlFor="website" className="text-xs font-bold text-slate-600">Current Website (if any)</Label>
                <Input id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="www.mybusiness.com" className="border-slate-200" />
              </div>

              <Button type="submit" disabled={submitting} className="w-full bg-[#e8621a] hover:bg-[#d4570f] text-white py-6 text-base font-bold mt-2">
                {submitting ? "Setting up..." : "Start Free Trial"}
                {!submitting && <ArrowRight size={16} className="ml-2" />}
              </Button>

              <p className="text-[10px] text-center text-slate-400 mt-2">
                No charge for 7 days. Setup fee billed after site is delivered.
              </p>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Or call now: <a href="tel:+13138064952" className="font-bold text-[#e8621a]">(313) 806-4952</a>
              </p>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="border-t border-white/10 px-4 py-8">
          <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center text-white">
            <div>
              <p className="text-2xl font-black text-[#e8621a]">62%</p>
              <p className="text-xs text-slate-400">of contractor calls go unanswered</p>
            </div>
            <div>
              <p className="text-2xl font-black text-[#e8621a]">3x</p>
              <p className="text-xs text-slate-400">more leads from weekly Google posts</p>
            </div>
            <div>
              <p className="text-2xl font-black text-[#e8621a]">78%</p>
              <p className="text-xs text-slate-400">call the first business that responds</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
