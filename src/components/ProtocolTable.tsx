import { useState } from "react";
import SectionHeader from "./SectionHeader";

const mockProtocol = [
  { exercise: "Competition Squat", target: "3×5 @ 82%", last: "185kg", rpe: 7.5 },
  { exercise: "Pause Bench Press", target: "4×4 @ 78%", last: "120kg", rpe: 7 },
  { exercise: "Romanian Deadlift", target: "3×8 @ 65%", last: "140kg", rpe: 6.5 },
  { exercise: "Barbell Row", target: "3×8 @ RPE 7", last: "95kg", rpe: 7 },
  { exercise: "Dips (Weighted)", target: "3×10 @ RPE 7", last: "+20kg", rpe: 6 },
];

const ProtocolTable = () => {
  const [weights, setWeights] = useState<Record<number, string>>({});

  return (
    <div>
      <SectionHeader title="Today's Program" timestamp="Week 6 / Day 1 — Matt's notes: Push the squat today" />
      
      <div className="grid grid-cols-[1fr_auto_auto_80px] md:grid-cols-[1fr_120px_80px_80px_80px] gap-2 px-3 py-2 bg-muted">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Exercise</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:block">Last</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:block">RPE</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Log</span>
      </div>

      {mockProtocol.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_auto_auto_80px] md:grid-cols-[1fr_120px_80px_80px_80px] gap-2 px-3 py-3 bg-card hover:bg-m2-surface-hover transition-m2 border-b border-border"
        >
          <span className="text-sm font-semibold text-foreground">{row.exercise}</span>
          <span className="text-sm font-mono text-primary">{row.target}</span>
          <span className="text-sm font-mono text-muted-foreground hidden md:block">{row.last}</span>
          <span className="text-sm font-mono text-muted-foreground hidden md:block">{row.rpe}</span>
          <input
            type="number"
            placeholder="0.0"
            value={weights[i] || ""}
            onChange={(e) => setWeights({ ...weights, [i]: e.target.value })}
            className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-8 w-full"
          />
        </div>
      ))}

      <div className="flex justify-end mt-4">
        <button className="bg-primary text-primary-foreground px-6 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2">
          Log Session
        </button>
      </div>
    </div>
  );
};

export default ProtocolTable;
