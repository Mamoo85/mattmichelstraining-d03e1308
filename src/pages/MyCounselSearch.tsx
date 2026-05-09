import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import JustPurchasedScreen, { isJustPurchased } from "@/components/shared/JustPurchasedScreen";

interface Client {
  email: string;
  contact_name: string | null;
  firm_name: string | null;
  tier: string;
  monitoring_enabled: boolean;
  active: boolean;
}

interface SearchRow {
  id: string;
  query_name: string;
  case_matter: string | null;
  total_hits: number | null;
  high_priority_hits: number | null;
  created_at: string;
}

export default function MyCounselSearch() {
  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const token = params.get("token") || "";
  const [client, setClient] = useState<Client | null>(null);
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!email || !token) {
      setLoading(false);
      setErr("Missing access token.");
      return;
    }
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const { data, error } = await sb
          .from("counsel_search_clients")
          .select("email,contact_name,firm_name,tier,monitoring_enabled,active,dashboard_token")
          .eq("email", email.toLowerCase())
          .maybeSingle();
        if (error) throw error;
        if (!data || data.dashboard_token !== token) {
          setErr("Invalid or expired access token.");
          return;
        }
        setClient(data as Client);
        const { data: rows } = await sb
          .from("counsel_searches")
          .select("id,query_name,case_matter,total_hits,high_priority_hits,created_at")
          .eq("email", email.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(50);
        setSearches((rows as SearchRow[]) || []);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [email, token]);

  if (loading) {
    if (isJustPurchased()) return <JustPurchasedScreen product="Counsel Records Search" />;
    return <div className="min-h-screen bg-[#030711] flex items-center justify-center"><Loader2 className="animate-spin text-[#00d4ff]" /></div>;
  }

  if (err || !client) {
    return (
      <div className="min-h-screen bg-[#030711] text-white flex items-center justify-center px-4">
        <Card className="bg-[#0a1628] border-[#1e3a5f] max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-400 mb-2">{err || "Access denied"}</p>
            <p className="text-[#94a3b8] text-sm">Need help? Text Matt at (313) 992-1219.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-[#00d4ff] text-xs font-extrabold tracking-[3px]">⚖️ COUNSEL RECORDS SEARCH</p>
        <h1 className="text-2xl md:text-3xl font-bold mt-2 mb-1">{client.firm_name || client.contact_name || client.email}</h1>
        <p className="text-[#94a3b8] text-sm mb-6">
          Plan: <span className="text-white font-semibold">{client.tier === "monitoring" ? "$79/mo Monitoring" : "$49/mo Solo"}</span>
          {client.monitoring_enabled && <span className="ml-3 text-[#00d4ff]">• Saved subjects re-scanned weekly</span>}
        </p>

        <Link to="/counsel-search/console" className="inline-block bg-[#00d4ff] text-black font-bold px-6 py-3 rounded-lg text-sm mb-8 hover:bg-[#00b8e0]">
          ⚖️ Run a New Search →
        </Link>

        <h2 className="text-lg font-bold mb-3">Recent Searches</h2>
        {searches.length === 0 ? (
          <Card className="bg-[#0a1628] border-[#1e3a5f]">
            <CardContent className="p-6 text-center text-[#94a3b8] text-sm">
              No searches yet. Click <strong className="text-white">Run a New Search</strong> above to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {searches.map((s) => (
              <Card key={s.id} className="bg-[#0a1628] border-[#1e3a5f]">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{s.query_name}</p>
                    <p className="text-[10px] text-[#64748b]">
                      {new Date(s.created_at).toLocaleString()}
                      {s.case_matter && <> • Matter: {s.case_matter}</>}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-white font-bold">{s.total_hits ?? 0} hits</p>
                    {(s.high_priority_hits ?? 0) > 0 && <p className="text-red-400">{s.high_priority_hits} high</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
