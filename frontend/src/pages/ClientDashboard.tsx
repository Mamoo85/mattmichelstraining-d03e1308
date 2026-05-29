import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import {
  Search,
  Users,
  MailCheck,
  Zap,
  ChevronRight,
  X,
  Radio,
  Eye,
  Send,
} from "lucide-react";

interface TenantLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  job_title: string | null;
  email: string | null;
  validated_email: boolean | null;
  phone: string | null;
  website: string | null;
  linkedin_url: string | null;
  enrichment_data: Record<string, unknown>;
  drip_campaign_status: Record<string, unknown>;
  source: string | null;
  created_at: string;
}

const ClientDashboard = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<TenantLead | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["tenant-leads", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as TenantLead[];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.first_name?.toLowerCase().includes(q) ||
        l.last_name?.toLowerCase().includes(q) ||
        l.company_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.job_title?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const totalLeads = leads.length;
  const verifiedEmails = leads.filter((l) => l.validated_email).length;
  const activeDrips = leads.filter(
    (l) => l.drip_campaign_status && Object.keys(l.drip_campaign_status).length > 0
  ).length;

  // Drip status badge renderer
  const getDripBadge = (status: Record<string, unknown>) => {
    const stage = (status?.current_stage as string) || null;
    if (!stage) return null;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-shimmer-badge">
        {stage}
      </span>
    );
  };

  return (
    <div className="min-h-dvh" style={{ background: "#0a0a0a", color: "#e4e4e7" }}>
      {/* ── Header ── */}
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid #1e1e24" }}
      >
        <div className="flex items-center gap-3">
          <img
            src="/images/DWA_Dark_Logo.png"
            alt="Agency"
            className="h-9 w-9 rounded-full object-contain"
            style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.25))" }}
          />
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight" style={{ color: "#f4f4f5" }}>
              Omni-Channel Lead Engine
            </h1>
            {/* Live status indicator */}
            <span className="flex items-center gap-1.5 ml-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/80">
                System Online
              </span>
            </span>
          </div>
        </div>
        <span className="text-xs font-mono" style={{ color: "#71717a" }}>
          {user?.email}
        </span>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Hero Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Traffic De-Anonymized",
              sublabel: "RB2B + Snitcher hits",
              value: totalLeads,
              icon: Eye,
              accent: "#22d3ee",
            },
            {
              label: "Emails Recovered",
              sublabel: "Waterfall-verified contacts",
              value: verifiedEmails,
              icon: MailCheck,
              accent: "#34d399",
            },
            {
              label: "Automated Touchpoints",
              sublabel: "Drip emails dispatched",
              value: activeDrips,
              icon: Send,
              accent: "#a78bfa",
            },
          ].map(({ label, sublabel, value, icon: Icon, accent }) => (
            <div
              key={label}
              className="rounded-xl p-5 flex items-center gap-4 transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: "#111114",
                border: "1px solid #1e1e24",
                boxShadow: `0 0 24px -8px ${accent}15`,
              }}
            >
              <div
                className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${accent}12` }}
              >
                <Icon className="h-5 w-5" style={{ color: accent }} />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums" style={{ color: "#f4f4f5" }}>
                  {value.toLocaleString()}
                </p>
                <p className="text-xs font-medium" style={{ color: "#71717a" }}>
                  {label}
                </p>
                <p className="text-[10px] font-mono" style={{ color: "#3f3f46" }}>
                  {sublabel}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Search + Run ── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#52525b" }} />
            <Input
              placeholder="Search leads…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-9 border-none text-sm"
              style={{
                background: "#111114",
                border: "1px solid #1e1e24",
                color: "#e4e4e7",
              }}
            />
          </div>
          <button
            className="relative overflow-hidden px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #22d3ee, #06b6d4)",
              color: "#0a0a0a",
              boxShadow: "0 0 20px -4px rgba(34,211,238,0.35)",
            }}
          >
            <span className="relative z-10 flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5" />
              Run Search
            </span>
            {/* Shimmer overlay */}
            <span
              className="absolute inset-0 animate-shimmer-btn"
              style={{
                background:
                  "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.15) 50%, transparent 75%)",
                backgroundSize: "200% 100%",
              }}
            />
          </button>
        </div>

        {/* ── Table ── */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1e1e24" }}>
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-[11px] uppercase tracking-wider"
                style={{ background: "#111114", color: "#52525b", borderBottom: "1px solid #1e1e24" }}
              >
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Job Title</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16" style={{ color: "#3f3f46" }}>
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                      Scanning…
                    </div>
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16" style={{ color: "#3f3f46" }}>
                    No leads found
                  </td>
                </tr>
              ) : (
                paged.map((lead, i) => (
                  <tr
                    key={lead.id}
                    className="transition-colors duration-150 cursor-pointer group"
                    style={{
                      borderBottom: "1px solid #1e1e24",
                      background: i % 2 === 0 ? "transparent" : "#0d0d10",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#14141a")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        i % 2 === 0 ? "transparent" : "#0d0d10")
                    }
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: "#f4f4f5" }}>
                      {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#a1a1aa" }}>
                      {lead.company_name || "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#a1a1aa" }}>
                      {lead.job_title || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span style={{ color: "#e4e4e7" }}>{lead.email || "—"}</span>
                        {lead.validated_email && (
                          <MailCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "#34d399" }} />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getDripBadge(lead.drip_campaign_status)}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        style={{ color: "#3f3f46" }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "#52525b" }}>
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg disabled:opacity-30 hover:bg-white/5 transition"
              style={{ border: "1px solid #1e1e24" }}
            >
              Prev
            </button>
            <span className="font-mono">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg disabled:opacity-30 hover:bg-white/5 transition"
              style={{ border: "1px solid #1e1e24" }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── Lead Detail Slide-Over ── */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="w-full max-w-md h-full overflow-y-auto p-6 space-y-6 animate-slide-in-right"
            style={{ background: "#111114", borderLeft: "1px solid #1e1e24" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: "#f4f4f5" }}>
                Lead Details
              </h2>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1.5 rounded-lg hover:bg-white/5 transition"
              >
                <X className="h-5 w-5" style={{ color: "#71717a" }} />
              </button>
            </div>

            <div className="space-y-4">
              {[
                {
                  label: "Name",
                  value: [selectedLead.first_name, selectedLead.last_name]
                    .filter(Boolean)
                    .join(" "),
                },
                { label: "Company", value: selectedLead.company_name },
                { label: "Job Title", value: selectedLead.job_title },
                { label: "Email", value: selectedLead.email },
                {
                  label: "Verified",
                  value: selectedLead.validated_email ? "Yes ✓" : "No",
                },
                { label: "Phone", value: selectedLead.phone },
                { label: "Website", value: selectedLead.website },
                { label: "LinkedIn", value: selectedLead.linkedin_url },
                { label: "Source", value: selectedLead.source },
                {
                  label: "Added",
                  value: new Date(selectedLead.created_at).toLocaleDateString(),
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: "#52525b" }}>
                    {label}
                  </p>
                  <p className="text-sm font-medium" style={{ color: value ? "#e4e4e7" : "#3f3f46" }}>
                    {value || "—"}
                  </p>
                </div>
              ))}

              {/* Enrichment Data */}
              {selectedLead.enrichment_data &&
                Object.keys(selectedLead.enrichment_data).length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "#52525b" }}>
                      Enrichment Data
                    </p>
                    <pre
                      className="text-xs p-3 rounded-lg overflow-x-auto font-mono"
                      style={{ background: "#0a0a0f", color: "#71717a", border: "1px solid #1e1e24" }}
                    >
                      {JSON.stringify(selectedLead.enrichment_data, null, 2)}
                    </pre>
                  </div>
                )}

              {/* Drip Status */}
              {selectedLead.drip_campaign_status &&
                Object.keys(selectedLead.drip_campaign_status).length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "#52525b" }}>
                      Drip Campaign Status
                    </p>
                    <pre
                      className="text-xs p-3 rounded-lg overflow-x-auto font-mono"
                      style={{ background: "#0a0a0f", color: "#71717a", border: "1px solid #1e1e24" }}
                    >
                      {JSON.stringify(selectedLead.drip_campaign_status, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
