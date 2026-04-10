// @ts-nocheck
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Asset {
  id: string;
  client_id: string;
  customer_id: string | null;
  name: string;
  asset_type: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  last_service_at: string | null;
  location_notes: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

interface AssetJob {
  id: string;
  title: string;
  status: string;
  completed_at: string | null;
}

interface Customer {
  id: string;
  company_name: string;
}

interface AssetManagerProps {
  clientId?: string;
  customerId?: string;
}

const ASSET_TYPES = ["boiler", "hvac", "compressor", "generator", "pump", "other"];

const statusColors: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-300",
  assigned: "bg-purple-500/20 text-purple-300",
  en_route: "bg-yellow-500/20 text-yellow-300",
  on_site: "bg-orange-500/20 text-orange-300",
  completed: "bg-green-500/20 text-green-300",
  invoiced: "bg-teal-500/20 text-teal-300",
};

function AssetJobHistory({ assetId }: { assetId: string }) {
  const { data: jobs = [], isLoading } = useQuery<AssetJob[]>({
    queryKey: ["asset-jobs", assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_service_jobs")
        .select("id, title, status, completed_at")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-white/40 text-xs py-2">Loading history...</p>;
  if (jobs.length === 0) return <p className="text-white/40 text-xs py-2">No jobs recorded for this asset.</p>;

  return (
    <div className="mt-3 space-y-1.5">
      {jobs.map((job) => (
        <div key={job.id} className="flex items-center justify-between bg-[#0a1628] rounded-lg px-3 py-2 border border-[#1e3a5f]">
          <span className="text-white/80 text-xs">{job.title}</span>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[job.status] ?? "bg-gray-500/20 text-gray-300"}`}>
              {job.status.replace("_", " ")}
            </span>
            {job.completed_at && (
              <span className="text-white/30 text-xs">{new Date(job.completed_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AssetManager({ clientId, customerId }: AssetManagerProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    asset_type: "other",
    manufacturer: "",
    model: "",
    serial_number: "",
    install_date: "",
    location_notes: "",
    customer_id: customerId ?? "",
    notes: "",
  });

  const queryKey = ["field-assets", clientId ?? "", customerId ?? ""];

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from("field_service_assets")
        .select("*")
        .order("name", { ascending: true });
      if (clientId) q = q.eq("client_id", clientId);
      if (customerId) q = q.eq("customer_id", customerId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["field-customers-for-assets", clientId ?? ""],
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

  const resetForm = () => {
    setForm({
      name: "",
      asset_type: "other",
      manufacturer: "",
      model: "",
      serial_number: "",
      install_date: "",
      location_notes: "",
      customer_id: customerId ?? "",
      notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Asset name is required");
      return;
    }
    if (!clientId) {
      toast.error("Client context required to add an asset");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("field_service_assets").insert({
        client_id: clientId,
        customer_id: form.customer_id || null,
        name: form.name.trim(),
        asset_type: form.asset_type || null,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        install_date: form.install_date || null,
        location_notes: form.location_notes || null,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast.success("Asset added");
      queryClient.invalidateQueries({ queryKey });
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error("Add asset error:", err);
      toast.error("Failed to add asset");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-white/40 text-sm">Loading assets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">Equipment / Assets</h3>
        {clientId && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#00d4ff] text-[#0a1628] text-sm font-bold rounded-lg hover:bg-[#00b8d9] transition-colors"
          >
            + Add Asset
          </button>
        )}
      </div>

      {assets.length === 0 ? (
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-8 text-center">
          <p className="text-white/40 text-sm">No assets tracked yet.</p>
          {clientId && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 px-4 py-2 bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-sm rounded-lg hover:bg-[#00d4ff]/20 transition-colors"
            >
              Add First Asset
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {assets.map((asset) => (
            <div key={asset.id} className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-bold text-base">{asset.name}</p>
                    {asset.asset_type && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30 capitalize">
                        {asset.asset_type}
                      </span>
                    )}
                    {!asset.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">Inactive</span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                    {asset.manufacturer && (
                      <span className="text-white/50 text-xs">{asset.manufacturer}</span>
                    )}
                    {asset.model && (
                      <span className="text-white/50 text-xs">Model: {asset.model}</span>
                    )}
                    {asset.serial_number && (
                      <span className="text-white/50 text-xs">S/N: {asset.serial_number}</span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                    {asset.install_date && (
                      <span className="text-white/40 text-xs">
                        Installed: {new Date(asset.install_date).toLocaleDateString()}
                      </span>
                    )}
                    {asset.last_service_at && (
                      <span className="text-white/40 text-xs">
                        Last service: {new Date(asset.last_service_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {asset.location_notes && (
                    <p className="text-white/40 text-xs mt-1 italic">{asset.location_notes}</p>
                  )}
                </div>

                <button
                  onClick={() => setExpandedId(expandedId === asset.id ? null : asset.id)}
                  className="shrink-0 text-xs px-3 py-1.5 border border-[#00d4ff]/30 text-[#00d4ff] rounded-lg hover:bg-[#00d4ff]/10 transition-colors"
                >
                  {expandedId === asset.id ? "Hide" : "View History"}
                </button>
              </div>

              {expandedId === asset.id && (
                <div className="mt-3 pt-3 border-t border-[#1e3a5f]">
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-2">Job History</p>
                  <AssetJobHistory assetId={asset.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Asset Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#1e3a5f]">
              <h3 className="text-white font-bold text-lg">Add Asset</h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-white/50 hover:text-white transition-colors text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-white/60 text-xs mb-1.5">Asset Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Boiler Unit #4"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d4ff]"
                  required
                />
              </div>

              <div>
                <label className="block text-white/60 text-xs mb-1.5">Asset Type</label>
                <select
                  value={form.asset_type}
                  onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value }))}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1.5">Manufacturer</label>
                  <input
                    value={form.manufacturer}
                    onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
                    placeholder="e.g. Carrier"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d4ff]"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1.5">Model</label>
                  <input
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder="Model #"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d4ff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1.5">Serial Number</label>
                  <input
                    value={form.serial_number}
                    onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                    placeholder="S/N"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d4ff]"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1.5">Install Date</label>
                  <input
                    type="date"
                    value={form.install_date}
                    onChange={(e) => setForm((f) => ({ ...f, install_date: e.target.value }))}
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/60 text-xs mb-1.5">Location Notes</label>
                <input
                  value={form.location_notes}
                  onChange={(e) => setForm((f) => ({ ...f, location_notes: e.target.value }))}
                  placeholder="e.g. Basement, east wall"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d4ff]"
                />
              </div>

              {customers.length > 0 && (
                <div>
                  <label className="block text-white/60 text-xs mb-1.5">Customer (optional)</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
                  >
                    <option value="">— No customer —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-white/60 text-xs mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  rows={3}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 resize-none focus:outline-none focus:border-[#00d4ff]"
                />
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
                  {saving ? "Saving..." : "Add Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
