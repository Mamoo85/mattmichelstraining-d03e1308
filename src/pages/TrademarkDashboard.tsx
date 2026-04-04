import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/layout/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Plus, Filter, ExternalLink, AlertTriangle } from "lucide-react";

type RecFilter = "all" | "oppose" | "monitor";

interface Mark {
  id: string;
  mark_text: string;
  goods_services: string | null;
  nice_classes: string | null;
  registration_number: string | null;
  last_scanned_at: string | null;
  created_at: string;
}

interface Finding {
  id: string;
  mark_id: string;
  serial_number: string;
  applicant_name: string | null;
  mark_text: string | null;
  goods_services: string | null;
  filing_date: string | null;
  similarity_score: number | null;
  recommendation: string | null;
  ai_analysis: string | null;
  reported_at: string | null;
  created_at: string;
}

interface Client {
  id: string;
  company_name: string | null;
  customer_email: string;
  customer_name: string | null;
  subscription_status: string;
  marks_count: number;
}

function recBadgeClass(rec: string | null): string {
  if (rec === "oppose") return "bg-red-100 text-red-800 border-red-300";
  if (rec === "monitor") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (rec === "ignore") return "bg-green-100 text-green-800 border-green-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 70) return "text-red-600 font-black";
  if (score >= 40) return "text-yellow-600 font-black";
  return "text-green-600 font-black";
}

function recLabel(rec: string | null): string {
  if (!rec) return "UNKNOWN";
  return rec.toUpperCase();
}

export default function TrademarkDashboard() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<RecFilter>("all");
  const [showAddMark, setShowAddMark] = useState(false);
  const [newMark, setNewMark] = useState({ mark_text: "", goods_services: "", nice_classes: "" });
  const [addingMark, setAddingMark] = useState(false);
  const [addError, setAddError] = useState("");
  const [activeMark, setActiveMark] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["trademark-dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: clients } = await (supabase.from as any)("trademark_watch_clients")
        .select("id, company_name, customer_email, customer_name, subscription_status, marks_count")
        .eq("user_id", user!.id)
        .limit(1);

      if (!clients || clients.length === 0) return { client: null, marks: [], findings: [] };

      const client: Client = clients[0];

      const { data: marks } = await (supabase.from as any)("trademark_watch_marks")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      const markIds = (marks || []).map((m: Mark) => m.id);

      let findings: Finding[] = [];
      if (markIds.length > 0) {
        const { data: f } = await (supabase.from as any)("trademark_watch_findings")
          .select("*")
          .in("mark_id", markIds)
          .order("similarity_score", { ascending: false });
        findings = f || [];
      }

      return { client, marks: (marks || []) as Mark[], findings };
    },
  });

  const selectedMarkId = activeMark || data?.marks?.[0]?.id || null;

  const filteredFindings = (data?.findings || []).filter((f: Finding) => {
    if (f.mark_id !== selectedMarkId) return false;
    if (filter === "all") return true;
    return f.recommendation === filter;
  });

  const selectedMark = data?.marks?.find((m: Mark) => m.id === selectedMarkId);

  const opposeCount = (data?.findings || []).filter(
    (f: Finding) => f.mark_id === selectedMarkId && f.recommendation === "oppose"
  ).length;

  const handleAddMark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMark.mark_text || !data?.client) return;
    setAddError("");
    setAddingMark(true);
    try {
      const { error: insertErr } = await (supabase.from as any)("trademark_watch_marks").insert({
        client_id: data.client.id,
        mark_text: newMark.mark_text.trim(),
        goods_services: newMark.goods_services || null,
        nice_classes: newMark.nice_classes || null,
      });
      if (insertErr) throw insertErr;
      setNewMark({ mark_text: "", goods_services: "", nice_classes: "" });
      setShowAddMark(false);
      refetch();
    } catch (err: any) {
      setAddError(err?.message || "Failed to add mark.");
    } finally {
      setAddingMark(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive text-sm">Error loading dashboard. Please refresh.</p>
      </div>
    );
  }

  if (!data?.client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <Shield size={40} className="mx-auto mb-4 text-[#0f2547]" />
          <h2 className="text-xl font-black mb-2">No Trademark Watch Subscription</h2>
          <p className="text-muted-foreground text-sm mb-6">
            You don't have an active Trademark Watch subscription tied to this account.
          </p>
          <a
            href="/trademark-watch"
            className="bg-[#0f2547] text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-[#1a3a6e] transition-all inline-block"
          >
            Start Watching Your Mark — $49/mo
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Trademark Watch Dashboard | M2 Development"
        description="Monitor your trademarks for potential conflicts. View findings, scores, and recommendations."
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Header */}
        <div className="bg-[#0f2547] text-white px-6 py-8">
          <div className="max-w-5xl mx-auto flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#c9a227] mb-1">Trademark Watch</p>
              <h1 className="text-2xl font-black">{data.client.company_name || data.client.customer_name || "Your Marks"}</h1>
              <p className="text-slate-400 text-sm mt-1">{data.client.customer_email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${data.client.subscription_status === "active" ? "bg-green-900/40 text-green-300 border-green-700" : "bg-red-900/40 text-red-300 border-red-700"}`}>
                {data.client.subscription_status.toUpperCase()}
              </span>
              <button
                onClick={() => setShowAddMark(!showAddMark)}
                className="flex items-center gap-2 bg-[#c9a227] hover:bg-[#b8911f] text-[#0f2547] px-4 py-2 rounded-lg font-bold text-sm transition-all"
              >
                <Plus size={14} /> Add Mark
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Add Mark Form */}
          {showAddMark && (
            <div className="bg-[#0f2547]/5 border border-[#0f2547]/20 rounded-xl p-6 mb-8">
              <h3 className="font-black text-base mb-4 text-foreground">Add a New Mark to Watch</h3>
              <form onSubmit={handleAddMark} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Trademark Text *</label>
                    <input
                      type="text"
                      value={newMark.mark_text}
                      onChange={(e) => setNewMark((p) => ({ ...p, mark_text: e.target.value }))}
                      placeholder="BRAND NAME"
                      required
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#0f2547]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Goods & Services</label>
                    <input
                      type="text"
                      value={newMark.goods_services}
                      onChange={(e) => setNewMark((p) => ({ ...p, goods_services: e.target.value }))}
                      placeholder="e.g., software, clothing"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#0f2547]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Nice Class</label>
                    <input
                      type="text"
                      value={newMark.nice_classes}
                      onChange={(e) => setNewMark((p) => ({ ...p, nice_classes: e.target.value }))}
                      placeholder="e.g., Class 42"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#0f2547]"
                    />
                  </div>
                </div>
                {addError && <p className="text-red-500 text-xs">{addError}</p>}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={addingMark}
                    className="bg-[#0f2547] text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-[#1a3a6e] transition-all disabled:opacity-50"
                  >
                    {addingMark ? "Adding..." : "Add Mark"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddMark(false)}
                    className="text-muted-foreground text-sm hover:text-foreground transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {data.marks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Shield size={40} className="mx-auto mb-4 opacity-30" />
              <p className="font-bold mb-1">No marks added yet</p>
              <p className="text-sm">Click "Add Mark" to start monitoring your first trademark.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

              {/* Marks sidebar */}
              <div className="lg:col-span-1">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Your Marks</h2>
                <div className="space-y-2">
                  {data.marks.map((m: Mark) => {
                    const markFindings = data.findings.filter((f: Finding) => f.mark_id === m.id);
                    const markOppose = markFindings.filter((f: Finding) => f.recommendation === "oppose").length;
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setActiveMark(m.id); setFilter("all"); }}
                        className={`w-full text-left p-4 rounded-lg border transition-all ${
                          selectedMarkId === m.id
                            ? "bg-[#0f2547] text-white border-[#0f2547]"
                            : "bg-background border-border hover:border-[#0f2547]/40"
                        }`}
                      >
                        <p className={`font-black text-sm ${selectedMarkId === m.id ? "text-white" : "text-foreground"}`}>
                          {m.mark_text}
                        </p>
                        <p className={`text-xs mt-1 ${selectedMarkId === m.id ? "text-slate-300" : "text-muted-foreground"}`}>
                          {markFindings.length} finding{markFindings.length !== 1 ? "s" : ""}
                          {markOppose > 0 && (
                            <span className="ml-2 text-red-400 font-bold">{markOppose} oppose</span>
                          )}
                        </p>
                        {m.last_scanned_at && (
                          <p className={`text-[10px] mt-1 ${selectedMarkId === m.id ? "text-slate-400" : "text-muted-foreground/60"}`}>
                            Scanned {new Date(m.last_scanned_at).toLocaleDateString()}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Findings panel */}
              <div className="lg:col-span-3">
                {selectedMark && (
                  <>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                      <div>
                        <h2 className="font-black text-lg text-foreground">{selectedMark.mark_text}</h2>
                        {selectedMark.goods_services && (
                          <p className="text-muted-foreground text-xs">{selectedMark.goods_services}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {opposeCount > 0 && (
                          <div className="flex items-center gap-1 bg-red-100 text-red-700 border border-red-300 px-3 py-1 rounded-full text-xs font-bold">
                            <AlertTriangle size={11} /> {opposeCount} opposition alert{opposeCount > 1 ? "s" : ""}
                          </div>
                        )}
                        <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
                          {(["all", "oppose", "monitor"] as RecFilter[]).map((f) => (
                            <button
                              key={f}
                              onClick={() => setFilter(f)}
                              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold transition-all ${
                                filter === f ? "bg-[#0f2547] text-white" : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <Filter size={10} />
                              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {filteredFindings.length === 0 ? (
                      <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground">
                        <Shield size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="font-bold text-sm mb-1">
                          {filter === "all" ? "No findings yet" : `No "${filter}" findings`}
                        </p>
                        <p className="text-xs">
                          {filter === "all"
                            ? "Your mark hasn't been scanned yet, or no conflicts were found."
                            : `Try switching to "All" to see all findings.`}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredFindings.map((f: Finding) => (
                          <div
                            key={f.id}
                            className={`border rounded-xl p-5 ${
                              f.recommendation === "oppose"
                                ? "border-red-200 bg-red-50 dark:bg-red-950/10 dark:border-red-900/30"
                                : f.recommendation === "monitor"
                                ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/10 dark:border-yellow-900/30"
                                : "border-green-200 bg-green-50 dark:bg-green-950/10 dark:border-green-900/30"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                              <div>
                                <p className="font-black text-base text-foreground">{f.mark_text || "—"}</p>
                                <p className="text-sm text-muted-foreground">{f.applicant_name || "Unknown applicant"}</p>
                                <p className="text-xs text-muted-foreground/70 mt-0.5">Serial: {f.serial_number}</p>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-center">
                                  <p className={`text-3xl leading-none ${scoreColor(f.similarity_score)}`}>{f.similarity_score ?? "—"}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">/ 100</p>
                                </div>
                                <Badge className={`border text-xs font-bold ${recBadgeClass(f.recommendation)}`}>
                                  {recLabel(f.recommendation)}
                                </Badge>
                              </div>
                            </div>

                            {f.ai_analysis && (
                              <p className="text-sm text-foreground/80 italic border-t border-current/10 pt-3 mt-3">
                                {f.ai_analysis}
                              </p>
                            )}

                            <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-muted-foreground">
                              {f.filing_date && <span>Filed: {new Date(f.filing_date).toLocaleDateString()}</span>}
                              {f.goods_services && <span className="truncate max-w-xs">{f.goods_services}</span>}
                              <a
                                href={`https://tmsearch.uspto.gov/search/search-results?searchInput=${encodeURIComponent(f.serial_number)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[#0f2547] hover:underline font-medium ml-auto"
                              >
                                View on USPTO <ExternalLink size={11} />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="max-w-5xl mx-auto px-6 pb-12">
          <p className="text-xs text-muted-foreground text-center">
            Trademark Watch scans USPTO weekly. This dashboard is for informational purposes only and does not constitute legal advice.
            Always consult a licensed trademark attorney before filing an opposition.
          </p>
        </div>
      </div>
    </>
  );
}
