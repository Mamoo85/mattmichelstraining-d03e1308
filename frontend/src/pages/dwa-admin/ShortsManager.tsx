// ShortsManager.tsx — YouTube Shorts queue manager + HeyGen avatar pipeline
// Shows past posts, schedules next Short, fire faceless or HeyGen avatar Shorts
// Route: /dwa-admin/shorts

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Play, Video, Clock, CheckCircle2, AlertCircle,
  ExternalLink, Zap, RefreshCw, User, Link as LinkIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SECONDARY_URL = "https://zmyczlfuufhngzovkjdh.supabase.co";
const SECONDARY_ANON = "eyJ.REDACTED.JWT";

const NICHES = [
  { value: "trades", label: "Trades (HVAC/Electrical/Plumbing)" },
  { value: "church", label: "Church Newsletter" },
  { value: "farming", label: "Ag Price Alerts / Farming" },
  { value: "podcast", label: "Podcast Show Notes" },
  { value: "video", label: "AI Video Scripts" },
  { value: "fitness", label: "Fitness / Gym" },
  { value: "business", label: "General Business" },
  { value: "nursery", label: "Nursery / Garden" },
  { value: "kitchen", label: "Kitchen / Food" },
  { value: "home", label: "Home Improvement" },
  { value: "sidehustle", label: "Side Hustle" },
  { value: "dwa", label: "Detroit Web Agency (DWA)" },
];

type ShortRecord = {
  id: string;
  niche: string;
  title: string;
  youtube_url?: string;
  youtube_id?: string;
  type?: string;
  created_at: string;
};

type HeyGenJob = {
  id: string;
  niche: string;
  title: string;
  status: string;
  heygen_video_id: string;
  youtube_url?: string;
  created_at: string;
};

async function fetchShorts(): Promise<ShortRecord[]> {
  const res = await fetch(
    `${SECONDARY_URL}/rest/v1/youtube_shorts?select=*&order=created_at.desc&limit=20`,
    { headers: { "apikey": SECONDARY_ANON, "Authorization": `Bearer ${SECONDARY_ANON}` } }
  );
  return res.ok ? res.json() : [];
}

async function fetchHeygenJobs(): Promise<HeyGenJob[]> {
  const res = await fetch(
    `${SECONDARY_URL}/rest/v1/heygen_jobs?select=*&order=created_at.desc&limit=20`,
    { headers: { "apikey": SECONDARY_ANON, "Authorization": `Bearer ${SECONDARY_ANON}` } }
  );
  return res.ok ? res.json() : [];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    completed: { label: "Published", variant: "default" },
    pending: { label: "Pending", variant: "secondary" },
    processing: { label: "Processing", variant: "outline" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const config = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

async function fetchPinterestStatus(): Promise<{ connected: boolean; username?: string; expiresAt?: string }> {
  const res = await fetch(
    `${SECONDARY_URL}/rest/v1/pinterest_oauth_tokens?select=pinterest_username,expires_at&user_label=eq.matt&limit=1`,
    { headers: { "apikey": SECONDARY_ANON, "Authorization": `Bearer ${SECONDARY_ANON}` } }
  );
  if (!res.ok) return { connected: false };
  const data = await res.json();
  if (!data?.length) return { connected: false };
  return {
    connected: true,
    username: data[0].pinterest_username,
    expiresAt: data[0].expires_at,
  };
}

export default function ShortsManager() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [selectedNiche, setSelectedNiche] = useState("trades");
  const [firing, setFiring] = useState(false);
  const [firingHeygen, setFiringHeygen] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const { data: pinterestStatus, refetch: refetchPinterest } = useQuery({
    queryKey: ["pinterest-status"],
    queryFn: fetchPinterestStatus,
    staleTime: 60_000,
  });

  // Handle OAuth callback params (?pinterest_connected=true&username=...)
  useEffect(() => {
    const connected = searchParams.get("pinterest_connected");
    const username  = searchParams.get("username");
    const oauthPlatform = searchParams.get("platform");
    if (connected === "true" && oauthPlatform === "pinterest") {
      toast({
        title: "✅ Pinterest connected!",
        description: username ? `Connected as @${username}` : "Your Pinterest account is linked.",
      });
      refetchPinterest();
      // Clean up URL params
      const clean = new URLSearchParams(searchParams);
      clean.delete("pinterest_connected");
      clean.delete("username");
      clean.delete("platform");
      setSearchParams(clean, { replace: true });
    }
  }, [searchParams]);

  function connectPinterest() {
    const redirectAfter = encodeURIComponent(
      `${window.location.origin}/dwa-admin/shorts?oauth=success&platform=pinterest`
    );
    window.location.href = `${SECONDARY_URL}/functions/v1/pinterest-oauth?action=start&redirect_after=${redirectAfter}`;
  }

  const { data: shorts, isLoading: shortsLoading, refetch: refetchShorts } = useQuery({
    queryKey: ["youtube-shorts-list"],
    queryFn: fetchShorts,
    staleTime: 30_000,
  });

  const { data: heygenJobs, isLoading: heygenLoading, refetch: refetchHeygen } = useQuery({
    queryKey: ["heygen-jobs-list"],
    queryFn: fetchHeygenJobs,
    staleTime: 30_000,
  });

  async function fireShort() {
    setFiring(true);
    setLastResult(null);
    try {
      const res = await fetch(
        `${SECONDARY_URL}/functions/v1/youtube-shorts-now?niche=${selectedNiche}`,
        {
          method: "GET",
          headers: { "Authorization": `Bearer ${SECONDARY_ANON}` },
        }
      );
      const data = await res.json();
      if (data.youtubeUrl || data.youtube_url) {
        const url = data.youtubeUrl || data.youtube_url;
        setLastResult(url);
        toast({ title: "✅ Short published!", description: `Posted to ${url}` });
        refetchShorts();
      } else if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Short generated", description: "Check the Shorts list for the result." });
      }
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setFiring(false);
    }
  }

  async function fireHeygenShort() {
    setFiringHeygen(true);
    try {
      const res = await fetch(
        `${SECONDARY_URL}/functions/v1/youtube-shorts-heygen`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SECONDARY_ANON}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ niche: selectedNiche }),
        }
      );
      const data = await res.json();
      if (data.error) {
        // Check if it's the "not configured" error
        if (data.setup) {
          toast({
            title: "HeyGen not configured yet",
            description: data.error,
            variant: "destructive",
          });
        } else {
          toast({ title: "Error", description: data.error, variant: "destructive" });
        }
      } else if (data.heygenVideoId) {
        toast({
          title: "🎬 HeyGen job submitted!",
          description: `Job ID: ${data.heygenVideoId}. Renders in 2-5 minutes then auto-uploads to YouTube.`,
        });
        refetchHeygen();
      }
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setFiringHeygen(false);
    }
  }

  async function pollHeygenJob(heygenVideoId: string) {
    try {
      const res = await fetch(
        `${SECONDARY_URL}/functions/v1/heygen-webhook`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SECONDARY_ANON}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ heygenVideoId }),
        }
      );
      const data = await res.json();
      if (data.youtubeUrl) {
        toast({ title: "✅ Uploaded to YouTube!", description: data.youtubeUrl });
      } else if (data.status === "processing") {
        toast({ title: "Still rendering...", description: "Try again in 1-2 minutes." });
      } else {
        toast({ title: "Status", description: JSON.stringify(data).slice(0, 100) });
      }
      refetchHeygen();
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dwa-admin/services")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Services
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">YouTube Shorts Manager</h1>
            <p className="text-sm text-gray-500">Fire faceless Shorts (v39) or HeyGen avatar Shorts — track all posts</p>
          </div>
        </div>

        {/* Fire a Short */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <Zap className="w-5 h-5" /> Generate a Short Right Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Niche</label>
                <Select value={selectedNiche} onValueChange={setSelectedNiche}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NICHES.map(n => (
                      <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={fireShort}
                  disabled={firing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {firing ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating (~30s)...</>
                  ) : (
                    <><Play className="w-4 h-4 mr-2" /> Faceless Short</>
                  )}
                </Button>
                <Button
                  onClick={fireHeygenShort}
                  disabled={firingHeygen}
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  {firingHeygen ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><User className="w-4 h-4 mr-2" /> HeyGen "Matt" Avatar</>
                  )}
                </Button>
              </div>
            </div>
            {lastResult && (
              <div className="mt-3 p-2 bg-green-100 rounded text-sm text-green-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Published: <a href={lastResult} target="_blank" rel="noopener noreferrer" className="underline">{lastResult}</a>
              </div>
            )}
            <div className="mt-3 text-xs text-green-700">
              <strong>Faceless:</strong> Voice (OpenAI TTS) + Background music + Ken Burns zoom + Pexels/AI photo. ~30s to generate.<br />
              <strong>HeyGen:</strong> Matt's face speaks the script. Renders in 2-5 min (async). Requires HEYGEN_API_KEY + MATT_HEYGEN_AVATAR_ID secrets.
            </div>
          </CardContent>
        </Card>

        {/* Pinterest Connection */}
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-800 flex items-center gap-2 text-base">
              <LinkIcon className="w-5 h-5" /> Pinterest Connection
              {pinterestStatus?.connected && (
                <Badge className="bg-green-100 text-green-700 ml-auto">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pinterestStatus?.connected ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-800 font-medium">
                    @{pinterestStatus.username || "unknown"} — Pinterest API authorized ✅
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Token expires: {pinterestStatus.expiresAt
                      ? new Date(pinterestStatus.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Shorts auto-post as Video Pins via <code>pinterest-pinner</code> (daily 12pm UTC)
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={connectPinterest} className="border-red-300 text-red-700 hover:bg-red-100">
                  Reconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">
                    Connect Pinterest to auto-post Video Pins from your Shorts.
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Requires: <code>PINTEREST_CLIENT_ID</code> + <code>PINTEREST_CLIENT_SECRET</code> in Supabase secrets
                    (App ID: 1570813 — get secret from developers.pinterest.com → your app → settings)
                  </p>
                </div>
                <Button onClick={connectPinterest} className="bg-red-600 hover:bg-red-700 text-white ml-4">
                  <LinkIcon className="w-4 h-4 mr-2" /> Connect Pinterest
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="faceless">
          <TabsList className="mb-4">
            <TabsTrigger value="faceless">
              <Video className="w-4 h-4 mr-2" /> Faceless Shorts ({shorts?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="heygen">
              <User className="w-4 h-4 mr-2" /> HeyGen Avatar ({heygenJobs?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* Faceless Shorts List */}
          <TabsContent value="faceless">
            <Card>
              <CardContent className="p-0">
                {shortsLoading ? (
                  <div className="p-4 space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : !shorts?.length ? (
                  <div className="p-8 text-center text-gray-400">
                    <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No Shorts generated yet.</p>
                    <p className="text-sm mt-1">Fire your first one above ↑</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {shorts.map((s) => (
                      <div key={s.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {s.niche}
                            </Badge>
                            {s.type === "heygen_avatar" && (
                              <Badge className="text-xs bg-purple-100 text-purple-700">Avatar</Badge>
                            )}
                          </div>
                          <p className="font-medium text-sm mt-1 truncate">{s.title || "Untitled"}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(s.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {s.youtube_url ? (
                            <>
                              <Badge className="bg-red-100 text-red-700">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Live on YouTube
                              </Badge>
                              <a href={s.youtube_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="sm">
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </a>
                            </>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="w-3 h-3 mr-1" /> Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* HeyGen Jobs */}
          <TabsContent value="heygen">
            <Card className="mb-3 border-purple-100 bg-purple-50">
              <CardContent className="pt-4 pb-3">
                <p className="text-sm text-purple-800">
                  <strong>Full-body "Matt" avatar Shorts.</strong> Requires setup:
                  record a 2-min video at <a href="https://app.heygen.com" className="underline" target="_blank" rel="noopener noreferrer">app.heygen.com</a> →
                  Avatars → Instant Avatar → copy avatar_id → add to Supabase secrets as
                  <code className="bg-purple-100 px-1 rounded ml-1">MATT_HEYGEN_AVATAR_ID</code> and
                  <code className="bg-purple-100 px-1 rounded ml-1">HEYGEN_API_KEY</code>.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                {heygenLoading ? (
                  <div className="p-4 space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : !heygenJobs?.length ? (
                  <div className="p-8 text-center text-gray-400">
                    <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No HeyGen jobs yet.</p>
                    <p className="text-sm mt-1">Submit your first avatar Short above ↑</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {heygenJobs.map((job) => (
                      <div key={job.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{job.niche}</Badge>
                            <StatusBadge status={job.status} />
                          </div>
                          <p className="font-medium text-sm mt-1 truncate">{job.title || "Untitled"}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(job.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {job.youtube_url ? (
                            <a href={job.youtube_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </a>
                          ) : job.status === "pending" || job.status === "processing" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => pollHeygenJob(job.heygen_video_id)}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" /> Check Status
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Strategy guide */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Shorts Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="font-semibold text-green-800 mb-1">Weekdays (Mon-Fri)</div>
                <p className="text-green-700">Automated faceless engine. Fire one Short per day. Zero effort. Rotates niches across all DWA products.</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="font-semibold text-purple-800 mb-1">Weekly (Sat)</div>
                <p className="text-purple-700">HeyGen "Matt" avatar Short on a product topic. 5 min setup. Looks like real Matt talking to camera.</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="font-semibold text-blue-800 mb-1">Monthly (2-4x)</div>
                <p className="text-blue-700">Real Matt records on phone. Authentic content that can't be scaled — high trust, high engagement.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
