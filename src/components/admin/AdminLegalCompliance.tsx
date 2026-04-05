import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, FileText, CheckCircle, AlertTriangle, RefreshCw, Square, CheckSquare, ExternalLink, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LegalDoc {
  type: string;
  title: string;
  description: string;
  exists: boolean;
  id: string | null;
  version: number;
  status: string;
  lastReviewed: string | null;
  nextReview: string | null;
}

export default function AdminLegalCompliance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["legal-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-lawyer-jess", {
        body: { action: "list" },
      });
      if (error) throw error;
      return (data?.documents || []) as LegalDoc[];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (documentType: string) => {
      setGeneratingType(documentType);
      const { data, error } = await supabase.functions.invoke("ai-lawyer-jess", {
        body: { action: "generate", documentType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Document Generated", description: "Jess created a new draft. Review and approve it." });
      if (data?.content) setPreviewContent(data.content);
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
      setGeneratingType(null);
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
      setGeneratingType(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (documentType: string) => {
      const { data, error } = await supabase.functions.invoke("ai-lawyer-jess", {
        body: { action: "approve", documentType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Document Approved" });
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
    },
  });

  const statusBadge = (doc: LegalDoc) => {
    if (!doc.exists) return <Badge variant="destructive" className="text-[9px]">MISSING</Badge>;
    if (doc.status === "approved") return <Badge className="bg-green-600 text-[9px]">APPROVED</Badge>;
    if (doc.status === "draft") return <Badge variant="secondary" className="text-[9px]">DRAFT</Badge>;
    return <Badge variant="outline" className="text-[9px]">{doc.status}</Badge>;
  };

  const needsReview = (doc: LegalDoc) => {
    if (!doc.nextReview) return false;
    return new Date(doc.nextReview) < new Date();
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  }

  const missing = documents?.filter(d => !d.exists).length || 0;
  const drafts = documents?.filter(d => d.status === "draft").length || 0;
  const approved = documents?.filter(d => d.status === "approved").length || 0;
  const reviewDue = documents?.filter(d => needsReview(d)).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="text-primary" size={20} />
        <div>
          <h2 className="text-lg font-bold">Legal & Compliance — Jess AI</h2>
          <p className="text-xs text-muted-foreground">AI-generated legal documents for all M2 services</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Missing", value: missing, color: "text-red-400" },
          { label: "Drafts", value: drafts, color: "text-yellow-400" },
          { label: "Approved", value: approved, color: "text-green-400" },
          { label: "Review Due", value: reviewDue, color: "text-orange-400" },
        ].map(s => (
          <Card key={s.label} className="border-border/40 bg-card/50">
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── COMPLIANCE CHECKLIST ───────────────────────────────── */}
      <LegalChecklist />

      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText size={14} /> All Legal Documents ({documents?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {documents?.map(doc => (
              <div key={doc.type} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                {doc.exists && doc.status === "approved" ? (
                  <CheckCircle size={14} className="text-green-400 shrink-0" />
                ) : (
                  <AlertTriangle size={14} className={doc.exists ? "text-yellow-400" : "text-red-400"} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">{doc.title}</div>
                  <div className="text-[10px] text-muted-foreground">{doc.description}</div>
                  {doc.lastReviewed && (
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      v{doc.version} — reviewed {new Date(doc.lastReviewed).toLocaleDateString()}
                      {needsReview(doc) && <span className="text-orange-400 ml-1">• Review overdue</span>}
                    </div>
                  )}
                </div>
                {statusBadge(doc)}
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] px-2"
                    disabled={generatingType === doc.type}
                    onClick={() => generateMutation.mutate(doc.type)}
                  >
                    {generatingType === doc.type ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                    <span className="ml-1">{doc.exists ? "Regenerate" : "Generate"}</span>
                  </Button>
                  {doc.exists && doc.status === "draft" && (
                    <Button
                      size="sm"
                      className="h-7 text-[10px] px-2"
                      onClick={() => approveMutation.mutate(doc.type)}
                    >
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {previewContent && (
        <Card className="border-border/40">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">Document Preview</CardTitle>
            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setPreviewContent(null)}>Close</Button>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none max-h-[500px] overflow-y-auto text-xs" dangerouslySetInnerHTML={{ __html: previewContent }} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── COMPLIANCE CHECKLIST COMPONENT ──────────────────────────── */

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  link?: string;
  linkText?: string;
  cost?: string;
}

interface ChecklistSection {
  title: string;
  color: string;
  borderColor: string;
  bgColor: string;
  icon: string;
  items: ChecklistItem[];
}

const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    title: "DO NOW (Free)",
    color: "text-green-400",
    borderColor: "border-green-500/20",
    bgColor: "bg-green-500/5",
    icon: "✅",
    items: [
      {
        id: "canspam_address",
        label: "Add CAN-SPAM physical address to email footer",
        description: "Federal law requires a physical mailing address in every commercial email. Use your Grosse Pointe address.",
      },
      {
        id: "refund_policy",
        label: "Create refund policy page",
        description: "Document your cancellation and refund terms. Monthly services: cancel anytime, no refunds for partial months. Web design: no refunds after work begins.",
      },
      {
        id: "cookie_consent",
        label: "Add cookie consent banner",
        description: "If you use analytics (Google Analytics, etc.) or serve EU visitors, a cookie consent banner is required.",
      },
      {
        id: "email_unsubscribe",
        label: "Verify unsubscribe links work in all emails",
        description: "CAN-SPAM requires working unsubscribe in every commercial email. Resend handles this but verify it's in templates.",
      },
      {
        id: "tos_published",
        label: "Publish Terms of Service to website",
        description: "Use Jess AI below to generate, review, and publish. Covers all M2 services.",
      },
      {
        id: "privacy_published",
        label: "Publish Privacy Policy to website",
        description: "Required by law if you collect any personal data (names, emails, phones). Use Jess AI below.",
      },
    ],
  },
  {
    title: "YOUR LICENSES (Upload/Verify)",
    color: "text-blue-400",
    borderColor: "border-blue-500/20",
    bgColor: "bg-blue-500/5",
    icon: "🏅",
    items: [
      {
        id: "training_cert",
        label: "Personal Training Certification",
        description: "Your certified training credentials. Upload or note which cert(s) you hold.",
      },
      {
        id: "cpr_cert",
        label: "CPR/AED Certification",
        description: "Required for personal trainers. Note expiration date.",
      },
      {
        id: "liability_insurance_training",
        label: "Professional Liability Insurance (Training)",
        description: "Covers your training business. Note carrier and policy number.",
      },
      {
        id: "business_registration",
        label: "DBA / Business Registration",
        description: "M2 Development or M2 Performance Training — your registered business name with the state/county.",
      },
    ],
  },
  {
    title: "AFTER FIRST 1-2 SALES ($50-300)",
    color: "text-yellow-400",
    borderColor: "border-yellow-500/20",
    bgColor: "bg-yellow-500/5",
    icon: "💰",
    items: [
      {
        id: "a2p_10dlc",
        label: "Register A2P 10DLC with Twilio",
        description: "CRITICAL for SMS products. Without registration, carriers may block your texts. Register your brand + campaign with Twilio. ~$15 one-time + $0.003/msg.",
        link: "https://www.twilio.com/docs/messaging/guides/10dlc",
        linkText: "Twilio 10DLC Guide",
        cost: "~$15",
      },
      {
        id: "llc_filing",
        label: "File Michigan LLC",
        description: "Protects personal assets from business liability. File online at Michigan LARA. Takes 1-2 weeks.",
        link: "https://www.michigan.gov/lara/bureau-list/bcs/corps/llc",
        linkText: "Michigan LLC Filing",
        cost: "$50",
      },
      {
        id: "ein_number",
        label: "Get EIN from IRS (free)",
        description: "Employer Identification Number — needed for LLC tax filing, opening business bank account. Apply online, instant.",
        link: "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online",
        linkText: "Apply for EIN",
        cost: "Free",
      },
      {
        id: "business_bank",
        label: "Open business bank account",
        description: "Separate personal and business finances. Need LLC docs + EIN. Most banks offer free business checking.",
        cost: "Free",
      },
    ],
  },
  {
    title: "AS YOU SCALE ($500-1,000)",
    color: "text-purple-400",
    borderColor: "border-purple-500/20",
    bgColor: "bg-purple-500/5",
    icon: "🔮",
    items: [
      {
        id: "attorney_review",
        label: "Have attorney review ToS and Privacy Policy",
        description: "AI-generated docs are a great start but an attorney review ensures full compliance with Michigan law.",
        cost: "$300-500",
      },
      {
        id: "general_liability",
        label: "General liability insurance (digital services)",
        description: "Covers your web design, marketing, and SaaS services. Separate from your training insurance.",
        cost: "$400-800/yr",
      },
      {
        id: "eo_insurance",
        label: "Errors & Omissions (E&O) insurance",
        description: "Professional liability for digital services — covers claims that your work caused financial harm to a client.",
        cost: "$500-1,000/yr",
      },
      {
        id: "stripe_atlas",
        label: "Consider Stripe Atlas for formal incorporation",
        description: "If you scale beyond Michigan, Stripe Atlas sets up a Delaware LLC + bank account + tax docs for $500.",
        cost: "$500",
      },
    ],
  },
];

const LS_KEY = "m2-legal-checklist";

function loadChecked(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveChecked(checked: Record<string, boolean>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(checked));
  } catch {}
}

function LegalChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>(loadChecked);

  useEffect(() => {
    saveChecked(checked);
  }, [checked]);

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalItems = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const completedItems = Object.values(checked).filter(Boolean).length;
  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Award size={14} className="text-primary" /> Compliance Checklist
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {completedItems}/{totalItems}
            </span>
            <div className="w-20 h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-primary">{pct}%</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Prioritized by urgency. Check items as you complete them. Your training licenses go in section 2.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {CHECKLIST_SECTIONS.map((section) => {
          const sectionDone = section.items.filter((i) => checked[i.id]).length;
          return (
            <div
              key={section.title}
              className={`rounded-lg border ${section.borderColor} ${section.bgColor} p-3`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span>{section.icon}</span>
                <span className={`text-xs font-bold ${section.color}`}>
                  {section.title}
                </span>
                <span className="text-[9px] text-muted-foreground ml-auto">
                  {sectionDone}/{section.items.length}
                </span>
              </div>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex gap-2 p-2 rounded-lg transition-all cursor-pointer hover:bg-white/5 ${
                      checked[item.id] ? "opacity-50" : ""
                    }`}
                    onClick={() => toggle(item.id)}
                  >
                    <div className="mt-0.5 shrink-0">
                      {checked[item.id] ? (
                        <CheckSquare size={14} className="text-green-400" />
                      ) : (
                        <Square size={14} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-bold ${checked[item.id] ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {item.label}
                        {item.cost && (
                          <span className="ml-1.5 text-[9px] font-normal text-muted-foreground">
                            ({item.cost})
                          </span>
                        )}
                      </p>
                      <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5">
                        {item.description}
                      </p>
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 mt-1 text-[9px] text-primary hover:underline"
                        >
                          <ExternalLink size={8} /> {item.linkText || "Learn more"}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
