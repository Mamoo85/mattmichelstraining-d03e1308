import { Lock } from "lucide-react";

export const DEMO_MASTER_TOKEN = "DWA_DEMO_MASTER";

export function isDemoMode(token: string | null): boolean {
  return token === DEMO_MASTER_TOKEN;
}

export default function DemoModeBadge() {
  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00d4ff]/15 border border-[#00d4ff]/30 backdrop-blur-sm shadow-lg animate-pulse">
      <Lock className="w-3 h-3 text-[#00d4ff]" />
      <span className="text-[#00d4ff] text-xs font-bold tracking-wide">DEMO MODE</span>
    </div>
  );
}
