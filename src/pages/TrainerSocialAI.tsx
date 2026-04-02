import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Dumbbell, Calendar, Users } from "lucide-react";

const PLATFORM_OPTIONS = ["Facebook", "Instagram", "LinkedIn"];

const FEATURES = [
  { icon: Dumbbell, label: "Fitness & nutrition content", sub: "Posts crafted around your specialty — strength, cardio, nutrition, mindset" },
  { icon: Calendar, label: "3 posts per week", sub: "Consistent presence without pulling you away from coaching" },
  { icon: Users, label: "Your brand voice", sub: "AI learns your style and writes like you, not a template" },
  { icon: CheckCircle, label: "Direct publishing", sub: "Posts go live automatically — no Buffer, no Hootsuite, no effort" },
];

export default function TrainerSocialAI() {
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [form, setForm] = useState({
    business_name: "",
    name: "",
    email: "",
    phone: "",
    city: "",
    state: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're in.</h1>
          <p className="text-muted-foreground leading-relaxed">Matt will reach out within 24 hours to connect your social accounts and start generating content in your voice.</p>
          <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.business_name) {
      toast.error("Your name/gym name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-social-media-checkout", {
        body: {
          ...form,
          business_type: "fitness trainer / gym",
          plan: "trainer",
          platforms,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Social Media AI for Fitness Trainers — $59.25/mo Launch Special | M² Trainer Social"
        description="Your gym stays active online — even when you're busy coaching. AI writes and posts fitness content to your social channels 3x a week. Launch special: $59.25/mo for first 3 months (normally $79)."
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M² Trainer Social AI</p>
          <h1 className="text-3xl font-black mb-4 leading-tight">
            Your gym stays active online —<br />even when you're busy coaching.
          </h1>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            AI generates fitness and nutrition content in your brand voice and posts to your social channels 3x per week. Built for trainers and coaches who are too busy training clients to manage social media.
          </p>
          <div className="mt-6 inline-block bg-primary/20 border border-primary/40 px-4 py-2 rounded">
            <span className="text-white/60 text-sm line-through mr-2">$79</span>
            <span className="text-green-400 font-black text-xl">$59.25</span>
            <span className="text-slate-300 text-sm">/mo for first 3 months</span>
          </div>
          <p className="text-green-400/80 text-xs mt-2 font-medium">🚀 Launch Special — 25% off</p>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
            {FEATURES.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="bg-card border border-border p-5">
                <Icon size={20} className="text-primary mb-3" />
                <p className="font-bold text-sm text-foreground mb-1">{label}</p>
                <p className="text-[12px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          {/* Signup form */}
          <div className="bg-card border border-border p-6 mb-10">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-1">Get Started — <span className="line-through text-muted-foreground">$79</span> <span className="text-green-500">$59.25/mo</span></h2>
            <p className="text-[12px] text-muted-foreground mb-5">25% off your first 3 months. No contracts. Cancel anytime.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Gym / Business Name *</label>
                  <input
                    required
                    value={form.business_name}
                    onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                    placeholder="Peak Performance Training"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Alex Johnson"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@yourgym.com"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(313) 555-0100"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">City</label>
                  <input
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Detroit, Ann Arbor…"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">State</label>
                  <input
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    placeholder="MI"
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Platform checkboxes */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Platforms to post on</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={`px-3 py-1.5 text-xs font-bold border transition-all ${
                        platforms.includes(p)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {platforms.includes(p) && <CheckCircle size={10} className="inline mr-1" />}
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {submitting ? "Processing…" : "Start Posting — $149/mo →"}
              </button>
            </form>
          </div>

          {/* Founder credibility */}
          <div className="bg-card border border-border p-5 mb-10 flex items-start gap-4">
            <img
              src="/images/matt-family-summer.jpg"
              alt="Matt Michels"
              className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0"
            />
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">I'm Matt Michels — personal trainer, Grosse Pointe, MI.</span>{" "}
              I built this for other fitness coaches who kept asking me to manage their social media. Now AI does it — I just review the results.
            </p>
          </div>

          <p className="text-[12px] text-muted-foreground text-center">
            Questions? Email{" "}
            <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a>{" "}
            or text{" "}
            <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
          </p>
        </div>
      </div>
    </>
  );
}
