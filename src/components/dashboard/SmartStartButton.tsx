import React, { useState } from 'react';
import { Play, Mic, Terminal, X, Send } from 'lucide-react';

export default function SmartStartButton({ hasWorkout = true }) {
  const [isLogOpen, setIsLogOpen] = useState(false);

  return (
    <div className="w-full px-4 mb-24">
      {!isLogOpen ? (
        <button 
          onClick={() => hasWorkout ? window.location.href='/workout/active' : setIsLogOpen(true)}
          className="w-full h-[60px] bg-gradient-to-r from-[#e8621a] to-[#c94e12] rounded-2xl flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(232,98,26,0.4)] active:scale-95 transition-all"
        >
          {hasWorkout ? (
            <>
              <Play className="fill-white" size={24} />
              <span className="font-oswald text-lg font-bold uppercase tracking-wider text-white">Start Today's Workout</span>
            </>
          ) : (
            <>
              <Mic size={24} className="text-white" />
              <span className="font-oswald text-lg font-bold uppercase tracking-wider text-white">Log Your Workout</span>
            </>
          )}
        </button>
      ) : (
        <div className="bg-[#111110] border border-[#e8621a]/40 rounded-2xl p-5 animate-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center mb-4 text-[#e8621a]">
            <div className="flex items-center gap-2"><Terminal size={16} /><span className="text-[10px] font-black uppercase tracking-widest">QuickLog v1.1</span></div>
            <button onClick={() => setIsLogOpen(false)}><X size={18} /></button>
          </div>
          <textarea 
            placeholder="e.g. '3 sets of 10 bench with 225'..."
            className="w-full bg-transparent border-none text-white focus:ring-0 p-0 mb-4 h-20 font-mono text-sm"
            autoFocus
          />
          <button className="w-full bg-[#e8621a] py-3 rounded-xl font-bold text-xs uppercase text-white flex items-center justify-center gap-2">
            Process Workout <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}