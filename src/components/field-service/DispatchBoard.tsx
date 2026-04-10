import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import JobCreateModal from "./JobCreateModal";

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
  field_service_customers: { company_name: string; phone: string } | null;
  field_service_techs: { name: string } | null;
  notes_count?: number;
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

const DispatchBoard: React.FC<DispatchBoardProps> = ({ clientId }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<DispatchJob | null>(null);

  const {
    data: jobs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["field-jobs", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_service_jobs" as any)
        .select(
          "id, title, priority, status, scheduled_date, scheduled_time, field_service_customers(company_name, phone), field_service_techs:assigned_tech_id(name)"
        )
        .eq("client_id", clientId)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DispatchJob[];
    },
  });

  const jobsByStatus = (status: string) => jobs.filter((j) => j.status === status);

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e3a5f]">
        <h2 className="text-white font-bold text-lg">Dispatch Board</h2>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="px-3 py-2 rounded-lg bg-[#0f1f35] border border-[#1e3a5f] text-gray-300 text-sm hover:border-[#00d4ff] transition-colors"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-[#00d4ff] text-[#0a1628] font-bold text-sm hover:bg-[#00bce8] transition-colors"
          >
            + New Job
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">Loading jobs...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-4 p-4" style={{ minWidth: "900px" }}>
            {COLUMNS.map((col) => {
              const colJobs = jobsByStatus(col.key);
              return (
                <div key={col.key} className="flex-1 min-w-[160px]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-gray-300 font-semibold text-sm uppercase tracking-wide">{col.label}</h3>
                    <span className="text-xs bg-[#1e3a5f] text-gray-300 rounded-full px-2 py-0.5">{colJobs.length}</span>
                  </div>
                  <div className="space-y-3">
                    {colJobs.length === 0 && (
                      <div className="rounded-xl border border-dashed border-[#1e3a5f] p-4 text-center text-gray-600 text-xs">
                        Empty
                      </div>
                    )}
                    {colJobs.map((job) => (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                        className="w-full text-left bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-3 hover:border-[#00d4ff] transition-colors"
                      >
                        <p className="text-white text-sm font-semibold leading-tight">{job.title}</p>
                        <p className="text-gray-400 text-xs mt-1 truncate">
                          {job.field_service_customers?.company_name ?? "No customer"}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {job.field_service_techs?.name ?? "Unassigned"}
                        </p>
                        {job.scheduled_date && (
                          <p className="text-[#00d4ff] text-xs mt-1">{job.scheduled_date}</p>
                        )}
                        <span
                          className={`inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                            priorityBadge[job.priority] ?? priorityBadge.normal
                          }`}
                        >
                          {job.priority}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline detail panel */}
      {selectedJob && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0f1f35] border-t border-[#1e3a5f] p-4 z-40 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base">{selectedJob.title}</p>
              <p className="text-gray-300 text-sm mt-0.5">
                {selectedJob.field_service_customers?.company_name ?? "No customer"}
              </p>
              {selectedJob.field_service_customers?.phone && (
                <a
                  href={`tel:${selectedJob.field_service_customers.phone}`}
                  className="text-[#00d4ff] text-sm"
                >
                  📞 {selectedJob.field_service_customers.phone}
                </a>
              )}
              <p className="text-gray-400 text-sm mt-1">
                Tech: {selectedJob.field_service_techs?.name ?? "Unassigned"}
              </p>
              {selectedJob.scheduled_date && (
                <p className="text-gray-400 text-sm">
                  Scheduled: {selectedJob.scheduled_date}
                  {selectedJob.scheduled_time ? ` at ${selectedJob.scheduled_time}` : ""}
                </p>
              )}
              <p className="text-gray-500 text-xs mt-1 capitalize">
                Status: {selectedJob.status.replace("_", " ")}
              </p>
            </div>
            <button
              onClick={() => setSelectedJob(null)}
              className="text-gray-400 hover:text-white text-2xl leading-none shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <JobCreateModal
          clientId={clientId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default DispatchBoard;
