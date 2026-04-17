import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Star, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useDwaDomainRedirect } from "@/hooks/useDwaDomainRedirect";

interface MapResult {
  position: number;
  title: string;
  rating: number | null;
  reviews: number | null;
  address: string;
  is_target: boolean;
}

export default function FreeLocalSearchAudit() {
  
  useDwaDomainRedirect();
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const handleScan = async () => {
    if (!businessName.trim() || !city.trim()) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("local-search-audit", {
        body: { business_name: businessName, city, email: email || undefined },
      });
      if (fnErr) throw fnErr;
      if (data?.success) setResults(data);
      else setError(data?.error || "Scan failed");
    } catch {
      setError("Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead title="Free Local Search Audit | Detroit Web Agency" description="See where your business ranks on Google Maps. Check your review count vs competitors — free, instant results." path="/free-tools/local-search" />
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Link to="/free-tools" className="text-cyan-400 text-xs font-mono hover:underline mb-6 inline-block">← All Free Tools</Link>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4">
              <MapPin size={12} /> Google Maps Audit
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">Are You Invisible on Google Maps?</h1>
            <p className="text-[#888] max-w-xl mx-auto text-sm">Check if your business shows up in the Map Pack — and how you stack up against the competition.</p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Your business name" value={businessName} onChange={e => setBusinessName(e.target.value)} className="bg-white/5 border-white/10" />
              <Input placeholder="City (e.g. Detroit)" value={city} onChange={e => setCity(e.target.value)} className="bg-white/5 border-white/10" />
            </div>
            <Input type="email" placeholder="Your email (optional)" value={email} onChange={e => setEmail(e.target.value)} className="bg-white/5 border-white/10" />
            <Button onClick={handleScan} disabled={loading || !businessName.trim() || !city.trim()} className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold">
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Scanning Google Maps...</> : "Run Map Pack Audit"}
            </Button>
          </div>

          {error && <p className="text-red-400 text-sm text-center mb-6">{error}</p>}

          {results && (
            <div className="space-y-4">
              {/* Target status */}
              <div className={`rounded-2xl p-6 text-center border ${results.target_found ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                {results.target_found ? (
                  <>
                    <Eye className="text-emerald-400 mx-auto mb-2" size={28} />
                    <p className="text-xl font-black mb-1">You're #{results.target_position} in the Map Pack</p>
                    <p className="text-sm text-[#888]">{results.target_rating}★ rating • {results.target_reviews} reviews</p>
                  </>
                ) : (
                  <>
                    <EyeOff className="text-red-500 mx-auto mb-2" size={28} />
                    <p className="text-xl font-black text-red-400 mb-1">You Are NOT in the Top 10</p>
                    <p className="text-sm text-[#888]">Your business was not found in Google Maps results for "{results.keyword}"</p>
                  </>
                )}
              </div>

              {/* Top results */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-[#aaa] uppercase tracking-widest mb-4">Top Map Pack Results</h3>
                <div className="space-y-3">
                  {(results.top_results || []).map((r: MapResult) => (
                    <div key={r.position} className={`flex items-center gap-3 p-3 rounded-xl ${r.is_target ? "bg-cyan-500/10 border border-cyan-400/20" : "bg-white/[0.02]"}`}>
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${r.position <= 3 ? "bg-amber-400/20 text-amber-400" : "bg-white/5 text-[#666]"}`}>
                        {r.position}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${r.is_target ? "text-cyan-400" : ""}`}>{r.title} {r.is_target && "← You"}</p>
                        <p className="text-xs text-[#666] truncate">{r.address}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1">
                          <Star size={12} className="text-amber-400" />
                          <span className="text-sm font-mono">{r.rating ?? "—"}</span>
                        </div>
                        <p className="text-[10px] text-[#666]">{r.reviews ?? 0} reviews</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              {(!results.target_found || (results.target_reviews && results.target_reviews < 50)) && (
                <div className="bg-cyan-500/5 border border-cyan-400/20 rounded-2xl p-6 text-center">
                  <p className="text-sm font-bold mb-2">{!results.target_found ? "You're invisible because you don't have enough reviews." : `You only have ${results.target_reviews} reviews — your competitors are ahead.`}</p>
                  <p className="text-xs text-[#888] mb-3">Our FieldDesk CRM auto-texts homeowners a review link the second the tech leaves. We'll get you 50+ reviews this month.</p>
                  <Link to="/field-service" className="inline-flex items-center gap-2 text-cyan-400 font-bold text-sm hover:underline">
                    Get FieldDesk <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-[#444] mt-8">Data source: Google Maps SERP • Generated by Detroit Web Agency</p>
        </div>
      </div>
    </>
  );
}
