import { useState } from "react";
import { Phone, Mail, Search, Copy, Plus, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addToTechAlertProspects, type ProspectInput } from "@/lib/addToTechAlertProspects";

interface Props {
  // Required for prospect insert
  companyName: string;
  // Optional contact bits
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  role?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string;
  isBoiler?: boolean;
  score?: number;
  notes?: string | null;
  // Email pitch
  emailSubject?: string;
  emailBody?: string;
  // Display
  compact?: boolean;
}

export default function IntelRowActions({
  companyName, phone, email, city, state = "MI", website, role,
  sourceUrl, sourceLabel = "manual_intel", isBoiler, score, notes,
  emailSubject, emailBody, compact = false,
}: Props) {
  const { toast } = useToast();
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`${companyName} ${city || ""} ${state || ""}`)}`;
  const mailto = `mailto:${email || ""}?subject=${encodeURIComponent(emailSubject || `Re: ${companyName}`)}&body=${encodeURIComponent(emailBody || "")}`;

  async function handleCopy() {
    const blob = [companyName, city && state ? `${city}, ${state}` : null, phone, email, website, sourceUrl]
      .filter(Boolean).join("\n");
    await navigator.clipboard.writeText(blob);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast({ title: "Contact info copied" });
  }

  async function handleAdd() {
    setBusy(true);
    try {
      const payload: ProspectInput = {
        company_name: companyName, city, state, role, phone, email, website,
        source_url: sourceUrl, source_label: sourceLabel, is_boiler: isBoiler, score, notes,
      };
      const r = await addToTechAlertProspects(payload);
      setAdded(true);
      toast({ title: r.action === "inserted" ? "Added to TechAlert prospects" : "Updated existing prospect" });
    } catch (e) {
      toast({ title: "Failed to add prospect", description: String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const btn = `inline-flex items-center justify-center gap-1 ${compact ? "px-2 py-1" : "px-2.5 py-1.5"} rounded text-[11px] font-medium transition-colors border`;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {phone ? (
        <a href={`tel:${phone}`} title={`Call ${phone}`}
           className={`${btn} bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20`}>
          <Phone className="w-3 h-3" /> Call
        </a>
      ) : null}
      <a href={mailto} title="Email pitch"
         className={`${btn} bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20`}>
        <Mail className="w-3 h-3" /> Email
      </a>
      <a href={googleUrl} target="_blank" rel="noreferrer" title="Google search"
         className={`${btn} bg-white/5 text-white/70 border-white/10 hover:bg-white/10`}>
        <Search className="w-3 h-3" /> Google
      </a>
      <button onClick={handleCopy} title="Copy contact info"
              className={`${btn} bg-white/5 text-white/70 border-white/10 hover:bg-white/10`}>
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
      </button>
      <button onClick={handleAdd} disabled={busy || added} title="Add to TechAlert prospect pipeline"
              className={`${btn} ${added ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/30 hover:bg-[#00d4ff]/25"} disabled:opacity-60`}>
        {added ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        {added ? "Added" : busy ? "Adding…" : "Add to Prospects"}
      </button>
    </div>
  );
}
