import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Star, BookOpen, Heart, Moon, Sparkles } from "lucide-react";

const FEATURES = [
  { icon: Moon, title: "Unique Story Every Single Night", desc: "Every bedtime is a brand-new adventure. No repeats, no reruns — 365 original stories per year." },
  { icon: Star, title: "Your Child Is Always the Hero", desc: "Their name, their personality, their world — woven into every chapter. They'll beg for bedtime." },
  { icon: Sparkles, title: "Personalized to Their Interests", desc: "Dinosaurs, space, princesses, dogs — whatever they love becomes the backdrop for tonight's story." },
  { icon: BookOpen, title: "Beautiful Storybook Emails", desc: "Arrives at 7pm every evening, formatted like a real storybook with age-appropriate language and gentle morals." },
  { icon: Heart, title: "Good Values, Gently Woven In", desc: "Every story ends with a quiet lesson — kindness, courage, honesty — delivered naturally through adventure." },
];

export default function BedtimeStories() {
  const [form, setForm] = useState({ parent_email: "", child_name: "", child_age: "", interests: "" });
  const [loading, setLoading] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const success = params.get("success") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.parent_email || !form.child_name || !form.child_age) {
      toast.error("Email, child's name, and age are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-bedtime-story-checkout", {
        body: {
          email: form.parent_email,
          parent_email: form.parent_email,
          child_name: form.child_name,
          child_age: parseInt(form.child_age),
          interests: form.interests.split(",").map(s => s.trim()).filter(Boolean),
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">✨ The Magic Begins Tonight!</h1>
        <p className="text-muted-foreground">
          Your child's first story arrives tonight at 7pm! Check your email for a magical adventure starring <strong>{form.child_name || "your little hero"}</strong>.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Questions? Text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Bedtime Stories — A New Adventure Every Night | $4.99/mo"
        description="AI-generated bedtime stories starring your child, delivered to your inbox every evening at 7pm. Personalized with their name, age, and favorite things. $4.99/mo."
        path="/bedtime-stories"
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border" style={{ background: "linear-gradient(135deg, #1e293b 0%, #2d1b4e 100%)" }}>
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Moon size={11} /> ✨ Bedtime Stories
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5 text-white">
              A New Adventure<br /><span style={{ color: "#e8621a" }}>Every Night.</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-6">
              Your child is the hero of a unique AI-generated bedtime story, delivered to your inbox every evening at 7pm. Personalized with their name, age, and favorite things.
            </p>
            <div className="text-4xl font-black mb-1" style={{ color: "#e8621a" }}>
              $4.99<span className="text-xl text-slate-400 font-normal">/mo</span>
            </div>
            <p className="text-sm text-slate-400 mb-8">Cancel anytime · First story tonight</p>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90"
              style={{ background: "#e8621a" }}
            >
              Start Tonight <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What Makes It Magical</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4 bg-card border border-border p-6">
                  <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(232,98,26,0.1)" }}>
                    <f.icon size={16} style={{ color: "#e8621a" }} />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">{f.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sign Up Form */}
        <section id="signup" className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black mb-2">✨ Start Your Child's Story Tonight</h2>
              <p className="text-muted-foreground text-sm">$4.99/mo · Cancel anytime · First story arrives at 7pm</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Email *</label>
                <input
                  type="email"
                  value={form.parent_email}
                  onChange={e => setForm(p => ({ ...p, parent_email: e.target.value }))}
                  placeholder="parent@example.com"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 outline-none"
                  style={{ "--tw-ring-color": "#e8621a" } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Child's Name *</label>
                <input
                  type="text"
                  value={form.child_name}
                  onChange={e => setForm(p => ({ ...p, child_name: e.target.value }))}
                  placeholder="Emma"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Child's Age * (2–12)</label>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={form.child_age}
                  onChange={e => setForm(p => ({ ...p, child_age: e.target.value }))}
                  placeholder="6"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Favorite Things (comma-separated)</label>
                <input
                  type="text"
                  value={form.interests}
                  onChange={e => setForm(p => ({ ...p, interests: e.target.value }))}
                  placeholder="dinosaurs, space, dogs, princesses"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                style={{ background: "#e8621a" }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {loading ? "Redirecting…" : "Start Tonight — $4.99/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
