import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Loader2 } from "lucide-react";

const LEGAL_TYPE_MAP: Record<string, { title: string; slug: string }> = {
  terms: { title: "Terms of Service", slug: "terms_of_service" },
  privacy: { title: "Privacy Policy", slug: "privacy_policy" },
  refund: { title: "Refund & Cancellation Policy", slug: "refund_policy" },
  "cookie-policy": { title: "Cookie Policy", slug: "cookie_policy" },
  "sms-consent": { title: "SMS/TCPA Consent", slug: "sms_consent" },
  "ai-disclosure": { title: "AI Usage Disclosure", slug: "ai_disclosure" },
  "referral-terms": { title: "Referral Program Terms", slug: "referral_terms" },
  "saas-agreement": { title: "SaaS Subscription Agreement", slug: "saas_agreement" },
  "affiliate-disclosure": { title: "Affiliate Disclosure", slug: "affiliate_disclosure" },
  "coaching-waiver": { title: "Coaching & Training Waiver", slug: "coaching_waiver" },
  "minor-waiver": { title: "Minor Athlete Parental Consent", slug: "minor_waiver" },
  "data-processing": { title: "Data Processing Agreement", slug: "data_processing_agreement" },
  "contractor-agreement": { title: "Independent Contractor Agreement", slug: "contractor_agreement" },
  "can-spam": { title: "CAN-SPAM Email Footer", slug: "can_spam_footer" },
};

const LegalPage = () => {
  const { type } = useParams<{ type: string }>();
  const mapped = type ? LEGAL_TYPE_MAP[type] : null;
  const docType = mapped?.slug;

  const { data: doc, isLoading } = useQuery({
    queryKey: ["legal-doc", docType],
    queryFn: async () => {
      if (!docType) return null;
      const { data } = await supabase
        .from("legal_documents")
        .select("*")
        .eq("document_type", docType)
        .eq("status", "approved")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!docType,
  });

  if (!mapped) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Document Not Found</h1>
          <Link to="/" className="text-primary underline">Return Home</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title={`${mapped.title} | M2 Development`} description={mapped.title} />
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : doc?.content ? (
            <article>
              <div
                className="prose prose-sm sm:prose max-w-none text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_a]:text-primary"
                dangerouslySetInnerHTML={{ __html: doc.content }}
              />
              <p className="text-xs text-muted-foreground mt-8 border-t border-border pt-4">
                Version {doc.version} · Last updated{" "}
                {new Date(doc.updated_at || doc.created_at).toLocaleDateString()}
              </p>
            </article>
          ) : (
            <div className="text-center py-20">
              <h1 className="text-2xl font-bold text-foreground mb-2">{mapped.title}</h1>
              <p className="text-muted-foreground">
                This document is pending review and will be published shortly.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default LegalPage;
