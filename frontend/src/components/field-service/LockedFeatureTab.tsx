import { Lock } from "lucide-react";

const LockedFeatureTab = ({ label }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
    <Lock size={16} />
    <span>{label ?? "Upgrade to unlock this feature"}</span>
  </div>
);
export default LockedFeatureTab;
