import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone } from "lucide-react";

const AnnouncementBanner = () => {
  const { data } = useQuery({
    queryKey: ["announcement-banner"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_content")
        .select("content_key, content_value")
        .eq("section", "announcement");
      if (!data) return null;
      const map: Record<string, string> = {};
      data.forEach((d: any) => { map[d.content_key] = d.content_value; });
      return { text: map["banner_text"] || "", enabled: map["banner_enabled"] === "true" };
    },
    staleTime: 60_000,
  });

  if (!data?.enabled || !data.text) return null;

  return (
    <div className="bg-primary text-primary-foreground text-center py-2 px-4 fixed top-0 left-0 right-0 z-[60]">
      <div className="flex items-center justify-center gap-2">
        <Megaphone size={12} />
        <span className="text-[11px] font-bold uppercase tracking-widest">{data.text}</span>
      </div>
    </div>
  );
};

export default AnnouncementBanner;
