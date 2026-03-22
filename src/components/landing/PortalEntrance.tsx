import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { LogIn, BarChart3, Dumbbell, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import portalPrograms from "@/assets/portal-programs.jpg";
import portalChat from "@/assets/portal-chat.jpg";
import portalProgress from "@/assets/portal-progress.jpg";

const PILLS = [
  { icon: BarChart3, label: "Track Progress" },
  { icon: Dumbbell, label: "Log Workouts" },
  { icon: MessageSquare, label: "Coach Chat" },
];

function usePortalBadge() {
  const [count, setCount] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) { setLoggedIn(false); return; }
      setLoggedIn(true);
      const uid = session.user.id;

      // Fetch unread notifications + unread DMs in parallel
      const [notifs, dms] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("is_read", false),
        supabase.from("coach_direct_messages").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("is_read", false).eq("sender_role", "coach"),
      ]);
      if (!cancelled) {
        setCount((notifs.count ?? 0) + (dms.count ?? 0));
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  return { loggedIn, count };
}

const PortalEntrance = () => {
  const { loggedIn, count } = usePortalBadge();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.22 }}
      className="mb-10"
    >
      {/* Quick-access button */}
      <Link
        to="/dashboard"
        className={`relative flex items-center justify-center gap-3 w-full bg-card border-2 px-5 py-4 transition-m2 group mb-4 overflow-hidden ${
          loggedIn
            ? "border-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.5)] animate-[pulse-glow_2.5s_ease-in-out_infinite]"
            : "border-primary/30 hover:border-primary"
        }`}
      >
        <LogIn size={18} className="text-primary" />
        <span className="text-sm font-bold uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">
          {loggedIn ? "Go to Portal" : "Enter Member Portal"}
        </span>

        {/* Badge count */}
        {loggedIn && count > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold font-mono rounded-full px-1 shadow-lg animate-scale-in">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>

      {/* Feature pills */}
      <div className="flex gap-1.5 sm:gap-2 mb-4">
        {PILLS.map((p) => (
          <div
            key={p.label}
            className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 bg-primary/5 border border-primary/10 py-2 px-1.5 sm:px-2"
          >
            <p.icon size={11} className="text-primary flex-shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-muted-foreground">
              {p.label}
            </span>
          </div>
        ))}
      </div>

      {/* Sneak peek — overlapping screenshots with gradient fade */}
      <div className="relative h-[140px] sm:h-[180px] overflow-hidden bg-card border border-border">
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={portalProgress}
            alt="Progress tracking"
            width={200}
            height={160}
            className="absolute w-[42%] sm:w-[45%] max-w-[200px] h-[120px] sm:h-[160px] object-cover object-top rounded shadow-m2 -rotate-3 -translate-x-[55%] translate-y-1 opacity-70"
            loading="lazy"
            decoding="async"
          />
          <img
            src={portalPrograms}
            alt="Training programs"
            width={220}
            height={170}
            className="absolute w-[48%] sm:w-[50%] max-w-[220px] h-[130px] sm:h-[170px] object-cover object-top rounded shadow-m2-hover z-10"
            loading="lazy"
            decoding="async"
          />
          <img
            src={portalChat}
            alt="Coach chat"
            width={200}
            height={160}
            className="absolute w-[42%] sm:w-[45%] max-w-[200px] h-[120px] sm:h-[160px] object-cover object-top rounded shadow-m2 rotate-3 translate-x-[55%] translate-y-1 opacity-70"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="absolute bottom-0 inset-x-0 h-12 sm:h-16 bg-gradient-to-t from-card to-transparent z-20" />

        <div className="absolute bottom-2 inset-x-0 z-30 text-center">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Already a member? Access your portal
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default PortalEntrance;
