import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ADD_ONS, type AddOn } from "@/lib/addons";
import { toast } from "sonner";
import { Loader2, CheckCircle, Clock, Wrench, Eye, Rocket, ExternalLink, Phone } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const PHONE = "(313) 806-4952";

const STATUS_STEPS = [
  { key: "prospect", label: "Received", icon: Clock },
  { key: "intake", label: "Intake", icon: CheckCircle },
  { key: "building", label: "Building", icon: Wrench },
  { key: "preview", label: "Preview", icon: Eye },
  { key: "live", label: "Live", icon: Rocket },
];

interface WebDesignLead {
  id: string;
  name: string | null;
  business: string | null;
  status: string;
  site_url: string | null;
  email: string | null;
}

interface ClientAddon {
  id: string;
  service_key: string;
  service_name: string;
  price_cents: number;
  status: string;
  activated_at: string;
}

const ClientPortal = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [lead, setLead] = useState<WebDesignLead | null>(null);
  const [addons, setAddons] = useState<ClientAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Add-on activated! It may take a moment to appear.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user?.email) return;
    const fetchData = async () => {
      try {
        // Fetch lead by email
        const { data: leadData } = await supabase
          .from("web_design_leads" as any)
          .select("*")
          .eq("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (leadData) setLead(leadData as any);

        // Fetch active addons
        const { data: addonData } = await supabase
          .from("client_addons" as any)
          .select("*")
          .eq("user_id", user.id)
          .order("activated_at", { ascending: false });
        if (addonData) setAddons(addonData as any);
      } catch (e) {
        console.warn("[ClientPortal] fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleCheckout = async (addon: AddOn) => {
    setCheckoutLoading(addon.key);
    try {
      const { data, error } = await supabase.functions.invoke("create-addon-checkout", {
        body: {
          service_key: addon.key,
          service_name: addon.name,
          price_cents: addon.priceCents,
          recurring: addon.recurring,
          lead_id: lead?.id || null,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setBillingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast.error(e.message || "Could not open billing portal");
    } finally {
      setBillingLoading(false);
    }
  };

  const activeAddonKeys = new Set(addons.filter((a) => a.status === "active").map((a) => a.service_key));
  const currentStepIndex = lead ? STATUS_STEPS.findIndex((s) => s.key === lead.status) : -1;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SEOHead title="Client Portal | M² Development" description="Manage your web design project and add-on services." />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-[#1e293b] text-white py-8 px-4">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold">Client Portal</h1>
            <p className="text-white/70 mt-1">
              Welcome back{lead?.name ? `, ${lead.name}` : ""}. Manage your site and services below.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
          {/* Site Status */}
          {lead ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Site Status — {lead.business || "Your Website"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 md:gap-3 overflow-x-auto pb-2">
                  {STATUS_STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isComplete = i <= currentStepIndex;
                    const isCurrent = i === currentStepIndex;
                    return (
                      <div key={step.key} className="flex items-center gap-1 md:gap-2">
                        <div className={`flex flex-col items-center min-w-[60px] ${isCurrent ? "scale-110" : ""}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isComplete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`text-[10px] mt-1 text-center ${isCurrent ? "font-bold text-primary" : "text-muted-foreground"}`}>
                            {step.label}
                          </span>
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                          <div className={`h-0.5 w-4 md:w-8 ${i < currentStepIndex ? "bg-primary" : "bg-muted"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {lead.site_url && (
                  <a href={lead.site_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary mt-4 hover:underline">
                    View Your Site <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No active web design project found for your account.</p>
                <p className="text-sm mt-2">If you've signed up recently, it may take a moment to sync. Questions? Call <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="text-primary font-semibold">{PHONE}</a></p>
              </CardContent>
            </Card>
          )}

          {/* Active Add-Ons */}
          {addons.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Active Services
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={billingLoading}>
                    {billingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage Billing"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {addons.filter((a) => a.status === "active").map((addon) => (
                    <div key={addon.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{addon.service_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Active since {new Date(addon.activated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded font-medium">Active</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add-On Marketplace */}
          <div>
            <h2 className="text-xl font-bold mb-4">Add-On Services</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Boost your website with powerful add-ons. Each service is managed by Matt personally.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ADD_ONS.map((addon) => {
                const Icon = addon.icon;
                const isActive = activeAddonKeys.has(addon.key);
                return (
                  <Card key={addon.key} className={`relative overflow-hidden ${isActive ? "ring-2 ring-green-500/50" : ""}`}>
                    {isActive && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded font-bold">
                        ACTIVE
                      </div>
                    )}
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${addon.color}15` }}>
                          <Icon className="h-5 w-5" style={{ color: addon.color }} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{addon.name}</h3>
                          <p className="text-primary font-bold text-sm">{addon.price}</p>
                          <p className="text-[10px] text-muted-foreground">{addon.priceSub}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-3">{addon.desc}</p>
                      <ul className="space-y-1 mb-4">
                        {addon.includes.slice(0, 3).map((item, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                        {addon.includes.length > 3 && (
                          <li className="text-[11px] text-muted-foreground">+{addon.includes.length - 3} more</li>
                        )}
                      </ul>
                      {isActive ? (
                        <Button variant="outline" size="sm" className="w-full" disabled>
                          Already Active
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleCheckout(addon)}
                          disabled={checkoutLoading === addon.key}
                        >
                          {checkoutLoading === addon.key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            `Add ${addon.recurring ? "for " + addon.price : "— " + addon.price}`
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Contact */}
          <Card>
            <CardContent className="p-6 text-center">
              <Phone className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="font-semibold">Need help or have questions?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Call or text Matt directly at{" "}
                <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="text-primary font-semibold">{PHONE}</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default ClientPortal;
