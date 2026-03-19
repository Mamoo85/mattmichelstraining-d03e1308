import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FocusData {
  title: string;
  topic: string;
  reasoning: string;
  matt_quote: string;
}

const MonthlyFocus = () => {
  const [focus, setFocus] = useState<FocusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    supabase
      .from("monthly_focus")
      .select("title, topic, reasoning, matt_quote")
      .eq("month", now.getMonth() + 1)
      .eq("year", now.getFullYear())
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setFocus(data as FocusData);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!focus) return null;

  const now = new Date();
  const monthName = now.toLocaleString("default", { month: "long" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mb-10"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-8 bg-primary rounded-full" />
        <Flame size={20} className="text-primary" />
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
          Monthly Focus
        </h2>
      </div>
      <div className="bg-card shadow-m2 border-l-4 border-primary p-5 md:p-6">
        <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground mb-2">
          {monthName}: {focus.topic || focus.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {focus.reasoning}
        </p>
        {focus.matt_quote && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3 mt-3">
            "{focus.matt_quote}" — Matt
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default MonthlyFocus;
