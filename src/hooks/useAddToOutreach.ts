import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddToOutreachParams {
  businessName: string;
  domain?: string;
  city?: string;
  phone?: string;
  industry?: string;
  sourceProduct?: string;
}

export function useAddToOutreach() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: AddToOutreachParams) => {
      const { businessName, domain, city, phone, industry, sourceProduct } = params;

      // Insert into outreach_leads — ignore if already exists (no unique constraint on business_name)
      const { data, error } = await (supabase as any)
        .from("outreach_leads")
        .insert({
          business_name: businessName,
          website: domain ? `https://${domain.replace(/^https?:\/\//, "")}` : null,
          city: city || null,
          phone: phone || null,
          industry: industry || null,
          source: sourceProduct || "admin_manual",
          pipeline_stage: "new",
        })
        .select("id")
        .single();

      if (error && !error.message?.includes("duplicate")) throw error;

      // Trigger enrichment immediately (fire-and-forget)
      supabase.functions
        .invoke("outreach-leads-enrich", { body: { batch: 1 } })
        .catch(() => {});

      return data;
    },
    onSuccess: (_, params) => {
      toast({
        title: "Added to pipeline",
        description: `${params.businessName} queued for enrichment.`,
      });
      qc.invalidateQueries({ queryKey: ["outreach_leads"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Already in pipeline",
        description: err.message?.includes("duplicate") ? "This business is already in your outreach pipeline." : err.message,
        variant: "destructive",
      });
    },
  });
}
