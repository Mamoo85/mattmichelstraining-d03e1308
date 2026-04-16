// @ts-nocheck
import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DndContext, DragOverlay, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import JobCreateModal from "./JobCreateModal";
import InvoiceGenerator from "./InvoiceGenerator";
import { toast } from "sonner";

interface DispatchBoardProps {
  clientId: string;
}

interface DispatchJob {
  id: string;
  title: string;
  priority: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration_minutes: number | null;
  notes: string | null;
  field_service_customers: { company_name: string; phone: string } | null;
  field_service_techs: { name: string } | null;
}

const COLUMNS = [
  { key: "open", label: "Open" },
  { key: "assigned", label: "Assigned" },
  { key: "en_route", label: "En Route" },
  { key: "on_site", label: "On Site" },
  { key: "completed", label: "Completed" },
] as const;

const priorityBadge: Record<string, string> = {
  emergency: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  normal: "bg-teal-500 text-white",
  low: "bg-gray-500 text-white",
};

const TODAY = new Date().toISOString().split("T")[0];

const DEMO_JOBS: DispatchJob[] = [
  { id: "d1", title: "Emergency: High-Pressure Alarm", priority: "emergency", status: "open", scheduled_date: TODAY, scheduled_time: "07:30", estimated_duration_minutes: 120, notes: "Contact Dave Kotrba — plant manager. Gate code: 4521.", field_service_customers: { company_name: "Chrysler Sterling Heights Assembly", phone: "(586) 939-7000" }, field_service_techs: null },
  { id: "d2", title: "Boiler Controls Upgrade Quote", priority: "normal", status: "open", scheduled_date: TODAY, scheduled_time: "14:00", estimated_duration_minutes: 60, notes: null, field_service_customers: { company_name: "Detroit Water & Sewage Dept.", phone: "(313) 267-8000" }, field_service_techs: null },
  { id: "d3", title: "Annual Boiler Tune-Up", priority: "high", status: "assigned", scheduled_date: TODAY, scheduled_time: "08:00", estimated_duration_minutes: 240, notes: "Unit 2 — East Powerhouse. Ask for loading dock access.", field_service_customers: { company_name: "Ford Motor Co. — River Rouge", phone: "(313) 845-8540" }, field_service_techs: { name: "Mike Johnson" } },
  { id: "d4", title: "Annual PM + CSD-1 Test", priority: "high", status: "assigned", scheduled_date: TODAY, scheduled_time: "10:30", estimated_duration_minutes: 180, notes: null, field_service_customers: { company_name: "Henry Ford Hospital", phone: "(313) 916-2600" }, field_service_techs: { name: "Dan Kowalski" } },
  { id: "d5", title: "Combustion Analysis — Unit 3", priority: "normal", status: "en_route", scheduled_date: TODAY, scheduled_time: "09:00", estimated_duration_minutes: 90, notes: null, field_service_customers: { company_name: "DTE Energy Plant — Trenton", phone: "(734) 675-7100" }, field_service_techs: { name: "Tony Radke" } },
  { id: "d6", title: "Burner Replacement — 200 HP", priority: "high", status: "on_site", scheduled_date: TODAY, scheduled_time: "07:00", estimated_duration_minutes: 480, notes: "North entrance only. Hardhat required.", field_service_customers: { company_name: "Stellantis Jefferson North Assembly", phone: "(313) 567-1800" }, field_service_techs: { name: "Chris Oller" } },
  { id: "d7", title: "Pressure Vessel Inspection", priority: "normal", status: "completed", scheduled_date: TODAY, scheduled_time: "06:30", estimated_duration_minutes: 60, notes: null, field_service_customers: { company_name: "GM Technical Center — Warren", phone: "(586) 986-5000" }, field_service_techs: { name: "Chris Oller" } },
];

// Draggable job card
function DraggableJobCard({ job, isSelected, onClick }: { job: DispatchJob; isSelected: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id });
  const durationLabel = job.estimated_duration_minutes
    ? job.estimated_duration_minutes >= 60
      ? `${Math.floor(job.estimated_duration_minutes / 60)}h${job.estimated_duration_minutes % 60 > 0 ? ` ${job.estimated_duration_minutes % 60}m` : ""}`
      : `${job.estimated_duration_minutes}m`
    : null;

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`w-full text-left bg-[#0f1f35] border rounded-xl p-3 transition-all ${
        isDragging ? "opacity-40 border-[#00d4ff]" : isSelected ? "border-[#00d4ff]" : "border-[#1e3a5f] hover:border-[#00d4ff]"
      }`}
    >
      <p className="text-white text-sm font-semibold leading-tight">{job.title}</p>
      <p className="text-gray-400 text-xs mt-1 truncate">
        {job.field_service_customers?.company_name ?? "No customer"}
      </p>
      <p className="text-gray-500 text-xs mt-0.5">
        {job.field_service_techs?.name ?? "Unassigned"}
      </p>
      <div className="flex items-center gap-2 mt-1">
        {job.scheduled_time && <span className="text-[#00d4ff] text-xs">{job.scheduled_time}</span>}
        {durationLabel && <span className="text-gray-500 text-xs">({durationLabel})</span>}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full uppercase ${priorityBadge[job.priority] ?? priorityBadge.normal}`}>
          {job.priority}
        </span>
        {job.notes && <span className="text-amber-400 text-xs" title="Has dispatcher notes">📋</span>}
      </div>
    </button>
  );
}

// Droppable column
function DroppableColumn({ status, label, children }: { status: string; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const count = React.Children.count(children);
  return (
    <div ref={setNodeRef} className="flex-1 min-w-[160px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-300 font-semibold text-sm uppercase tracking-wide">{label}</h3>
        <span className="text-xs bg-[#1e3a5f] text-gray-300 rounded-full px-2 py-0.5">{count}</span>
      </div>
      <div className={`space-y-3 min-h-[100px] rounded-xl p-1 transition-colors ${isOver ? "bg-[#00d4ff]/10 border border-dashed border-[#00d4ff]" : ""}`}>
        {count === 0 && !isOver && (
          <div className="rounded-xl border border-dashed border-[#1e3a5f] p-4 text-center text-gray-600 text-xs">Empty</div>
        )}
        {children}
      </div>
    </div>
  );
}

const DispatchBoard: React.FC<DispatchBoardProps> = ({ clientId }) => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<DispatchJob | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const {
    data: jobs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["field-jobs", clientId],
    queryFn: async () => {
      if (clientId === "demo") return DEMO_JOBS;
      const { data, error } = await supabase
        .from("field_service_jobs")
        .select(
          "id, title, priority, status, scheduled_date, scheduled_time, estimated_duration_minutes, notes, field_service_customers(company_name, phone), field_service_techs:assigned_tech_id(name)"
        )
        .eq("client_id", clientId)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DispatchJob[];
    },
  });

  // Realtime subscription for live updates
  useEffect(() => {
    if (clientId === "demo") return;
    const channel = supabase
      .channel("dispatch-board-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "field_service_jobs", filter: `client_id=eq.${clientId}` },
        () => {
          refetch();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, refetch]);

  const handleDragEnd = useCallback(async (event: any) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !active) return;
    const jobId = active.id as string;
    const newStatus = over.id as string;
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === newStatus) return;

    if (clientId === "demo") {
      toast.info("Demo mode — drag-and-drop is view-only");
      return;
    }

    try {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "on_site") updates.started_at = new Date().toISOString();
      if (newStatus === "completed") updates.completed_at = new Date().toISOString();

      const { error } = await supabase.from("field_service_jobs").update(updates).eq("id", jobId);
      if (error) throw error;
      toast.success(`Job moved to ${newStatus.replace("_", " ")}`);
      refetch();
    } catch (err) {
      console.error("Drag status update failed:", err);
      toast.error("Failed to update job status");
    }
  }, [jobs, clientId, refetch]);

  const handleSaveNotes = async () => {
    if (!selectedJob || clientId === "demo") return;
    try {
      await supabase.from("field_service_jobs").update({ notes: notesValue || null }).eq("id", selectedJob.id);
      setEditingNotes(false);
      toast.success("Notes saved");
      refetch();
    } catch { toast.error("Failed to save notes"); }
  };

  const activeJob = activeId ? jobs.find((j) => j.id === activeId) : null;

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e3a5f]">
        <h2 className="text-white font-bold text-lg">Dispatch Board</h2>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="px-3 py-2 rounded-lg bg-[#0f1f35] border border-[#1e3a5f] text-gray-300 text-sm hover:border-[#00d4ff] transition-colors">
            ↻ Refresh
          </button>
          <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 rounded-lg bg-[#00d4ff] text-[#0a1628] font-bold text-sm hover:bg-[#00bce8] transition-colors">
            + New Job
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading jobs...</p></div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto">
            <div className="flex gap-4 p-4" style={{ minWidth: "900px" }}>
              {COLUMNS.map((col) => {
                const colJobs = jobs.filter((j) => j.status === col.key);
                return (
                  <DroppableColumn key={col.key} status={col.key} label={col.label}>
                    {colJobs.map((job) => (
                      <DraggableJobCard
                        key={job.id}
                        job={job}
                        isSelected={selectedJob?.id === job.id}
                        onClick={() => {
                          setSelectedJob(selectedJob?.id === job.id ? null : job);
                          setEditingNotes(false);
                          setNotesValue(job.notes || "");
                        }}
                      />
                    ))}
                  </DroppableColumn>
                );
              })}
            </div>
          </div>
          <DragOverlay>
            {activeJob && (
              <div className="bg-[#0f1f35] border border-[#00d4ff] rounded-xl p-3 shadow-2xl opacity-90 max-w-[200px]">
                <p className="text-white text-sm font-semibold">{activeJob.title}</p>
                <p className="text-gray-400 text-xs mt-1">{activeJob.field_service_customers?.company_name ?? "No customer"}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Inline detail panel */}
      {selectedJob && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0f1f35] border-t border-[#1e3a5f] p-4 z-40 shadow-2xl max-h-[40vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base">{selectedJob.title}</p>
              <p className="text-gray-300 text-sm mt-0.5">{selectedJob.field_service_customers?.company_name ?? "No customer"}</p>
              {selectedJob.field_service_customers?.phone && (
                <a href={`tel:${selectedJob.field_service_customers.phone}`} className="text-[#00d4ff] text-sm">📞 {selectedJob.field_service_customers.phone}</a>
              )}
              <p className="text-gray-400 text-sm mt-1">Tech: {selectedJob.field_service_techs?.name ?? "Unassigned"}</p>
              {selectedJob.scheduled_date && (
                <p className="text-gray-400 text-sm">Scheduled: {selectedJob.scheduled_date}{selectedJob.scheduled_time ? ` at ${selectedJob.scheduled_time}` : ""}</p>
              )}
              {selectedJob.estimated_duration_minutes && (
                <p className="text-gray-500 text-xs mt-0.5">Duration: {selectedJob.estimated_duration_minutes}min</p>
              )}
              <p className="text-gray-500 text-xs mt-1 capitalize">Status: {selectedJob.status.replace("_", " ")}</p>

              {/* Dispatcher Notes editing */}
              <div className="mt-3 border-t border-[#1e3a5f] pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-amber-300 text-xs uppercase tracking-wide font-bold">📋 Dispatcher Notes</p>
                  {!editingNotes && (
                    <button onClick={() => { setEditingNotes(true); setNotesValue(selectedJob.notes || ""); }} className="text-[#00d4ff] text-xs">Edit</button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="mt-2 space-y-2">
                    <textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} rows={3} placeholder="Gate codes, contact names, special instructions..." className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-[#00d4ff]" />
                    <div className="flex gap-2">
                      <button onClick={handleSaveNotes} className="px-3 py-1.5 bg-[#00d4ff] text-[#0a1628] text-xs font-bold rounded-lg">Save</button>
                      <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 border border-[#1e3a5f] text-gray-400 text-xs rounded-lg">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm mt-1">{selectedJob.notes || "No notes — click Edit to add instructions for the tech."}</p>
                )}
              </div>
            </div>
            <div className="shrink-0 flex flex-col gap-2 items-end">
              <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
              <button
                onClick={() => setShowInvoice(true)}
                className="px-3 py-1.5 bg-[#00d4ff] text-[#0a1628] text-xs font-bold rounded-lg hover:bg-[#00bce8] transition-colors whitespace-nowrap"
              >
                🧾 Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvoice && selectedJob && (
        <InvoiceGenerator job={selectedJob} onClose={() => setShowInvoice(false)} />
      )}

      {showCreateModal && (
        <JobCreateModal clientId={clientId} onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); refetch(); }} />
      )}
    </div>
  );
};

export default DispatchBoard;
