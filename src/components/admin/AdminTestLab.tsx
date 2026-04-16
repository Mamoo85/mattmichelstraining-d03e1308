import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle, Zap, FlaskConical } from "lucide-react";

interface TestProduct {
  id: string;
  name: string;
  price: string;
  description: string;
  fields: Array<{ key: string; label: string; default: string }>;
}

const PRODUCTS: TestProduct[] = [
  {
    id: "am_i_breached",
    name: "Am I Breached?",
    price: "$4.99",
    description: "Check one email against 14B+ breached records. Results in 30 seconds.",
    fields: [
      { key: "target_email", label: "Email to Check", default: "matthewmichels4@gmail.com" },
    ],
  },
  {
    id: "website_speed",
    name: "Is My Website Fast?",
    price: "$9",
    description: "Mobile + Desktop speed scores, Core Web Vitals, plain-English recommendations.",
    fields: [
      { key: "url", label: "Website URL", default: "detroitwebagent.com" },
    ],
  },
  {
    id: "google_me",
    name: "Google Me",
    price: "$14.99",
    description: "Where you rank on Google Search + Google Maps. Top 5 competitors shown.",
    fields: [
      { key: "business_name", label: "Business Name", default: "Detroit Web Agency" },
      { key: "city", label: "City", default: "Detroit" },
    ],
  },
  {
    id: "shield_my_team",
    name: "Shield My Team",
    price: "$49",
    description: "Scan up to 10 employee emails for credential breaches. Full risk report.",
    fields: [
      { key: "company_name", label: "Company Name", default: "Matthew Drew Michels" },
      { key: "emails_csv", label: "Emails (comma separated)", default: "matthewmichels4@gmail.com,matt@mattmichelstraining.com,matt@detroitwebagent.com" },
    ],
  },
  {
    id: "spy_competitor",
    name: "Spy On My Competitor",
    price: "$19",
    description: "Website speed, content analysis, strengths/weaknesses vs your business.",
    fields: [
      { key: "your_business", label: "Your Business Name", default: "Detroit Web Agency" },
      { key: "competitor_url", label: "Competitor URL", default: "https://thrivedigital.com" },
    ],
  },
  {
    id: "review_my_reviews",
    name: "Review My Reviews",
    price: "$9.99",
    description: "Your Google rating, sentiment analysis, response templates for bad reviews.",
    fields: [
      { key: "business_name", label: "Business Name", default: "Detroit Web Agency" },
      { key: "city", label: "City", default: "Detroit" },
    ],
  },
  {
    id: "hire_ready",
    name: "Hire-Ready Report",
    price: "$29",
    description: "Single candidate background intel — breach history, license check, risk assessment.",
    fields: [
      { key: "candidate_name", label: "Candidate Name", default: "John Smith" },
      { key: "candidate_email", label: "Candidate Email", default: "test@example.com" },
      { key: "trade", label: "Trade", default: "HVAC" },
    ],
  },
  {
    id: "storm_leads",
    name: "Storm Damage Lead Pack",
    price: "$99",
    description: "10 targeted leads after severe weather events in your service area.",
    fields: [
      { key: "zip_code", label: "ZIP Code", default: "48236" },
      { key: "trade", label: "Trade (roofing, HVAC, etc.)", default: "roofing" },
    ],
  },
  {
    id: "weekly_checkup",
    name: "Weekly Website Checkup",
    price: "$9.99/mo",
    description: "Monthly speed report emailed automatically. Alerts when your site slows down.",
    fields: [
      { key: "url", label: "Website URL", default: "detroitwebagent.com" },
    ],
  },
  {
    id: "digital_footprint",
    name: "My Digital Footprint",
    price: "$19.99",
    description: "Every breach, paste dump, and data exposure tied to your email. Full action plan.",
    fields: [
      { key: "target_email", label: "Email to Scan", default: "matthewmichels4@gmail.com" },
      { key: "full_name", label: "Full Name", default: "Matthew Drew Michels" },
    ],
  },
];

type TestStatus = "idle" | "loading" | "success" | "error";

export default function AdminTestLab() {
  const [statuses, setStatuses] = useState<Record<string, TestStatus>>({});
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, string>>>({});
  const { toast } = useToast();

  const getFieldValue = (productId: string, fieldKey: string, defaultVal: string) => {
    return fieldValues[productId]?.[fieldKey] ?? defaultVal;
  };

  const setFieldValue = (productId: string, fieldKey: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [fieldKey]: value },
    }));
  };

  const runTest = async (product: TestProduct) => {
    setStatuses(s => ({ ...s, [product.id]: "loading" }));
    setResults(r => ({ ...r, [product.id]: null }));

    try {
      const body: Record<string, unknown> = {
        product: product.id,
        email: "matthewmichels4@gmail.com",
      };

      // Add field values
      for (const field of product.fields) {
        const val = getFieldValue(product.id, field.key, field.default);
        if (field.key === "emails_csv") {
          body.emails = val.split(",").map((e: string) => e.trim());
        } else {
          body[field.key] = val;
        }
      }

      const { data, error } = await supabase.functions.invoke("cold-sell-fulfill", { body });
      if (error) throw error;

      setStatuses(s => ({ ...s, [product.id]: "success" }));
      setResults(r => ({ ...r, [product.id]: data }));
      toast({ title: `✅ ${product.name}`, description: "Report sent to your email!" });
    } catch (e: unknown) {
      setStatuses(s => ({ ...s, [product.id]: "error" }));
      const msg = e instanceof Error ? e.message : String(e);
      setResults(r => ({ ...r, [product.id]: msg }));
      toast({ title: `❌ ${product.name} failed`, description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <FlaskConical className="h-6 w-6 text-cyan-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Test Lab — Cold-Sell Products</h2>
          <p className="text-slate-400 text-sm">Direct fulfillment testing. No Stripe. Reports sent to your Gmail.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRODUCTS.map(product => (
          <Card key={product.id} className="bg-slate-800/80 border-slate-700">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-white text-base">{product.name}</CardTitle>
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500 text-xs shrink-0 ml-2">
                  {product.price}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-slate-400 text-xs leading-relaxed">{product.description}</p>

              {product.fields.map(field => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-slate-300 text-xs">{field.label}</Label>
                  <Input
                    className="bg-slate-900 border-slate-600 text-white text-xs h-8"
                    value={getFieldValue(product.id, field.key, field.default)}
                    onChange={e => setFieldValue(product.id, field.key, e.target.value)}
                    placeholder={field.default}
                  />
                </div>
              ))}

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => runTest(product)}
                  disabled={statuses[product.id] === "loading"}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-8 flex-1"
                >
                  {statuses[product.id] === "loading" ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" />Running...</>
                  ) : (
                    <><Zap className="h-3 w-3 mr-1" />Test Now</>
                  )}
                </Button>
                {statuses[product.id] === "success" && <CheckCircle className="h-4 w-4 text-green-500" />}
                {statuses[product.id] === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
              </div>

              {results[product.id] && statuses[product.id] === "success" && (
                <div className="bg-slate-900 rounded p-2 text-xs text-green-400 font-mono">
                  {JSON.stringify(results[product.id], null, 2)}
                </div>
              )}
              {results[product.id] && statuses[product.id] === "error" && (
                <div className="bg-slate-900 rounded p-2 text-xs text-red-400 font-mono">
                  {String(results[product.id])}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
