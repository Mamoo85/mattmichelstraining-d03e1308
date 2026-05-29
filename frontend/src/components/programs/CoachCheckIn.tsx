import { MessageSquare, Camera, Settings } from "lucide-react";
import AskCoachMatt from "./AskCoachMatt";

interface CoachCheckInProps {
  weekNumber: number;
  programId: string;
  programTitle: string;
}

const CHECK_IN_CONFIG: Record<number, { icon: React.ElementType; label: string; prompt: string }> = {
  2: {
    icon: MessageSquare,
    label: "Week 2 Check-In",
    prompt: "How's the weight feeling? Send Matt a quick note about your first two weeks.",
  },
  4: {
    icon: Camera,
    label: "Halfway Check-In",
    prompt: "You're halfway through the block — request a form review or let Matt know how it's going.",
  },
  7: {
    icon: Settings,
    label: "Next Block Preview",
    prompt: "Next block starts soon — let Matt know if you want any program adjustments for Block 2.",
  },
};

const CoachCheckIn = ({ weekNumber, programId, programTitle }: CoachCheckInProps) => {
  const config = CHECK_IN_CONFIG[weekNumber];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="bg-primary/5 border border-primary/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{config.label}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{config.prompt}</p>
      <AskCoachMatt
        programId={programId}
        programTitle={programTitle}
        weekNumber={weekNumber}
        dayNumber={1}
        exercises={[]}
        isPurchasedProgram={true}
      />
    </div>
  );
};

export default CoachCheckIn;
