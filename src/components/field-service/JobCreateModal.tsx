// @ts-nocheck
import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JobCreateModalProps {
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}

interface Customer {
  id: string;
  company_name: string;
  city: string;
}

interface Tech {
  id: string;
  name: string;
}

const JobCreateModal: React.FC<JobCreateModalProps> = ({ clientId, onClose, onCreated }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"emergency" | "high" | "normal" | "low">("normal");
  const [customerId, setCustomerId] = useState("");
  const [techId, setTechId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const [custRes, techRes] = await Promise.all([
        supabase
          .from("field_service_customers")
          .select("id, company_name, city")
          .eq("client_id", clientId)
          .order("company_name"),
        supabase
          .from("field_service_techs")
          .select("id, name")
          .eq("client_id", clientId)
          .eq("active", true)
          .order("name"),
      ]);
      if (custRes.data) setCustomers(custRes.data);
      if (techRes.data) setTechs(techRes.data);
    };
    loadData();
  }, [clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Job title is required");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("field_service_jobs").insert({
        client_id: clientId,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        customer_id: customerId || null,
        assigned_tech_id: techId || null,
        scheduled_date: scheduledDate || null,
        scheduled_time: scheduledTime || null,
        status: techId ? "assigned" : "open",
      });
      if (error) throw error;
      toast.success("Job created successfully");
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create job";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-lg bg-[#0f1f35] rounded-2xl border border-[#1e3a5f] shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e3a5f]">
          <h2 className="text-white font-bold text-xl">New Job</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1">
              Job Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. HVAC Repair, Roof Inspection"
              required
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#00d4ff]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Job details, special instructions..."
              rows={3}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-[#00d4ff]"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
            >
              <option value="normal">Normal</option>
              <option value="low">Low</option>
              <option value="high">High</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
            >
              <option value="">— Select Customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name} — {c.city}
                </option>
              ))}
            </select>
          </div>

          {/* Assigned Tech */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1">Assigned Tech</label>
            <select
              value={techId}
              onChange={(e) => setTechId(e.target.value)}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
            >
              <option value="">— Unassigned —</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Scheduled Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1">Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1">Time</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4ff]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[#1e3a5f] text-gray-300 font-semibold hover:bg-[#1e3a5f] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-[#00d4ff] text-[#0a1628] font-bold disabled:opacity-50 hover:bg-[#00bce8] transition-colors"
            >
              {submitting ? "Creating..." : "Create Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobCreateModal;
