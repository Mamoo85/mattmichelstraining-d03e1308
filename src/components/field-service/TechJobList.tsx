import React from "react";

export interface FieldJob {
  id: string;
  client_id?: string;
  title: string;
  description: string | null;
  priority: "emergency" | "high" | "normal" | "low";
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  customer: {
    company_name: string;
    address: string;
    city: string;
    phone: string;
  } | null;
  notes: string | null;
}

interface TechJobListProps {
  jobs: FieldJob[];
  onSelect: (job: FieldJob) => void;
}

const priorityConfig: Record<string, { label: string; bg: string; text: string }> = {
  emergency: { label: "EMERGENCY", bg: "bg-red-600", text: "text-white" },
  high: { label: "HIGH", bg: "bg-orange-500", text: "text-white" },
  normal: { label: "NORMAL", bg: "bg-teal-500", text: "text-white" },
  low: { label: "LOW", bg: "bg-gray-500", text: "text-white" },
};

const TechJobList: React.FC<TechJobListProps> = ({ jobs, onSelect }) => {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-6">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-white text-xl font-semibold text-center">No jobs assigned today</p>
        <p className="text-gray-400 text-sm text-center mt-2">Check back later or contact your dispatcher.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {jobs.map((job) => {
        const pCfg = priorityConfig[job.priority] ?? priorityConfig.normal;
        return (
          <button
            key={job.id}
            onClick={() => onSelect(job)}
            className="w-full text-left rounded-2xl p-5 bg-[#0f1f35] border border-[#1e3a5f] shadow-lg active:scale-[0.98] transition-transform"
            style={{ minHeight: 88 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-lg leading-tight truncate">{job.title}</p>
                {job.customer && (
                  <>
                    <p className="text-gray-300 text-sm mt-1 font-medium">{job.customer.company_name}</p>
                    <p className="text-gray-400 text-sm">
                      {job.customer.address}, {job.customer.city}
                    </p>
                  </>
                )}
                {job.scheduled_time && (
                  <p className="text-[#00d4ff] text-sm mt-1 font-semibold">{job.scheduled_time}</p>
                )}
              </div>
              <span
                className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${pCfg.bg} ${pCfg.text} uppercase tracking-wide`}
              >
                {pCfg.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default TechJobList;
