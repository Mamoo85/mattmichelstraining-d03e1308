import React, { useState, useEffect } from 'react';
import { Activity, Calendar, TrendingUp, MessageSquare, Lock, Share2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function ParentView() {
  const [accessCode, setAccessCode] = useState('');
  const [isLinked, setIsLinked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // In a real implementation, this would fetch from Supabase based on the linked ID
  const [mockData] = useState({
    athleteName: 'Harrison',
    workoutsThisWeek: 2,
    targetWorkouts: 3,
    streakDays: 5,
    lastWorkout: 'Upper Body Power',
    lastWorkoutDate: 'Yesterday',
    topLift: 'Trap Bar Deadlift',
    topLiftWeight: '225 lbs',
    recentNote: "Form looked excellent on the squats today. Increased working weight by 10lbs for next week."
  });

  useEffect(() => {
    const linkedId = localStorage.getItem('m2-parent-linked-athlete');
    if (linkedId) setIsLinked(true);
  }, []);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data, error: dbError } = await (supabase.from('parent_access_codes' as any) as any)
        .select('athlete_id, is_active')
        .eq('code', accessCode.toUpperCase())
        .single();

      if (dbError || !data) {
        setError('Invalid access code. Please check with Coach Matt.');
        return;
      }

      if (!data.is_active) {
        setError('This access code has been deactivated. Please contact Coach Matt.');
        return;
      }

      localStorage.setItem('m2-parent-linked-athlete', data.athlete_id);
      setIsLinked(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLinked) {
    return (
      <div className="min-h-screen bg-[#161615] flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full bg-[#1e1e1d] p-8 rounded-2xl border border-white/5 shadow-2xl text-center">
          <div className="w-16 h-16 bg-[#e8621a]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-[#e8621a]" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Parent Access</h1>
          <p className="text-slate-400 mb-8">Enter the 6-digit code provided by Coach Matt to view your athlete's progress.</p>

          <form onSubmit={handleLink} className="space-y-4">
            <input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              className="w-full bg-black/40 border border-white/10 rounded-lg py-4 px-4 text-center text-3xl tracking-[0.5em] text-white focus:outline-none focus:border-[#e8621a] transition-colors font-mono"
            />
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={isLoading || accessCode.length !== 6}
              className="w-full bg-[#e8621a] text-white font-bold py-4 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 size={18} className="animate-spin" />}
              {isLoading ? 'Verifying...' : 'View Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#161615] text-slate-200 pb-20">
      <header className="bg-[#1e1e1d] border-b border-white/5 px-6 py-4 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">{mockData.athleteName}'s Training</h1>
          <span className="text-[10px] uppercase tracking-widest text-[#e8621a] font-bold">M² Parent View</span>
        </div>
        <button className="text-slate-400 hover:text-white">
          <Share2 size={20} />
        </button>
      </header>

      <main className="p-6 max-w-lg mx-auto space-y-6">
        {/* Weekly Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#1e1e1d] p-5 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Activity size={16} />
              <span className="text-xs uppercase tracking-wider font-bold">This Week</span>
            </div>
            <div className="text-3xl font-black text-white">{mockData.workoutsThisWeek} <span className="text-lg text-slate-500 font-normal">/ {mockData.targetWorkouts}</span></div>
          </div>
          <div className="bg-[#1e1e1d] p-5 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <TrendingUp size={16} />
              <span className="text-xs uppercase tracking-wider font-bold">Current Streak</span>
            </div>
            <div className="text-3xl font-black text-[#e8621a]">{mockData.streakDays} <span className="text-lg text-[#e8621a]/50 font-normal">days</span></div>
          </div>
        </div>

        {/* Last Session */}
        <div className="bg-[#1e1e1d] p-6 rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Calendar size={18} className="text-[#e8621a]" />
              Last Session
            </h3>
            <span className="text-xs text-slate-400">{mockData.lastWorkoutDate}</span>
          </div>
          <p className="text-lg font-medium text-white mb-4">{mockData.lastWorkout}</p>
          <div className="bg-black/30 p-4 rounded-lg border-l-2 border-[#e8621a]">
            <p className="text-sm text-slate-300 italic">"{mockData.recentNote}"</p>
            <p className="text-xs text-slate-500 mt-2 font-bold uppercase">— Coach Matt</p>
          </div>
        </div>

        {/* Message Coach */}
        <button className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2">
          <MessageSquare size={20} className="text-[#e8621a]" />
          Message Coach Matt
        </button>
      </main>
    </div>
  );
}
