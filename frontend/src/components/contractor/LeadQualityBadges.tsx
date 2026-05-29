export interface LeadQualityData {
  score?: number;
  label?: string;
}

const LeadQualityBadges = ({ data }: { data?: LeadQualityData }) => (
  <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
    {data?.label ?? "Standard"} Lead
  </div>
);
export default LeadQualityBadges;
