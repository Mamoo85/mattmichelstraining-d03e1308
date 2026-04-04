import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

const MATT_EMAIL = "matt@mattmichelstraining.com";

const M2_SERVICES = [
  {
    key: "blog_post",
    table: "blog_post_clients",
    name: "Monthly Blog Posts",
    desc: "4 SEO blog posts/month for mattmichelstraining.com",
    emoji: "📝",
    schedule: "Monthly",
    insert: {
      business_name: "M2 Development",
      contact_name: "Matt Michels",
      email: MATT_EMAIL,
      website: "https://mattmichelstraining.com",
      industry: "AI automation & web development",
      tone: "professional",
      active: true,
    },
  },
  {
    key: "ads_copy",
    table: "ads_copy_clients",
    name: "Monthly Ad Copy",
    desc: "10 fresh Google Ads variations/month for M2's services",
    emoji: "📢",
    schedule: "Monthly",
    insert: {
      business_name: "M2 Development",
      email: MATT_EMAIL,
      industry: "AI automation & SaaS services",
      target_keywords: ["AI automation", "automated marketing", "contractor leads", "AI phone answering", "missed call text back"],
      active: true,
    },
  },
  {
    key: "newsletter_service",
    table: "newsletter_service_clients",
    name: "Business Newsletter",
    desc: "AI-written monthly newsletter for M2's subscribers",
    emoji: "📧",
    schedule: "Monthly",
    insert: {
      business_name: "M2 Development",
      email: MATT_EMAIL,
      industry: "AI automation services for small business",
      subscriber_list: [MATT_EMAIL],
      active: true,
    },
  },
  {
    key: "social_captions",
    table: "social_captions_clients",
    name: "Social Media Captions",
    desc: "30 AI captions/month for LinkedIn, Facebook, Instagram",
    emoji: "📱",
    schedule: "Monthly",
    insert: {
      business_name: "M2 Development",
      contact_name: "Matt Michels",
      email: MATT_EMAIL,
      industry: "AI automation & web development",
      active: true,
    },
  },
  {
    key: "local_seo",
    table: "local_seo_clients",
    name: "Local SEO Pages",
    desc: "AI-written SEO landing pages for M2's service areas",
    emoji: "🔍",
    schedule: "Monthly",
    insert: {
      business_name: "M2 Development",
      contact_name: "Matt Michels",
      email: MATT_EMAIL,
      industry: "AI automation services",
      city: "Grosse Pointe",
      active: true,
    },
  },
  {
    key: "competitor_watch",
    table: "competitor_watch_clients",
    name: "Competitor Watch",
    desc: "Weekly intel on competing AI/automation agencies",
    emoji: "🔭",
    schedule: "Weekly",
    insert: {
      business_name: "M2 Development",
      email: MATT_EMAIL,
      industry: "AI automation services",
      competitor_urls: [
        "https://vendasta.com",
        "https://hibu.com",
        "https://thryv.com",
      ],
      active: true,
    },
  },
  {
    key: "market_intel",
    table: "market_intel_clients",
    name: "Market Intelligence",
    desc: "Weekly AI automation industry news & trends report",
    emoji: "📊",
    schedule: "Weekly",
    insert: {
      email: MATT_EMAIL,
      industry: "AI automation",
      location: "United States",
      focus_topics: ["AI automation", "SaaS trends", "SMB marketing", "contractor lead gen", "missed call text back"],
      active: true,
    },
  },
  {
    key: "linkedin_ghostwriting",
    table: "linkedin_ghostwriting_clients",
    name: "LinkedIn Ghostwriting",
    desc: "Weekly LinkedIn posts written in Matt's voice",
    emoji: "💼",
    schedule: "Weekly",
    insert: {
      email: MATT_EMAIL,
      business_name: "M2 Development",
      industry: "AI automation & SaaS",
      active: true,
    },
  },
  {
    key: "gbp_saas",
    table: "gbp_saas_clients",
    name: "GBP Auto-Poster",
    desc: "3x/week AI posts to M2's Google Business Profile",
    emoji: "📍",
    schedule: "3x/week",
    insert: {
      business_name: "M2 Development",
      business_type: "AI automation & web development agency",
      contact_name: "Matt Michels",
      email: MATT_EMAIL,
      phone: "3138064952",
      city: "Grosse Pointe",
      state: "MI",
      plan: "pro",
      active: true,
    },
  },
];

const AdminM2GrowthHub = () => {
  const qc = useQueryClient();
  const [enrollingAll, setEnrollingAll] = useState(false);

  const { data: enrollments = {}, isLoading } = useQuery({
    queryKey: ["m2-enrollments"],
    queryFn: async () => {
      const results: Record<string, boolean> = {};
      await Promise.all(
        M2_SERVICES.map(async (s) => {
          const { data } = await (supabase.from as any)(s.table)
            .select("id, active")
            .eq("email", MATT_EMAIL)
            .maybeSingle();
          results[s.key] = !!(data?.active);
        })
      );
      return results;
    },
  });

  const { mutate: toggleService, isPending } = useMutation({
    mutationFn: async ({ service, enroll }: { service: typeof M2_SERVICES[0]; enroll: boolean }) => {
      if (enroll) {
        // Check if already exists first to avoid ON CONFLICT issues
        const { data: existing } = await (supabase.from as any)(service.table)
          .select("id")
          .eq("email", MATT_EMAIL)
          .maybeSingle();
        if (existing) {
          const { error } = await (supabase.from as any)(service.table)
            .update({ active: true })
            .eq("email", MATT_EMAIL);
          if (error) throw error;
        } else {
          const { error } = await (supabase.from as any)(service.table).insert(service.insert);
          if (error) throw error;
        }
      } else {
        const { error } = await (supabase.from as any)(service.table).update({ active: false }).eq("email", MATT_EMAIL);
        if (error) throw error;
      }
    },
    onSuccess: (_, { service, enroll }) => {
      toast.success(enroll ? `✅ M2 enrolled in ${service.name}` : `Removed from ${service.name}`);
      qc.invalidateQueries({ queryKey: ["m2-enrollments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const enrollAll = async () => {
    setEnrollingAll(true);
    for (const service of M2_SERVICES) {
      if (!enrollments[service.key]) {
        await new Promise<void>((resolve) => {
          toggleService({ service, enroll: true }, { onSettled: () => resolve() });
        });
      }
    }
    setEnrollingAll(false);
    toast.success("🚀 M2 Development enrolled in all services!");
  };

  const activeCount = Object.values(enrollments).filter(Boolean).length;
  const scheduleGroups = ["3x/week", "Weekly", "Monthly"] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-foreground">M2 Self-Service Hub</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Run every product on your own business for free.{" "}
            <span className="text-primary font-semibold">{activeCount}/{M2_SERVICES.length} active.</span>
          </p>
        </div>
        <Button
          size="sm"
          onClick={enrollAll}
          disabled={enrollingAll || activeCount === M2_SERVICES.length}
          className="text-xs gap-1.5 shrink-0"
        >
          {enrollingAll ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
          {activeCount === M2_SERVICES.length ? "All Active" : "Enroll All"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {scheduleGroups.map((freq) => {
            const group = M2_SERVICES.filter((s) => s.schedule === freq);
            return (
              <div key={freq}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{freq}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.map((service) => {
                    const active = enrollments[service.key];
                    return (
                      <div
                        key={service.key}
                        className={`p-4 border rounded-lg flex flex-col gap-3 transition-all ${
                          active ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-sm">{service.emoji}</span>
                              <span className="text-xs font-bold text-foreground truncate">{service.name}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{service.desc}</p>
                          </div>
                          {active ? (
                            <CheckCircle size={14} className="text-primary shrink-0 mt-0.5" />
                          ) : (
                            <Circle size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={active ? "outline" : "default"}
                          className="text-[11px] h-7 w-full"
                          disabled={isPending}
                          onClick={() => toggleService({ service, enroll: !active })}
                        >
                          {active ? "Remove M2" : "Enroll M2"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 border border-dashed border-border rounded-lg bg-muted/20">
        <p className="text-[11px] text-muted-foreground">
          <strong className="text-foreground">How this works:</strong> Enrolling M2 Development adds your business as a client in each service table.
          The automated cron jobs will then generate and email content directly to{" "}
          <span className="text-primary">matt@mattmichelstraining.com</span> on their normal schedule —
          same as any paying customer. Zero extra cost.
        </p>
      </div>
    </div>
  );
};

export default AdminM2GrowthHub;
