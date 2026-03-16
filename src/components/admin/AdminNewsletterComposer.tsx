import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const TEMPLATES = [
  {
    name: "Monthly Training Insight",
    subject: "The Real Deal — [Month] Edition",
    body: `Hey team,\n\nHere's this month's insight from 20+ years of training athletes.\n\n**This Month's Topic: [TOPIC]**\n\n[Write your insight here. Remember — the WHY matters more than the WHAT.]\n\n**The Hard Truth:**\n[One truth bomb your athletes need to hear]\n\n**Quick Tip:**\n[One actionable thing they can do this week]\n\nTrain smart,\nMatt Michels\nM² Training`,
  },
  {
    name: "Injury Prevention Focus",
    subject: "M² Training: How to Prevent [Injury Type]",
    body: `Parents & Athletes,\n\nI've seen this injury hundreds of times. Here's what most people get wrong — and how to fix it.\n\n**The Problem:**\n[Describe the common injury pattern]\n\n**Why It Happens (The Kinesiology):**\n[Explain the WHY — this is what makes your content unique]\n\n**The Fix:**\n[3-4 specific exercises or protocols]\n\n**When to See a Professional:**\n[Clear guidance on when training alone isn't enough]\n\nStay healthy,\nMatt Michels\nM² Training`,
  },
  {
    name: "Sport-Specific Breakdown",
    subject: "The Real Deal: [Sport] Training Secrets",
    body: `Athletes,\n\nEvery sport has movements that matter more than others. Here's what [sport] athletes need to focus on.\n\n**The #1 Exercise Most [Sport] Athletes Skip:**\n[Exercise name and why it matters]\n\n**The Physics Behind It:**\n[Your signature WHY — force angles, muscle chains, etc.]\n\n**Programming It:**\n- Sets: [X]\n- Reps: [X]\n- When: [In-season vs off-season guidance]\n\n**Common Mistakes:**\n[What you see athletes doing wrong]\n\nGet after it,\nMatt Michels\nM² Training`,
  },
  {
    name: "Parent Education",
    subject: "M² Training: What Every Sports Parent Needs to Know",
    body: `Dear Parents,\n\nI've trained thousands of young athletes, and the ones who succeed have one thing in common — parents who understand the process.\n\n**This Month's Parent Lesson:**\n[Topic: rest, nutrition, pressure, early specialization, etc.]\n\n**What the Research Says:**\n[Back it up with facts]\n\n**What You Can Do:**\n[Practical advice for parents]\n\n**What to Avoid:**\n[Common parent mistakes]\n\nYour kid's biggest advantage is a parent who gets it.\n\nMatt Michels\nM² Training`,
  },
];

const AdminNewsletterComposer = () => {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { data: activeCount = 0 } = useQuery({
    queryKey: ["admin-subscriber-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("newsletter_subscribers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setSubject(template.subject);
    setBody(template.body);
    setSelectedTemplate(template.name);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      return toast({ title: "Subject and body required", variant: "destructive" });
    }

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("send-newsletter", {
        body: { subject, body, template_name: selectedTemplate },
      });

      if (res.error) throw new Error(res.error.message || "Failed to send");

      const result = res.data;
      if (!result.success) throw new Error(result.error || "Send failed");

      toast({
        title: `Newsletter sent to ${result.sent} subscribers!`,
        description: result.errors ? `${result.errors.length} batch(es) had issues` : "All emails delivered successfully.",
      });
      setSubject("");
      setBody("");
      setSelectedTemplate(null);
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Template picker */}
      <div className="bg-card shadow-m2 p-4">
        <p className="text-xs font-bold text-foreground mb-3">Quick Templates</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => applyTemplate(t)}
              className={`text-left p-3 transition-m2 ${
                selectedTemplate === t.name
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-muted hover:bg-m2-surface-hover border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText size={12} className="text-primary" />
                <span className="text-xs font-bold text-foreground">{t.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{t.subject}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="bg-card shadow-m2 p-4 space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Subject Line</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
            placeholder="The Real Deal — March Edition"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Newsletter Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-64 font-mono leading-relaxed"
            placeholder="Write your newsletter here..."
          />
          <p className="text-[10px] text-muted-foreground mt-1">Supports **bold** and basic formatting</p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Will send to <span className="text-primary font-bold">{activeCount}</span> active subscribers
          </p>
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
            className="bg-primary text-primary-foreground px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={12} />
            {sending ? "Sending..." : "Send Newsletter"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminNewsletterComposer;
