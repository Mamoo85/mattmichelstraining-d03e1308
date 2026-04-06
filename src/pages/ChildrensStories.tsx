import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, BookOpen, Heart, Star, Zap, Smile, Mail } from "lucide-react";

const FEATURES = [
  { icon: BookOpen, title: "4 Original Stories Per Month", desc: "A brand new bedtime story delivered every week — written specifically for your child, with their name woven into the adventure." },
  { icon: Heart, title: "Personalized to Your Child", desc: "Tell us their favorite animals, interests, and heroes. Every story features characters and settings they actually care about." },
  { icon: Star, title: "Age-Appropriate Language", desc: "Stories calibrated to your child's age — simple vocabulary for toddlers, richer language and longer plots for older kids." },
  { icon: Smile, title: "Positive Values Built In", desc: "Every story ends with a natural lesson — kindness, courage, curiosity, honesty — woven into the plot, never preachy." },
  { icon: Mail, title: "Delivered to Your Inbox", desc: "Every Sunday evening, a new story arrives ready to read at bedtime. Print it, read from your phone, or save it forever." },
  { icon: Zap, title: "Seasonal & Special Stories", desc: "Holiday stories, birthday adventures, and milestone moments — AI writes stories tied to what's happening in your family's life." },
];

export default function ChildrensStories() {
  const [form, setForm] = useState({ email: "", name: "", child_name: "", child_age: "", story_themes: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.child_name) { toast.error("Email and child's name are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-childrens-story-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-500" /></div>
        <h1 className="text-2xl font-black text-foreground mb-3">First story coming Sunday!</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">Your child's first personalized bedtime story arrives this Sunday evening. Check your inbox at bedtime.</p>
        <p className="mt-6 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Children's Story Subscription — $9.99/mo | M2 Training" description="4 original, personalized bedtime stories per month — featuring your child's name and favorite themes. New story every Sunday. $9.99/mo." path="/childrens-stories" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <BookOpen size={11} /> Personalized Bedtime Stories
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Bedtime Stories Where<br /><span className="text-primary">Your Kid Is the Hero.</span></h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">Every child deserves stories written just for them. AI writes original bedtime adventures featuring your child's name, favorite animals, and the things they love most — delivered fresh every week.</p>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="text-4xl font-black text-primary">$9.99<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">4 stories/month · Fully personalized · Cancel anytime</p>
            </div>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity">
              Start Their Adventure <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0"><f.icon size={16} className="text-primary" /></div>
                  <div><p className="font-bold text-sm mb-1">{f.title}</p><p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="signup" className="py-16 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Their Story</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">First story arrives this Sunday. $9.99/mo — less than a picture book.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "child_name", label: "Child's Name *", placeholder: "Emma" },
                { key: "child_age", label: "Child's Age *", placeholder: "5" },
                { key: "story_themes", label: "Favorite Things (animals, interests, etc.)", placeholder: "Dragons, space, dinosaurs, horses..." },
                { key: "name", label: "Parent Name *", placeholder: "John Smith" },
                { key: "email", label: "Email Address *", placeholder: "john@email.com", type: "email" },
                { key: "phone", label: "Phone Number", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded transition-opacity">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                {loading ? "Redirecting…" : "Start Stories — $9.99/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
