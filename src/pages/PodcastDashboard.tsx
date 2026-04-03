import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mic, FileText, Linkedin, Mail, Youtube, Twitter, Copy, Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface PodcastEpisode {
  id: string;
  episode_title: string | null;
  episode_url: string | null;
  published_at: string | null;
  blog_post: string | null;
  linkedin_post: string | null;
  email_newsletter: string | null;
  youtube_description: string | null;
  twitter_thread: string | null;
  content_sent: boolean;
  created_at: string;
}

interface PodcastClient {
  id: string;
  podcast_name: string | null;
  rss_feed_url: string;
  subscription_status: string;
  created_at: string;
}

const CONTENT_TABS = [
  { key: "blog_post", label: "Blog Post", icon: FileText, color: "#FF6B35" },
  { key: "linkedin_post", label: "LinkedIn", icon: Linkedin, color: "#0A66C2" },
  { key: "email_newsletter", label: "Email Newsletter", icon: Mail, color: "#FF6B35" },
  { key: "youtube_description", label: "YouTube", icon: Youtube, color: "#FF0000" },
  { key: "twitter_thread", label: "Twitter / X", icon: Twitter, color: "#1DA1F2" },
] as const;

type ContentKey = (typeof CONTENT_TABS)[number]["key"];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded border transition-colors"
      style={copied
        ? { background: "#16a34a20", borderColor: "#16a34a60", color: "#4ade80" }
        : { background: "#FF6B3520", borderColor: "#FF6B3560", color: "#FF6B35" }
      }
    >
      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

function EpisodeCard({ episode }: { episode: PodcastEpisode }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ContentKey>("blog_post");

  const pubDate = episode.published_at
    ? new Date(episode.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const activeContent = episode[activeTab] || "";

  return (
    <div className="border border-[#2d2d4e] rounded-lg overflow-hidden mb-4">
      {/* Episode header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-[#1a1a2e] hover:bg-[#1e1e36] transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Mic size={16} className="text-[#FF6B35] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{episode.episode_title || "Untitled Episode"}</p>
            <p className="text-slate-500 text-xs mt-0.5">
              {pubDate || "No date"} ·{" "}
              {episode.content_sent ? (
                <span className="text-green-400">Content sent</span>
              ) : (
                <span className="text-yellow-400">Generating…</span>
              )}
            </p>
          </div>
        </div>
        {open ? <ChevronDown size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />}
      </button>

      {/* Content area */}
      {open && (
        <div className="bg-[#0d0d1a]">
          {/* Tab bar */}
          <div className="flex gap-1 px-4 pt-4 border-b border-[#2d2d4e] overflow-x-auto pb-0">
            {CONTENT_TABS.map(({ key, label, icon: Icon, color }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors"
                style={activeTab === key
                  ? { borderColor: color, color: color }
                  : { borderColor: "transparent", color: "#64748b" }
                }
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Content pane */}
          <div className="p-5">
            {activeContent ? (
              <>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">
                    {CONTENT_TABS.find((t) => t.key === activeTab)?.label}
                  </span>
                  <CopyButton text={activeContent} />
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 leading-relaxed bg-[#13132b] border border-[#2d2d4e] rounded p-4 overflow-x-auto max-h-[500px] overflow-y-auto">
                  {activeContent}
                </pre>
              </>
            ) : (
              <p className="text-slate-500 text-sm py-4 text-center">Content not yet generated for this piece.</p>
            )}
          </div>

          {/* Episode link */}
          {episode.episode_url && (
            <div className="px-5 pb-4">
              <a
                href={episode.episode_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FF6B35] text-xs hover:underline"
              >
                Listen to episode →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PodcastDashboard() {
  const { data: clientData, isLoading: clientLoading } = useQuery({
    queryKey: ["podcast-client"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("podcast_clients")
        .select("id, podcast_name, rss_feed_url, subscription_status, created_at")
        .eq("subscription_status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PodcastClient | null;
    },
  });

  const { data: episodes, isLoading: episodesLoading } = useQuery({
    queryKey: ["podcast-episodes", clientData?.id],
    enabled: !!clientData?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("podcast_episodes")
        .select("id, episode_title, episode_url, published_at, blog_post, linkedin_post, email_newsletter, youtube_description, twitter_thread, content_sent, created_at")
        .eq("client_id", clientData!.id)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PodcastEpisode[];
    },
  });

  const isLoading = clientLoading || episodesLoading;

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <p className="text-[#FF6B35] text-xs font-bold uppercase tracking-widest mb-2">M² Development</p>
          <h1 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
            <Mic size={22} className="text-[#FF6B35]" />
            Podcast-to-Revenue Machine
          </h1>
          {clientData && (
            <p className="text-slate-400 text-sm">
              {clientData.podcast_name || "Your Podcast"} ·{" "}
              <span className="text-green-400 font-medium capitalize">{clientData.subscription_status}</span>
            </p>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center gap-3 text-slate-400 py-12 justify-center">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading your episodes…</span>
          </div>
        )}

        {!isLoading && !clientData && (
          <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-lg p-8 text-center">
            <Mic size={32} className="text-[#FF6B35] mx-auto mb-4 opacity-60" />
            <h2 className="text-white font-bold text-lg mb-2">No active subscription found</h2>
            <p className="text-slate-400 text-sm mb-6">Sign up for the Podcast-to-Revenue Machine to get started.</p>
            <a
              href="/podcast-revenue-machine"
              className="inline-block bg-[#FF6B35] text-white font-bold px-6 py-3 rounded-sm hover:bg-[#e85d2a] transition-colors text-sm"
            >
              Get Started →
            </a>
          </div>
        )}

        {!isLoading && clientData && (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { label: "Episodes Processed", value: episodes?.length ?? 0 },
                { label: "Content Pieces Sent", value: (episodes?.filter((e) => e.content_sent).length ?? 0) * 5 },
                { label: "Hours Saved", value: `~${((episodes?.length ?? 0) * 3)}h` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-md p-4 text-center">
                  <p className="text-2xl font-black text-[#FF6B35]">{value}</p>
                  <p className="text-slate-500 text-xs mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Episodes */}
            <div>
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText size={14} className="text-[#FF6B35]" />
                Episode Content
              </h2>

              {episodes && episodes.length === 0 ? (
                <div className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-lg p-8 text-center">
                  <Mic size={28} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-white font-semibold mb-1">Waiting for your next episode</p>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                    We'll check your RSS feed every 6 hours. The next time you publish, your content pack will arrive in your inbox automatically.
                  </p>
                </div>
              ) : (
                episodes?.map((ep) => <EpisodeCard key={ep.id} episode={ep} />)
              )}
            </div>

            {/* RSS info */}
            <div className="mt-8 bg-[#1a1a2e] border border-[#2d2d4e] rounded-md p-4 flex items-start gap-3">
              <Mic size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-slate-400 text-xs font-medium mb-0.5">Connected RSS Feed</p>
                <p className="text-slate-300 text-xs break-all">{clientData.rss_feed_url}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
