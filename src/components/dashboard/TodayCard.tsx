import React from 'react';
import { CalendarDays, BookOpen, Clock3 } from 'lucide-react';

export default function TodayCard({ workoutName = "Upper Body Power", phase = "Phase 2", day = 4 }) {
  const week = [
    { d: 'M', s: 'done' }, { d: 'W', s: 'done' }, { d: 'F', s: 'today' }, { d: 'M', s: 'future' }, { d: 'W', s: 'future' }
  ];

  return (
    <div className="w-full px-4 mb-4">
      <div className="bg-[#111110] border-l-4 border-[#e8621a] rounded-r-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="text-[10px] font-black text-[#e8621a] uppercase tracking-widest flex items-center gap-2 mb-2">
          <CalendarDays size={14} /> {phase} · Day {day}
        </div>
        <h2 className="font-oswald text-3xl font-black text-white uppercase tracking-tight leading-none mb-3">
          {workoutName}
        </h2>
        <div className="flex items-center gap-4 text-muted-foreground text-[11px] font-bold uppercase mb-5">
          <span className="flex items-center gap-1.5"><BookOpen size={14} /> 6 exercises</span>
          <span className="flex items-center gap-1.5"><Clock3 size={14} /> ~45 min</span>
        </div>
        <div className="flex gap-2">
          {week.map((item, i) => (
            <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs 
              ${item.s === 'done' ? 'bg-green-600 text-black' : item.s === 'today' ? 'bg-[#e8621a] text-white shadow-[0_0_15px_rgba(232,98,26,0.5)]' : 'bg-white/5 text-muted-foreground'}`}>
              {item.d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}