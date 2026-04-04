import { useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Send, Loader2, Sparkles, X, Bot, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const QUICK_QUERIES = [
  "How many active subscribers do we have?",
  "Which users are at risk of churning?",
  "Show me today's revenue",
  "What coach replies need review?",
  "How many open support tickets?",
  "Run a CMO intelligence report",
  "What are the top exercises this week?",
  "Show pending AI queue items",
];

const AdminAiBar = memo(() => {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleQuery = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setResponse("");
    setError(null);
    setExpanded(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-admin-assist`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ type: "general_query", context: { query: q } }),
        }
      );

      if (!resp.ok) {
        if (resp.status === 429) throw new Error("Rate limited — try again shortly.");
        if (resp.status === 402) throw new Error("AI credits needed — add credits in workspace settings.");
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "AI service error");
      }

      const data = await resp.json();
      setResponse(data.result || "No response generated.");
    } catch (e: any) {
      setError(e.message || "Unknown error");
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div
        className="relative flex items-center gap-2 rounded-2xl px-4 py-3"
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(168,85,247,0.04) 100%)",
          border: "1px solid rgba(249,115,22,0.15)",
        }}
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.15)" }}>
          <Bot size={16} style={{ color: "#f97316" }} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) handleQuery(query.trim()); }}
          onFocus={() => !response && !loading && setExpanded(true)}
          placeholder="Ask Oz anything about your business…"
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none min-w-0"
          disabled={loading}
        />
        {loading ? (
          <Loader2 size={14} className="animate-spin shrink-0 text-primary" />
        ) : (
          <button
            onClick={() => query.trim() && handleQuery(query.trim())}
            disabled={!query.trim()}
            className="w-7 h-7 rounded-full flex items-center justify-center transition active:scale-90 shrink-0 disabled:opacity-30"
            style={{ background: "rgba(249,115,22,0.25)", border: "1px solid rgba(249,115,22,0.4)" }}
          >
            <Send size={11} style={{ color: "#f97316" }} />
          </button>
        )}
      </div>

      {/* Quick Query Chips — shown when expanded and no response */}
      <AnimatePresence>
        {expanded && !response && !loading && !error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5 px-1">
              {QUICK_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); handleQuery(q); }}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg transition active:scale-95 flex items-center gap-1"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#a3a3a3",
                  }}
                >
                  <Zap size={9} style={{ color: "#f97316" }} />
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Response */}
      <AnimatePresence>
        {(loading || response || error) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: error ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(249,115,22,0.15)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              {loading ? (
                <Loader2 size={12} className="animate-spin text-primary" />
              ) : (
                <Sparkles size={12} style={{ color: "#f97316" }} />
              )}
              <span className="text-xs font-bold text-foreground">
                {loading ? "Oz is thinking…" : error ? "Error" : "Oz says"}
              </span>
              {(response || error) && (
                <button
                  onClick={() => { setResponse(""); setError(null); setExpanded(false); }}
                  className="ml-auto p-1 rounded-full hover:bg-muted/30 transition"
                >
                  <X size={12} className="text-muted-foreground" />
                </button>
              )}
            </div>

            {loading && (
              <div className="space-y-2">
                <div className="h-3 rounded-full bg-muted/20 animate-pulse w-3/4" />
                <div className="h-3 rounded-full bg-muted/20 animate-pulse w-1/2" />
              </div>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            {response && (
              <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_p]:text-xs [&_li]:text-xs [&_strong]:text-primary [&_a]:text-cyan-400">
                <ReactMarkdown>{response}</ReactMarkdown>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

AdminAiBar.displayName = "AdminAiBar";
export default AdminAiBar;
