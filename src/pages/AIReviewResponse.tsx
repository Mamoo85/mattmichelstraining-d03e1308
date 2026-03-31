import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Star, ThumbsUp, Zap, CheckCircle } from "lucide-react";

export default function AIReviewResponse() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ businessName: "", email: "", phone: "", industry: "", googlePlaceId: "", brandVoice: "" });

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-review-response-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: MessageSquare, title: "Daily Response Drafts", desc: "AI-written responses for every new review — positive and negative" },
    { icon: Star, title: "Boost Rankings", desc: "Google rewards businesses that respond to reviews consistently" },
    { icon: ThumbsUp, title: "Your Brand Voice", desc: "Responses match your tone — professional, casual, or warm" },
    { icon: Zap, title: "Copy & Paste Ready", desc: "Just approve and post — takes 30 seconds per review" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Star size={16} /> Review Management
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4">AI Review Response Service</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Never ignore a review again. Our AI drafts personalized responses to every Google and Yelp review in your brand voice — delivered daily.
          </p>
          <div className="mt-4 text-3xl font-black text-primary">$49/mo</div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {features.map((f) => (
            <Card key={f.title} className="border-border/40 bg-card/60">
              <CardContent className="p-5 flex gap-4">
                <f.icon className="text-primary shrink-0 mt-1" size={22} />
                <div>
                  <h3 className="font-bold text-sm">{f.title}</h3>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-primary/30 max-w-lg mx-auto">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-center">Start Getting Review Responses</h2>
            <Input placeholder="Business Name *" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
            <Input placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            <Input placeholder="Google Place ID (optional)" value={form.googlePlaceId} onChange={(e) => setForm({ ...form, googlePlaceId: e.target.value })} />
            <Textarea placeholder="Describe your brand voice (e.g. 'Friendly, professional, always thank the customer')" value={form.brandVoice} onChange={(e) => setForm({ ...form, brandVoice: e.target.value })} rows={3} />
            <Button className="w-full font-bold" size="lg" onClick={handleCheckout} disabled={loading || !form.businessName || !form.email}>
              {loading ? "Processing..." : "Subscribe — $49/mo"}
            </Button>
            <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
              <CheckCircle size={12} className="text-green-400" /> First responses within 24 hours • Cancel anytime
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
