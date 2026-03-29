import React from 'react';
import { Sparkles, Wrench, MessageSquare, Trophy, BarChart3, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ZoneCommandCenter() {
  const navigate = useNavigate();

  const triggerProveIt = () => {
    window.dispatchEvent(new CustomEvent("open-prove-it-zone"));
  };

  const actions = [
    { label: 'Generate', icon: Sparkles, color: 'text-orange-400', bg: 'bg-orange-500/10', path: '/free-ai-generator' },
    { label: 'Fix It', icon: Wrench, color: 'text-purple-400', bg: 'bg-purple-500/10', path: '/ai-insights' },
    { label: 'Chat', icon: MessageSquare, color: 'text-green-400', bg: 'bg-green-500/10', path: '/coach' },
    { label: 'AI Poster', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10', path: '/the-edge' },
    { label: 'Progress', icon: BarChart3, color: 'text-cyan-400', bg: 'bg-cyan-500/10', path: '/progress' },
    { label: 'Prove It', icon: Trophy, color: 'text-red-400', bg: 'bg-red-500/10', action: triggerProveIt },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5 px-4 mb-6">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => action.action ? action.action() : navigate(action.path)}
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-[#e8621a]/40 transition-all active:scale-95"
        >
          <div className={`p-2 rounded-xl ${action.bg} ${action.color} mb-2`}>
            <action.icon size={22} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}