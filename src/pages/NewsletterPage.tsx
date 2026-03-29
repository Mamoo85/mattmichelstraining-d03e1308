import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Send, Mail } from "lucide-react";

const SAMPLE_TOPICS = [
  "Cold call openers that actually work in medical sales",
  "The 5-minute pre-call research routine",
  "How to handle 'send me an email' brushoffs",
  "LinkedIn outreach for industrial reps",
  "Getting past the gatekeeper — dental & medical",
  "Territory planning: how top reps build their week",
  "Voicemail scripts that get callbacks",
  "Re-engaging dead leads the right way",
];

export default function NewsletterPage() {
  const [form, setForm] = useState({ email: "", name: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email) { toast.error("Email is required"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("newsletter_subscribers" as any)
        .upsert({ email: form.email, name: form.name || null, active: true, source: "website" }, { onConflict: "email" });
      if (error) throw error;
      setDone(true);
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're in.</h1>
          <p className="text-muted-foreground leading-relaxed">Every Monday, a short prospecting tip, a word-for-word script, and one tool tip lands in your inbox. No fluff. Unsubscribe any time.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="The Field Rep Weekly — Free Newsletter for B2B Sales Reps"
        description="Weekly prospecting tips, scripts, and tool spotlights for medical device, dental, and industrial field reps. Free. Every Monday."
      />
      <div className="min-h-screen bg-background text-foreground">
        <div className="bg-[#1e293b] text-white px-6 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">Free Weekly Newsletter</p>
          <h1 className="text-3xl font-black mb-4">The Field Rep Weekly</h1>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            Prospecting tactics, word-for-word scripts, and tool tips for B2B field reps — medical device, dental equipment, industrial, and more. Every Monday. Under 3 minutes to read.
          </p>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* What's inside */}
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">What's inside every issue</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
            {[
              { title: "Tip of the Week", sub: "One specific, actionable tactic. No theory — just what works in the field." },
              { title: "Script of the Week", sub: "Word-for-word. Cold calls, voicemails, LinkedIn messages, brushoff responses." },
              { title: "Tool Spotlight", sub: "One specific tip for Apollo, Sales Navigator, Hunter, or another rep tool you're already using." },
            ].map(item => (
              <div key={item.title} className="bg-card border border-border p-4">
                <p className="font-black text-sm text-foreground mb-1.5">{item.title}</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{item.sub}</p>
              </div>
            ))}
          </div>

          {/* Upcoming topics */}
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Upcoming topics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-10">
            {SAMPLE_TOPICS.map(topic => (
              <div key={topic} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle size={13} className="text-primary flex-shrink-0" /> {topic}
              </div>
            ))}
          </div>

          {/* Author bio */}
          <div className="bg-card border border-border p-5 mb-10 flex items-start gap-4">
            <img
              src="/images/matt-boat.jpg"
              alt="Matt Michels"
              className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0"
            />
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">Written by Matt Michels — coach, dad, Grosse Pointe, MI.</span> I started this newsletter because reps kept asking me how to find more leads without blowing their budget on expensive tools.
            </p>
          </div>

          {/* Signup */}
          <div className="bg-card border border-border p-6">
            <h2 className="text-base font-black text-foreground mb-1">Get it free — every Monday</h2>
            <p className="text-[12px] text-muted-foreground mb-5">No spam. Unsubscribe any time. Takes 10 seconds to sign up.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder="Your first name (optional)"
                className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
              />
              <input
                type="email" required
                value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                placeholder="Your work or personal email"
                className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
              />
              <button type="submit" disabled={submitting}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submitting ? "Subscribing…" : "Subscribe Free →"}
              </button>
            </form>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-6">
            Written by Matt Michels — former competitive athlete, now helping reps get better at the prospecting side of the job.<br />
            Questions? <a href="mailto:matt@m2training.com" className="text-primary">matt@m2training.com</a> · <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
          </p>
        </div>
      </div>
    </>
  );
}
