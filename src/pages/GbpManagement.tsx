import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle, MapPin, Star, MessageSquare, Camera,
  ArrowRight, Loader2, TrendingUp, Calendar
} from "lucide-react";

const INCLUDED = [
  { icon: Calendar, title: "4 Posts Per Month", desc: "Consistent weekly updates to your profile — offers, updates, service highlights — all handled for you." },
  { icon: Star, title: "Review Monitoring", desc: "I watch for new reviews and flag anything that needs a response so you stay on top of your reputation." },
  { icon: MapPin, title: "Profile Optimization", desc: "Hours, services, categories, photos, business description — all reviewed and updated to maximize visibility." },
  { icon: Camera, title: "Photo Recommendations", desc: "I'll tell you exactly what photos to add (or take) to improve your profile's performance in search." },
  { icon: MessageSquare, title: "Monthly Check-In", desc: "Quick summary each month of what posted, what changed, and what to focus on next." },
  { icon: TrendingUp, title: "Local Map Pack Visibility", desc: "Businesses with active, optimized GBP profiles consistently rank higher on Google Maps than inactive ones." },
];

export default function GbpManagement() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    phone: "",
    email: "",
    current_gbp_url: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.business_name || !form.contact_name || !form.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-gbp-subscription", {
        body: form,
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#f97316]/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-[#f97316]" />
          </div>
          <h1 className="text-2xl font-black mb-3">You're Signed Up!</h1>
          <p className="text-[#aaa] text-sm leading-relaxed mb-6">
            Matt will review your Google Business Profile within 24 hours and reach out to get started. Your first monthly posts go out in the first week.
          </p>
          <Link to="/detroit-web-design">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
              Back to Main Site
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Google Business Profile Management — $49/mo | Matt Michels Web Design"
        description="Weekly Google Business Profile posts, profile optimization, and review monitoring. $49/month. Handled by Matt Michels in Metro Detroit."
        path="/gbp-management"
      />
      <div className="min-h-screen bg-[#0f0f1a] text-white">

        {/* Hero */}
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6">
              <MapPin size={11} /> GBP Management · Metro Detroit
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Your Google Business Profile,<br />
              <span className="text-[#f97316]">Handled Every Week.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#aaa] max-w-2xl mx-auto mb-4 leading-relaxed">
              Businesses with active, optimized GBP profiles show up higher on Google Maps — and get more calls. Our system actively manages your profile for $49/month.
            </p>
            <div className="bg-[#1a1a2e] border border-white/10 p-5 mb-8 rounded-xl flex items-start gap-4 max-w-2xl mx-auto text-left">
              <div className="w-[52px] h-[52px] rounded-full bg-[#f97316]/15 border border-[#f97316]/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={24} className="text-[#f97316]" />
              </div>
              <p className="text-[13px] text-[#aaa] leading-relaxed">
                <span className="font-bold text-white">The Local Growth Engine.</span> We built this system specifically for local trades businesses who are too busy on the jobsite to manage their Google presence. Our proprietary setup ensures your profile stays active, optimized, and ranking above the competition. We handle the algorithm, you handle the calls.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-[#f97316] hover:bg-[#ea6c10] text-white text-base px-8 py-5 font-bold rounded-xl"
                onClick={() => document.getElementById("gbp-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                Start for $49/mo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Link to="/local-business-score">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 text-base px-6 py-5 rounded-xl">
                  Check Your Profile Score (Free) →
                </Button>
              </Link>
            </div>
            <p className="text-xs text-[#666] mt-4">Month-to-month · Cancel anytime · No setup fee</p>
          </div>
        </section>

        {/* What's Included */}
        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-10">What's Included Every Month</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {INCLUDED.map((item) => (
                <div key={item.title} className="bg-[#1a1a2e] border border-white/8 rounded-xl p-5">
                  <div className="w-9 h-9 rounded-lg bg-[#f97316]/15 flex items-center justify-center mb-3">
                    <item.icon size={16} className="text-[#f97316]" />
                  </div>
                  <h3 className="font-bold text-sm mb-1.5">{item.title}</h3>
                  <p className="text-xs text-[#888] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing callout */}
        <section className="px-4 pb-16">
          <div className="max-w-lg mx-auto">
            <div className="bg-[#1a1a2e] border border-[#f97316]/30 rounded-xl p-6 text-center">
              <div className="text-4xl font-black text-[#f97316] mb-1">$49<span className="text-xl text-[#888] font-normal">/mo</span></div>
              <p className="text-sm text-[#aaa] mb-3">No contracts. Cancel anytime.</p>
              <ul className="text-xs text-[#888] space-y-1 text-left max-w-xs mx-auto">
                {["4 posts per month", "Profile optimization included", "Review monitoring", "Monthly summary", "Direct line to Matt"].map(i => (
                  <li key={i} className="flex items-center gap-2"><CheckCircle size={11} className="text-[#f97316] shrink-0" />{i}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Form */}
        <section id="gbp-form" className="px-4 pb-24">
          <div className="max-w-lg mx-auto">
            <Card className="bg-[#1a1a2e] border-white/10">
              <CardContent className="p-6 sm:p-8">
                <h2 className="text-xl font-bold mb-1">Get Started — $49/mo</h2>
                <p className="text-sm text-[#888] mb-6">Fill this out and Matt will review your profile within 24 hours to get started.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[#aaa] text-xs">Business Name *</Label>
                      <Input
                        value={form.business_name}
                        onChange={e => setForm(f => ({...f, business_name: e.target.value}))}
                        placeholder="Smith Plumbing LLC"
                        className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-[#aaa] text-xs">Your Name *</Label>
                      <Input
                        value={form.contact_name}
                        onChange={e => setForm(f => ({...f, contact_name: e.target.value}))}
                        placeholder="John Smith"
                        className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                        required
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
                        placeholder="john@smithplumbing.com"
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
                    <Label className="text-[#aaa] text-xs">Link to Your Google Business Profile (optional)</Label>
                    <Input
                      value={form.current_gbp_url}
                      onChange={e => setForm(f => ({...f, current_gbp_url: e.target.value}))}
                      placeholder="https://g.page/yourprofile"
                      className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                    />
                    <p className="text-[10px] text-[#555] mt-1">Search your business on Google Maps and copy the link. If you don't have one yet, Matt will help set it up.</p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#f97316] hover:bg-[#ea6c10] text-white font-bold py-5 text-base rounded-xl"
                    disabled={loading}
                  >
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Start GBP Management — $49/mo →"}
                  </Button>
                  <p className="text-[10px] text-center text-[#555]">Secure payment via Stripe. Cancel anytime. No long-term contract.</p>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}
