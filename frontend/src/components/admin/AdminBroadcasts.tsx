import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, Upload, Users, FileText, Bot, Sparkles, RotateCcw, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AiAssistButton from "./AiAssistButton";

type Audience = "all_users" | "subscribers" | "trial_users" | "csv";

const AUDIENCE_OPTIONS: { value: Audience; label: string; description: string }[] = [
  { value: "subscribers", label: "Active Subscribers", description: "Newsletter subscribers only" },
  { value: "all_users", label: "All Registered Users", description: "Every user with a profile" },
  { value: "trial_users", label: "Trial Users", description: "Users currently on a free trial" },
  { value: "csv", label: "Upload CSV", description: "Import your own email list" },
];

const AdminBroadcasts = () => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("subscribers");
  const [csvEmails, setCsvEmails] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [sending, setSending] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: counts } = useQuery({
    queryKey: ["broadcast-audience-counts"],
    queryFn: async () => {
      const [subs, users, trials] = await Promise.all([
        supabase.from("newsletter_subscribers").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).not("trial_started_at", "is", null).eq("subscription_tier", "free"),
      ]);
      return {
        subscribers: subs.count ?? 0,
        all_users: users.count ?? 0,
        trial_users: trials.count ?? 0,
      };
    },
  });

  const recipientCount = audience === "csv"
    ? csvEmails.length
    : counts?.[audience] ?? 0;

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const emails = text
        .split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
      const unique = [...new Set(emails)];
      setCsvEmails(unique);
      toast({ title: `${unique.length} emails imported from CSV` });
    };
    reader.readAsText(file);
  };

  const handleGenerate = async () => {
    if (!aiTopic.trim()) return toast({ title: "Enter a topic first", variant: "destructive" });
    setGenerating(true);
    try {
      const res = await supabase.functions.invoke("generate-newsletter", { body: { topic: aiTopic.trim() } });
      if (res.error) throw new Error(res.error.message);
      if (res.data.error) throw new Error(res.data.error);
      setSubject(res.data.subject);
      setBody(res.data.body);
      toast({ title: "Draft generated! 🔥" });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return toast({ title: "Subject and body required", variant: "destructive" });
    if (audience === "csv" && csvEmails.length === 0) return toast({ title: "Upload a CSV first", variant: "destructive" });

    const confirmMsg = `Send this broadcast to ${recipientCount} recipients?`;
    if (!window.confirm(confirmMsg)) return;

    setSending(true);
    try {
      const res = await supabase.functions.invoke("send-newsletter", {
        body: {
          subject,
          body,
          audience,
          csv_emails: audience === "csv" ? csvEmails : undefined,
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (!res.data.success) throw new Error(res.data.error || "Send failed");

      toast({
        title: `Broadcast sent to ${res.data.sent} recipients!`,
        description: res.data.errors ? `${res.data.errors.length} batch(es) had issues` : "All emails delivered.",
      });
      setSubject("");
      setBody("");
      setCsvEmails([]);
      setCsvFileName("");
      setAiTopic("");
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Draft */}
      <div className="bg-card shadow-m2 p-4 border-l-4 border-primary">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={16} className="text-primary" />
          <p className="text-xs font-bold text-foreground uppercase tracking-widest">AI Draft Assist</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">Give a topic and the AI writes a broadcast in your voice.</p>
        <div className="flex gap-2">
          <input
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="e.g. Summer training prep checklist"
            className="flex-1 bg-background border border-border px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => e.key === "Enter" && !generating && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !aiTopic.trim()}
            className="bg-primary text-primary-foreground px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            <Sparkles size={12} />
            {generating ? "Writing..." : "Generate"}
          </button>
        </div>
      </div>

      {/* Audience Selector */}
      <div className="bg-card shadow-m2 p-4">
        <p className="text-xs font-bold text-foreground mb-3 uppercase tracking-widest">Select Audience</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {AUDIENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAudience(opt.value)}
              className={`text-left p-3 transition-m2 border ${
                audience === opt.value
                  ? "bg-primary/10 border-primary/30"
                  : "bg-muted border-transparent hover:border-border"
              }`}
            >
              <Users size={12} className={audience === opt.value ? "text-primary" : "text-muted-foreground"} />
              <p className="text-xs font-bold text-foreground mt-1">{opt.label}</p>
              <p className="text-[10px] text-muted-foreground">{opt.description}</p>
              {opt.value !== "csv" && counts && (
                <p className="text-[10px] text-primary font-mono mt-1">{counts[opt.value]} emails</p>
              )}
            </button>
          ))}
        </div>

        {/* CSV Upload */}
        {audience === "csv" && (
          <div className="mt-3 p-3 bg-muted border border-border">
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" />
            {csvEmails.length === 0 ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 text-xs text-primary hover:text-foreground transition-m2"
              >
                <Upload size={14} />
                Upload CSV or TXT file (one email per line or comma-separated)
              </button>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-foreground">
                  <span className="font-bold text-primary">{csvEmails.length}</span> emails from{" "}
                  <span className="text-muted-foreground">{csvFileName}</span>
                </p>
                <button
                  onClick={() => { setCsvEmails([]); setCsvFileName(""); }}
                  className="text-muted-foreground hover:text-destructive transition-m2"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}
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
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email Body</label>
            <AiAssistButton
              type="newsletter"
              context={{ topic: subject || "training broadcast", audience: audience }}
              onResult={(text) => setBody(text)}
              label="AI Write"
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-64 font-mono leading-relaxed"
            placeholder="Write your broadcast here... Supports **bold** formatting."
          />
          <p className="text-[10px] text-muted-foreground mt-1">Supports **bold** and line breaks</p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Sending to <span className="text-primary font-bold">{recipientCount}</span> recipients
          </p>
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim() || recipientCount === 0}
            className="bg-primary text-primary-foreground px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={12} />
            {sending ? "Sending..." : "Send Blast"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminBroadcasts;
