// @ts-nocheck
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import TechLogin from "@/components/field-service/TechLogin";
import TechJobList, { type FieldJob } from "@/components/field-service/TechJobList";
import TechJobDetail from "@/components/field-service/TechJobDetail";
import {
  addToOfflineQueue,
  cacheJobs,
  getCachedJobs,
  getOfflineQueue,
  clearOfflineQueue,
} from "@/lib/fieldServiceOfflineQueue";

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const syncOfflineQueue = useCallback(async (techId: string) => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    setSyncing(true);
    try {
      for (const item of queue) {
        const updates: Record<string, unknown> = { status: item.status };
        if (item.status === "on_site") updates.started_at = item.timestamp;
        if (item.status === "completed") updates.completed_at = item.timestamp;
        await supabase
          .from("field_service_jobs")
          .update(updates)
          .eq("id", item.jobId);
      }
      clearOfflineQueue();
      // Re-fetch after syncing
      await fetchJobs(techId);
    } catch (err) {
      console.error("Sync queue error:", err);
    } finally {
      // Keep syncing banner visible briefly then hide
      setTimeout(() => setSyncing(false), 2000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When coming back online, sync the queue
  useEffect(() => {
    if (isOnline && tech) {
      syncOfflineQueue(tech.id);
    }
  }, [isOnline, tech, syncOfflineQueue]);

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
      cacheJobs(techId, mapped);
    } catch (err) {
      console.error("fetchJobs error:", err);
      // If offline or fetch fails, load from cache
      if (!navigator.onLine) {
        const cached = getCachedJobs(techId) as FieldJob[];
        if (cached.length > 0) {
          setJobs(cached);
        }
      }
    } finally {
      setLoadingJobs(false);
    }
  }, [today]);

  useEffect(() => {
    if (tech) {
      fetchJobs(tech.id);
    }
  }, [tech, fetchJobs]);

  const handleStatusChange = useCallback(
    async (jobId: string, status: string) => {
      // Optimistic local update
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status } : j))
      );
      if (selectedJob?.id === jobId) {
        setSelectedJob((prev) => (prev ? { ...prev, status } : prev));
      }

      if (!navigator.onLine) {
        // Queue for later sync
        addToOfflineQueue({ jobId, status, timestamp: new Date().toISOString() });
        return;
      }

      // Online — try direct update then refetch
      try {
        const updates: Record<string, unknown> = { status };
        if (status === "on_site") updates.started_at = new Date().toISOString();
        if (status === "completed") updates.completed_at = new Date().toISOString();
        const { error } = await supabase
          .from("field_service_jobs")
          .update(updates)
          .eq("id", jobId);
        if (error) throw error;
        if (tech) await fetchJobs(tech.id);
      } catch (err) {
        console.error("Status update error — queuing for offline sync:", err);
        addToOfflineQueue({ jobId, status, timestamp: new Date().toISOString() });
      }
    },
    [selectedJob, tech, fetchJobs]
  );

  if (!tech) {
    return <TechLogin onLogin={setTech} />;
  }

  if (selectedJob) {
    return (
      <>
        {!isOnline && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600/90 text-white text-center text-xs font-semibold py-2 px-4">
            You're offline — changes will sync when connection returns
          </div>
        )}
        {syncing && isOnline && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-[#00d4ff]/90 text-[#0a1628] text-center text-xs font-semibold py-2 px-4">
            Syncing offline changes...
          </div>
        )}
        <div className={!isOnline || syncing ? "pt-8" : ""}>
          <TechJobDetail
            job={selectedJob}
            techId={tech.id}
            onBack={() => setSelectedJob(null)}
            onStatusChange={handleStatusChange}
          />
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-yellow-600/90 text-white text-center text-xs font-semibold py-2 px-4">
          You're offline — changes will sync when connection returns
        </div>
      )}

      {/* Syncing banner */}
      {syncing && isOnline && (
        <div className="bg-[#00d4ff]/90 text-[#0a1628] text-center text-xs font-semibold py-2 px-4">
          Syncing offline changes...
        </div>
      )}

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
