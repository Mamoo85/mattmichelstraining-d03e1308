import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Phone, ArrowRight, CheckCircle, TrendingUp, MapPin,
  BarChart3, Star, FileSearch, MessageSquare, RefreshCw,
  Calendar, Users, Mail, Globe, Zap, DollarSign, Wrench
} from "lucide-react";

const PHONE = "(313) 806-4952";

const ADD_ONS = [
  {
    icon: BarChart3,
    name: "Google Ads Management",
    price: "$99/mo",
    priceSub: "add-on to any plan",
    color: "#4285f4",
    desc: "I set up and manage your Google Ads campaigns — keyword research, ad copy, bidding, and monthly reporting. You only pay for clicks that matter.",
    includes: [
      "Campaign setup & keyword research",
      "Ad copy written and A/B tested",
      "Bid management & budget control",
      "Monthly performance report",
      "Direct communication — no agency middleman",
    ],
  },
  {
    icon: Globe,
    name: "Monthly Content Package",
    price: "$79/mo",
    priceSub: "add-on to any plan",
    color: "#7c3aed",
    desc: "Done-for-you content every month — 4 social posts, 1 blog article, and a monthly email newsletter. Written in your voice, posted on your schedule.",
    includes: [
      "4 Instagram/Facebook posts with captions",
      "1 SEO blog article (600–800 words)",
      "Monthly email newsletter",
      "Hashtag strategy included",
      "Content calendar delivered on the 1st",
    ],
  },
  {
    icon: MapPin,
    name: "Google Business Profile Management",
    price: "$149 setup + $49/mo",
    priceSub: "ongoing management",
    color: "#059669",
    desc: "Your GBP is often the first thing customers see. I optimize your profile, add weekly posts, and respond to reviews — so you rank higher on Google Maps.",
    includes: [
      "Full profile setup & optimization",
      "4 GBP posts per month",
      "Review response management",
      "Photo uploads & service updates",
      "Monthly ranking check",
    ],
  },
  {
    icon: TrendingUp,
    name: "Local SEO Landing Pages",
    price: "$299",
    priceSub: "10-page package · one-time",
    color: "#d97706",
    desc: "Get found for 10 local search terms. I build dedicated pages targeting keywords like 'plumber Grosse Pointe' or 'electrician Harper Woods' so you rank in every neighborhood you serve.",
    includes: [
      "10 keyword-targeted landing pages",
      "Location-specific copy on each page",
      "SEO meta tags & schema markup",
      "Submitted to Google Search Console",
      "Linked from your main site",
    ],
  },
  {
    icon: FileSearch,
    name: "Website Audit & Report",
    price: "$49",
    priceSub: "one-time · any website",
    color: "#dc2626",
    desc: "Not sure why your site isn't converting? I run a full audit — speed, SEO, mobile experience, call-to-action placement — and send you a plain-English report with exactly what to fix.",
    includes: [
      "Page speed & Core Web Vitals check",
      "SEO & keyword gap analysis",
      "Mobile usability review",
      "Conversion rate issues identified",
      "Prioritized fix list delivered within 48 hrs",
    ],
  },
  {
    icon: MessageSquare,
    name: "Reputation & Review Management",
    price: "$79/mo",
    priceSub: "ongoing service",
    color: "#0891b2",
    desc: "I monitor your Google and Yelp reviews and write professional responses within 24 hours — good or bad. A well-managed review profile builds trust and improves local rankings.",
    includes: [
      "Monitor Google, Yelp & Facebook reviews",
      "Professional responses within 24 hours",
      "Monthly reputation summary report",
      "Strategy for generating more 5-star reviews",
      "Negative review escalation handling",
    ],
  },
  {
    icon: RefreshCw,
    name: "Website Refresh",
    price: "$199",
    priceSub: "one-time",
    color: "#7c3aed",
    desc: "Already have a site but it looks dated or isn't converting? I'll rewrite your homepage copy, update your CTAs, fix mobile issues, and modernize the layout — no full rebuild needed.",
    includes: [
      "Full homepage copy rewrite",
      "Updated call-to-action buttons & placement",
      "Mobile responsiveness fixes",
      "Speed optimization pass",
      "1 round of revisions included",
    ],
  },
  {
    icon: Calendar,
    name: "Annual Maintenance Plan",
    price: "$399/yr",
    priceSub: "save $189 vs monthly",
    color: "#059669",
    desc: "Pay annually and save two months. Same great service — hosting, SSL, unlimited edits, security updates, and direct access to me — just locked in at a better rate.",
    includes: [
      "All standard $49/mo maintenance included",
      "Priority response time",
      "Annual SEO review & recommendations",
      "Free 1 additional revision round",
      "Save $189 vs. paying month-to-month",
    ],
  },
];

// 5 NEW ideas presented as "Coming Soon" or "Ask About This"
const NEW_IDEAS = [
  {
    icon: Users,
    name: "Referral Partner Program",
    idea: "Send me a paying web design client and earn $100 cash or a free month of service. My existing hosting clients are my best lead source — this formalizes it. Tell a contractor friend, collect your reward.",
    cta: "Ask About This",
  },
  {
    icon: Mail,
    name: "Email Marketing Campaigns",
    idea: "Got a list of past customers? I'll write and send a targeted email campaign to re-engage them — an offer, a seasonal deal, or a simple check-in. One campaign, $149 flat.",
    cta: "Ask About This",
  },
  {
    icon: Zap,
    name: "Video / Reel Content Creation",
    idea: "Short-form video is the #1 organic reach driver right now. I coordinate a 1-hour shoot at your location, edit 4–6 reels/shorts, and write captions optimized for each platform. One-time $299.",
    cta: "Ask About This",
  },
  {
    icon: Globe,
    name: "White-Label for Other Coaches & Trainers",
    idea: "Are you a fitness coach or trainer with clients who need websites? I'll build sites under your brand — you mark up the price, I do the work. Partner pricing available for 3+ referrals.",
    cta: "Ask About This",
  },
  {
    icon: DollarSign,
    name: "Local Business Photography Coordination",
    idea: "A site with real photos converts 2–3x better than stock images. I'll coordinate a 2-hour shoot at your business with a local photographer I trust — headshots, interior, product. $299 flat.",
    cta: "Ask About This",
  },
];

const WebDesignServices = () => {
  const [form, setForm] = useState({ name: "", business: "", phone: "", email: "", service: "", details: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ name: "", business: "", email: "", phone: "", how_they_heard: "" });
  const [partnerSending, setPartnerSending] = useState(false);
  const [partnerSent, setPartnerSent] = useState(false);

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerSending(true);
    try {
      const { error } = await supabase.functions.invoke("partner-onboarding", {
        body: partnerForm,
      });
      if (error) throw error;
      setPartnerSent(true);
    } catch {
      toast.error("Something went wrong. Text me directly at (313) 806-4952");
    } finally {
      setPartnerSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await supabase.functions.invoke("notify-coach-question", {
        body: {
          subject: `🌐 Web Design Service Inquiry: ${form.service || "General"} — ${form.business || form.name}`,
          message: `Name: ${form.name}\nBusiness: ${form.business}\nPhone: ${form.phone}\nEmail: ${form.email}\nService Interest: ${form.service}\n\nMessage:\n${form.details}`,
          userEmail: form.email,
        },
      });
      await supabase.from("web_design_leads" as any).insert({
        name: form.name,
        business: form.business,
        phone: form.phone,
        email: form.email,
        description: `Service interest: ${form.service}. ${form.details}`,
        status: "new",
      });
      setSent(true);
    } catch {
      toast.error("Something went wrong. Call me directly — (313) 806-4952");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Web Design Services & Add-Ons | Matt Michels · Metro Detroit"
        description="Google Ads, monthly content, SEO pages, GBP management, reputation management, and more. Add-on services for local Metro Detroit businesses."
        path="/web-design-services"
      />

      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="relative pt-20 pb-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/6 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Wrench size={11} /> Add-On Services · Metro Detroit
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5 tracking-tight">
              A Website Is the Start.<br />
              <span className="text-primary">These Services Drive the Leads.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              Every add-on below is designed to do one thing: get more people to call your business. No agency fluff — just services that move the needle for local businesses.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="text-base px-7 py-5 rounded-xl"
                onClick={() => document.getElementById("inquiry-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                Talk to Matt About Add-Ons <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <a
                href={`tel:${PHONE.replace(/\D/g, "")}`}
                className="inline-flex items-center justify-center gap-2 text-base px-6 py-3 rounded-xl border border-border/60 hover:border-primary/50 transition-colors font-medium"
              >
                <Phone size={15} /> {PHONE}
              </a>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              All add-ons can be paired with any web design plan. No long-term contracts.
            </p>
          </div>
        </section>

        {/* Add-On Services Grid */}
        <section className="px-4 pb-24">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Available Services</h2>
              <p className="text-muted-foreground text-sm">Mix and match. Add what you need, drop what you don't. Month-to-month on everything.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              {ADD_ONS.map((service) => (
                <Card key={service.name} className="border-border/40 bg-card/60 hover:border-primary/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${service.color}18` }}>
                        <service.icon size={18} style={{ color: service.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base leading-tight">{service.name}</h3>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-sm font-black text-primary">{service.price}</span>
                          <span className="text-xs text-muted-foreground">{service.priceSub}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{service.desc}</p>
                    <ul className="space-y-1.5">
                      {service.includes.map(item => (
                        <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle size={12} className="text-primary shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full text-xs border-border/60 hover:border-primary/50 hover:text-primary"
                      onClick={() => {
                        setForm(f => ({ ...f, service: service.name }));
                        document.getElementById("inquiry-form")?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Ask About This <ArrowRight size={12} className="ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* New Ideas Section */}
        <section className="px-4 pb-24 bg-muted/20">
          <div className="max-w-5xl mx-auto py-16">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-4">
                <Star size={11} /> New & Coming Soon
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">More Ways to Grow</h2>
              <p className="text-muted-foreground text-sm">These services are available now or in development. Ask Matt about any of them.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {NEW_IDEAS.map((idea) => (
                <div key={idea.name} className="bg-card border border-border/40 rounded-xl p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <idea.icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm mb-1.5">{idea.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{idea.idea}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-auto w-full text-xs text-primary hover:bg-primary/10 border border-primary/20"
                    onClick={() => {
                      setForm(f => ({ ...f, service: idea.name }));
                      document.getElementById("inquiry-form")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {idea.cta} <ArrowRight size={11} className="ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Partner Program */}
        <section id="partner-program" className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Users size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">Referral Partner Program</h3>
                    <p className="text-sm text-muted-foreground">Earn $100 cash for every client you send my way</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  {[
                    { step: "01", text: "Sign up below — get your personal referral link" },
                    { step: "02", text: "Share it with a business owner who needs a website" },
                    { step: "03", text: "They sign up → you get $100 cash within 7 days of launch" },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex gap-3 items-start">
                      <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center">{step}</span>
                      <p className="text-sm text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>

                {partnerSent ? (
                  <div className="text-center py-6">
                    <CheckCircle size={32} className="text-primary mx-auto mb-3" />
                    <p className="font-bold text-base mb-1">You're in the program!</p>
                    <p className="text-sm text-muted-foreground">Check your email — your referral link is on its way.</p>
                  </div>
                ) : (
                  <form onSubmit={handlePartnerSubmit} className="space-y-3 pt-2 border-t border-border/40">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pt-1">Sign Up as a Partner</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="p-name" className="text-xs">Your Name *</Label>
                        <Input id="p-name" value={partnerForm.name} onChange={e => setPartnerForm(f => ({...f, name: e.target.value}))} placeholder="John Smith" required />
                      </div>
                      <div>
                        <Label htmlFor="p-biz" className="text-xs">Your Business / Occupation</Label>
                        <Input id="p-biz" value={partnerForm.business} onChange={e => setPartnerForm(f => ({...f, business: e.target.value}))} placeholder="Smith Roofing LLC" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="p-email" className="text-xs">Email *</Label>
                        <Input id="p-email" type="email" value={partnerForm.email} onChange={e => setPartnerForm(f => ({...f, email: e.target.value}))} placeholder="john@email.com" required />
                      </div>
                      <div>
                        <Label htmlFor="p-phone" className="text-xs">Phone</Label>
                        <Input id="p-phone" type="tel" value={partnerForm.phone} onChange={e => setPartnerForm(f => ({...f, phone: e.target.value}))} placeholder="(313) 555-1234" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="p-heard" className="text-xs">How did you hear about this?</Label>
                      <Input id="p-heard" value={partnerForm.how_they_heard} onChange={e => setPartnerForm(f => ({...f, how_they_heard: e.target.value}))} placeholder="Friend, social media, existing client..." />
                    </div>
                    <Button type="submit" className="w-full font-bold" disabled={partnerSending}>
                      {partnerSending ? "Signing up..." : "Join the Partner Program — Get My Referral Link →"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Inquiry Form */}
        <section id="inquiry-form" className="px-4 pb-24 bg-muted/20">
          <div className="max-w-lg mx-auto py-16">
            {sent ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Got it. I'll reach out today.</h2>
                <p className="text-muted-foreground text-sm">You'll hear from me within a few hours. Or call/text me directly:</p>
                <a href={`tel:${PHONE.replace(/\D/g,"")}`} className="text-primary font-semibold hover:underline mt-2 block">{PHONE}</a>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ask About a Service</h2>
                  <p className="text-muted-foreground text-sm">Tell me what you're looking for. No commitment, no pitch — just an honest conversation about what makes sense for your business.</p>
                </div>
                <Card className="border-border/40 bg-card/80">
                  <CardContent className="p-6 sm:p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="ws-name">Your Name *</Label>
                          <Input id="ws-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Smith" required />
                        </div>
                        <div>
                          <Label htmlFor="ws-biz">Business Name</Label>
                          <Input id="ws-biz" value={form.business} onChange={e => setForm({ ...form, business: e.target.value })} placeholder="Smith Roofing LLC" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="ws-phone">Phone *</Label>
                          <Input id="ws-phone" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(313) 555-1234" required />
                        </div>
                        <div>
                          <Label htmlFor="ws-email">Email</Label>
                          <Input id="ws-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@smithroofing.com" />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="ws-service">Service You're Interested In</Label>
                        <Input id="ws-service" value={form.service} onChange={e => setForm({ ...form, service: e.target.value })} placeholder="e.g. Google Ads, Monthly Content, SEO Pages..." />
                      </div>
                      <div>
                        <Label htmlFor="ws-details">Tell me about your business</Label>
                        <Textarea
                          id="ws-details"
                          value={form.details}
                          onChange={e => setForm({ ...form, details: e.target.value })}
                          placeholder="What you do, where you're located, what you're trying to achieve..."
                          rows={4}
                        />
                      </div>
                      <Button type="submit" className="w-full py-5 text-base font-bold" disabled={sending}>
                        {sending ? "Sending..." : "Get in Touch →"}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Or call/text: <a href={`tel:${PHONE.replace(/\D/g,"")}`} className="font-semibold text-foreground hover:text-primary">{PHONE}</a>
                      </p>
                    </form>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/30 py-8 px-4">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Matt Michels Web Design · Grosse Pointe, MI</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link to="/detroit-web-design" className="hover:text-foreground transition-colors">Main Site</Link>
              <Link to="/whats-included" className="hover:text-foreground transition-colors">What's Included</Link>
              <a href={`tel:${PHONE.replace(/\D/g,"")}`} className="hover:text-foreground transition-colors flex items-center gap-1"><Phone size={11} /> {PHONE}</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default WebDesignServices;
