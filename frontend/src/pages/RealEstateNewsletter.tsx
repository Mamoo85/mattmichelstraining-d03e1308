import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { CheckCircle, Mail, MapPin, TrendingUp, Users, Clock, Star, ChevronRight } from "lucide-react";

const PAIN_POINTS = [
  { label: "Writing market updates yourself", sub: "Hours of research, writing, formatting — every single week." },
  { label: "Staying top-of-mind with your sphere", sub: "Out of sight = out of mind. Your competitors are emailing their lists." },
  { label: "Looking like a local expert online", sub: "Generic social posts don't prove you know the market. Data does." },
  { label: "Hiring a marketing VA", sub: "$1,500–$3,000/mo for someone who still doesn't know your market like you do." },
];

const WHAT_YOU_GET = [
  "Weekly branded HTML email with your name, brokerage, logo color",
  "Hyper-local market data: median price, days on market, inventory levels, price trends",
  "AI-written buyer insights, seller insights, and local market commentary — per zip code",
  "Unlimited contacts — your entire sphere of influence, clients, and past buyers",
  "Multiple zip codes covered in each issue",
  "Delivered every week without you lifting a finger",
];

const STATS = [
  { value: "79%", label: "of buyers work with the first agent who educates them" },
  { value: "5×", label: "more likely to be referred when you send regular market updates" },
  { value: "$0", label: "time investment from you after setup" },
  { value: "6 min", label: "average read time — contacts actually finish it" },
];

// Mock newsletter preview data
const MOCK_PREVIEW = {
  zip: "48236",
  medianPrice: "$412,000",
  priceChange: "+4.1%",
  dom: "18 days",
  inventory: "1.4 months",
  headline: "Inventory Stays Tight as Spring Demand Surges in 48236",
  marketSnap: "The 48236 market is moving fast this spring. Well-priced homes are receiving multiple offers within 48–72 hours of listing. Median home prices have climbed 4.1% year-over-year, driven by low inventory and sustained buyer demand from metro Detroit professionals.",
  buyerNote: "If you're buying in 48236, get pre-approved and be ready to move quickly. The best properties are not sitting — a clean, strong offer with minimal contingencies is your edge right now.",
  sellerNote: "Sellers have the upper hand. Pricing correctly and presenting well will put you in a multiple-offer situation. This is one of the strongest seller's markets this area has seen in years.",
  localInsight: "The 48236 zip continues to attract buyers drawn to Grosse Pointe's school district reputation and walkable village feel. New listings near the lake are commanding 8–12% premiums.",
};

export default function RealEstateNewsletter() {
  const [form, setForm] = useState({
    agent_name: "",
    brokerage: "",
    zip_codes: "",
    brand_color: "#1a4a7a",
    phone: "",
    website: "",
    customer_email: "",
    customer_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customer_email || !form.agent_name || !form.zip_codes) {
      setError("Please fill in your name, email, and at least one zip code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-re-newsletter-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="AI Hyper-Local Real Estate Newsletter | Look Like the #1 Agent — M2 Development"
        description="Every week, AI generates a branded market report newsletter and sends it to your sphere of influence. You look like the local expert. Zero effort. $79/month."
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <div className="bg-[#1a4a7a] text-white px-6 py-20 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300 mb-3">M2 Development · AI Tools for Real Estate Agents</p>
          <h1 className="text-3xl sm:text-4xl font-black mb-5 leading-tight max-w-3xl mx-auto">
            Look Like the #1 Agent in Your Market<br className="hidden sm:block" /> — Without Writing a Single Word
          </h1>
          <p className="text-blue-100 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            Every week, AI generates a <strong className="text-white">hyper-local real estate market report</strong> — branded with your name and brokerage — and sends it to your entire contact list automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#signup" className="bg-white text-[#1a4a7a] px-8 py-3 font-bold text-sm hover:bg-blue-50 transition-all inline-flex items-center gap-2 justify-center">
              Start for $79/mo <ChevronRight size={16} />
            </a>
            <a href="#preview" className="border border-white/40 text-white px-8 py-3 font-bold text-sm hover:bg-white/10 transition-all inline-flex items-center gap-2 justify-center">
              See a Sample Newsletter
            </a>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-[#0f2d4d] text-white px-6 py-6">
          <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.value} className="text-center">
                <p className="text-2xl font-black text-blue-300">{s.value}</p>
                <p className="text-xs text-blue-100 mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pain Section */}
        <div className="max-w-3xl mx-auto px-6 py-14">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">The Problem</p>
          <h2 className="text-xl font-black text-foreground mb-6">Most agents know they should be marketing. Almost none actually do it.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            {PAIN_POINTS.map((p) => (
              <div key={p.label} className="bg-red-950/20 border border-red-900/30 p-4 rounded">
                <p className="font-bold text-sm text-foreground mb-1">{p.label}</p>
                <p className="text-[12px] text-muted-foreground">{p.sub}</p>
              </div>
            ))}
          </div>

          {/* Solution Intro */}
          <div className="bg-[#1a4a7a] text-white p-6 rounded-lg mb-10">
            <p className="text-sm font-bold text-blue-200 uppercase tracking-widest mb-2">The Solution</p>
            <h3 className="text-lg font-black mb-3">We do all of it. Your contacts see your name. You do nothing.</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Every week, our AI pulls local market data for your zip codes, writes market commentary, formats a professional branded email, and sends it to every contact you've uploaded. Your clients think you're working around the clock. You're not even opening a laptop.
            </p>
          </div>

          {/* What You Get */}
          <h2 className="text-lg font-black mb-4 uppercase tracking-wide">What You Get Every Week</h2>
          <div className="space-y-3 mb-12">
            {WHAT_YOU_GET.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sample Preview */}
        <div id="preview" className="bg-muted/30 border-y border-border px-6 py-14">
          <div className="max-w-2xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 text-center">Sample Newsletter</p>
            <h2 className="text-xl font-black text-foreground mb-8 text-center">Here's what your contacts will receive</h2>

            {/* Mock Email Card */}
            <div className="bg-white text-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-200">
              {/* Header */}
              <div style={{ background: "#1a4a7a" }} className="p-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-1">Local Market Report</p>
                <h3 className="text-xl font-black text-white">ZIP {MOCK_PREVIEW.zip} Market Update</h3>
                <p className="text-blue-200 text-sm mt-1">Brought to you by <strong className="text-white">Sarah Johnson</strong> · Keller Williams</p>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 divide-x divide-slate-200 bg-white">
                <div className="p-4 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Median Price</p>
                  <p className="text-lg font-black text-slate-800">{MOCK_PREVIEW.medianPrice}</p>
                  <p className="text-[11px] font-semibold text-green-600">{MOCK_PREVIEW.priceChange} YoY</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Days on Market</p>
                  <p className="text-lg font-black text-slate-800">{MOCK_PREVIEW.dom}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Inventory</p>
                  <p className="text-lg font-black text-slate-800">{MOCK_PREVIEW.inventory}</p>
                  <p className="text-[11px] text-slate-500">supply</p>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 border-t border-slate-100">
                <h4 className="font-black text-slate-800 mb-2 text-base">{MOCK_PREVIEW.headline}</h4>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">{MOCK_PREVIEW.marketSnap}</p>

                <div className="border-l-4 border-green-500 bg-green-50 p-3 mb-3 rounded-r">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mb-1">For Buyers</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{MOCK_PREVIEW.buyerNote}</p>
                </div>

                <div className="border-l-4 border-amber-500 bg-amber-50 p-3 mb-3 rounded-r">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1">For Sellers</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{MOCK_PREVIEW.sellerNote}</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Local Insight</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{MOCK_PREVIEW.localInsight}</p>
                </div>

                <div style={{ background: "#1a4a7a" }} className="p-4 rounded text-center">
                  <p className="text-white text-sm font-semibold mb-2">Thinking about making a move? Let's talk — a quick call could save you thousands.</p>
                  <span className="inline-block bg-white text-[#1a4a7a] px-4 py-2 rounded font-bold text-xs">Call Sarah: (313) 555-0192</span>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-4">This is a sample. Your newsletter is branded with your name, colors, and contact info.</p>
          </div>
        </div>

        {/* How It Works */}
        <div className="max-w-3xl mx-auto px-6 py-14">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">How It Works</p>
          <h2 className="text-xl font-black mb-8">Up and running in 5 minutes</h2>
          <div className="space-y-6">
            {[
              { step: "1", icon: <Users size={20} />, title: "Sign up and enter your zip codes", body: "Tell us which markets you serve. One zip or twenty — we cover them all." },
              { step: "2", icon: <Mail size={20} />, title: "Upload your contact list", body: "Paste a CSV or add contacts manually in your dashboard. Clients, past buyers, sphere of influence — everyone." },
              { step: "3", icon: <TrendingUp size={20} />, title: "AI generates and sends every week", body: "Every week, fresh market data, AI-written commentary, branded to you, sent to every contact. You do nothing." },
              { step: "4", icon: <Star size={20} />, title: "Your phone starts ringing", body: "Contacts remember you're the expert. Referrals increase. Listings come to you first." },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-[#1a4a7a] text-white flex items-center justify-center font-black text-sm flex-shrink-0">
                  {item.step}
                </div>
                <div className="pt-1">
                  <h3 className="font-bold text-sm text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing + Signup */}
        <div id="signup" className="bg-[#1a4a7a] text-white px-6 py-16">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-blue-300 text-sm font-bold uppercase tracking-widest mb-2">Pricing</p>
              <div className="flex items-baseline justify-center gap-2 mb-2">
                <span className="text-5xl font-black">$79</span>
                <span className="text-xl text-blue-200">/mo</span>
              </div>
              <p className="text-blue-100 text-sm">Unlimited contacts · Multiple zip codes · Cancel anytime</p>
              <div className="flex flex-wrap gap-3 justify-center mt-4">
                {["Weekly automated sends", "Branded to you", "Multiple zip codes", "Unlimited contacts", "Cancel anytime"].map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 bg-white/10 border border-white/20 px-3 py-1 rounded-full text-xs font-medium">
                    <CheckCircle size={11} className="text-green-400" /> {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Your Name *</label>
                  <input
                    name="customer_name"
                    value={form.customer_name}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 px-4 py-3 text-sm focus:outline-none focus:border-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Agent Name (as it appears on emails) *</label>
                  <input
                    name="agent_name"
                    value={form.agent_name}
                    onChange={handleChange}
                    placeholder="Jane Smith, REALTOR®"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 px-4 py-3 text-sm focus:outline-none focus:border-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Email Address *</label>
                  <input
                    name="customer_email"
                    type="email"
                    value={form.customer_email}
                    onChange={handleChange}
                    placeholder="jane@kwrealty.com"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 px-4 py-3 text-sm focus:outline-none focus:border-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Brokerage</label>
                  <input
                    name="brokerage"
                    value={form.brokerage}
                    onChange={handleChange}
                    placeholder="Keller Williams"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 px-4 py-3 text-sm focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Phone</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="(313) 555-0192"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 px-4 py-3 text-sm focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Website</label>
                  <input
                    name="website"
                    value={form.website}
                    onChange={handleChange}
                    placeholder="https://janesmith.kwrealty.com"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 px-4 py-3 text-sm focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">
                  Zip Codes to Cover * <span className="text-blue-300 font-normal normal-case">(one per line or comma-separated)</span>
                </label>
                <textarea
                  name="zip_codes"
                  value={form.zip_codes}
                  onChange={handleChange as any}
                  placeholder={"48236\n48230\n48215"}
                  rows={3}
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-300 px-4 py-3 text-sm focus:outline-none focus:border-white resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-blue-200 text-xs font-bold uppercase tracking-widest mb-2">Brand Color</label>
                <div className="flex items-center gap-3">
                  <input
                    name="brand_color"
                    type="color"
                    value={form.brand_color}
                    onChange={handleChange}
                    className="w-12 h-10 cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-blue-200 text-sm">{form.brand_color} — used for header and CTA button in newsletters</span>
                </div>
              </div>

              {error && (
                <p className="text-red-300 text-sm bg-red-900/30 border border-red-800/40 px-4 py-3 rounded">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-[#1a4a7a] py-4 font-black text-base hover:bg-blue-50 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-[#1a4a7a] border-t-transparent rounded-full animate-spin" /> Processing...</>
                ) : (
                  <>Start My Newsletter — $79/mo <ChevronRight size={16} /></>
                )}
              </button>

              <p className="text-center text-blue-300 text-xs">Secure checkout via Stripe · Cancel anytime · No contracts</p>
            </form>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto px-6 py-14">
          <h2 className="text-lg font-black mb-6 uppercase tracking-wide">Common Questions</h2>
          <div className="space-y-5">
            {[
              { q: "How accurate is the market data?", a: "We pull from publicly available data sources and supplement with AI-generated commentary calibrated to real seasonal and regional trends. We're transparent with recipients that data is AI-generated — and your name on a professional weekly update builds credibility regardless." },
              { q: "How many contacts can I add?", a: "Unlimited. Your entire sphere — past clients, referral partners, neighbors, leads — everyone. Upload via CSV paste or add manually in your dashboard." },
              { q: "Can I customize the branding?", a: "Yes. You set your brand color during signup. Your agent name, brokerage, phone, and website appear in every email footer and header." },
              { q: "What zip codes can I use?", a: "Any US zip code. Add as many as you serve — each zip gets its own market commentary block in the newsletter." },
              { q: "When do newsletters go out?", a: "Weekly, automatically. No action required from you after setup." },
            ].map((faq) => (
              <div key={faq.q} className="border-b border-border pb-5">
                <p className="font-bold text-sm text-foreground mb-2">{faq.q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
