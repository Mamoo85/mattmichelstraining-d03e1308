import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Loader2, FileCheck, Send } from "lucide-react";

interface QbrRow {
  id: string;
  client_email: string;
  client_name: string | null;
  product: string;
  quarter: string;
  pdf_url: string | null;
  status: string;
  metrics: any;
  created_at: string;
}

export default function DwaAdminQbrQueue() {
  const [rows, setRows] = useState<QbrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("qbr_queue" as any)
      .select("*")
      .in("status", ["pending_review", "approved"])
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as any) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approveAndSend(row: QbrRow) {
    setBusy(row.id);
    try {
      const { error } = await supabase
        .from("qbr_queue" as any)
        .update({
          status: "sent",
          approved_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function generateNow() {
    setBusy("generate");
    try {
      const { error } = await supabase.functions.invoke("dwa-v4-qbr-generator", { body: {} });
      if (error) throw error;
      await load();
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SEOHead title="QBR Queue — DWA Admin" description="Quarterly business reviews awaiting review." />
      <main className="min-h-screen bg-background text-foreground p-6 md:p-10 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">QBR Queue</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Review & approve quarterly business reports before sending.
            </p>
          </div>
          <button
            onClick={generateNow}
            disabled={busy === "generate"}
            className="bg-cyan-500 text-slate-900 font-bold text-sm px-4 py-2 rounded-lg hover:bg-cyan-400 disabled:opacity-50 flex items-center gap-2"
          >
            {busy === "generate" && <Loader2 className="w-4 h-4 animate-spin" />}
            Generate this quarter
          </button>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No QBRs in queue. Click "Generate this quarter" to build them.</p>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <article key={r.id} className="border border-border bg-card rounded-lg p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-bold truncate">{r.client_name ?? r.client_email}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{r.product}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs font-mono text-cyan-400">{r.quarter}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{r.client_email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.pdf_url && (
                      <a
                        href={r.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted"
                      >
                        Preview PDF
                      </a>
                    )}
                    <button
                      onClick={() => approveAndSend(r)}
                      disabled={busy === r.id}
                      className="bg-emerald-500 text-slate-900 font-bold text-xs px-3 py-1.5 rounded-md hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3" />
                      {busy === r.id ? "…" : "Approve & send"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
