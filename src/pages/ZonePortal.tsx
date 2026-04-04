import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Dumbbell, Brain, Wrench, Trophy, MessageCircle, Home, Activity, BarChart3, User } from "lucide-react";

const ZonePortal = () => {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || "Athlete";
  const [activeTab, setActiveTab] = useState("home");

  const stats = [
    { label: "Streak", value: "12", unit: "days" },
    { label: "This Week", value: "4", unit: "sessions" },
    { label: "Program", value: "Phase 2", unit: "week 3" },
  ];

  const actions = [
    {
      label: "Workout Portal",
      icon: Dumbbell,
      accent: "#00f0ff",
      event: "open-workout-zone",
    },
    {
      label: "AI Generator",
      icon: Brain,
      accent: "#a855f7",
      event: "open-workout-zone",
    },
    {
      label: "Fix It Engine",
      icon: Wrench,
      accent: "#00f0ff",
      event: "open-workout-zone",
    },
    {
      label: "Submit PR",
      icon: Trophy,
      accent: "#f97316",
      event: "open-prove-it-zone",
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a", color: "#e5e5e5" }}>
      {/* Zone Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-5 py-4" style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff" }}>
            M2
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: "#737373" }}>THE ZONE</p>
            <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>{displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
          <span className="text-xs" style={{ color: "#737373" }}>Online</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-28 pt-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-4 text-center"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <p className="text-2xl font-black" style={{ color: "#fafafa" }}>{s.value}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color: "#737373" }}>{s.label}</p>
              <p className="text-[10px]" style={{ color: "#525252" }}>{s.unit}</p>
            </div>
          ))}
        </div>

        {/* Today's Action Card */}
        <div
          className="relative rounded-2xl p-[1px] overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #f97316, #00f0ff, #a855f7)",
          }}
        >
          <div
            className="rounded-2xl p-6"
            style={{ background: "#0a0a0a" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#00f0ff" }}>
              Today's Training
            </p>
            <h2 className="text-xl font-black mb-1" style={{ color: "#fafafa" }}>
              Upper Body Power
            </h2>
            <p className="text-sm mb-5" style={{ color: "#737373" }}>
              6 exercises · ~45 min · Phase 2, Day 4
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-workout-zone"))}
              className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                color: "#fff",
                boxShadow: "0 0 24px rgba(249,115,22,0.3)",
              }}
            >
              Start Training →
            </button>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => window.dispatchEvent(new CustomEvent(a.event))}
              className="rounded-2xl p-5 text-left transition-all active:scale-[0.96]"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(16px)",
                border: `1px solid ${a.accent}22`,
              }}
            >
              <a.icon size={24} style={{ color: a.accent }} className="mb-3" />
              <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>{a.label}</p>
            </button>
          ))}
        </div>

        {/* Coach Access */}
        <button
          className="w-full flex items-center gap-4 rounded-2xl p-5 transition-all active:scale-[0.98]"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="relative">
            <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)" }}>
              <MessageCircle size={20} style={{ color: "#f97316" }} />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full animate-pulse" style={{ background: "#22c55e", border: "2px solid #0a0a0a" }} />
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-semibold" style={{ color: "#fafafa" }}>Message Coach Matt</p>
            <p className="text-xs" style={{ color: "#737373" }}>Usually replies within 2 hours</p>
          </div>
          <div className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
            Available
          </div>
        </button>

        {/* Recent Activity */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#525252" }}>Recent Activity</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { text: "Completed Lower Body Strength", time: "Yesterday", dot: "#22c55e" },
              { text: "PR: Trap Bar Deadlift — 315 lbs", time: "2 days ago", dot: "#f97316" },
              { text: "Coach Matt left feedback", time: "3 days ago", dot: "#00f0ff" },
              { text: "Completed Upper Body Hypertrophy", time: "4 days ago", dot: "#22c55e" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.dot }} />
                <p className="text-sm flex-1" style={{ color: "#d4d4d4" }}>{item.text}</p>
                <p className="text-[10px] flex-shrink-0" style={{ color: "#525252" }}>{item.time}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Test Label */}
        <p className="text-center text-[10px] uppercase tracking-widest pt-4" style={{ color: "#2a2a2a" }}>
          TEST PAGE — NOT CONNECTED TO LIVE SITE
        </p>
      </main>

      {/* Bottom Zone Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around py-3 px-4"
        style={{
          background: "rgba(10,10,10,0.92)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {[
          { icon: Home, label: "Home", id: "home" },
          { icon: Activity, label: "Train", id: "train" },
          { icon: BarChart3, label: "Progress", id: "progress" },
          { icon: User, label: "Profile", id: "profile" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center gap-1 transition-all"
          >
            <tab.icon
              size={22}
              style={{ color: activeTab === tab.id ? "#f97316" : "#525252" }}
            />
            <span
              className="text-[10px] font-medium"
              style={{ color: activeTab === tab.id ? "#f97316" : "#525252" }}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default ZonePortal;
