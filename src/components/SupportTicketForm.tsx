import { useState } from "react";
import { LifeBuoy, Send, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = [
  "Billing / Subscription Issue",
  "Account Access Problem",
  "Program or Workout Issue",
  "Technical Bug",
  "Other",
];

const SupportTicketForm = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!body.trim() || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("support_tickets" as any).insert({
        user_id: user.id,
        subject: subject || "General Support",
        body: body.trim(),
      });
      if (error) throw error;
      setSubmitted(true);
      setBody("");
      setSubject("");
      toast({ title: "Support ticket submitted", description: "We'll review it and get back to you shortly." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-card border border-border p-5 mt-4">
      <button
        onClick={() => { setOpen(!open); setSubmitted(false); }}
        className="w-full flex items-center gap-3 group"
      >
        <div className="w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
          <LifeBuoy size={18} className="text-primary" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-[11px] font-bold uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">
            Help & Support
          </span>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Billing issue? Wrong plan? Submit a ticket and we'll fix it.
          </p>
        </div>
        <Send size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </button>

      {open && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {submitted ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <CheckCircle size={28} className="text-primary" />
              <p className="text-sm font-bold text-foreground">Ticket Received</p>
              <p className="text-[11px] text-muted-foreground text-center">
                Coach Matt will review your issue and respond within 24 hours.
              </p>
              <button
                onClick={() => { setSubmitted(false); setOpen(false); }}
                className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                  Category
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="">Select a category…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                  Describe Your Issue
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="e.g., I meant to buy Foundation for my son but accidentally purchased Basic…"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground resize-none placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!body.trim() || sending}
                className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {sending ? "Submitting…" : "Submit Ticket"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SupportTicketForm;
