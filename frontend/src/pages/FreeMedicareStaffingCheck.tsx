import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Heart, AlertTriangle, Shield, Star, ArrowRight, Loader2 } from "lucide-react";
import { useDwaDomainRedirect } from "@/hooks/useDwaDomainRedirect";

interface Facility {
  provider_name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  overall_rating: number | null;
  staffing_rating: number | null;
  rn_staffing_rating: number | null;
  quality_rating: number | null;
  number_of_beds: number | null;
  ownership_type: string | null;
  number_of_fines: number | null;
  fine_total: number | null;
}

export default function FreeMedicareStaffingCheck() {
  
  useDwaDomainRedirect();
  const [facilityName, setFacilityName] = useState("");
  const [state, setState] = useState("MI");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Facility[] | null>(null);
  const [error, setError] = useState("");

  const handleScan = async () => {
    if (!facilityName.trim()) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("medicare-staffing-check", {
        body: { facility_name: facilityName, state, email: email || undefined },
      });
      if (fnErr) throw fnErr;
      if (data?.facilities?.length) {
        setResults(data.facilities);
      } else {
        setError("No facilities matched that name. Try a shorter or different spelling.");
      }
    } catch {
      setError("Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const ratingColor = (r: number | null) => {
    if (!r) return "text-[#555]";
    if (r <= 1) return "text-red-500";
    if (r <= 2) return "text-orange-500";
    if (r <= 3) return "text-amber-400";
    return "text-emerald-400";
  };

  const ratingLabel = (r: number | null) => {
    if (!r) return "N/A";
    if (r <= 1) return "CRITICAL";
    if (r <= 2) return "POOR";
    if (r <= 3) return "AVERAGE";
    if (r <= 4) return "GOOD";
    return "EXCELLENT";
  };

  return (
    <>
      <SEOHead title="Free Medicare Staffing Assessment | Detroit Web Agency" description="Check any nursing home's federal staffing star rating, fine history, and compliance risk — free and instant." path="/free-tools/medicare-staffing" />
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Link to="/free-tools" className="text-cyan-400 text-xs font-mono hover:underline mb-6 inline-block">← All Free Tools</Link>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4">
              <Heart size={12} /> Medicare Staffing Check
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">Nursing Home Staffing Threat Assessment</h1>
            <p className="text-[#888] max-w-xl mx-auto text-sm">Pull any facility's federal staffing rating, fine history, and compliance risk from CMS Medicare data.</p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Facility name" value={facilityName} onChange={e => setFacilityName(e.target.value)} className="md:col-span-2 bg-white/5 border-white/10" />
              <select value={state} onChange={e => setState(e.target.value)} className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm">
                <option value="MI">Michigan</option>
                <option value="OH">Ohio</option>
                <option value="IN">Indiana</option>
                <option value="IL">Illinois</option>
              </select>
            </div>
            <Input type="email" placeholder="Your email (optional — for full report)" value={email} onChange={e => setEmail(e.target.value)} className="bg-white/5 border-white/10" />
            <Button onClick={handleScan} disabled={loading || !facilityName.trim()} className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold">
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Scanning CMS Database...</> : "Run Staffing Assessment"}
            </Button>
          </div>

          {error && <p className="text-red-400 text-sm text-center mb-6">{error}</p>}

          {results && results.map((f, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-4">
              <h3 className="text-lg font-bold mb-1">{f.provider_name}</h3>
              <p className="text-[#888] text-xs mb-4">{f.address}, {f.city}, {f.state} • {f.phone}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Overall", value: f.overall_rating },
                  { label: "Staffing", value: f.staffing_rating },
                  { label: "RN Staffing", value: f.rn_staffing_rating },
                  { label: "Quality", value: f.quality_rating },
                ].map(r => (
                  <div key={r.label} className="bg-white/[0.03] rounded-xl p-3 text-center">
                    <p className="text-[10px] text-[#666] uppercase tracking-widest mb-1">{r.label}</p>
                    <div className="flex items-center justify-center gap-1">
                      <Star size={14} className={ratingColor(r.value)} />
                      <span className={`text-xl font-black font-mono ${ratingColor(r.value)}`}>{r.value ?? "—"}</span>
                    </div>
                    <p className={`text-[10px] font-bold ${ratingColor(r.value)}`}>{ratingLabel(r.value)}</p>
                  </div>
                ))}
              </div>

              {(f.number_of_fines || f.fine_total) && (
                <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                  <AlertTriangle className="text-red-500 shrink-0" size={18} />
                  <div>
                    <p className="text-sm font-bold text-red-400">{f.number_of_fines} Penalties — ${f.fine_total?.toLocaleString()} in Fines</p>
                    <p className="text-xs text-[#888]">Federal penalties on record from CMS</p>
                  </div>
                </div>
              )}

              {f.staffing_rating && f.staffing_rating <= 2 && (
                <div className="mt-4 bg-cyan-500/5 border border-cyan-400/20 rounded-xl p-4 text-center">
                  <Shield className="text-cyan-400 mx-auto mb-2" size={20} />
                  <p className="text-sm font-bold mb-1">Your staffing rating is a liability.</p>
                  <p className="text-xs text-[#888] mb-3">We have active CNAs and LPNs in your area ready for immediate placement.</p>
                  <Link to="/hire-alert" className="inline-flex items-center gap-2 text-cyan-400 font-bold text-sm hover:underline">
                    Fix Your Staffing Now <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          ))}

          <p className="text-center text-[10px] text-[#444] mt-8">Data source: CMS Medicare Care Compare • Generated by Detroit Web Agency</p>
        </div>
      </div>
    </>
  );
}
