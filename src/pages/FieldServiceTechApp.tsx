/* eslint-disable @typescript-eslint/ban-ts-comment */
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
import InstallAppBanner from "@/components/shared/InstallAppBanner";

interface Tech {
  id: string;
  name: string;
  client_id: string;
}

type AppTab = "today" | "history";

const DEMO_TECH: Tech = { id: "demo", name: "Mike Johnson", client_id: "demo" };

const DEMO_TECH_JOBS: FieldJob[] = [
  { id: "d1", title: "Emergency: High-Pressure Alarm", description: "Boiler tripped high-limit at 175 PSI. Investigate and reset.", priority: "emergency", status: "en_route", scheduled_date: new Date().toISOString().split("T")[0], scheduled_time: "07:30", notes: "Contact: Dave Kotrba (plant manager). Gate code: 4521.", customer: { company_name: "Chrysler Sterling Heights Assembly", address: "38111 Van Dyke Ave", city: "Sterling Heights", phone: "(586) 939-7000" } },
  { id: "d2", title: "Annual Boiler Tune-Up", description: "Full safety inspection, combustion analysis, and CSD-1 test.", priority: "high", status: "open", scheduled_date: new Date().toISOString().split("T")[0], scheduled_time: "13:30", notes: "Unit 2 — East Powerhouse", customer: { company_name: "Ford Motor Co. — River Rouge", address: "3001 Miller Rd", city: "Dearborn", phone: "(313) 845-8540" } },
];

const DEMO_HISTORY_JOBS: FieldJob[] = [
  { id: "h1", title: "Boiler Feed Water Pump Repair", description: "Replaced packing and bearings on BFW pump #3.", priority: "normal", status: "completed", scheduled_date: new Date(Date.now() - 86400000).toISOString().split("T")[0], scheduled_time: "08:00", notes: "Parts: 2x packing rings, 1x bearing kit", customer: { company_name: "GM Technical Center — Warren", address: "30001 Van Dyke Ave", city: "Warren", phone: "(586) 986-5000" } },
  { id: "h2", title: "Safety Valve Replacement", description: "Replaced 150 PSI safety relief valve on Unit 1.", priority: "high", status: "completed", scheduled_date: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0], scheduled_time: "09:00", notes: null, customer: { company_name: "Ford Motor Co. — River Rouge", address: "3001 Miller Rd", city: "Dearborn", phone: "(313) 845-8540" } },
];

const TECH_TOKEN_KEY = "fielddesk.tech_session_token";
const TECH_INFO_KEY = "fielddesk.tech_info";

function loadStoredSession(): { tech: Tech; token: string } | null {
  try {
    const token = localStorage.getItem(TECH_TOKEN_KEY);
    const raw = localStorage.getItem(TECH_INFO_KEY);
    if (!token || !raw) return null;
    const tech = JSON.parse(raw) as Tech;
    if (!tech?.id || !tech?.client_id) return null;
    return { tech, token };
  } catch { return null; }
}

export default function FieldServiceTechApp() {
  const isDemo = new URLSearchParams(window.location.search).get("demo") === "1";
  const stored = loadStoredSession();
  const [tech, setTech] = useState<Tech | null>(isDemo ? DEMO_TECH : (stored?.tech ?? null));
  const [sessionToken, setSessionToken] = useState<string | null>(isDemo ? "demo" : (stored?.token ?? null));
  const [jobs, setJobs] = useState<FieldJob[]>([]);
  const [historyJobs, setHistoryJobs] = useState<FieldJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<FieldJob | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("today");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  // Map raw row from edge function -> FieldJob
  const mapRow = (row: Record<string, unknown>): FieldJob => {
    const cust = row.field_service_customers as Record<string, string> | null;
    return {
      id: row.id as string, title: row.title as string, description: (row.description as string | null) ?? null,
      priority: (row.priority as FieldJob["priority"]) ?? "normal", status: row.status as string,
      scheduled_date: (row.scheduled_date as string | null) ?? null, scheduled_time: (row.scheduled_time as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      customer: cust ? { company_name: cust.company_name ?? "", address: cust.address ?? "", city: cust.city ?? "", phone: cust.phone ?? "" } : null,
    };
  };

  const handleSignOut = useCallback(() => {
    localStorage.removeItem(TECH_TOKEN_KEY);
    localStorage.removeItem(TECH_INFO_KEY);
    setSessionToken(null);
    setTech(null);
  }, []);

  const syncOfflineQueue = useCallback(async (techId: string, token: string) => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    setSyncing(true);
    try {
      for (const item of queue) {
        await supabase.functions.invoke("tech-job-update", {
          body: { token, job_id: item.jobId, status: item.status, timestamp: item.timestamp },
        });
      }
      clearOfflineQueue();
      await fetchJobs(techId, token);
    } catch (err) { console.error("Sync queue error:", err); }
    finally { setTimeout(() => setSyncing(false), 2000); }
  }, []);

  useEffect(() => {
    if (isOnline && tech && sessionToken && sessionToken !== "demo") {
      syncOfflineQueue(tech.id, sessionToken);
    }
  }, [isOnline, tech, sessionToken, syncOfflineQueue]);

  const fetchJobs = useCallback(async (techId: string, token: string) => {
    if (techId === "demo") { setJobs(DEMO_TECH_JOBS); return; }
    setLoadingJobs(true);
    try {
      const { data, error } = await supabase.functions.invoke("tech-jobs-get", {
        body: { token, scope: "today" },
      });
      if (error) throw error;
      if (data?.error === "invalid_session") { handleSignOut(); return; }
      const mapped: FieldJob[] = (data?.jobs ?? []).map(mapRow);
      setJobs(mapped);
      cacheJobs(techId, mapped);
    } catch (err) {
      console.error("fetchJobs error:", err);
      if (!navigator.onLine) {
        const cached = getCachedJobs(techId) as FieldJob[];
        if (cached.length > 0) setJobs(cached);
      }
    } finally { setLoadingJobs(false); }
  }, [handleSignOut]);

  const fetchHistory = useCallback(async (techId: string, token: string) => {
    if (techId === "demo") { setHistoryJobs(DEMO_HISTORY_JOBS); return; }
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase.functions.invoke("tech-jobs-get", {
        body: { token, scope: "history" },
      });
      if (error) throw error;
      if (data?.error === "invalid_session") { handleSignOut(); return; }
      const mapped: FieldJob[] = (data?.jobs ?? []).map(mapRow);
      setHistoryJobs(mapped);
    } catch (err) { console.error("fetchHistory error:", err); }
    finally { setLoadingHistory(false); }
  }, [handleSignOut]);

  useEffect(() => {
    if (tech && sessionToken) {
      fetchJobs(tech.id, sessionToken);
      fetchHistory(tech.id, sessionToken);
    }
  }, [tech, sessionToken, fetchJobs, fetchHistory]);

  const handleStatusChange = useCallback(
    async (jobId: string, status: string) => {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
      if (selectedJob?.id === jobId) setSelectedJob((prev) => (prev ? { ...prev, status } : prev));
      if (!navigator.onLine || !sessionToken || sessionToken === "demo") {
        if (sessionToken !== "demo") {
          addToOfflineQueue({ jobId, status, timestamp: new Date().toISOString() });
        }
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("tech-job-update", {
          body: { token: sessionToken, job_id: jobId, status, timestamp: new Date().toISOString() },
        });
        if (error) throw error;
        if (data?.error === "invalid_session") { handleSignOut(); return; }
        if (tech) await fetchJobs(tech.id, sessionToken);
      } catch (err) {
        console.error("Status update error — queuing for offline sync:", err);
        addToOfflineQueue({ jobId, status, timestamp: new Date().toISOString() });
      }
    },
    [selectedJob, tech, sessionToken, fetchJobs, handleSignOut]
  );

  const handleLogin = useCallback((newTech: Tech, token: string) => {
    try {
      localStorage.setItem(TECH_TOKEN_KEY, token);
      localStorage.setItem(TECH_INFO_KEY, JSON.stringify(newTech));
    } catch { /* storage may be disabled */ }
    setSessionToken(token);
    setTech(newTech);
  }, []);

  if (!tech) return <TechLogin onLogin={handleLogin} />;

  if (selectedJob) {
    return (
      <>
        {!isOnline && <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600/90 text-white text-center text-xs font-semibold py-2 px-4">You're offline — changes will sync when connection returns</div>}
        {syncing && isOnline && <div className="fixed top-0 left-0 right-0 z-50 bg-[#00d4ff]/90 text-[#0a1628] text-center text-xs font-semibold py-2 px-4">Syncing offline changes...</div>}
        <div className={!isOnline || syncing ? "pt-8" : ""}>
          <TechJobDetail job={selectedJob} techId={tech.id} onBack={() => setSelectedJob(null)} onStatusChange={handleStatusChange} />
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {!isOnline && <div className="bg-yellow-600/90 text-white text-center text-xs font-semibold py-2 px-4">You're offline — changes will sync when connection returns</div>}
      {syncing && isOnline && <div className="bg-[#00d4ff]/90 text-[#0a1628] text-center text-xs font-semibold py-2 px-4">Syncing offline changes...</div>}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-[#1e3a5f]">
        <div>
          <span className="font-black text-sm tracking-tight text-white">DETROIT</span>
          <span className="text-[#00d4ff] font-black text-sm tracking-tight"> WEB AGENCY</span>
        </div>
        <div className="text-right">
          <p className="text-white text-sm font-semibold">{tech.name}</p>
          <button onClick={() => setTech(null)} className="text-gray-500 text-xs hover:text-gray-300">Sign Out</button>
        </div>
      </header>

      {/* One-tap install — primary onboarding moment for techs in the truck */}
      <div className="px-4 pt-3">
        <InstallAppBanner app="fielddesk" />
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-[#1e3a5f]">
        <button
          onClick={() => setActiveTab("today")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            activeTab === "today" ? "text-[#00d4ff] border-b-2 border-[#00d4ff]" : "text-gray-400 hover:text-white"
          }`}
        >
          Today ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            activeTab === "history" ? "text-[#00d4ff] border-b-2 border-[#00d4ff]" : "text-gray-400 hover:text-white"
          }`}
        >
          History ({historyJobs.length})
        </button>
      </div>

      {activeTab === "today" ? (
        loadingJobs ? (
          <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading jobs...</p></div>
        ) : (
          <TechJobList jobs={jobs} onSelect={setSelectedJob} />
        )
      ) : (
        loadingHistory ? (
          <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading history...</p></div>
        ) : historyJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-6">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-white text-xl font-semibold text-center">No completed jobs in the last 14 days</p>
          </div>
        ) : (
          <div className="space-y-4 px-4 py-4">
            {historyJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className="w-full text-left rounded-2xl p-5 bg-[#0f1f35] border border-[#1e3a5f] shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-lg leading-tight truncate">{job.title}</p>
                    {job.customer && <p className="text-gray-300 text-sm mt-1 font-medium">{job.customer.company_name}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500 text-xs">{job.scheduled_date}</span>
                      {job.scheduled_time && <span className="text-gray-500 text-xs">at {job.scheduled_time}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-green-500/20 text-green-300">✓ Done</span>
                </div>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
