/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JobPart {
  id: string;
  job_id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  unit_cost_cents: number;
  created_at: string;
}

interface JobPartsProps {
  jobId: string;
}

export default function JobParts({ jobId }: JobPartsProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    part_name: "",
    part_number: "",
    quantity: "1",
    unit_cost_dollars: "",
  });

  const queryKey = ["job-parts", jobId];

  const { data: parts = [], isLoading } = useQuery<JobPart[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_parts")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalCents = parts.reduce(
    (sum, p) => sum + p.quantity * p.unit_cost_cents,
    0
  );

  const formatDollars = (cents: number) =>
    `$${(cents / 100).toFixed(2)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.part_name.trim()) {
      toast.error("Part name is required");
      return;
    }
    const qty = parseFloat(form.quantity) || 1;
    const unitCents = Math.round((parseFloat(form.unit_cost_dollars) || 0) * 100);

    setSaving(true);
    try {
      const { error } = await supabase.from("job_parts").insert({
        job_id: jobId,
        part_name: form.part_name.trim(),
        part_number: form.part_number.trim() || null,
        quantity: qty,
        unit_cost_cents: unitCents,
      });
      if (error) throw error;
      toast.success("Part added");
      queryClient.invalidateQueries({ queryKey });
      setForm({ part_name: "", part_number: "", quantity: "1", unit_cost_dollars: "" });
    } catch (err) {
      console.error("Add part error:", err);
      toast.error("Failed to add part");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-white/40 text-xs py-2">Loading parts...</p>;
  }

  return (
    <div className="space-y-3">
      {parts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wide border-b border-[#1e3a5f]">
                <th className="text-left pb-2 pr-3">Part Name</th>
                <th className="text-left pb-2 pr-3">Part #</th>
                <th className="text-right pb-2 pr-3">Qty</th>
                <th className="text-right pb-2 pr-3">Unit Cost</th>
                <th className="text-right pb-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]/50">
              {parts.map((part) => (
                <tr key={part.id}>
                  <td className="py-2 pr-3 text-white/90">{part.part_name}</td>
                  <td className="py-2 pr-3 text-white/50 text-xs">{part.part_number ?? "—"}</td>
                  <td className="py-2 pr-3 text-white/80 text-right">{part.quantity}</td>
                  <td className="py-2 pr-3 text-white/80 text-right">{formatDollars(part.unit_cost_cents)}</td>
                  <td className="py-2 text-[#00d4ff] text-right font-medium">
                    {formatDollars(part.quantity * part.unit_cost_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#1e3a5f]">
                <td colSpan={4} className="pt-2 text-white/40 text-xs uppercase tracking-wide text-right pr-3">
                  Total Parts Cost
                </td>
                <td className="pt-2 text-[#00d4ff] font-bold text-right">
                  {formatDollars(totalCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add Part Inline Form */}
      <form onSubmit={handleSubmit} className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-3 space-y-3">
        <p className="text-white/40 text-xs uppercase tracking-wide">Add Part</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={form.part_name}
            onChange={(e) => setForm((f) => ({ ...f, part_name: e.target.value }))}
            placeholder="Part name *"
            className="col-span-2 bg-[#0f1f35] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d4ff]"
          />
          <input
            value={form.part_number}
            onChange={(e) => setForm((f) => ({ ...f, part_number: e.target.value }))}
            placeholder="Part # (optional)"
            className="bg-[#0f1f35] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d4ff]"
          />
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            placeholder="Qty"
            className="bg-[#0f1f35] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d4ff]"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.unit_cost_dollars}
            onChange={(e) => setForm((f) => ({ ...f, unit_cost_dollars: e.target.value }))}
            placeholder="Unit cost ($)"
            className="bg-[#0f1f35] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#00d4ff]"
          />
          <button
            type="submit"
            disabled={saving || !form.part_name.trim()}
            className="col-span-2 py-2 bg-[#00d4ff] text-[#0a1628] text-sm font-bold rounded-lg hover:bg-[#00b8d9] disabled:opacity-40 transition-colors"
          >
            {saving ? "Adding..." : "Add Part"}
          </button>
        </div>
      </form>
    </div>
  );
}
