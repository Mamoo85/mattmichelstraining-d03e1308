// @ts-nocheck
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Client {
  id: string;
  business_name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  plan: string | null;
  industry: string | null;
  status: string | null;
  created_at: string;
}

function formatIndustry(industry: string | null): string {
  if (!industry) return '—';
  return industry
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function PlanBadge({ plan }: { plan: string | null }) {
  if (plan === "bundle") {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30">
        Bundle
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/70 border border-white/20">
      Standalone
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "active") {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
        Active
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/40 border border-white/20">
      {status ?? "Inactive"}
    </span>
  );
}

function AddClientModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    business_name: "",
    owner_name: "",
    email: "",
    phone: "",
    plan: "standalone",
    industry: "hvac",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.business_name.trim()) {
      toast.error("Company name is required");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("field_crm_clients").insert({
      business_name: form.business_name.trim(),
      owner_name: form.owner_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      plan: form.plan,
      industry: form.industry,
      status: "active",
    });
    setLoading(false);
    if (error) {
      toast.error("Failed to add client: " + error.message);
      return;
    }
    toast.success("Client added successfully");
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#0f1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-5">Add New Client</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">
              Company Name *
            </label>
            <input
              className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00d4ff]/50"
              placeholder="ABC Roofing LLC"
              value={form.business_name}
              onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">
              Owner Name
            </label>
            <input
              className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00d4ff]/50"
              placeholder="John Smith"
              value={form.owner_name}
              onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00d4ff]/50"
              placeholder="john@abcroofing.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">
              Phone
            </label>
            <input
              type="tel"
              className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00d4ff]/50"
              placeholder="+13135550123"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">
              Plan
            </label>
            <select
              className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]/50"
              value={form.plan}
              onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
            >
              <option value="standalone">Standalone ($299/mo)</option>
              <option value="bundle">Bundle ($199/mo)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">
              Industry
            </label>
            <select
              className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]/50"
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
            >
              <option value="hvac">HVAC</option>
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="boiler_industrial">Boiler / Industrial</option>
              <option value="appliance_repair">Appliance Repair</option>
              <option value="it_support">IT Support</option>
              <option value="pest_control">Pest Control</option>
              <option value="landscaping">Landscaping</option>
              <option value="fire_protection">Fire Protection</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-[#00d4ff] text-[#0a1628] font-semibold text-sm hover:bg-[#00d4ff]/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DWAClientRoster() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["dwa-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_crm_clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Client[];
    },
    staleTime: 60_000,
  });

  const filtered = clients.filter(
    (c) =>
      c.business_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {showModal && (
        <AddClientModal
          onClose={() => setShowModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["dwa-clients"] })}
        />
      )}

      <div className="flex items-center justify-between gap-4 mb-4">
        <input
          className="bg-[#0f1f35] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00d4ff]/50 w-64"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-[#00d4ff] text-[#0a1628] font-semibold text-sm hover:bg-[#00d4ff]/90 transition-colors"
        >
          + Add Client
        </button>
      </div>

      <div className="bg-[#0f1f35] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-white/40 font-medium uppercase tracking-wide text-xs">
                  Company
                </th>
                <th className="text-left px-4 py-3 text-white/40 font-medium uppercase tracking-wide text-xs">
                  Plan
                </th>
                <th className="text-left px-4 py-3 text-white/40 font-medium uppercase tracking-wide text-xs">
                  Industry
                </th>
                <th className="text-left px-4 py-3 text-white/40 font-medium uppercase tracking-wide text-xs">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-white/40 font-medium uppercase tracking-wide text-xs">
                  Phone
                </th>
                <th className="text-left px-4 py-3 text-white/40 font-medium uppercase tracking-wide text-xs">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-white/40 font-medium uppercase tracking-wide text-xs">
                  Created
                </th>
                <th className="text-left px-4 py-3 text-white/40 font-medium uppercase tracking-wide text-xs">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-white/5 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-white/30">
                    {search ? "No clients match your search." : "No clients yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      {client.business_name}
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={client.plan} />
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {formatIndustry(client.industry)}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {client.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {client.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={client.status} />
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {new Date(client.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <a
                          href={`/field-service/dispatch?client=${client.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded bg-[#00d4ff]/10 text-[#00d4ff] text-xs border border-[#00d4ff]/20 hover:bg-[#00d4ff]/20 transition-colors"
                        >
                          Dispatch
                        </a>
                        <a
                          href="/field-service/tech"
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded bg-white/5 text-white/60 text-xs border border-white/10 hover:bg-white/10 transition-colors"
                        >
                          Tech App
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}