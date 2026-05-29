import { useState } from "react";
import { Button } from "@/components/ui/button";
import { podSupabase } from "@/integrations/supabase/podClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, Copy, Check, Download, Play, RefreshCw,
  Film, ExternalLink, Zap, Trash2, Pause, Radio,
  BarChart2, Video, Clock, AlertCircle,
} from "lucide-react";

const POD_URL = "https://zmyczlfuufhngzovkjdh.supabase.co";
const POD_ANON =
  "eyJ.REDACTED.JWT";

// ── Types ─────────────────────────────────────────────────────────────────────
interface StorageFile {
  name: string;
  created_at?: string;
  updated_at?: string;
  metadata?: { size?: number };
}

interface HeygenJob {
  id: string;
  heygen_video_id: string;
  status: string;
  title: string;
  niche: string;
  video_url?: string;
  source?: string;
  error?: string;
  created_at: string;
}

interface MetaInsights {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
}

interface MetaStatsResult {
  campaignId: string;
  campaign?: { name?: string; status?: string; daily_budget?: string; created_time?: string };
  insights?: MetaInsights | null;
  adSets?: Array<{ name: string; status: string; daily_budget?: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const CopyButton = ({ text, label = "Copy" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied!"); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-white/20 rounded hover:border-[#00d4ff]/40 transition-colors text-white/60 hover:text-white"
    >
      {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
      {label}
    </button>
  );
};

function formatBytes(b?: number) {
  if (!b) return "?";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusColor(s: string) {
  if (s === "rendered" || s === "complete") return "text-green-400 bg-green-500/15 border-green-500/30";
  if (s === "processing" || s === "pending") return "text-yellow-400 bg-yellow-500/15 border-yellow-500/30";
  if (s === "failed") return "text-red-400 bg-red-500/15 border-red-500/30";
  return "text-white/40 bg-white/5 border-white/10";
}

function metaStatusColor(s?: string) {
  if (s === "ACTIVE") return "text-green-400 bg-green-500/15 border-green-500/30";
  if (s === "PAUSED") return "text-yellow-400 bg-yellow-500/15 border-yellow-500/30";
  return "text-white/40 bg-white/5 border-white/10";
}

// ── Elapsed timer ─────────────────────────────────────────────────────────────
function ElapsedTimer({ startMs }: { startMs: number }) {
  const [elapsed, setElapsed] = useState(0);
  useState(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startMs) / 1000)), 1000);
    return () => clearInterval(id);
  });
  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  return <span className="font-mono text-[#00d4ff]">{m}:{String(s).padStart(2, "0")}</span>;
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function callPod(path: string, body: unknown) {
  const res = await fetch(`${POD_URL}/functions/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${POD_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  return res.json();
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminDwaAdStudio() {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [genStart, setGenStart] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{ success: boolean; backgroundVideoUrl?: string; slides?: number; totalSecs?: number; bytes?: number; error?: string } | null>(null);
  const [heygenStatus, setHeygenStatus] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [toggling, setToggling] = useState(false);

  // ── Storage files ──────────────────────────────────────────────────────────
  const { data: files, isLoading: filesLoading } = useQuery<StorageFile[]>({
    queryKey: ["dwa-bg-files"],
    queryFn: async () => {
      const { data, error } = await podSupabase.storage
        .from("ad-creatives")
        .list("dwa-backgrounds", { limit: 50, sortBy: { column: "created_at", order: "desc" } });
      if (error) {
        if (error.message?.includes("not found") || error.message?.includes("Not Found")) return [];
        throw error;
      }
      return (data ?? []).filter((f) => f.name.endsWith(".avi"));
    },
  });

  // ── HeyGen jobs ────────────────────────────────────────────────────────────
  const { data: heygenJobs, isLoading: jobsLoading } = useQuery<HeygenJob[]>({
    queryKey: ["heygen-dwa-jobs"],
    queryFn: async () => {
      const { data, error } = await podSupabase
        .from("heygen_jobs" as any)
        .select("id,heygen_video_id,status,title,niche,video_url,source,error,created_at")
        .eq("source", "dwa_meta_video_ad")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as HeygenJob[];
    },
    refetchInterval: 15_000, // poll every 15s — jobs transition pending→rendering→rendered
  });

  // ── Meta campaign stats ────────────────────────────────────────────────────
  const { data: metaStats, isLoading: metaLoading, refetch: refetchMeta } = useQuery<MetaStatsResult>({
    queryKey: ["meta-campaign-stats-dwa"],
    queryFn: async () => {
      const data = await callPod("meta-ads-poster", { campaignStats: "dwa" });
      return data as MetaStatsResult;
    },
    staleTime: 5 * 60 * 1000, // re-fetch every 5 min
    retry: 1,
  });

  const getPublicUrl = (name: string) =>
    podSupabase.storage.from("ad-creatives").getPublicUrl(`dwa-backgrounds/${name}`).data.publicUrl;

  // ── Generate new background ────────────────────────────────────────────────
  const generate = async () => {
    setGenerating(true);
    setGenStart(Date.now());
    setLastResult(null);
    try {
      const res = await fetch(`${POD_URL}/functions/v1/dwa-ad-background-generator`, {
        method: "POST",
        headers: { Authorization: `Bearer ${POD_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(210_000),
      });
      const data = await res.json();
      setLastResult(data);
      if (data.success) {
        toast.success("Background video generated!");
        qc.invalidateQueries({ queryKey: ["dwa-bg-files"] });
      } else {
        toast.error("Generation failed: " + (data.error ?? "Unknown error"));
      }
    } catch (e: unknown) {
      const msg = String(e);
      setLastResult({ success: false, error: msg });
      toast.error("Generation failed: " + msg);
    } finally {
      setGenerating(false);
      setGenStart(null);
    }
  };

  // ── Submit to HeyGen ───────────────────────────────────────────────────────
  const submitToHeygen = async (url: string, filename: string) => {
    setHeygenStatus((p) => ({ ...p, [filename]: "loading" }));
    try {
      const data = await callPod("dwa-video-ad", { backgroundVideoUrl: url });
      if (data.error) throw new Error(data.error);
      setHeygenStatus((p) => ({ ...p, [filename]: "submitted" }));
      toast.success("Submitted to HeyGen! Renders in ~3 min, then auto-posts to Meta.");
      qc.invalidateQueries({ queryKey: ["heygen-dwa-jobs"] });
    } catch (e: unknown) {
      setHeygenStatus((p) => ({ ...p, [filename]: "error" }));
      toast.error("HeyGen submit failed: " + String(e));
    }
  };

  // ── Delete background file ─────────────────────────────────────────────────
  const deleteFile = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    setDeleting((p) => ({ ...p, [name]: true }));
    try {
      const { error } = await podSupabase.storage
        .from("ad-creatives")
        .remove([`dwa-backgrounds/${name}`]);
      if (error) throw error;
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["dwa-bg-files"] });
    } catch (e: unknown) {
      toast.error("Delete failed: " + String(e));
    } finally {
      setDeleting((p) => ({ ...p, [name]: false }));
    }
  };

  // ── Toggle Meta campaign ───────────────────────────────────────────────────
  const toggleCampaign = async (newStatus: "ACTIVE" | "PAUSED") => {
    setToggling(true);
    try {
      const data = await callPod("meta-ads-poster", { toggleCampaignStatus: "dwa", newStatus });
      if (!data.success) throw new Error(data.error ?? "Toggle failed");
      toast.success(`Campaign ${newStatus === "ACTIVE" ? "activated" : "paused"}!`);
      qc.invalidateQueries({ queryKey: ["meta-campaign-stats-dwa"] });
      refetchMeta();
    } catch (e: unknown) {
      toast.error("Toggle failed: " + String(e));
    } finally {
      setToggling(false);
    }
  };

  const campaignStatus = metaStats?.campaign?.status;
  const insights = metaStats?.insights;

  return (
    <div className="space-y-6 text-white">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Film size={16} className="text-[#00d4ff]" />
            DWA Ad Background Studio
          </h2>
          <p className="text-xs text-white/50 mt-1">
            End-to-end Meta ad pipeline: generate slideshow background → HeyGen renders talking head → Meta campaign goes live.
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 text-[11px] gap-1.5 bg-[#1d4ed8] hover:bg-[#2563eb] shrink-0"
          onClick={generate}
          disabled={generating}
        >
          {generating ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
          {generating ? "Generating…" : "Generate New Background"}
        </Button>
      </div>

      {/* ── Meta Campaign Status ── */}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/10">
          <span className="text-xs font-semibold flex items-center gap-2">
            <BarChart2 size={13} className="text-[#00d4ff]" /> Meta Campaign
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => refetchMeta()} className="text-white/30 hover:text-white transition-colors">
              <RefreshCw size={11} />
            </button>
            <a
              href="https://www.facebook.com/adsmanager/manage/campaigns"
              target="_blank" rel="noreferrer"
              className="text-[10px] text-[#00d4ff] hover:underline flex items-center gap-1"
            >
              Ads Manager <ExternalLink size={9} />
            </a>
          </div>
        </div>

        {metaLoading && (
          <div className="flex items-center gap-2 p-4 text-white/40">
            <Loader2 size={12} className="animate-spin" /> <span className="text-xs">Loading campaign stats…</span>
          </div>
        )}

        {!metaLoading && metaStats?.campaign && (
          <div className="p-4 space-y-4">
            {/* Status row */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs font-semibold truncate max-w-[240px]">{metaStats.campaign.name ?? "DWA Campaign"}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">ID: {metaStats.campaignId}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${metaStatusColor(campaignStatus)}`}>
                  {campaignStatus ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {campaignStatus === "PAUSED" && (
                  <Button
                    size="sm"
                    className="h-7 text-[10px] gap-1 bg-green-600 hover:bg-green-700"
                    onClick={() => toggleCampaign("ACTIVE")}
                    disabled={toggling}
                  >
                    {toggling ? <Loader2 size={10} className="animate-spin" /> : <Radio size={10} />}
                    Activate
                  </Button>
                )}
                {campaignStatus === "ACTIVE" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] gap-1 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => toggleCampaign("PAUSED")}
                    disabled={toggling}
                  >
                    {toggling ? <Loader2 size={10} className="animate-spin" /> : <Pause size={10} />}
                    Pause
                  </Button>
                )}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Spend", value: insights?.spend ? `$${parseFloat(insights.spend).toFixed(2)}` : "$0.00", sub: "last 30 days" },
                { label: "Impressions", value: insights?.impressions ? parseInt(insights.impressions).toLocaleString() : "0", sub: "last 30 days" },
                { label: "Clicks", value: insights?.clicks ? parseInt(insights.clicks).toLocaleString() : "0", sub: "last 30 days" },
                { label: "CTR", value: insights?.ctr ? `${parseFloat(insights.ctr).toFixed(2)}%` : "—", sub: "click-through rate" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">{stat.value}</p>
                  <p className="text-[9px] font-semibold text-white/60 uppercase tracking-wide mt-0.5">{stat.label}</p>
                  <p className="text-[9px] text-white/30">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Daily budget */}
            {metaStats.campaign.daily_budget && (
              <p className="text-[10px] text-white/40">
                Daily budget: ${(parseInt(metaStats.campaign.daily_budget) / 100).toFixed(2)} ·{" "}
                Created: {new Date(metaStats.campaign.created_time!).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {!metaLoading && !metaStats?.campaign && (
          <div className="p-4 flex items-center gap-2 text-white/40">
            <AlertCircle size={13} /> <span className="text-xs">Could not load campaign stats — check META_USER_ACCESS_TOKEN secret</span>
          </div>
        )}
      </div>

      {/* ── Active generation progress ── */}
      {generating && genStart && (
        <div className="border border-[#1d4ed8]/40 rounded-lg bg-[#1d4ed8]/10 p-4">
          <div className="flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-[#00d4ff] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Building 30-second background video…</p>
              <p className="text-xs text-white/50 mt-0.5">
                Capturing DWA screenshots · Generating 3 AI product mockups · Compositing text overlays · Assembling MJPEG AVI
              </p>
            </div>
            <div className="text-right shrink-0">
              <ElapsedTimer startMs={genStart} />
              <p className="text-[10px] text-white/40 mt-0.5">~2 min total</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[#00d4ff] rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(95, ((Date.now() - genStart) / 120000) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Last result ── */}
      {lastResult && !generating && (
        <div className={`border rounded-lg p-4 ${lastResult.success ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          {lastResult.success ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-green-400">✓ Background generated</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-white/60">{lastResult.slides} slides · {lastResult.totalSecs}s · {formatBytes(lastResult.bytes)}</span>
                {lastResult.backgroundVideoUrl && <CopyButton text={lastResult.backgroundVideoUrl} label="Copy URL" />}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-red-400">✗ Failed</p>
              <p className="text-[11px] text-white/60 mt-1 font-mono">{lastResult.error}</p>
            </div>
          )}
        </div>
      )}

      {/* ── HeyGen Jobs ── */}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/10">
          <span className="text-xs font-semibold flex items-center gap-2">
            <Video size={13} className="text-[#00d4ff]" /> HeyGen Render Jobs
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => qc.invalidateQueries({ queryKey: ["heygen-dwa-jobs"] })} className="text-white/30 hover:text-white transition-colors">
              <RefreshCw size={11} />
            </button>
            <span className="text-[10px] text-white/30">Auto-refreshes every 15s</span>
          </div>
        </div>

        {jobsLoading && (
          <div className="flex items-center gap-2 p-4 text-white/40">
            <Loader2 size={12} className="animate-spin" /> <span className="text-xs">Loading jobs…</span>
          </div>
        )}

        {!jobsLoading && (!heygenJobs || heygenJobs.length === 0) && (
          <div className="p-6 text-center text-white/30 text-xs">
            No DWA HeyGen jobs yet — submit a background to start
          </div>
        )}

        {!jobsLoading && heygenJobs && heygenJobs.length > 0 && (
          <div className="divide-y divide-white/5">
            {heygenJobs.map((job) => (
              <div key={job.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium truncate max-w-[200px]">{job.title}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${statusColor(job.status)}`}>
                      {job.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock size={9} className="text-white/30" />
                    <span className="text-[10px] text-white/40">{relativeTime(job.created_at)}</span>
                    {job.error && <span className="text-[10px] text-red-400 truncate max-w-[200px]">{job.error}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {job.video_url && (
                    <>
                      <CopyButton text={job.video_url} label="Copy MP4" />
                      <a
                        href={job.video_url}
                        download
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-white/20 rounded hover:border-white/40 transition-colors text-white/60 hover:text-white"
                      >
                        <Download size={10} /> Download
                      </a>
                      <a
                        href={job.video_url}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-white/20 rounded hover:border-white/40 transition-colors text-white/60 hover:text-white"
                      >
                        <Play size={10} /> Preview
                      </a>
                    </>
                  )}
                  {job.status === "pending" && !job.video_url && (
                    <span className="text-[10px] text-yellow-400 flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> Rendering…
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Generated backgrounds ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white/80">Background Files in Storage</h3>
          <button onClick={() => qc.invalidateQueries({ queryKey: ["dwa-bg-files"] })} className="text-white/40 hover:text-white transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>

        {filesLoading && (
          <div className="flex items-center gap-2 py-6 justify-center text-white/40">
            <Loader2 size={14} className="animate-spin" /> <span className="text-xs">Loading storage…</span>
          </div>
        )}

        {!filesLoading && (!files || files.length === 0) && (
          <div className="border border-dashed border-white/10 rounded-lg py-10 flex flex-col items-center gap-3 text-white/30">
            <Film size={28} />
            <p className="text-sm">No backgrounds yet</p>
            <Button size="sm" className="mt-2 h-8 text-[11px] gap-1.5 bg-[#1d4ed8] hover:bg-[#2563eb]" onClick={generate} disabled={generating}>
              <Zap size={11} /> Generate First Background
            </Button>
          </div>
        )}

        {!filesLoading && files && files.length > 0 && (
          <div className="space-y-2">
            {files.map((file) => {
              const publicUrl = getPublicUrl(file.name);
              const hStatus = heygenStatus[file.name];
              const tsMatch = file.name.match(/(\d{13})/);
              const fileDate = tsMatch
                ? new Date(parseInt(tsMatch[1])).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : relativeTime(file.updated_at ?? file.created_at);

              return (
                <div key={file.name} className="border border-white/10 rounded-lg bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded bg-[#1d4ed8]/30 flex items-center justify-center shrink-0">
                      <Film size={18} className="text-[#00d4ff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate text-white/90">{file.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-white/40">{fileDate}</span>
                        {file.metadata?.size && <span className="text-[10px] text-white/40">{formatBytes(file.metadata.size)}</span>}
                        <span className="text-[9px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded">30s · 1280×720</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <CopyButton text={publicUrl} label="Copy URL" />
                      <a href={publicUrl} download={file.name} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-white/20 rounded hover:border-white/40 transition-colors text-white/60 hover:text-white">
                        <Download size={10} /> Download
                      </a>
                      <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-white/20 rounded hover:border-white/40 transition-colors text-white/60 hover:text-white">
                        <ExternalLink size={10} /> Open
                      </a>
                      <Button
                        size="sm"
                        className={`h-7 text-[10px] gap-1 ${hStatus === "submitted" ? "bg-green-600 hover:bg-green-600 cursor-default" : hStatus === "error" ? "bg-red-600 hover:bg-red-700" : "bg-[#1d4ed8] hover:bg-[#2563eb]"}`}
                        onClick={() => hStatus !== "submitted" && submitToHeygen(publicUrl, file.name)}
                        disabled={hStatus === "loading" || hStatus === "submitted"}
                      >
                        {hStatus === "loading" ? <Loader2 size={10} className="animate-spin" /> : hStatus === "submitted" ? <Check size={10} /> : <Play size={10} />}
                        {hStatus === "submitted" ? "Sent to HeyGen" : hStatus === "error" ? "Retry" : "Submit to HeyGen"}
                      </Button>
                      <button
                        onClick={() => deleteFile(file.name)}
                        disabled={deleting[file.name]}
                        className="p-1.5 rounded border border-white/10 text-white/30 hover:text-red-400 hover:border-red-400/30 transition-colors"
                        title="Delete file"
                      >
                        {deleting[file.name] ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                  <div className="px-4 pb-3">
                    <code className="block text-[9px] text-white/20 font-mono truncate hover:text-white/40 transition-colors cursor-text select-all">
                      {publicUrl}
                    </code>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── How-to ── */}
      <div className="border border-dashed border-white/10 rounded-lg p-4 bg-white/3">
        <p className="text-[11px] text-white/50 leading-relaxed">
          <strong className="text-white/70">Full pipeline:</strong>{" "}
          Generate background (~$0.13, 2 min) → Submit to HeyGen (renders talking head over slideshow, ~3 min) →
          HeyGen webhook auto-uploads to Meta Ads Manager (PAUSED) → Activate campaign above when ready.
          HeyGen jobs auto-refresh. Final MP4 in the jobs list is what Meta uses.
        </p>
      </div>
    </div>
  );
}
