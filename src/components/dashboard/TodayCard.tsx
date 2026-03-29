import React from 'react';
import { CalendarDays, BookOpen, Clock3, Play, Dumbbell } from 'lucide-react';

interface TodayCardProps {
  workoutName?: string;
  phase?: string;
  day?: number;
  exerciseCount?: number;
  durationMin?: number;
  onClick?: () => void;
  hasWorkout?: boolean;
}

export default function TodayCard({
  workoutName = "Upper Body Power",
  phase = "Phase 2",
  day = 4,
  exerciseCount,
  durationMin,
  onClick,
  hasWorkout = true,
}: TodayCardProps) {
  const week = [
    { d: 'M', s: 'done' }, { d: 'W', s: 'done' }, { d: 'F', s: 'today' }, { d: 'M', s: 'future' }, { d: 'W', s: 'future' }
  ];

  return (
    <div className="w-full px-4 mb-2">
      <button
        onClick={onClick}
        className="w-full text-left rounded-2xl overflow-hidden shadow-xl transition-all active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, #161610 0%, #1a1a12 100%)",
          border: "1px solid rgba(232,98,26,0.25)",
          boxShadow: hasWorkout ? "0 4px 24px rgba(232,98,26,0.12)" : "none",
        }}
      >
        {/* Orange top accent bar */}
        <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, #e8621a, #f97316, rgba(249,115,22,0.3))" }} />

        <div className="p-5">
          <div className="flex items-start justify-between mb-2">
            <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#e8621a" }}>
              <CalendarDays size={11} />
              {hasWorkout ? `${phase} · Day ${day}` : "No Active Program"}
            </div>
            {onClick && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(232,98,26,0.2)", boxShadow: "0 0 10px rgba(232,98,26,0.3)" }}
              >
                <Play size={12} className="fill-[#e8621a] text-[#e8621a]" style={{ marginLeft: 1 }} />
              </div>
            )}
          </div>

          <h2 className="font-oswald text-2xl font-black text-white uppercase tracking-tight leading-none mb-1">
            {hasWorkout ? workoutName : "Build Your Plan"}
          </h2>
          <p className="text-[11px] mb-4" style={{ color: "#525252" }}>
            {hasWorkout
              ? "Tap to launch your session"
              : "Browse programs or log a free workout"}
          </p>

          {hasWorkout && (
            <div className="flex items-center gap-4 mb-4" style={{ color: "#525252" }}>
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase">
                <BookOpen size={12} /> {exerciseCount ?? 6} exercises
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase">
                <Clock3 size={12} /> ~{durationMin ?? 45} min
              </span>
            </div>
          )}

          {!hasWorkout && (
            <div className="flex items-center gap-2 mb-4">
              <Dumbbell size={13} style={{ color: "#525252" }} />
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#525252" }}>
                Get a coach-built program →
              </span>
            </div>
          )}

          <div className="flex gap-2">
            {week.map((item, i) => (
              <div
                key={i}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-[11px] transition-all ${
                  item.s === 'done'
                    ? 'bg-green-600/80 text-black'
                    : item.s === 'today'
                    ? 'text-white'
                    : 'bg-white/5 text-white/20'
                }`}
                style={item.s === 'today' ? {
                  background: "#e8621a",
                  boxShadow: "0 0 14px rgba(232,98,26,0.5)",
                } : {}}
              >
                {item.d}
              </div>
            ))}
          </div>
        </div>
      </button>
    </div>
  );
}
