import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Search, Users, MailCheck, Zap, ChevronRight, X } from "lucide-react";

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

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Lead Dashboard</h1>
        <span className="text-xs text-muted-foreground">{user?.email}</span>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Leads", value: totalLeads, icon: Users },
            { label: "Verified Emails", value: verifiedEmails, icon: MailCheck },
            { label: "Active Drips", value: activeDrips, icon: Zap },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card p-5 flex items-center gap-4"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-muted-foreground text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Job Title</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    No leads found
                  </td>
                </tr>
              ) : (
                paged.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-border last:border-0 hover:bg-card/60 transition-colors cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="px-4 py-3 font-medium">
                      {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.company_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.job_title || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        {lead.email || "—"}
                        {lead.validated_email && (
                          <MailCheck className="h-3.5 w-3.5 text-green-400" />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-30 hover:bg-card transition"
            >
              Prev
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-30 hover:bg-card transition"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="w-full max-w-md bg-card border-l border-border h-full overflow-y-auto p-6 space-y-6 animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Lead Details</h2>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1 rounded-lg hover:bg-secondary transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {[
                { label: "Name", value: [selectedLead.first_name, selectedLead.last_name].filter(Boolean).join(" ") },
                { label: "Company", value: selectedLead.company_name },
                { label: "Job Title", value: selectedLead.job_title },
                { label: "Email", value: selectedLead.email },
                { label: "Verified", value: selectedLead.validated_email ? "Yes ✓" : "No" },
                { label: "Phone", value: selectedLead.phone },
                { label: "Website", value: selectedLead.website },
                { label: "LinkedIn", value: selectedLead.linkedin_url },
                { label: "Source", value: selectedLead.source },
                { label: "Added", value: new Date(selectedLead.created_at).toLocaleDateString() },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-sm font-medium">{value || "—"}</p>
                </div>
              ))}

              {/* Enrichment Data */}
              {selectedLead.enrichment_data &&
                Object.keys(selectedLead.enrichment_data).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Enrichment Data</p>
                    <pre className="text-xs bg-secondary/50 p-3 rounded-lg overflow-x-auto">
                      {JSON.stringify(selectedLead.enrichment_data, null, 2)}
                    </pre>
                  </div>
                )}

              {/* Drip Status */}
              {selectedLead.drip_campaign_status &&
                Object.keys(selectedLead.drip_campaign_status).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Drip Campaign Status</p>
                    <pre className="text-xs bg-secondary/50 p-3 rounded-lg overflow-x-auto">
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
