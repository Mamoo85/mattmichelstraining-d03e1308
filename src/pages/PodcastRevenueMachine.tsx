import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { Mic, FileText, Linkedin, Mail, Youtube, Twitter, ArrowRight, CheckCircle, Zap, Clock, DollarSign } from "lucide-react";

const CONTENT_TYPES = [
  {
    icon: FileText,
    title: "Blog Post",
    desc: "600–900 word SEO-optimized article with proper headings, ready to publish to your site or Medium.",
    color: "#FF6B35",
  },
  {
    icon: Linkedin,
    title: "LinkedIn Post",
    desc: "150–200 word professional post with a scroll-stopping hook and engagement question.",
    color: "#0A66C2",
  },
  {
    icon: Mail,
    title: "Email Newsletter",
    desc: "300–400 word conversational email with subject line included. Hit send to your list in seconds.",
    color: "#FF6B35",
  },
  {
    icon: Youtube,
    title: "YouTube Description",
    desc: "200–300 word optimized description with hook, timestamps section, and hashtags.",
    color: "#FF0000",
  },
  {
    icon: Twitter,
    title: "Twitter / X Thread",
    desc: "5–7 numbered tweets under 280 chars each. Starts with a bold claim. Built to go viral.",
    color: "#1DA1F2",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Connect Your RSS Feed",
    desc: "Paste your podcast RSS URL during signup. Works with every major platform — Spotify, Apple Podcasts, Buzzsprout, Anchor, Transistor.",
  },
  {
    num: "02",
    title: "We Detect New Episodes",
    desc: "Our system checks your feed every 6 hours. The moment a new episode goes live, we start generating.",
  },
  {
    num: "03",
    title: "Full Content Pack in Your Inbox",
    desc: "Within hours, you receive all 5 pieces — copy-paste ready. No editing needed. Just publish.",
  },
];

export default function PodcastRevenueMachine() {
  const [form, setForm] = useState({
    podcast_name: "",
    rss_feed_url: "",
    podcast_niche: "",
    target_audience: "",
    tone: "professional",
    customer_name: "",
    customer_email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_email || !form.rss_feed_url) {
      setError("Email and RSS feed URL are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/functions/v1/create-podcast-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Failed to create checkout session.");
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <SEOHead
        title="Podcast-to-Revenue Machine — Turn Every Episode Into a Full Week of Content"
        description="Connect your RSS feed. Every time you publish a new podcast episode, Claude automatically generates a blog post, LinkedIn post, email newsletter, YouTube description, and Twitter thread. $199/mo."
      />
      <div className="min-h-screen bg-[#0d0d1a] text-white">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#0d0d1a] via-[#1a1a2e] to-[#0d0d1a] px-6 py-20 text-center">
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.12) 0%, transparent 70%)"
          }} />
          <div className="relative max-w-3xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#FF6B35] mb-4">M² Development · AI Content Automation</p>
            <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-6">
              Turn Every Episode Into a<br />
              <span className="text-[#FF6B35]">Full Week of Content</span> — Automatically
            </h1>
            <p className="text-slate-300 text-lg max-w-xl mx-auto leading-relaxed mb-10">
              Connect your RSS feed. Every new episode triggers 5 ready-to-publish pieces: blog post, LinkedIn, email newsletter, YouTube description, and a Twitter thread. In your inbox within hours.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-4">
              <a href="#signup" className="bg-[#FF6B35] text-white px-8 py-4 font-bold text-base rounded-sm hover:bg-[#e85d2a] transition-colors inline-flex items-center gap-2">
                Start Repurposing Free for 14 Days <ArrowRight size={18} />
              </a>
            </div>
            <p className="text-slate-500 text-sm">14-day free trial · $199/mo after · Cancel anytime</p>
          </div>
        </section>

        {/* ── Pain Point ────────────────────────────────────────────────────── */}
        <section className="bg-[#1a1a2e] border-y border-[#2d2d4e] px-6 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <Mic className="w-10 h-10 text-[#FF6B35] mx-auto mb-6 opacity-80" />
            <h2 className="text-2xl font-black mb-4 text-white">You spend hours recording.<br />Then nothing gets repurposed.</h2>
            <p className="text-slate-400 text-base leading-relaxed max-w-2xl mx-auto">
              Your episode is out. The audio goes on Spotify. Maybe Apple Podcasts. And then it just… sits there. No blog post. No LinkedIn. No email to your list. No YouTube traffic. All that work, and 90% of your potential reach never happens because repurposing is a grind you don't have time for.
            </p>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {[
                { icon: Clock, label: "2–4 hours", sub: "to repurpose one episode manually" },
                { icon: DollarSign, label: "$2,000–4,000/mo", sub: "to hire a content repurposer" },
                { icon: Zap, label: "Hours after publish", sub: "when we do it automatically" },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="bg-[#0d0d1a] border border-[#2d2d4e] p-5 rounded-md">
                  <Icon size={20} className="text-[#FF6B35] mb-3" />
                  <p className="font-bold text-white text-lg">{label}</p>
                  <p className="text-slate-500 text-sm">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── What You Get ──────────────────────────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[#FF6B35] text-xs font-bold uppercase tracking-widest mb-3">What You Get</p>
              <h2 className="text-3xl font-black">5 content pieces, every episode.</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {CONTENT_TYPES.map(({ icon: Icon, title, desc, color }) => (
                <div key={title} className="bg-[#1a1a2e] border border-[#2d2d4e] p-6 rounded-md hover:border-[#FF6B35]/50 transition-colors">
                  <Icon size={28} style={{ color }} className="mb-4" />
                  <h3 className="font-bold text-white text-base mb-2">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
              {/* CTA card */}
              <div className="bg-gradient-to-br from-[#FF6B35]/20 to-[#FF6B35]/5 border border-[#FF6B35]/40 p-6 rounded-md flex flex-col justify-center">
                <p className="font-black text-white text-xl mb-2">$199/mo</p>
                <p className="text-[#FF6B35] text-sm mb-4 font-medium">vs. $2,000–4,000 for a human repurposer</p>
                <a href="#signup" className="text-sm font-bold text-white bg-[#FF6B35] px-4 py-2 rounded-sm hover:bg-[#e85d2a] transition-colors inline-block text-center">
                  Get Started →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────────────── */}
        <section className="bg-[#1a1a2e] border-y border-[#2d2d4e] px-6 py-20">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[#FF6B35] text-xs font-bold uppercase tracking-widest mb-3">How It Works</p>
              <h2 className="text-3xl font-black">Set it once. Content forever.</h2>
            </div>
            <div className="space-y-8">
              {STEPS.map((step) => (
                <div key={step.num} className="flex gap-6 items-start">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#FF6B35]/20 border border-[#FF6B35]/40 flex items-center justify-center">
                    <span className="text-[#FF6B35] font-black text-sm">{step.num}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base mb-1">{step.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Social Proof / Value ──────────────────────────────────────────── */}
        <section className="px-6 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                "Works with any podcast platform — Buzzsprout, Transistor, Anchor, Libsyn, Podbean, and more",
                "Claude AI generates unique, niche-specific content — not generic boilerplate",
                "Your podcast niche and audience tone guide every piece of content",
                "All 5 pieces arrive in one clean email — copy, paste, publish",
                "Runs automatically, 24/7. No login required after setup.",
                "14-day free trial. Cancel anytime. No contracts.",
              ].map((point) => (
                <div key={point} className="flex items-start gap-3 bg-[#1a1a2e] border border-[#2d2d4e] p-4 rounded-md">
                  <CheckCircle size={16} className="text-[#FF6B35] flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300 text-sm leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <section className="bg-[#1a1a2e] border-y border-[#2d2d4e] px-6 py-20 text-center">
          <div className="max-w-lg mx-auto">
            <p className="text-[#FF6B35] text-xs font-bold uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl font-black mb-8">Simple, flat pricing.</h2>
            <div className="bg-[#0d0d1a] border-2 border-[#FF6B35] rounded-lg p-8 mb-6">
              <p className="text-5xl font-black text-white mb-2">$199<span className="text-xl font-normal text-slate-400">/mo</span></p>
              <p className="text-slate-400 mb-6 text-sm">Unlimited episodes · 5 content pieces each · Automatic delivery</p>
              <div className="space-y-3 text-left mb-8">
                {["Blog post (600–900 words, SEO-optimized)", "LinkedIn post (150–200 words)", "Email newsletter (with subject line)", "YouTube description (with timestamps)", "Twitter/X thread (5–7 tweets)"].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle size={15} className="text-[#FF6B35] flex-shrink-0" />
                    <span className="text-slate-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
              <a href="#signup" className="block w-full bg-[#FF6B35] text-white text-center font-bold py-3 rounded-sm hover:bg-[#e85d2a] transition-colors">
                Start Free 14-Day Trial
              </a>
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
              <span className="line-through">Hiring a repurposer: $2,000–4,000/mo</span>
              <span className="text-[#FF6B35] font-bold">M²: $199/mo</span>
            </div>
          </div>
        </section>

        {/* ── Signup Form ───────────────────────────────────────────────────── */}
        <section id="signup" className="px-6 py-20">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-10">
              <p className="text-[#FF6B35] text-xs font-bold uppercase tracking-widest mb-3">Get Started</p>
              <h2 className="text-3xl font-black mb-3">Start Repurposing Free for 14 Days</h2>
              <p className="text-slate-400 text-sm">No credit card charged today. $199/mo after trial.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Your Name</label>
                <input
                  name="customer_name"
                  value={form.customer_name}
                  onChange={handleChange}
                  placeholder="Jane Smith"
                  className="w-full bg-[#1a1a2e] border border-[#2d2d4e] text-white placeholder:text-slate-600 px-4 py-3 rounded-sm focus:outline-none focus:border-[#FF6B35] text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Email Address <span className="text-[#FF6B35]">*</span></label>
                <input
                  name="customer_email"
                  type="email"
                  required
                  value={form.customer_email}
                  onChange={handleChange}
                  placeholder="jane@yourpodcast.com"
                  className="w-full bg-[#1a1a2e] border border-[#2d2d4e] text-white placeholder:text-slate-600 px-4 py-3 rounded-sm focus:outline-none focus:border-[#FF6B35] text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Podcast Name</label>
                <input
                  name="podcast_name"
                  value={form.podcast_name}
                  onChange={handleChange}
                  placeholder="The Growth Podcast"
                  className="w-full bg-[#1a1a2e] border border-[#2d2d4e] text-white placeholder:text-slate-600 px-4 py-3 rounded-sm focus:outline-none focus:border-[#FF6B35] text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">RSS Feed URL <span className="text-[#FF6B35]">*</span></label>
                <input
                  name="rss_feed_url"
                  type="url"
                  required
                  value={form.rss_feed_url}
                  onChange={handleChange}
                  placeholder="https://feeds.buzzsprout.com/..."
                  className="w-full bg-[#1a1a2e] border border-[#2d2d4e] text-white placeholder:text-slate-600 px-4 py-3 rounded-sm focus:outline-none focus:border-[#FF6B35] text-sm"
                />
                <p className="text-slate-500 text-xs mt-1">
                  Find it: Spotify → Your Show → Edit → Distribution. Apple: Podcast Connect → RSS feed URL.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Podcast Niche</label>
                <input
                  name="podcast_niche"
                  value={form.podcast_niche}
                  onChange={handleChange}
                  placeholder="e.g. B2B sales, fitness, real estate investing"
                  className="w-full bg-[#1a1a2e] border border-[#2d2d4e] text-white placeholder:text-slate-600 px-4 py-3 rounded-sm focus:outline-none focus:border-[#FF6B35] text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Target Audience</label>
                <input
                  name="target_audience"
                  value={form.target_audience}
                  onChange={handleChange}
                  placeholder="e.g. small business owners, sales reps, coaches"
                  className="w-full bg-[#1a1a2e] border border-[#2d2d4e] text-white placeholder:text-slate-600 px-4 py-3 rounded-sm focus:outline-none focus:border-[#FF6B35] text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Content Tone</label>
                <select
                  name="tone"
                  value={form.tone}
                  onChange={handleChange}
                  className="w-full bg-[#1a1a2e] border border-[#2d2d4e] text-white px-4 py-3 rounded-sm focus:outline-none focus:border-[#FF6B35] text-sm"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="educational">Educational</option>
                  <option value="inspirational">Inspirational</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-700/40 text-red-400 text-sm px-4 py-3 rounded-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF6B35] text-white font-bold py-4 rounded-sm hover:bg-[#e85d2a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Connecting to Stripe…
                  </span>
                ) : (
                  <>Start Repurposing Free for 14 Days <ArrowRight size={18} /></>
                )}
              </button>

              <p className="text-center text-slate-500 text-xs">
                Secure checkout via Stripe · 14-day free trial · Cancel anytime
              </p>
            </form>
          </div>
        </section>

        {/* ── Footer signature ─────────────────────────────────────────────── */}
        <div className="border-t border-[#2d2d4e] px-6 py-8">
          <div className="max-w-3xl mx-auto flex items-center gap-4">
            <img
              src="/images/matt-boat.jpg"
              alt="Matt Michels"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
            <div>
              <p className="text-white font-bold text-sm">Matt Michels</p>
              <p className="text-slate-500 text-xs">Grosse Pointe, MI · <a href="tel:+13138064952" className="text-[#FF6B35]">(313) 806-4952</a> · M² Development</p>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
