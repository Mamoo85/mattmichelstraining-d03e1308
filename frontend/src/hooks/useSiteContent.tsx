import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SiteSection {
  id: string;
  section_key: string;
  label: string;
  is_visible: boolean;
  sort_order: number;
}

export interface SiteContentItem {
  id: string;
  section: string;
  content_key: string;
  content_value: string;
  content_type: string;
  label: string;
  sort_order: number;
}

export function useSiteSections() {
  return useQuery({
    queryKey: ["site-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_sections")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as SiteSection[];
    },
    staleTime: 60_000,
  });
}

export function useSiteContent(section?: string) {
  return useQuery({
    queryKey: ["site-content", section],
    queryFn: async () => {
      let q = supabase.from("site_content").select("*").order("sort_order");
      if (section) q = q.eq("section", section);
      const { data, error } = await q;
      if (error) throw error;
      return data as SiteContentItem[];
    },
    staleTime: 60_000,
  });
}

/** Get a single content value with a fallback */
export function useContentValue(section: string, key: string, fallback: string = "") {
  const { data } = useSiteContent(section);
  const item = data?.find((c) => c.content_key === key);
  return item?.content_value ?? fallback;
}

/** Get a map of content_key -> content_value for a section */
export function useContentMap(section: string) {
  const { data, isLoading } = useSiteContent(section);
  const map: Record<string, string> = {};
  data?.forEach((c) => {
    map[c.content_key] = c.content_value;
  });
  return { content: map, isLoading };
}

/** Check if a section is visible */
export function useSectionVisible(sectionKey: string) {
  const { data } = useSiteSections();
  const section = data?.find((s) => s.section_key === sectionKey);
  return section?.is_visible ?? true; // default visible if not found
}

export function useInvalidateSiteContent() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["site-content"] });
    qc.invalidateQueries({ queryKey: ["site-sections"] });
  };
}
