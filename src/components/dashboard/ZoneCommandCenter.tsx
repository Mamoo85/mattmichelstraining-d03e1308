import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Wrench, MessageCircle, Image, BarChart3, Trophy } from "lucide-react";

const COMMANDS = [
  { key: "generate", label: "Generate", icon: Sparkles, color: "#a855f7", route: "/free-ai-generator" },
  { key: "fixit", label: "Fix It", icon: Wrench, color: "#00f0ff", route: "/ai-insights" },
  { key: "chat", label: "Chat", icon: MessageCircle, color: "#f97316", route: null },
  { key: "poster", label: "AI Poster", icon: Image, color: "#ec4899", route: null },
  { key: "progress", label: "Progress", icon: BarChart3, color: "#22c55e", route: "/progress" },
  { key: "proveit", label: "Prove It", icon: Trophy, color: "#f97316", route: null },
] as const;

interface ZoneCommandCenterProps {
  onChat?: () => void;
  onProveIt?: () => void;
  onPoster?: () => void;
}

const ZoneCommandCenter = memo(({ onChat, onProveIt, onPoster }: ZoneCommandCenterProps) => {
  const navigate = useNavigate();

  const handleCommand = (cmd: typeof COMMANDS[number]) => {
    if (cmd.key === "chat" && onChat) { onChat(); return; }
    if (cmd.key === "proveit" && onProveIt) { onProveIt(); return; }
    if (cmd.key === "poster" && onPoster) { onPoster(); return; }
    if (cmd.route) navigate(cmd.route);
  };

  return (
    <div className="w-full">
      <p className="text-xs font-black uppercase tracking-[0.2em] mb-3 px-1" style={{ color: "#737373" }}>
        Command Center
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2 snap-x scrollbar-hide">
        {COMMANDS.map((cmd) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.key}
              onClick={() => handleCommand(cmd)}
              className="flex flex-col items-center gap-1.5 min-w-[72px] snap-start rounded-2xl p-3 transition-all active:scale-[0.94]"
              style={{
                background: `${cmd.color}0d`,
                border: `1px solid ${cmd.color}33`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${cmd.color}22` }}
              >
                <Icon size={18} style={{ color: cmd.color }} />
              </div>
              <span className="text-xs font-bold whitespace-nowrap" style={{ color: "#d4d4d4" }}>
                {cmd.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

ZoneCommandCenter.displayName = "ZoneCommandCenter";
export default ZoneCommandCenter;
