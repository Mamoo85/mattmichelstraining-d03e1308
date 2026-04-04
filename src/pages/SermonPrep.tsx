import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, BookOpen, Calendar, Send, Lightbulb, Users, Star } from "lucide-react";

const FEATURES = [
  {
    icon: Calendar,
    title: "Delivered Every Monday Morning",
    desc: "By 6am Monday, a complete sermon outline is in your inbox. Three-point structure, scripture references, opening hook, and closing call to action — organized and ready.",
  },
  {
    icon: BookOpen,
    title: "Full 3-Point Outline with Scripture Commentary",
    desc: "Each point includes the key text, cross-references, original language notes, and a short commentary paragraph. You still preach — the research is done.",
  },
  {
    icon: Lightbulb,
    title: "2-3 Sermon Illustrations Per Week",
    desc: "Real stories, cultural observations, and historical examples that connect your text to modern life. Each illustration is ready to use or adapt as you see fit.",
  },
  {
    icon: Users,
    title: "Small Group Application Questions",
    desc: "5 discussion questions per week for Sunday school, life groups, or home groups. Pull right from your bulletin or email to your group leaders.",
  },
  {
    icon: Send,
    title: "Children's Message Summary",
    desc: "A one-page, age-appropriate version of the week's sermon theme for kids church or children's moments. Same truth, vocabulary that lands with 4-10 year olds.",
  },
  {
    icon: Star,
    title: "Tuned to Your Denomination",
    desc: "Calvinist? Arminian? Liturgical? Contemporary? You tell us your tradition and theological distinctives at signup. Every outline respects your framework.",
  },
];

const COMPARISON = [
  { tool: "Logos Bible Software", price: "$30–100/mo", what: "Data and commentaries only — you still do all the writing" },
  { tool: "SermonCentral Pro", price: "$50/mo", what: "Other pastors' sermons — generic, not written for you" },
  { tool: "Pastoral study assistant", price: "$800+/mo", what: "Human, part-time, vacation time, turnover" },
  { tool: "M2 Sermon Prep", price: "$79/mo", what: "Your complete outline, illustrations, questions — every Monday", highlight: true },
];

export default function SermonPrep() {
  const [form, setForm] = useState({ email: "", name: "", churchName: "", phone: "", denomination: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.churchName) {
      toast.error("Email and church name are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-sermon-prep-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">Welcome aboard.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Matt will reach out within 24 hours to confirm your theological tradition and preferred lectionary or topical approach. Your first outline arrives next Monday morning.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Questions? Call or text{" "}
          <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="AI Sermon Prep — Complete Outline Delivered Every Monday | $79/mo"
        description="Full sermon outline with scripture commentary, illustrations, small group questions, and children's message — delivered every Monday morning. $79/mo, 14-day free trial."
        path="/sermon-prep"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <BookOpen size={11} /> Sermon Prep
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Your Complete Sermon Outline,<br />
              <span className="text-primary">Every Monday Morning.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              You weren't called to spend 15 hours a week in front of a blank document. AI delivers a full sermon outline — research, illustrations, small group questions, and a children's message — so you can focus on prayer, people, and delivery.
            </p>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="text-4xl font-black text-primary">
                $79<span className="text-xl text-muted-foreground font-normal">/mo</span>
              </div>
              <p className="text-sm text-muted-foreground">14-day free trial · Cancel anytime · No contracts</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start Free Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Pain Bridge */}
        <section className="py-14 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-lg text-muted-foreground leading-relaxed">
              Research shows the average pastor spends{" "}
              <span className="text-foreground font-bold">10-15 hours per week</span>{" "}
              on sermon preparation. That's time that could go to hospital visits, counseling, discipleship, and being present with your congregation.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What's in Every Monday Outline</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <f.icon size={16} className="text-primary" />
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

        {/* Comparison */}
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-2 uppercase tracking-tight">Compare Your Options</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Other tools give you data. We give you the finished work.</p>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div
                  key={c.tool}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    c.highlight ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex-1 pr-4">
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground">{c.what}</p>
                  </div>
                  <div className={`text-sm font-black whitespace-nowrap ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>
                    {c.price}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Signup */}
        <section id="signup" className="py-16 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your 14-Day Free Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">
              No charge today. First outline arrives next Monday. Cancel anytime.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "churchName", label: "Church Name *", placeholder: "Grace Community Church" },
                { key: "name", label: "Your Name *", placeholder: "Pastor John Smith" },
                { key: "email", label: "Email Address *", placeholder: "john@gracechurch.com", type: "email" },
                { key: "phone", label: "Phone Number", placeholder: "(313) 555-0100", type: "tel" },
                { key: "denomination", label: "Denomination / Tradition", placeholder: "e.g. Baptist, Methodist, Non-denominational" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                    {f.label}
                  </label>
                  <input
                    type={f.type || "text"}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $79/mo After"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-1">14-day free trial. No card charged today.</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
