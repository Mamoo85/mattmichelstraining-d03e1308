// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FieldJob } from "./TechJobList";
import JobParts from "./JobParts";
import SignaturePad from "./SignaturePad";

interface TechJobDetailProps {
  job: FieldJob;
  techId: string;
  onBack: () => void;
  onStatusChange: (jobId: string, status: string) => void;
}

const priorityConfig: Record<string, { label: string; bg: string; text: string }> = {
  emergency: { label: "EMERGENCY", bg: "bg-red-600", text: "text-white" },
  high: { label: "HIGH", bg: "bg-orange-500", text: "text-white" },
  normal: { label: "NORMAL", bg: "bg-teal-500", text: "text-white" },
  low: { label: "LOW", bg: "bg-gray-500", text: "text-white" },
};

const nextStatusFlow: Record<string, { label: string; value: string; bg: string }> = {
  assigned: { label: "En Route", value: "en_route", bg: "bg-teal-500 hover:bg-teal-600" },
  en_route: { label: "On Site", value: "on_site", bg: "bg-orange-500 hover:bg-orange-600" },
  on_site: { label: "Complete Job", value: "completed", bg: "bg-green-600 hover:bg-green-700" },
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Capture GPS and write to tech_locations */
async function captureGPS(techId: string, clientId: string | undefined) {
  if (!navigator.geolocation || techId === "demo") return;
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      })
    );
    await supabase.from("tech_locations").upsert(
      {
        tech_id: techId,
        client_id: clientId || null,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tech_id" }
    );
  } catch (err) {
    console.warn("GPS capture failed:", err);
  }
}

const TechJobDetail: React.FC<TechJobDetailProps> = ({ job, techId, onBack, onStatusChange }) => {
  const [currentStatus, setCurrentStatus] = useState(job.status);
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [onSiteStart, setOnSiteStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showSignature, setShowSignature] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pCfg = priorityConfig[job.priority] ?? priorityConfig.normal;
  const next = nextStatusFlow[currentStatus];

  useEffect(() => {
    if (currentStatus === "on_site" && !onSiteStart) setOnSiteStart(new Date());
  }, [currentStatus]);

  useEffect(() => {
    if (currentStatus === "on_site" && onSiteStart) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - onSiteStart.getTime()) / 1000));
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [currentStatus, onSiteStart]);

  // Continuous GPS pinging every 30s while en_route
  useEffect(() => {
    if (currentStatus !== "en_route" || techId === "demo") return;
    captureGPS(techId, job.client_id);
    const gpsInterval = setInterval(() => {
      captureGPS(techId, job.client_id);
    }, 30000);
    return () => clearInterval(gpsInterval);
  }, [currentStatus, techId, job.client_id]);

  const executeStatusChange = async (skipSignature = false) => {
    if (!next || submittingStatus) return;

    // If completing, show signature pad first (unless skipped)
    if (next.value === "completed" && !skipSignature && !showSignature) {
      setShowSignature(true);
      return;
    }

    setSubmittingStatus(true);
    try {
      const updates: Record<string, unknown> = { status: next.value };
      if (next.value === "on_site") updates.started_at = new Date().toISOString();
      if (next.value === "completed") updates.completed_at = new Date().toISOString();

      const { error } = await supabase
        .from("field_service_jobs")
        .update(updates)
        .eq("id", job.id);
      if (error) throw error;

      setCurrentStatus(next.value);
      if (next.value === "on_site") setOnSiteStart(new Date());
      onStatusChange(job.id, next.value);

      // GPS check-in on status changes
      captureGPS(techId, job.client_id);

      // En-Route: fire ETA SMS to customer
      if (next.value === "en_route") {
        try {
          await supabase.functions.invoke("field-service-en-route", { body: { job_id: job.id } });
        } catch (e) { console.error("En-route notification failed:", e); }
      }

      // Completed: fire completion SMS to customer
      if (next.value === "completed") {
        try {
          await supabase.functions.invoke("field-service-job-complete-notify", { body: { job_id: job.id } });
        } catch (e) { console.error("Completion notification failed:", e); }
      }
    } catch (err) {
      console.error("Status update failed:", err);
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleSignatureSave = async (dataUrl: string) => {
    setShowSignature(false);
    try {
      // Convert data URL to blob and upload
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const path = `${job.id}/signature_${Date.now()}.png`;
      await supabase.storage.from("job-photos").upload(path, blob, { contentType: "image/png" });
      const { data: urlData } = supabase.storage.from("job-photos").getPublicUrl(path);

      // Save signature URL to job
      await supabase.from("field_service_jobs").update({ signature_url: urlData?.publicUrl }).eq("id", job.id);

      // Also save as a job photo
      await supabase.from("job_photos").insert({
        job_id: job.id,
        tech_id: techId,
        storage_path: path,
        public_url: urlData?.publicUrl ?? null,
      });
    } catch (err) {
      console.error("Signature upload failed:", err);
    }
    // Now proceed with the actual completion
    await executeStatusChange(true);
  };

  const handleSignatureSkip = async () => {
    setShowSignature(false);
    await executeStatusChange(true);
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || submittingNote) return;
    setSubmittingNote(true);
    try {
      const { error } = await supabase.from("job_notes").insert({
        job_id: job.id,
        tech_id: techId,
        note: noteText.trim(),
      });
      if (error) throw error;
      setNoteText("");
    } catch (err) {
      console.error("Note submit failed:", err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const timestamp = Date.now();
      const path = `${job.id}/${timestamp}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("job-photos")
        .upload(path, file, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("job-photos").getPublicUrl(path);
      const { error: insertError } = await supabase.from("job_photos").insert({
        job_id: job.id,
        tech_id: techId,
        storage_path: path,
        public_url: urlData?.publicUrl ?? null,
      });
      if (insertError) throw insertError;
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const mapsUrl = job.customer
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${job.customer.address} ${job.customer.city}`
      )}`
    : null;

  const phoneUrl = job.customer?.phone ? `tel:${job.customer.phone}` : null;

  return (
    <div className="min-h-screen bg-[#0a1628] text-white pb-12">
      {/* Signature Modal */}
      {showSignature && (
        <SignaturePad onSave={handleSignatureSave} onCancel={handleSignatureSkip} />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1e3a5f]">
        <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0f1f35] border border-[#1e3a5f] text-white" aria-label="Back">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-tight truncate">{job.title}</h1>
        </div>
        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${pCfg.bg} ${pCfg.text} uppercase`}>{pCfg.label}</span>
      </div>

      <div className="px-4 space-y-6 mt-6">
        {/* Dispatcher Notes — highlighted callout */}
        {job.notes && (
          <div className="bg-amber-900/30 border border-amber-500/40 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-sm">📋</span>
              <p className="text-amber-300 text-xs uppercase tracking-wide font-bold">Dispatcher Notes</p>
            </div>
            <p className="text-amber-100 text-sm leading-relaxed">{job.notes}</p>
          </div>
        )}

        {/* Customer Info */}
        {job.customer && (
          <div className="bg-[#0f1f35] rounded-2xl p-4 border border-[#1e3a5f] space-y-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide">Customer</p>
            <p className="text-white font-semibold text-lg">{job.customer.company_name}</p>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block text-[#00d4ff] text-sm underline">
                {job.customer.address}, {job.customer.city}
              </a>
            )}
            {phoneUrl && (
              <a href={phoneUrl} className="block text-[#00d4ff] text-sm font-semibold">📞 {job.customer.phone}</a>
            )}
          </div>
        )}

        {/* Status / Timer */}
        <div className="bg-[#0f1f35] rounded-2xl p-4 border border-[#1e3a5f] space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-xs uppercase tracking-wide">Status</p>
            <span className="text-white font-semibold capitalize">{currentStatus.replace("_", " ")}</span>
          </div>
          {currentStatus === "on_site" && onSiteStart && (
            <div className="text-center py-2">
              <p className="text-gray-400 text-xs uppercase tracking-wide">Time on Site</p>
              <p className="text-[#00d4ff] text-3xl font-mono font-bold mt-1">{formatElapsed(elapsed)}</p>
            </div>
          )}
          {next && (
            <button
              onClick={() => executeStatusChange()}
              disabled={submittingStatus}
              className={`w-full py-4 rounded-xl text-white font-bold text-lg ${next.bg} disabled:opacity-50 transition-colors`}
            >
              {submittingStatus ? "Updating..." : next.label}
            </button>
          )}
          {currentStatus === "completed" && (
            <div className="text-center py-2">
              <p className="text-green-400 font-bold text-lg">Job Complete ✓</p>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-[#0f1f35] rounded-2xl p-4 border border-[#1e3a5f] space-y-3">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Add Note</p>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Type a note about this job..." rows={3} className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-3 py-2 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-[#00d4ff]" />
          <button onClick={handleAddNote} disabled={submittingNote || !noteText.trim()} className="w-full py-3 rounded-xl bg-[#00d4ff] text-[#0a1628] font-bold disabled:opacity-40 transition-opacity">
            {submittingNote ? "Saving..." : "Save Note"}
          </button>
        </div>

        {/* Photo Upload */}
        <div className="bg-[#0f1f35] rounded-2xl p-4 border border-[#1e3a5f] space-y-3">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Upload Photo</p>
          <label className="block w-full py-4 rounded-xl border-2 border-dashed border-[#1e3a5f] text-center cursor-pointer hover:border-[#00d4ff] transition-colors">
            <span className="text-gray-300 text-sm">{uploadingPhoto ? "Uploading..." : "📷 Take or Choose Photo"}</span>
            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} disabled={uploadingPhoto} className="hidden" />
          </label>
        </div>

        {/* Parts Used */}
        <div className="bg-[#0f1f35] rounded-2xl p-4 border border-[#1e3a5f] space-y-3">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Parts Used</p>
          <JobParts jobId={job.id} />
        </div>

        {/* Description */}
        {job.description && (
          <div className="bg-[#0f1f35] rounded-2xl p-4 border border-[#1e3a5f]">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Job Description</p>
            <p className="text-gray-300 text-sm leading-relaxed">{job.description}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TechJobDetail;
