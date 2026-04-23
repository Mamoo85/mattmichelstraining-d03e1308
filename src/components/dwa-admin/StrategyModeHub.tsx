import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Template = {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  audit_checklist: string;
  created_at: string;
};

type PromptMode = {
  key: "plan" | "default" | "chat";
  label: string;
  emoji: string;
  desc: string;
  color: string;
};

const PROMPT_MODES: PromptMode[] = [
  {
    key: "plan",
    label: "Plan Mode",
    emoji: "🧠",
    desc: "Think only — no file edits. Outputs plans, audits, and proposals.",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  {
    key: "default",
    label: "Default Mode",
    emoji: "⚡",
    desc: "Build mode — make code changes after brief discussion.",
    color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  },
  {
    key: "chat",
    label: "Chat Mode",
    emoji: "💬",
    desc: "Conversation only — explain, discuss, no edits or planning artifacts.",
    color: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  },
];

const MODE_STORAGE_KEY = "dwa-prompt-mode";

export default function StrategyModeHub() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [auditChecklist, setAuditChecklist] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // briefing
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingMd, setBriefingMd] = useState<string>("");

  // mode toggle
  const [mode, setMode] = useState<PromptMode["key"]>(() => {
    if (typeof window === "undefined") return "default";
    return (localStorage.getItem(MODE_STORAGE_KEY) as PromptMode["key"]) || "default";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  const activeMode = PROMPT_MODES.find((m) => m.key === mode)!;

  async function loadTemplates() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("strategy_mode_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setTemplates((data as Template[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setSystemPrompt("");
    setAuditChecklist("");
  }

  async function saveTemplate() {
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error("Name and system prompt are required");
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      system_prompt: systemPrompt.trim(),
      audit_checklist: auditChecklist.trim(),
      updated_at: new Date().toISOString(),
    };
    if (editingId) {
      const { error } = await (supabase as any)
        .from("strategy_mode_templates")
        .update(payload)
        .eq("id", editingId);
      if (error) return toast.error(error.message);
      toast.success("Template updated");
    } else {
      const { error } = await (supabase as any).from("strategy_mode_templates").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Template saved");
    }
    resetForm();
    loadTemplates();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    const { error } = await (supabase as any).from("strategy_mode_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    loadTemplates();
  }

  function loadIntoForm(t: Template) {
    setEditingId(t.id);
    setName(t.name);
    setDescription(t.description || "");
    setSystemPrompt(t.system_prompt);
    setAuditChecklist(t.audit_checklist);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function copyTemplate(t: Template) {
    const text = `[STRATEGY MODE: ${t.name}]\n\n${t.system_prompt}\n\nAudit checklist:\n${t.audit_checklist}`;
    navigator.clipboard.writeText(text);
    toast.success(`Copied "${t.name}" to clipboard`);
  }

  async function generateBriefing() {
    setBriefingLoading(true);
    setBriefingMd("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-business-briefing", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBriefingMd(data.markdown || "");
      toast.success("Briefing generated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate briefing");
    } finally {
      setBriefingLoading(false);
    }
  }

  function copyBriefingMd() {
    navigator.clipboard.writeText(briefingMd);
    toast.success("Markdown copied");
  }

  function downloadBriefingPdf() {
    // Print-to-PDF via new window — works as browser PDF save
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Popup blocked — allow popups to download PDF");
      return;
    }
    const html = `<!DOCTYPE html><html><head><title>DWA Business Briefing</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; max-width: 780px; margin: 40px auto; padding: 0 24px; color: #111; line-height: 1.55; }
  h1 { color: #0a1628; border-bottom: 3px solid #00d4ff; padding-bottom: 8px; margin-top: 32px; }
  h2 { color: #0a1628; margin-top: 28px; }
  h3 { color: #1e293b; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  pre { background: #f1f5f9; padding: 12px; border-radius: 6px; overflow-x: auto; }
  blockquote { border-left: 4px solid #00d4ff; padding-left: 12px; color: #475569; margin-left: 0; }
  hr { border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
  th { background: #f8fafc; }
  .header { color: #64748b; font-size: 13px; margin-bottom: 24px; }
</style></head><body>
<div class="header">Detroit Web Agency · Business Briefing · Generated ${new Date().toLocaleString()}</div>
${markdownToHtml(briefingMd)}
<script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
</body></html>`;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Mode toggle */}
      <Card className="bg-[#0f1f3a] border-white/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-lg">Prompt Mode</h2>
          <Badge className={`${activeMode.color} border`}>
            {activeMode.emoji} {activeMode.label} active
          </Badge>
        </div>
        <p className="text-white/60 text-sm mb-4">
          Visual reminder of how you want me to behave on your next message. Toggle, then write your prompt.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PROMPT_MODES.map((m) => {
            const active = m.key === mode;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`text-left rounded-lg border p-3 transition ${
                  active
                    ? `${m.color} border-current`
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                }`}
              >
                <div className="font-bold text-sm mb-1">
                  {m.emoji} {m.label}
                </div>
                <div className="text-xs opacity-80">{m.desc}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Briefing packet */}
      <Card className="bg-[#0f1f3a] border-white/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white font-bold text-lg">Gemini Deep Think Briefing Packet</h2>
            <p className="text-white/60 text-sm">
              Pulls live DB stats + CLAUDE.md context, generates the 8-section structure via Gemini 2.5 Pro.
            </p>
          </div>
          <Button
            onClick={generateBriefing}
            disabled={briefingLoading}
            className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/90 font-bold"
          >
            {briefingLoading ? "Generating…" : "🚀 Generate Briefing"}
          </Button>
        </div>

        {briefingMd && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button onClick={copyBriefingMd} variant="outline" className="border-white/20 text-white">
                📋 Copy Markdown
              </Button>
              <Button onClick={downloadBriefingPdf} variant="outline" className="border-white/20 text-white">
                📄 Download PDF
              </Button>
            </div>
            <pre className="bg-black/40 border border-white/10 rounded p-4 text-white/80 text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">
              {briefingMd}
            </pre>
          </div>
        )}
      </Card>

      {/* Template editor */}
      <Card className="bg-[#0f1f3a] border-white/10 p-5">
        <h2 className="text-white font-bold text-lg mb-1">
          {editingId ? "Edit Strategy Template" : "Save New Strategy Template"}
        </h2>
        <p className="text-white/60 text-sm mb-4">
          Save the prompting guidelines + audit checklist that worked best. Reuse on future research requests.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-white/80 text-sm block mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Revenue Audit Mode"
              className="bg-black/30 border-white/20 text-white"
            />
          </div>
          <div>
            <label className="text-white/80 text-sm block mb-1">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When to use this template…"
              className="bg-black/30 border-white/20 text-white"
            />
          </div>
          <div>
            <label className="text-white/80 text-sm block mb-1">System Prompt / Guidelines</label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder="You are a senior strategy analyst… focus on…"
              className="bg-black/30 border-white/20 text-white font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-white/80 text-sm block mb-1">Audit Checklist</label>
            <Textarea
              value={auditChecklist}
              onChange={(e) => setAuditChecklist(e.target.value)}
              rows={5}
              placeholder="- Check every claim against live DB&#10;- Flag assumptions explicitly&#10;- Cite source files when referencing code"
              className="bg-black/30 border-white/20 text-white font-mono text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveTemplate} className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/90 font-bold">
              {editingId ? "Update" : "Save"} Template
            </Button>
            {editingId && (
              <Button onClick={resetForm} variant="outline" className="border-white/20 text-white">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Template library */}
      <Card className="bg-[#0f1f3a] border-white/10 p-5">
        <h2 className="text-white font-bold text-lg mb-3">
          Strategy Template Library {templates.length > 0 && <span className="text-white/40 text-sm">({templates.length})</span>}
        </h2>
        {loading ? (
          <div className="text-white/40 text-sm">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="text-white/40 text-sm">No templates yet — save your first one above.</div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <div key={t.id} className="bg-black/30 border border-white/10 rounded p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-white font-bold">{t.name}</div>
                    {t.description && <div className="text-white/60 text-sm">{t.description}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => copyTemplate(t)} className="border-white/20 text-white text-xs h-7">
                      📋 Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => loadIntoForm(t)} className="border-white/20 text-white text-xs h-7">
                      ✏️ Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteTemplate(t.id)} className="border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs h-7">
                      🗑️
                    </Button>
                  </div>
                </div>
                <details className="text-white/70 text-xs">
                  <summary className="cursor-pointer text-white/50 hover:text-white/80">View prompt + checklist</summary>
                  <pre className="whitespace-pre-wrap mt-2 bg-black/40 p-2 rounded">{t.system_prompt}</pre>
                  {t.audit_checklist && (
                    <pre className="whitespace-pre-wrap mt-2 bg-black/40 p-2 rounded">{t.audit_checklist}</pre>
                  )}
                </details>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Minimal markdown → HTML for the PDF (headings, bold, italic, lists, code, hr)
function markdownToHtml(md: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  for (const raw of lines) {
    const line = raw;
    if (line.trim().startsWith("```")) {
      if (inCode) { out.push("</pre>"); inCode = false; }
      else { out.push("<pre>"); inCode = true; }
      continue;
    }
    if (inCode) { out.push(escapeHtml(line)); continue; }
    if (/^---+$/.test(line.trim())) { out.push("<hr/>"); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (inList) { out.push("</ul>"); inList = false; }
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(escapeHtml(h[2]))}</h${lvl}>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(escapeHtml(line.replace(/^\s*[-*]\s+/, "")))}</li>`);
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    if (line.trim() === "") { out.push(""); continue; }
    out.push(`<p>${inline(escapeHtml(line))}</p>`);
  }
  if (inList) out.push("</ul>");
  if (inCode) out.push("</pre>");
  return out.join("\n");

  function inline(s: string) {
    return s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }
}
