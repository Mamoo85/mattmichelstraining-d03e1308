interface CandidateRiskBadgesProps {
  risk?: "low" | "medium" | "high";
}

const colors = { low: "bg-green-100 text-green-800", medium: "bg-amber-100 text-amber-800", high: "bg-red-100 text-red-800" };

const CandidateRiskBadges = ({ risk = "low" }: CandidateRiskBadgesProps) => (
  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colors[risk]}`}>
    {risk.charAt(0).toUpperCase() + risk.slice(1)} Risk
  </span>
);
export default CandidateRiskBadges;
