import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Contract {
  id: string;
  client_id: string;
  customer_id: string | null;
  asset_id: string | null;
  title: string;
  description: string | null;
  frequency: string;
  assigned_tech_id: string | null;
  next_due_date: string;
  active: boolean;
  created_at: string;
  customer_name: string | null;
  asset_name: string | null;
  tech_name: string | null;
}

interface Customer {
  id: string;
  company_name: string;
}

interface Asset {
  id: string;
  name: string;
  customer_id: string | null;
}

interface Tech {
  id: string;
  name: string;
}

interface ContractManagerProps {
  clientId?: string;
}

const FREQUENCIES = ["weekly", "monthly", "quarterly", "biannual", "annual"];

const freqLabel: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  biannual: "Biannual",
  annual: "Annual",
};

const freqColors: Record<string, string> = {
  weekly: "bg-purple-500/20 text-purple-300",
  monthly: "bg-blue-500/20 text-blue-300",
  quarterly: "bg-teal-500/20 text-[#00d4ff]",
  biannual: "bg-orange-500/20 text-orange-300",
  annual: "bg-green-500/20 text-green-300",
};

export default function ContractManager({ clientId }: ContractManagerProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    customer_id: "",
    asset_id: "",
    description: "",
    frequency: "monthly",
    assigned_tech_id: "",
    next_due_date: "",
  });

  const today = new Date().toISOString().split("T")[0];
  const queryKey = ["field-contracts", clientId ?? ""];

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from("field_service_contracts")
        .select(
          "*, field_service_customers(company_name), field_service_assets(name), field_service_techs(name)"
        )
        .order("next_due_date", { ascending: true });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => {
        const cust = row.field_service_customers as Record<string, string> | null;
        const asset = row.field_service_assets as Record<string, string> | null;
        const tech = row.field_service_techs as Record<string, string> | null;
        return {
          id: row.id as string,
          client_id: row.client_id as string,
          customer_id: (row.customer_id as string | null) ?? null,
          asset_id: (row.asset_id as string | null) ?? null,
          title: row.title as string,
          description: (row.description as string | null) ?? null,
          frequency: row.frequency as string,
          assigned_tech_id: (row.assigned_tech_id as string | null) ?? null,
          next_due_date: row.next_due_date as string,
          active: row.active as boolean,
          created_at: row.created_at as string,
          customer_name: cust?.company_name ?? null,
          asset_name: asset?.name ?? null,
          tech_name: tech?.name ?? null,
        };
      });
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["field-customers-for-contracts", clientId ?? ""],
    queryFn: async () => {
      let q = supabase
        .from("field_service_customers")
        .select("id, company_name")
        .order("company_name", { ascending: true });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["field-assets-for-contracts", clientId ?? ""],
    queryFn: async () => {
      let q = supabase
        .from("field_service_assets")
        .select("id, name, customer_id")
        .eq("active", true)
        .order("name", { ascending: true });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: techs = [] } = useQuery<Tech[]>({
    queryKey: ["field-techs-for-contracts", clientId ?? ""],
    queryFn: async () => {
      let q = supabase
        .from("field_service_techs")
        .select("id, name")
        .eq("active", true)
        .order("name", { ascending: true });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredAssets = form.customer_id
    ? assets.filter((a) => a.customer_id === form.customer_id)
    : assets;

  const resetForm = () => {
    setForm({
      title: "",
      customer_id: "",
      asset_id: "",
      description: "",
      frequency: "monthly",
      assigned_tech_id: "",
      next_due_date: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.next_due_date) { toast.error("Next due date is required"); return; }
    if (!clientId) { toast.error("Client context required"); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from("field_service_contracts").insert({
        client_id: clientId,
        customer_id: form.customer_id || null,
        asset_id: form.asset_id || null,
        title: form.title.trim(),
        description: form.description || null,
        frequency: form.frequency,
        assigned_tech_id: form.assigned_tech_id || null,
        next_due_date: form.next_due_date,
      });
      if (error) throw error;
      toast.success("Contract added");
      queryClient.invalidateQueries({ queryKey });
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error("Add contract error:", err);
      toast.error("Failed to add contract");
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async (contractId: string) => {
    setRunningId(contractId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/field-service-contract-scheduler`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({ contract_id: contractId }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scheduler error");
      toast.success(`Job created for contract`);
      queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      console.error("Run contract error:", err);
      toast.error("Failed to run contract");
    } finally {
      setRunningId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-white/40 text-sm">Loading contracts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">Service Contracts</h3>
        {clientId && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#00d4ff] text-[#0a1628] text-sm font-bold rounded-lg hover:bg-[#00b8d9] transition-colors"
          >
            + Add Contract
          </button>
        )}
      </div>

      {contracts.length === 0 ? (
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-8 text-center">
          <p className="text-white/40 text-sm">No service contracts yet.</p>
          {clientId && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 px-4 py-2 bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-sm rounded-lg hover:bg-[#00d4ff]/20 transition-colors"
            >
              Add First Contract
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wide border-b border-[#1e3a5f]">
                <th className="text-left pb-3 pr-4">Title</th>
                <th className="text-left pb-3 pr-4">Customer</th>
                <th className="text-left pb-3 pr-4">Asset</th>
                <th className="text-left pb-3 pr-4">Frequency</th>
                <th className="text-left pb-3 pr-4">Tech</th>
                <th className="text-left pb-3 pr-4">Next Due</th>
                <th className="text-left pb-3 pr-4">Status</th>
                <th className="text-left pb-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]/40">
              {contracts.map((c) => {
                const isOverdue = c.active && c.next_due_date <= today;
                return (
                  <tr
                    key={c.id}
                    className={isOverdue ? "bg-red-900/10" : ""}
                  >
                    <td className="py-3 pr-4">
                      <span className="text-white font-medium">{c.title}</span>
                    </td>
                    <td className="py-3 pr-4 text-white/60">
                      {c.customer_name ?? <span className="text-white/25">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-white/60">
                      {c.asset_name ?? <span className="text-white/25">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${freqColors[c.frequency] ?? "bg-gray-500/20 text-gray-300"}`}>
                        {freqLabel[c.frequency] ?? c.frequency}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-white/60">
                      {c.tech_name ?? <span className="text-white/25">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={isOverdue ? "text-red-400 font-semibold" : "text-white/70"}>
                        {new Date(c.next_due_date + "T00:00:00").toLocaleDateString()}
                      </span>
                      {isOverdue && (
                        <span className="ml-2 text-xs text-red-400 font-bold">OVERDUE</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {c.active ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium">Active</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 font-medium">Inactive</span>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleRunNow(c.id)}
                        disabled={runningId === c.id}
                        className="text-xs px-3 py-1.5 border border-[#00d4ff]/30 text-[#00d4ff] rounded-lg hover:bg-[#00d4ff]/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                      >
                        {runningId === c.id ? "Running..." : "Run Now"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Contract Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#1e3a5f]">
              <h3 className="text-white font-bold text-lg">Add Service Contract</h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-white/50 hover:text-white transition-colors text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-white/60 text-xs mb-1.5">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Monthly Boiler Inspection"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d4ff]"
                  required
                />
              </div>

              <div>
                <label className="block text-white/60 text-xs mb-1.5">Customer</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value, asset_id: "" }))}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
                >
                  <option value="">— No customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/60 text-xs mb-1.5">Asset</label>
                <select
                  value={form.asset_id}
                  onChange={(e) => setForm((f) => ({ ...f, asset_id: e.target.value }))}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
                >
                  <option value="">— No asset —</option>
                  {filteredAssets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/60 text-xs mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What does this maintenance contract cover?"
                  rows={2}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 resize-none focus:outline-none focus:border-[#00d4ff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1.5">Frequency *</label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
                  >
                    {FREQUENCIES.map((freq) => (
                      <option key={freq} value={freq}>{freqLabel[freq]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1.5">Next Due Date *</label>
                  <input
                    type="date"
                    value={form.next_due_date}
                    onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))}
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/60 text-xs mb-1.5">Assigned Tech</label>
                <select
                  value={form.assigned_tech_id}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_tech_id: e.target.value }))}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
                >
                  <option value="">— Unassigned —</option>
                  {techs.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 py-2.5 border border-[#1e3a5f] text-white/60 text-sm rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#00d4ff] text-[#0a1628] text-sm font-bold rounded-lg hover:bg-[#00b8d9] disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Add Contract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
