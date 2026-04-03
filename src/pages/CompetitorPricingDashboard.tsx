import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, RefreshCw, TrendingUp, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CompetitorPricingDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [addForm, setAddForm] = useState({ competitor_name: "", url: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("success") === "1"
  );

  // Fetch the client record for this user
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["competitor-pricing-client", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitor_pricing_clients" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("subscription_status", "active")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Fetch tracked URLs
  const { data: urls, isLoading: urlsLoading } = useQuery({
    queryKey: ["competitor-pricing-urls", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitor_pricing_urls" as any)
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch recent changes
  const { data: changes, isLoading: changesLoading } = useQuery({
    queryKey: ["competitor-pricing-changes", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitor_pricing_changes" as any)
        .select("*")
        .eq("client_id", client!.id)
        .order("detected_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client?.id || !addForm.competitor_name.trim() || !addForm.url.trim()) return;
    setAddLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/functions/v1/add-competitor-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          client_id: client.id,
          competitor_name: addForm.competitor_name.trim(),
          url: addForm.url.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add URL");
      setAddForm({ competitor_name: "", url: "" });
      qc.invalidateQueries({ queryKey: ["competitor-pricing-urls"] });
      toast.success(`${addForm.competitor_name} added successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add competitor URL");
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteUrl = async (urlId: string, name: string) => {
    if (!confirm(`Remove ${name} from monitoring?`)) return;
    const { error } = await supabase
      .from("competitor_pricing_urls" as any)
      .delete()
      .eq("id", urlId);
    if (error) { toast.error("Failed to remove URL"); return; }
    qc.invalidateQueries({ queryKey: ["competitor-pricing-urls"] });
    toast.success(`${name} removed`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">You need to be signed in to access your dashboard.</p>
          <a href="/auth" className="bg-[#2563eb] text-white px-6 py-2 text-sm font-bold hover:bg-[#1d4ed8] transition-colors">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (clientLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <AlertCircle size={36} className="text-[#2563eb] mx-auto mb-4" />
          <h2 className="font-bold text-foreground text-lg mb-2">No Active Subscription Found</h2>
          <p className="text-muted-foreground text-sm mb-6">
            It looks like your subscription isn't active yet. If you just signed up, it may take a moment. Otherwise, start your subscription below.
          </p>
          <a
            href="/competitor-pricing"
            className="inline-block bg-[#2563eb] text-white px-6 py-2 text-sm font-bold hover:bg-[#1d4ed8] transition-colors"
          >
            Get Started — $149/mo
          </a>
        </div>
      </div>
    );
  }

  const urlCount = urls?.length || 0;
  const unreportedChanges = changes?.filter((c: any) => !c.included_in_report) || [];
  const reportedChanges = changes?.filter((c: any) => c.included_in_report) || [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-[#1e293b] text-white px-6 py-10 border-b-2 border-[#2563eb]">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#2563eb] mb-1">Competitor Pricing Intelligence</p>
          <h1 className="text-2xl font-black">
            {client.company_name || client.customer_email}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {urlCount} competitor{urlCount !== 1 ? "s" : ""} tracked
            {client.last_report_sent_at && (
              <> · Last report: {new Date(client.last_report_sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
            )}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Success Banner */}
        {showSuccess && (
          <div className="bg-green-950/20 border border-green-800/40 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-green-400 text-sm">Subscription Active</p>
              <p className="text-green-300 text-sm mt-0.5">
                Welcome! Add your competitors below (3–10 URLs). Your first weekly report will arrive next Monday.
              </p>
            </div>
            <button onClick={() => setShowSuccess(false)} className="ml-auto text-green-600 hover:text-green-400 text-xs">✕</button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Competitors Tracked", value: urlCount, sub: "of 10 max" },
            { label: "Pending Changes", value: unreportedChanges.length, sub: "not yet reported" },
            { label: "Total Changes", value: changes?.length || 0, sub: "all time" },
            { label: "Reports Sent", value: client.last_report_sent_at ? "Active" : "Pending first scan", sub: client.last_report_sent_at ? "subscription active" : "adds URLs to begin" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-5 pb-4">
                <p className="text-2xl font-black text-foreground">{s.value}</p>
                <p className="text-xs font-bold text-foreground mt-0.5">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add Competitor URL */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus size={16} className="text-[#2563eb]" />
              Add Competitor URL
            </CardTitle>
            <p className="text-xs text-muted-foreground">Add the pricing or product pages you want monitored. Min 3, max 10.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddUrl} className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Competitor name (e.g. Acme Corp)"
                value={addForm.competitor_name}
                onChange={e => setAddForm(f => ({ ...f, competitor_name: e.target.value }))}
                className="flex-1"
                required
              />
              <Input
                placeholder="URL (e.g. https://acmecorp.com/pricing)"
                value={addForm.url}
                onChange={e => setAddForm(f => ({ ...f, url: e.target.value }))}
                className="flex-[2]"
                type="url"
                required
              />
              <Button type="submit" disabled={addLoading || urlCount >= 10} className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
                {addLoading ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} className="mr-1" />Add</>}
              </Button>
            </form>
            {urlCount >= 10 && (
              <p className="text-xs text-amber-500 mt-2">Maximum of 10 competitor URLs reached. Remove one to add another.</p>
            )}
          </CardContent>
        </Card>

        {/* Tracked URLs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp size={16} className="text-[#2563eb]" />
              Tracked Competitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {urlsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : urlCount === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No competitors added yet. Use the form above to add your first competitor URL.</p>
            ) : (
              <div className="space-y-2">
                {urls!.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{u.competitor_name}</p>
                      <a
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#2563eb] hover:underline flex items-center gap-1 truncate"
                      >
                        {u.url} <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {u.last_scraped_at ? (
                        <p className="text-xs text-muted-foreground">
                          Scanned {new Date(u.last_scraped_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">Pending first scan</Badge>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteUrl(u.id, u.competitor_name)}
                      className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                      title="Remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Changes Feed */}
        {unreportedChanges.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500" />
                Pending Changes
                <Badge className="bg-amber-500 text-white text-xs">{unreportedChanges.length} new</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">These changes were detected and will be included in your next weekly report.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {unreportedChanges.map((ch: any) => (
                <ChangeCard key={ch.id} change={ch} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Historical Changes */}
        {reportedChanges.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw size={16} className="text-[#2563eb]" />
                Change History
              </CardTitle>
              <p className="text-xs text-muted-foreground">All previously reported pricing changes.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {reportedChanges.slice(0, 10).map((ch: any) => (
                <ChangeCard key={ch.id} change={ch} reported />
              ))}
              {reportedChanges.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-2">Showing 10 of {reportedChanges.length} historical changes.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI Recommendations from latest unreported */}
        {unreportedChanges.some((c: any) => c.ai_recommendation) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp size={16} className="text-[#2563eb]" />
                AI Recommendations
              </CardTitle>
              <p className="text-xs text-muted-foreground">Individual recommendations based on each detected change.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {unreportedChanges
                .filter((c: any) => c.ai_recommendation)
                .map((c: any, i: number) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 bg-[#2563eb] rounded-full flex items-center justify-center text-white font-bold text-xs">{i + 1}</div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground mb-0.5">{c.competitor_name}</p>
                      <p className="text-sm text-foreground leading-relaxed">{c.ai_recommendation}</p>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

function ChangeCard({ change, reported }: { change: any; reported?: boolean }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-[#2563eb]/10 border-b border-border px-4 py-2 flex items-center justify-between">
        <p className="font-bold text-sm text-foreground">{change.competitor_name}</p>
        <div className="flex items-center gap-2">
          {reported && <Badge variant="outline" className="text-xs text-muted-foreground">Reported</Badge>}
          <p className="text-xs text-muted-foreground">
            {new Date(change.detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>
      <div className="p-4 space-y-3 bg-card">
        {change.change_summary && (
          <p className="text-sm text-foreground"><strong>What changed:</strong> {change.change_summary}</p>
        )}
        {change.new_snippet && (
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Current Content Snapshot</p>
            <div className="bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground font-mono leading-relaxed line-clamp-3">
              {change.new_snippet}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
