import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import TechLogin from "@/components/field-service/TechLogin";
import TechJobList, { type FieldJob } from "@/components/field-service/TechJobList";
import TechJobDetail from "@/components/field-service/TechJobDetail";

interface Tech {
  id: string;
  name: string;
  client_id: string;
}

export default function FieldServiceTechApp() {
  const [tech, setTech] = useState<Tech | null>(null);
  const [jobs, setJobs] = useState<FieldJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<FieldJob | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const fetchJobs = useCallback(async (techId: string) => {
    setLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from("field_service_jobs")
        .select(
          "id, title, description, priority, status, scheduled_date, scheduled_time, notes, field_service_customers(company_name, address, city, phone)"
        )
        .eq("assigned_tech_id", techId)
        .eq("scheduled_date", today)
        .not("status", "in", '("completed","invoiced")')
        .order("scheduled_time", { ascending: true });

      if (error) throw error;

      const mapped: FieldJob[] = (data ?? []).map((row: Record<string, unknown>) => {
        const cust = row.field_service_customers as Record<string, string> | null;
        return {
          id: row.id as string,
          title: row.title as string,
          description: (row.description as string | null) ?? null,
          priority: (row.priority as FieldJob["priority"]) ?? "normal",
          status: row.status as string,
          scheduled_date: (row.scheduled_date as string | null) ?? null,
          scheduled_time: (row.scheduled_time as string | null) ?? null,
          notes: (row.notes as string | null) ?? null,
          customer: cust
            ? {
                company_name: cust.company_name ?? "",
                address: cust.address ?? "",
                city: cust.city ?? "",
                phone: cust.phone ?? "",
              }
            : null,
        };
      });

      setJobs(mapped);
    } catch (err) {
      console.error("fetchJobs error:", err);
    } finally {
      setLoadingJobs(false);
    }
  }, [today]);

  useEffect(() => {
    if (tech) {
      fetchJobs(tech.id);
    }
  }, [tech, fetchJobs]);

  const handleStatusChange = (jobId: string, status: string) => {
    // Optimistically update local state then re-fetch
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status } : j))
    );
    if (selectedJob?.id === jobId) {
      setSelectedJob((prev) => (prev ? { ...prev, status } : prev));
    }
    if (tech) {
      fetchJobs(tech.id);
    }
  };

  if (!tech) {
    return <TechLogin onLogin={setTech} />;
  }

  if (selectedJob) {
    return (
      <TechJobDetail
        job={selectedJob}
        techId={tech.id}
        onBack={() => setSelectedJob(null)}
        onStatusChange={handleStatusChange}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-[#1e3a5f]">
        <div>
          <span className="font-black text-sm tracking-tight text-white">DETROIT</span>
          <span className="text-[#00d4ff] font-black text-sm tracking-tight"> WEB AGENCY</span>
        </div>
        <div className="text-right">
          <p className="text-white text-sm font-semibold">{tech.name}</p>
          <button
            onClick={() => setTech(null)}
            className="text-gray-500 text-xs hover:text-gray-300"
          >
            Sign Out
          </button>
        </div>
      </header>

      {loadingJobs ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">Loading jobs...</p>
        </div>
      ) : (
        <TechJobList jobs={jobs} onSelect={setSelectedJob} />
      )}
    </div>
  );
}
