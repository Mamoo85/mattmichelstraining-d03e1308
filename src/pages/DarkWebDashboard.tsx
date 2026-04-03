import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/layout/SEOHead";
import { Shield, AlertTriangle, CheckCircle, Clock, Globe, RefreshCw } from "lucide-react";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

export default function DarkWebDashboard() {
  const { user } = useAuth();

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["dark-web-clients", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("dark_web_monitor_clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const clientIds: string[] = (clients || []).map((c: any) => c.id);

  const { data: findings, isLoading: findingsLoading } = useQuery({
    queryKey: ["dark-web-findings", clientIds.join(",")],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const { data, error } = await (supabase.from as any)("dark_web_monitor_findings")
        .select("*")
        .in("client_id", clientIds)
        .order("first_seen_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: clientIds.length > 0,
  });

  const isLoading = clientsLoading || findingsLoading;

  const criticalCount = (findings || []).filter((f: any) => f.severity === "critical").length;
  const highCount     = (findings || []).filter((f: any) => f.severity === "high").length;
  const newCount      = (findings || []).filter((f: any) => f.is_new).length;

  return (
    <>
      <SEOHead
        title="Dark Web Monitor Dashboard | M² Development"
        description="Your dark web credential monitoring dashboard"
      />
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <div className="bg-[#0a0f1e] border-b border-[#1e2d4a]">
          <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#00d4ff] mb-1">M² Development</div>
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                <Shield size={20} className="text-[#00d4ff]" /> Dark Web Monitor
              </h1>
            </div>
            <a
              href="/dark-web-monitor"
              className="text-xs text-slate-400 hover:text-[#00d4ff] transition-colors border border-[#1e2d4a] px-4 py-2"
            >
              + Add Domain
            </a>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-10">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-6 h-6 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !clients || clients.length === 0 ? (
            <div className="text-center py-24">
              <Shield size={48} className="text-[#1e2d4a] mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-3">No domains being monitored yet</h2>
              <p className="text-slate-400 text-sm mb-6">Add your first domain to start monitoring for credential breaches.</p>
              <a
                href="/dark-web-monitor"
                className="inline-block bg-[#00d4ff] text-[#0a0f1e] font-black px-8 py-3 text-sm hover:bg-[#00b8e0] transition-colors"
              >
                Start Monitoring — $49/mo
              </a>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                <div className="bg-[#0d1526] border border-[#1e2d4a] p-5 text-center">
                  <div className="text-2xl font-black text-white mb-1">{clients.length}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Domains</div>
                </div>
                <div className="bg-[#0d1526] border border-[#1e2d4a] p-5 text-center">
                  <div className="text-2xl font-black text-white mb-1">{(findings || []).length}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Total Findings</div>
                </div>
                <div className="bg-[#0d1526] border border-red-900/40 p-5 text-center">
                  <div className="text-2xl font-black text-red-400 mb-1">{criticalCount + highCount}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Critical / High</div>
                </div>
                <div className="bg-[#0d1526] border border-[#00d4ff30] p-5 text-center">
                  <div className="text-2xl font-black text-[#00d4ff] mb-1">{newCount}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">New This Week</div>
                </div>
              </div>

              {/* Per-client sections */}
              {clients.map((client: any) => {
                const clientFindings = (findings || []).filter((f: any) => f.client_id === client.id);
                const hasFindings = clientFindings.length > 0;

                return (
                  <div key={client.id} className="mb-10 bg-[#0d1526] border border-[#1e2d4a]">
                    {/* Client header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-[#1e2d4a]">
                      <div className="flex items-center gap-3">
                        <Globe size={18} className="text-[#00d4ff] flex-shrink-0" />
                        <div>
                          <div className="font-bold text-white text-base">{client.monitored_domain}</div>
                          {client.company_name && (
                            <div className="text-xs text-slate-500">{client.company_name}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <RefreshCw size={11} />
                          Last scan: {client.last_scan_at
                            ? new Date(client.last_scan_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "Pending"}
                        </span>
                        <span
                          className="px-2 py-0.5 font-bold uppercase tracking-wider"
                          style={{
                            background: client.subscription_status === "active" ? "#22c55e15" : "#ef444415",
                            color: client.subscription_status === "active" ? "#86efac" : "#fca5a5",
                            border: `1px solid ${client.subscription_status === "active" ? "#22c55e30" : "#ef444430"}`,
                          }}
                        >
                          {client.subscription_status}
                        </span>
                        <span className="bg-[#00d4ff15] text-[#00d4ff] border border-[#00d4ff30] px-2 py-0.5 font-bold uppercase tracking-wider">
                          {client.plan_type} · {client.domains_allowed} {client.domains_allowed === 1 ? "domain" : "domains"}
                        </span>
                      </div>
                    </div>

                    {/* Findings */}
                    <div className="px-6 py-5">
                      {!hasFindings ? (
                        <div className="flex items-center gap-3 py-4 text-sm">
                          <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                          <span className="text-slate-300">
                            No credential breaches found for <strong className="text-white">{client.monitored_domain}</strong>.
                            {!client.last_scan_at && " Initial scan pending — check back shortly."}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-4">
                            <AlertTriangle size={14} className="text-red-400" />
                            {clientFindings.length} {clientFindings.length === 1 ? "breach" : "breaches"} found
                          </div>
                          {clientFindings.map((finding: any) => (
                            <div
                              key={finding.id}
                              className="bg-[#0a0f1e] border border-[#1e2d4a] p-5"
                            >
                              <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className="font-bold text-white text-sm">{finding.breach_title || finding.breach_name}</span>
                                <span
                                  className="text-xs font-bold uppercase px-2 py-0.5 rounded"
                                  style={{
                                    color: SEVERITY_COLOR[finding.severity] || "#94a3b8",
                                    background: (SEVERITY_COLOR[finding.severity] || "#94a3b8") + "20",
                                    border: `1px solid ${(SEVERITY_COLOR[finding.severity] || "#94a3b8")}40`,
                                  }}
                                >
                                  {finding.severity}
                                </span>
                                {finding.is_new && (
                                  <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-[#00d4ff15] text-[#00d4ff] border border-[#00d4ff30]">
                                    NEW
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400 mb-4">
                                <div>
                                  <span className="text-slate-500 uppercase tracking-wider">Breach Date</span>
                                  <div className="text-slate-300 mt-0.5">{finding.breach_date || "Unknown"}</div>
                                </div>
                                <div>
                                  <span className="text-slate-500 uppercase tracking-wider">Records Exposed</span>
                                  <div className="text-slate-300 mt-0.5">
                                    {finding.pwn_count ? Number(finding.pwn_count).toLocaleString() : "Unknown"}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-slate-500 uppercase tracking-wider">First Detected</span>
                                  <div className="text-slate-300 mt-0.5">
                                    {new Date(finding.first_seen_at).toLocaleDateString("en-US", {
                                      month: "short", day: "numeric", year: "numeric",
                                    })}
                                  </div>
                                </div>
                              </div>

                              {finding.data_types_exposed && (
                                <div className="mb-4">
                                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Data Types Exposed</div>
                                  <div className="text-sm text-slate-300">{finding.data_types_exposed}</div>
                                </div>
                              )}

                              {finding.ai_remediation && (
                                <div className="bg-[#060c18] border-l-2 border-[#00d4ff] pl-4 pr-4 py-3">
                                  <div className="text-xs font-bold text-[#00d4ff] uppercase tracking-wider mb-2">
                                    AI Remediation Steps
                                  </div>
                                  <div className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">
                                    {finding.ai_remediation}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#1e2d4a] py-6 mt-8">
          <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/images/matt-boat.jpg" alt="Matt" className="w-8 h-8 rounded-full object-cover border border-[#1e2d4a]" />
              <span className="text-xs text-slate-500">M² Development · matt@mattmichelstraining.com</span>
            </div>
            <div className="text-xs text-slate-600">
              <Clock size={11} className="inline mr-1" />Scans run weekly
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
