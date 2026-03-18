import { WifiOff } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";

const OfflineBadge = () => {
  const { isOnline, queueCount } = useOfflineSync();

  if (isOnline && queueCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 shadow-m2 animate-in slide-in-from-bottom-2">
      <WifiOff size={14} className="text-destructive" />
      <span className="text-xs font-bold text-foreground">
        {!isOnline
          ? `Syncing paused — Offline${queueCount > 0 ? ` (${queueCount})` : ""}`
          : `Syncing ${queueCount} action(s)…`}
      </span>
    </div>
  );
};

export default OfflineBadge;
