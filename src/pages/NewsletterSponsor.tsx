import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle, Mail, Users, Zap, Star, ArrowRight, Loader2
} from "lucide-react";

const TIERS = [
  {
    name: "Spotlight",
    price: "$99/issue",
    color: "#3b82f6",
    what: "2-sentence mention in the newsletter with your business name, city, and a link.",
    best: "Brand awareness, local recognition",
  },
  {
    name: "Feature",
    price: "$199/issue",
    color: "#f97316",
    what: "Full paragraph dedicated to your business — what you offer, your location, a special offer or CTA, and a link. Positioned in the body of the newsletter.",
    best: "Direct response, offer promotion",
    popular: true,
  },
  {
    name: "Presenting Sponsor",
    price: "$299/issue",
    color: "#8b5cf6",
    what: 'Top-of-newsletter placement, "Presented by [Your Business]" header, 3 mentions throughout the issue, and a social media callout.',
    best: "Maximum exposure, campaign launches",
  },
];

const AUDIENCE = [
  { stat: "500+", label: "Youth sports families" },
  { stat: "8–18", label: "Athlete age range" },
  { stat: "Metro Detroit", label: "Primary audience location" },
  { stat: "Weekly", label: "Send frequency" },
];

export default function NewsletterSponsor() {
  const [form, setForm] = useState({
    name: "",
    business_name: "",
    email: "",
    phone: "",
    preferred_tier: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("submit-sponsor-inquiry", {
        body: form,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Try emailing matt@m2training.com directly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Sponsor the M² Youth Sports Newsletter | Matt Michels"
        description="Reach 500+ youth sports families in Metro Detroit. Sponsor the M² weekly sports newsletter. Spotlight $99, Feature $199, Presenting Sponsor $299 per issue."
        path="/sponsor"
      />
      <div className="min-h-screen bg-[#0f0f1a] text-white">

        {/* Hero */}
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6">
              <Mail size={11} /> Newsletter Sponsorships
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Reach 500+ Youth Sports Families<br />
              <span className="text-[#f97316]">Every Week.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#aaa] max-w-2xl mx-auto mb-8 leading-relaxed">
              The M² weekly newsletter goes to parents of youth athletes across Metro Detroit — families actively looking for training, gear, camps, and services for their kids.
            </p>
            <Button
              size="lg"
              className="bg-[#f97316] hover:bg-[#ea6c10] text-white text-base px-8 py-5 font-bold rounded-xl"
              onClick={() => document.getElementById("sponsor-form")?.scrollIntoView({ behavior: "smooth" })}
            >
              Reserve a Sponsor Spot <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Audience stats */}
        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {AUDIENCE.map(({ stat, label }) => (
                <div key={label} className="bg-[#1a1a2e] border border-white/8 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-[#f97316] mb-1">{stat}</div>
                  <div className="text-xs text-[#888]">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Example callout */}
        <section className="px-4 pb-16">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-lg font-bold text-center mb-6 text-[#aaa]">What a Sponsored Mention Looks Like</h2>
            <div className="bg-white text-[#1a1a1a] rounded-xl p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#f97316] bg-[#f97316]/10 px-2 py-0.5 rounded">Sponsored</span>
              </div>
              <p className="text-sm leading-relaxed text-[#444]">
                <strong className="text-[#1a1a1a]">Looking for custom team gear this season?</strong> Grosse Pointe Sports Supply has everything from jerseys to training bags — and they offer team discounts for orders of 10+. Tell them Matt sent you.{" "}
                <span className="text-[#f97316] underline font-medium">→ grossepointesportssupply.com</span>
              </p>
            </div>
            <p className="text-xs text-[#555] text-center mt-3">Feature-tier example. Spotlight and Presenting Sponsor placements vary.</p>
          </div>
        </section>

        {/* Tiers */}
        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-10">Sponsor Tiers</h2>
            <div className="grid sm:grid-cols-3 gap-5">
              {TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`bg-[#1a1a2e] rounded-xl p-6 border ${tier.popular ? "border-[#f97316]/50 shadow-lg shadow-[#f97316]/10" : "border-white/8"}`}
                >
                  {tier.popular && (
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#f97316] mb-3 flex items-center gap-1">
                      <Star size={10} /> Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-black mb-1" style={{ color: tier.color }}>{tier.name}</h3>
                  <div className="text-2xl font-black mb-3">{tier.price}</div>
                  <p className="text-xs text-[#888] leading-relaxed mb-3">{tier.what}</p>
                  <p className="text-[10px] text-[#666] uppercase tracking-wider font-semibold">Best for: {tier.best}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#666] text-center mt-6">Sponsors rotate per issue. First-come, first-served per issue date. Reach out to lock in your spot.</p>
          </div>
        </section>

        {/* Form */}
        <section id="sponsor-form" className="px-4 pb-24">
          <div className="max-w-lg mx-auto">
            {sent ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full bg-[#f97316]/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-[#f97316]" />
                </div>
                <h2 className="text-xl font-bold mb-3">Inquiry Received</h2>
                <p className="text-[#888] text-sm">Matt will reach out within 24 hours to confirm your spot and collect payment. Looking forward to working with you.</p>
              </div>
            ) : (
              <Card className="bg-[#1a1a2e] border-white/10">
                <CardContent className="p-6 sm:p-8">
                  <h2 className="text-xl font-bold mb-1">Reserve a Sponsor Spot</h2>
                  <p className="text-sm text-[#888] mb-6">No payment collected here — Matt will follow up to confirm your spot and handle payment.</p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[#aaa] text-xs">Your Name *</Label>
                        <Input
                          value={form.name}
                          onChange={e => setForm(f => ({...f, name: e.target.value}))}
                          placeholder="Jane Smith"
                          className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-[#aaa] text-xs">Business Name</Label>
                        <Input
                          value={form.business_name}
                          onChange={e => setForm(f => ({...f, business_name: e.target.value}))}
                          placeholder="Grosse Pointe Sports Supply"
                          className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[#aaa] text-xs">Email *</Label>
                        <Input
                          type="email"
                          value={form.email}
                          onChange={e => setForm(f => ({...f, email: e.target.value}))}
                          placeholder="jane@yourbusiness.com"
                          className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-[#aaa] text-xs">Phone</Label>
                        <Input
                          type="tel"
                          value={form.phone}
                          onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                          placeholder="(313) 555-1234"
                          className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[#aaa] text-xs">Preferred Tier</Label>
                      <select
                        value={form.preferred_tier}
                        onChange={e => setForm(f => ({...f, preferred_tier: e.target.value}))}
                        className="w-full h-10 rounded-md bg-white/5 border border-white/15 text-white text-sm px-3"
                      >
                        <option value="" className="bg-[#1a1a2e]">Select a tier...</option>
                        <option value="Spotlight ($99/issue)" className="bg-[#1a1a2e]">Spotlight — $99/issue</option>
                        <option value="Feature ($199/issue)" className="bg-[#1a1a2e]">Feature — $199/issue</option>
                        <option value="Presenting Sponsor ($299/issue)" className="bg-[#1a1a2e]">Presenting Sponsor — $299/issue</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[#aaa] text-xs">Anything else? (optional)</Label>
                      <Textarea
                        value={form.message}
                        onChange={e => setForm(f => ({...f, message: e.target.value}))}
                        placeholder="Specific issue dates, what you'd like to promote, etc."
                        className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                        rows={3}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-[#f97316] hover:bg-[#ea6c10] text-white font-bold py-5 text-base rounded-xl"
                      disabled={loading}
                    >
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Submit Sponsor Inquiry →"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="mt-6 text-center">
              <p className="text-xs text-[#666]">
                Not a sponsor yet?{" "}
                <Link to="/newsletter" className="text-[#f97316] hover:underline">
                  Subscribe to the free newsletter first →
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
