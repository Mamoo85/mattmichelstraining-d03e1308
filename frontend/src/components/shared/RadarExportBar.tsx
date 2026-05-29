import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface RadarExportBarProps {
  onExport?: () => void;
  disabled?: boolean;
  count?: number;
}

export const RadarExportBar = ({ onExport, disabled, count }: RadarExportBarProps) => (
  <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
    <span className="text-xs text-muted-foreground">{count ?? 0} leads</span>
    <Button size="sm" variant="outline" disabled={disabled} onClick={onExport} className="gap-1.5">
      <Download size={13} /> Export CSV
    </Button>
  </div>
);

export default RadarExportBar;
