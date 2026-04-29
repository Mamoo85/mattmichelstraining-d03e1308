import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, MapPin, FileSearch } from "lucide-react";

interface Props {
  verifier_grounded?: boolean | null;
  verifier_citation_match?: boolean | null;
  verification_method?: string | null;
  has_coordinates?: boolean;
}

export default function LeadVerificationBadges({
  verifier_grounded,
  verifier_citation_match,
  verification_method,
  has_coordinates,
}: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {verifier_grounded ? (
        <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-300">
          <ShieldCheck className="w-3 h-3" /> Grounded
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-300">
          <ShieldAlert className="w-3 h-3" /> Unverified
        </Badge>
      )}
      {verifier_citation_match && (
        <Badge variant="outline" className="gap-1 border-cyan-500/40 text-cyan-300">
          <FileSearch className="w-3 h-3" /> Citation match
        </Badge>
      )}
      {has_coordinates && (
        <Badge variant="outline" className="gap-1 border-blue-500/40 text-blue-300">
          <MapPin className="w-3 h-3" /> Geo-locked
        </Badge>
      )}
      {verification_method && (
        <Badge variant="secondary" className="text-[10px]">{verification_method}</Badge>
      )}
    </div>
  );
}
