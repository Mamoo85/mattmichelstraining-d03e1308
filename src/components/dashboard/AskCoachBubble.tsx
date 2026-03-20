import { useState, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

type Draft = { id: string; question: string; ai_answer: string; admin_edit: string | null; created_at: string };

const AskCoachBubble = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [answers, setAnswers] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("coach_ai_drafts")
      .select("id, question, ai_answer, admin_edit, created_at")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setAnswers((data as Draft[]) || []);
        setLoading(false);
      });
  }, [open, user]);

  const handleSend = async () => {
    if (!input.trim() || sending || !user) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-coach`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ message: input.trim() }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send");
      }
      toast({ title: "Question sent!", description: "Coach Matt will review and respond. You'll be notified." });
      setInput("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-all"
          aria-label="Ask Coach Matt"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[340px] sm:w-[380px] max-h-[520px] bg-card border border-border shadow-xl flex flex-col rounded-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest">Ask Coach Matt</p>
              <p className="text-[9px] opacity-70">Reviewed by Coach Matt</p>
            </div>
            <button onClick={() => setOpen(false)} className="hover:opacity-70">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[340px]">
            {loading && (
              <div className="flex justify-center py-6">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && answers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No answers yet. Ask Coach Matt a question below!
              </p>
            )}
            {answers.map((a) => (
              <div key={a.id} className="space-y-1.5">
                <div className="bg-muted px-3 py-2 text-xs text-foreground">
                  <span className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">You asked</span>
                  {a.question}
                </div>
                <div className="bg-primary/5 border-l-2 border-primary px-3 py-2 text-xs text-foreground">
                  <span className="font-bold text-[10px] uppercase tracking-widest text-primary block mb-1">Coach Matt</span>
                  <div className="prose prose-xs max-w-none">
                    <ReactMarkdown>{a.admin_edit || a.ai_answer}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-border p-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Ask about training, recovery..."
              className="flex-1 bg-muted px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="bg-primary text-primary-foreground px-3 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-[8px] text-muted-foreground text-center pb-1.5">
            Every answer reviewed by Coach Matt before delivery
          </p>
        </div>
      )}
    </>
  );
};

export default AskCoachBubble;
