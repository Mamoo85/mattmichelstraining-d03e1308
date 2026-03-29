import React from 'react';
import { Flame, CheckCircle2, Award, Target } from 'lucide-react';

export default function AthleteStats() {
  return (
    <div className="w-full px-4 py-4 space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <div className="flex justify-center mb-1 text-[#e8621a]"><Flame size={20} /></div>
          <div className="font-oswald text-3xl font-black text-[#e8621a] leading-none">7🔥</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">Streak</div>
        </div>
        <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <div className="flex justify-center mb-1 text-green-500"><CheckCircle2 size={20} /></div>
          <div className="font-oswald text-xl font-black text-white leading-none mt-1">✅✅✅</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-1.5">This Week</div>
        </div>
        <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <div className="flex justify-center mb-1 text-[#a855f7]"><Award size={20} /></div>
          <div className="font-oswald text-3xl font-black text-[#a855f7] leading-none">1,240</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">Points</div>
        </div>
      </div>
      <div className="px-1">
        <div className="flex justify-between items-end mb-1 text-xs font-bold uppercase tracking-wide">
          <span className="text-[#e8621a] font-oswald text-lg flex items-center gap-1.5">
            <Target size={14} /> Warrior
          </span>
          <span className="text-muted-foreground text-[10px] font-medium lowercase pb-1">260 pts to Elite</span>
        </div>
        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#e8621a] to-orange-400 w-[64%]" />
        </div>
      </div>
    </div>
  );
}