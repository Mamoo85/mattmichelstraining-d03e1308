import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Heart, Moon, Activity, ArrowRight, Loader2 } from "lucide-react";

const PAIN_POINTS = [
  {
    icon: Activity,
    title: "Your Body Takes a Beating",
    desc: "Back pain, knee pain, swollen feet — 65% of nurses report a musculoskeletal injury within 5 years. Training the right way builds the resilience to stay in the game.",
  },
  {
    icon: Moon,
    title: "You Work When the World Sleeps",
    desc: "Night shifts, rotating schedules, 12-hour stretches. We build programs around YOUR schedule — 20-minute sessions that work at 6am, 6pm, or 3am after a shift.",
  },
  {
    icon: Heart,
    title: "You Give Everything to Patients",
    desc: "Caregiver fatigue is real. Exercise is the #1 evidence-based intervention for compassion fatigue and burnout. Not a luxury — a survival tool.",
  },
];

const WHAT_YOU_GET = [
  "Workouts designed for 20–30 minutes — before, during, or after a shift",
  "Back and knee protection built into every program",
  "Night-shift recovery protocols (sleep, nutrition, stress)",
  "Progressive programming that fits your unpredictable schedule",
  "Mobile app access — train anywhere, track everything",
  "Direct coaching from Matt — a real person, not an algorithm",
];

const STATS = [
  { stat: "65%", label: "of nurses report musculoskeletal injuries" },
  { stat: "2x", label: "burnout rate for night shift nurses vs day shift" },
  { stat: "40%", label: "less compassion fatigue in nurses who exercise regularly" },
  { stat: "12 hrs", label: "average shift — your body deserves a plan built for that" },
];

const TESTIMONIALS = [
  {
    quote: "I finally have a program that fits my night shifts. Matt made it work around my schedule, not the other way around. My back hasn't felt this good in years.",
    name: "Sarah M.",
    role: "ICU RN, 8 years",
  },
  {
    quote: "I thought I was too exhausted to work out after a 12-hour shift. Turns out I just needed the right 20-minute program. Three months in and I feel completely different.",
    name: "Tanya J.",
    role: "ER Nurse, Detroit Medical Center",
  },
  {
    quote: "The knee pain that was making me consider leaving nursing is gone. The hip and glute work Matt programmed fixed what years of physical therapy couldn't.",
    name: "Maria L.",
    role: "Floor Nurse, 11 years",
  },
];

const SHIFT_OPTIONS = ["Day shift (7am–7pm)", "Night shift (7pm–7am)", "Rotating shifts", "Part-time / per diem"];

export default function ForNurses() {
  const [form, setForm] = useState({ name: "", email: "", shift: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) { toast.error("Name and email are required"); return; }
    setLoading(true);
    try {
      await supabase.from("newsletter_subscribers" as any).upsert(
        { email: form.email, name: form.name, niche: "nurses", tags: ["nurse", form.shift].filter(Boolean) },
        { onConflict: "email" }
      );
      setDone(true);
    } catch {
      toast.error("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center px-4">
        <div className="max-w-md text-center text-white">
          <div className="w-20 h-20 rounded-full bg-[#e8621a]/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-[#e8621a]" />
          </div>
          <h1 className="text-2xl font-black mb-3">You're In!</h1>
          <p className="text-slate-400 leading-relaxed mb-6">
            Matt will reach out personally within 24 hours with your customized nurse fitness plan. Keep an eye on your inbox.
          </p>
          <a href="/" className="text-[#e8621a] font-bold text-sm hover:underline">← Back to M2 Training</a>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Fitness Programs for Nurses | M2 Training — Metro Detroit"
        description="Workout plans built for 12-hour shifts, night work, and the physical demands of nursing. Quick, effective, designed for your schedule. Personal coaching from Matt Michels."
        path="/for-nurses"
      />
      <div className="min-h-screen bg-[#0a1628] text-white">

        {/* Nav */}
        <nav className="px-6 py-4 flex items-center justify-between border-b border-white/10">
          <a href="/" className="text-[#e8621a] font-black text-lg tracking-wide">M2 TRAINING</a>
          <a href="/for-nurses#get-started" className="bg-[#e8621a] text-white px-5 py-2 text-sm font-bold rounded hover:opacity-90 transition-opacity">
            Get My Plan →
          </a>
        </nav>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-[#e8621a]/15 border border-[#e8621a]/30 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-widest text-[#e8621a] uppercase mb-8">
            <Heart size={10} /> Built for Healthcare Workers
          </div>
          <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-6">
            Built for the<br />
            <span className="text-[#e8621a]">12-Hour Shift.</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Training designed around your schedule, your body, and the brutal physical demands of nursing.
            Not a generic gym plan. A program that actually fits your life.
          </p>
          <button
            onClick={() => document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" })}
            className="bg-[#e8621a] text-white px-10 py-4 font-bold text-base rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            Get My Nurse Fitness Plan <ArrowRight size={16} />
          </button>
          <p className="text-slate-600 text-xs mt-4">Free consultation · No credit card required</p>
        </section>

        {/* Stats */}
        <section className="bg-[#0d2137] border-y border-white/5 py-12 px-6">
          <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.stat}>
                <div className="text-3xl font-black text-[#e8621a] mb-1">{s.stat}</div>
                <div className="text-xs text-slate-400 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Pain Points */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-black text-center mb-12">
            We Built This Because<br />
            <span className="text-[#e8621a]">Generic Programs Don't Work for You</span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {PAIN_POINTS.map((p) => (
              <div key={p.title} className="bg-[#0d2137] border border-white/5 rounded-xl p-6">
                <div className="w-12 h-12 bg-[#e8621a]/15 rounded-xl flex items-center justify-center mb-4">
                  <p.icon size={22} className="text-[#e8621a]" />
                </div>
                <h3 className="font-bold text-base mb-2">{p.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What You Get */}
        <section className="bg-[#0d2137] border-y border-white/5 py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-10">What Your Program Includes</h2>
            <div className="space-y-3">
              {WHAT_YOU_GET.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle size={16} className="text-[#e8621a] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-black text-center mb-10">Nurses Who Finally Found a Program That Works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-[#0d2137] border border-white/5 rounded-xl p-5">
                <div className="text-[#f59e0b] text-sm mb-3 tracking-wider">★★★★★</div>
                <blockquote className="text-sm italic text-slate-300 leading-relaxed mb-4">"{t.quote}"</blockquote>
                <div>
                  <p className="text-xs font-bold text-white">{t.name}</p>
                  <p className="text-[11px] text-slate-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Form */}
        <section id="get-started" className="bg-[#0d2137] border-t border-white/5 py-16 px-6">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Get Your Nurse Fitness Plan</h2>
            <p className="text-center text-slate-400 text-sm mb-8">
              Tell Matt your schedule. He'll build a program around it — personally.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Your Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="First name"
                    required
                    className="w-full bg-[#0a1628] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 rounded focus:outline-none focus:border-[#e8621a]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Your Shift</label>
                  <select
                    value={form.shift}
                    onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}
                    className="w-full bg-[#0a1628] border border-white/10 px-3 py-2.5 text-sm text-white rounded focus:outline-none focus:border-[#e8621a]"
                  >
                    <option value="">Select shift</option>
                    {SHIFT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@email.com"
                  required
                  className="w-full bg-[#0a1628] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 rounded focus:outline-none focus:border-[#e8621a]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Phone (optional)</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(313) 000-0000"
                  className="w-full bg-[#0a1628] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 rounded focus:outline-none focus:border-[#e8621a]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#e8621a] hover:opacity-90 text-white font-bold py-3.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {loading ? "Submitting..." : "Get My Nurse Fitness Plan →"}
              </button>
              <p className="text-[10px] text-slate-600 text-center">
                No spam. Matt responds personally within 24 hours.
              </p>
            </form>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-8 px-6 text-center">
          <p className="text-slate-600 text-xs">
            <a href="/" className="text-[#e8621a] font-bold hover:underline">M2 Training</a>
            {" "}· Grosse Pointe, MI · <a href="https://mattmichelstraining.com" className="text-slate-500 hover:text-slate-400">mattmichelstraining.com</a>
          </p>
        </footer>
      </div>
    </>
  );
}
