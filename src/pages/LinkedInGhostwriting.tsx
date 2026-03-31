import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Linkedin, Send } from "lucide-react";

const SAMPLE_POSTS = [
  {
    day: "Monday",
    content: "Most B2B sales reps spend 4+ hours a week researching prospects.\n\nHere's how I cut that down to 30 minutes:\n\n→ Use Apollo.io to find company decision-makers\n→ Check LinkedIn Sales Navigator for recent job changes\n→ Set up Google Alerts for target accounts\n\nTime saved = more selling time.\n\nWhat's your biggest time-waster in prospecting?",
  },
  {
    day: "Wednesday",
    content: "Cold calling isn't dead.\n\nBut your approach might be.\n\n3 things that changed my cold call success rate from 2% to 18%:\n\n1. Call between 8-9am or 4-5pm (decision-makers are at their desk)\n2. Lead with a question, not a pitch\n3. Use their first name 3 times in the first minute\n\nPeople buy from people they remember.\n\nWhat's your best cold calling tip?",
  },
  {
    day: "Friday",
    content: "I lost a $50K deal last month.\n\nNot because our product wasn't the best.\nNot because of price.\n\nBecause I didn't ask the right questions.\n\nThe prospect went with a competitor who uncovered a need I missed entirely.\n\nLesson learned: Discovery calls matter more than demos.\n\nNow I spend 2x as long on discovery.\n\nHave you ever lost a deal and learned something valuable?",
  },
];

export default function LinkedInGhostwriting() {
  const [signupForm, setSignupForm] = useState({
    email: "",
    name: "",
    industry: "",
    topics: "",
    tone: "professional",
  });
  const [signingUp, setSigningUp] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!signupForm.email || !signupForm.name) {
      toast.error("Name and email are required");
      return;
    }
    setSigningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-linkedin-ghostwriting-checkout", {
        body: signupForm,
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setSigningUp(false);
    }
  }

  return (
    <>
      <SEOHead
        title="LinkedIn Ghostwriting Service — $299/month | M² Content"
        description="Get 5 professional LinkedIn posts written every week. AI-powered, your voice, zero effort."
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-14 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Linkedin size={16} className="text-primary" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">M² Development</p>
          </div>
          <h1 className="text-3xl font-black mb-4">
            5 LinkedIn posts per week.<br />Written in your voice.<br />Delivered every Monday.
          </h1>
          <p className="text-slate-300 max-w-xl mx-auto text-sm leading-relaxed">
            You're too busy to post on LinkedIn — but you know you should. We write 5 posts every week based on your industry, topics, and tone. Copy, paste, post. Done.
          </p>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* How it works */}
          <div className="mb-10">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">How It Works</h2>
            <div className="space-y-4">
              {[
                { num: "1", title: "Quick Onboarding", desc: "Answer 10 questions about your industry, tone, and topics (takes 3 minutes)" },
                { num: "2", title: "We Write", desc: "AI generates 5 unique posts every week — Monday through Friday" },
                { num: "3", title: "You Post", desc: "Get all 5 posts delivered via email Monday morning. Copy, paste, done." },
                { num: "4", title: "Feedback Loop", desc: "Reply with edits or feedback — we learn your voice over time" },
              ].map(step => (
                <div key={step.num} className="flex gap-4 items-start">
                  <div className="bg-primary text-white w-8 h-8 flex items-center justify-center font-black text-sm flex-shrink-0">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sample posts */}
          <div className="mb-10">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Sample Week</h2>
            <div className="space-y-4">
              {SAMPLE_POSTS.map(post => (
                <div key={post.day} className="bg-card border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Send size={12} className="text-primary" />
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{post.day}</p>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{post.content}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">Posts customized to your industry, voice, and topics.</p>
          </div>

          {/* What you get */}
          <div className="mb-10">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">What's Included</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                "5 posts per week (Mon-Fri)",
                "Delivered every Monday morning",
                "Your industry, your voice",
                "No editing required (but you can)",
                "Engagement hooks built-in",
                "Story-driven content",
                "Cancel anytime",
                "Feedback loop — we learn your style",
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle size={14} className="text-primary flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Pricing + Signup */}
          <div className="bg-card border border-border p-6">
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-base font-black text-foreground uppercase tracking-wide">Start Posting</h2>
              <div className="text-right">
                <p className="text-2xl font-black text-primary">$299</p>
                <p className="text-[11px] text-muted-foreground">per month · cancel anytime</p>
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-3">
              <input
                required
                value={signupForm.name}
                onChange={e => setSignupForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
                className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
              />
              <input
                type="email"
                required
                value={signupForm.email}
                onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Your email"
                className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
              />
              <input
                required
                value={signupForm.industry}
                onChange={e => setSignupForm(f => ({ ...f, industry: e.target.value }))}
                placeholder="Your industry (e.g., B2B SaaS sales, manufacturing, real estate)"
                className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
              />
              <textarea
                value={signupForm.topics}
                onChange={e => setSignupForm(f => ({ ...f, topics: e.target.value }))}
                placeholder="Topics you want to post about (optional — we'll suggest based on your industry)"
                rows={3}
                className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none resize-none"
              />
              <select
                value={signupForm.tone}
                onChange={e => setSignupForm(f => ({ ...f, tone: e.target.value }))}
                className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="professional">Professional (LinkedIn default)</option>
                <option value="casual">Casual (friendly, conversational)</option>
                <option value="thought_leader">Thought Leader (educational, insightful)</option>
                <option value="motivational">Motivational (inspiring, uplifting)</option>
              </select>

              <button
                type="submit"
                disabled={signingUp}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {signingUp ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {signingUp ? "Processing…" : "Subscribe — $299/month →"}
              </button>
            </form>

            <p className="text-[11px] text-muted-foreground text-center mt-3">
              Questions? <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a> or text{" "}
              <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
            </p>
          </div>

          {/* FAQ */}
          <div className="mt-10">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">FAQ</h2>
            <div className="space-y-3">
              {[
                { q: "Do you post for me?", a: "No — we email you the posts. You copy/paste into LinkedIn. This avoids API access issues and keeps control in your hands." },
                { q: "Can I edit the posts?", a: "Absolutely. Use them as-is or tweak to your liking. Reply with feedback and we'll adjust future posts." },
                { q: "What if I don't like a post?", a: "Skip it. You get 5 per week — use what fits, ignore what doesn't." },
                { q: "How long until I see results?", a: "Most clients see engagement pick up after 2-3 weeks of consistent posting." },
              ].map(faq => (
                <div key={faq.q} className="bg-card border border-border p-4">
                  <p className="font-bold text-sm text-foreground mb-1">{faq.q}</p>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
