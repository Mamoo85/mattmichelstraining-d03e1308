import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import { Home, Lock, Phone, MessageSquare, MapPin, Bell } from "lucide-react";

type Lead = {
  id: string;
  full_name: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  signal_type: string;
  signal_source: string;
  signal_detail: string | null;
  signal_date: string | null;
  score: number;
  suggested_opener: string | null;
  best_call_window: string | null;
  created_at: string;
};

export default function MyMortgageRadar() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftFor, setDraftFor] = useState<Lead | null>(null);

  useEffect(() => {
    (async () => {
      // Admin-only fallback view: pulls all hot leads from last 14 days.
      // (LO portal magic-link auth wires in next iteration; matching admin RLS now.)
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      const { data, error } = await (supabase.from as any)("mortgage_radar_leads")
        .select("id, full_name, address, city, zip, signal_type, signal_source, signal_detail, signal_date, score, suggested_opener, best_call_window, created_at")
        .gte("created_at", since)
        .order("score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        toast.error("Could not load leads — admin access required");
      } else {
        setLeads(data || []);
      }
      setLoading(false);
    })();
  }, []);

  const hotCount = useMemo(() => leads.filter(l => l.score >= 9).length, [leads]);
  const warmCount = useMemo(() => leads.filter(l => l.score >= 7 && l.score < 9).length, [leads]);

  const claimLead = async (leadId: string) => {
    toast.info("Claim system requires LO login — coming next iteration. For now, copy the suggested opener.");
  };

  return (
    <div className="min-h-screen bg-[#030711] text-foreground">
      <SEOHead title="My Mortgage Radar — Loan Officer Dashboard" description="Daily in-market mortgage leads from public records." />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-[#00d4ff]" />
            <span className="font-bold tracking-tight text-white">My Mortgage Radar</span>
          </div>
          <a href="tel:+13139921219" className="text-sm text-[#00d4ff] font-semibold">(313) 992-1219</a>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-[#00d4ff] mb-1">Hot leads (9–10)</p>
            <p className="text-3xl font-extrabold text-white">{hotCount}</p>
          </CardContent></Card>
          <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-[#00d4ff] mb-1">Warm (7–8)</p>
            <p className="text-3xl font-extrabold text-white">{warmCount}</p>
          </CardContent></Card>
          <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-5">
            <p className="text-xs uppercase tracking-widest text-[#00d4ff] mb-1">Total (14d)</p>
            <p className="text-3xl font-extrabold text-white">{leads.length}</p>
          </CardContent></Card>
        </div>

        {loading ? (
          <p className="text-[#94a3b8]">Loading leads…</p>
        ) : leads.length === 0 ? (
          <Card className="bg-[#0a1628] border-[#1e3a5f]"><CardContent className="p-8 text-center">
            <Bell className="w-8 h-8 text-[#00d4ff] mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">No leads yet</p>
            <p className="text-sm text-[#94a3b8]">The scanner runs daily. New permits, FSBO, and foreclosure signals will appear here within 24 hours.</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {leads.map((l) => (
              <Card key={l.id} className={`bg-[#0a1628] border ${l.score >= 9 ? "border-[#00d4ff]" : "border-[#1e3a5f]"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-white text-lg">{l.address || "Address pending"}</CardTitle>
                      <p className="text-xs text-[#94a3b8] mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {l.city || ""} {l.zip || ""} · {l.signal_source}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-extrabold ${l.score >= 9 ? "text-[#00d4ff]" : "text-white"}`}>{l.score}/10</p>
                      <p className="text-[10px] text-[#64748b] uppercase tracking-widest">{l.signal_type.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {l.signal_detail && <p className="text-sm text-[#cbd5e1] mb-3">{l.signal_detail}</p>}
                  {l.suggested_opener && (
                    <div className="bg-[#030711] border border-[#1e3a5f] rounded p-3 mb-3">
                      <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] mb-1">Suggested opener</p>
                      <p className="text-sm text-[#cbd5e1] italic">"{l.suggested_opener}"</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => claimLead(l.id)} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
                      <Lock className="w-3 h-3 mr-1" /> Claim 7d
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDraftFor(l)} className="border-[#1e3a5f] text-white hover:bg-[#1e3a5f]/40">
                      <MessageSquare className="w-3 h-3 mr-1" /> Draft outreach
                    </Button>
                    {l.best_call_window && (
                      <span className="text-xs text-[#94a3b8] flex items-center gap-1 ml-auto">
                        <Phone className="w-3 h-3" /> Best: {l.best_call_window}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-[10px] text-[#64748b] text-center mt-10 max-w-2xl mx-auto">
          Mortgage Radar uses public records and behavioral signals only. We do not access, purchase, or resell credit-bureau trigger leads. All outreach must be sent manually by you in compliance with TCPA + FCRA.
        </p>
      </section>

      {draftFor && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setDraftFor(null)}>
          <Card className="max-w-lg w-full bg-[#0a1628] border-[#1e3a5f]" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle className="text-white">Outreach draft</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-[#00d4ff] uppercase tracking-widest mb-1">SMS / Phone opener</p>
              <textarea
                readOnly
                className="w-full h-32 bg-[#030711] border border-[#1e3a5f] rounded p-3 text-sm text-[#cbd5e1]"
                value={(draftFor.suggested_opener || "").replace(/\{name\}/g, draftFor.full_name || "there").replace(/\{address\}/g, draftFor.address || "your property")}
              />
              <p className="text-[10px] text-[#64748b] mt-2">Copy and send manually. Do not text numbers on your DNC list.</p>
              <Button onClick={() => setDraftFor(null)} className="mt-3 w-full bg-[#1e3a5f] text-white">Close</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
