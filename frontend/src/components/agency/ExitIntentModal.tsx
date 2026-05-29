import { useState, useEffect } from "react";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ExitIntentModal = () => {
  const [show, setShow] = useState(false);
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (sessionStorage.getItem("exit_intent_shown")) return;

    const handler = (e: MouseEvent) => {
      if (e.clientY <= 5) {
        setShow(true);
        sessionStorage.setItem("exit_intent_shown", "1");
        document.removeEventListener("mouseout", handler);
      }
    };

    const timer = setTimeout(() => document.addEventListener("mouseout", handler), 5000);
    return () => { clearTimeout(timer); document.removeEventListener("mouseout", handler); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !url) return;
    setLoading(true);
    try {
      await supabase.from("exit_intent_leads" as any).insert({ email, url });
      setSubmitted(true);
      toast({ title: "Got it!", description: "We'll build your custom demo within 24 hours." });
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
    setLoading(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
      <div className="relative w-full max-w-md rounded-2xl p-8" style={{ background: "#0d1117", border: "1px solid rgba(34,211,238,0.2)", boxShadow: "0 0 60px rgba(34,211,238,0.1)" }}>
        <button onClick={() => setShow(false)} className="absolute top-4 right-4 p-1" style={{ color: "#64748b" }}>
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-bold mb-2" style={{ color: "#e2e8f0" }}>We're On It</h3>
            <p className="text-sm" style={{ color: "#64748b" }}>Check your inbox within 24 hours for your custom demo link.</p>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold mb-2" style={{ color: "#e2e8f0" }}>Leaving So Soon?</h3>
            <p className="text-sm mb-6" style={{ color: "#94a3b8" }}>
              Enter your URL and our Lead Agent will build a custom, functional demo of your new system in 24 hours. <strong style={{ color: "#22d3ee" }}>No cost.</strong>
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Input placeholder="Your website URL" value={url} onChange={(e) => setUrl(e.target.value)} className="bg-[#0a0a0f] border-[rgba(148,163,184,0.15)] text-white placeholder:text-[#475569]" />
              <Input type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-[#0a0a0f] border-[rgba(148,163,184,0.15)] text-white placeholder:text-[#475569]" />
              <Button type="submit" disabled={loading} className="w-full py-5 font-bold" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617" }}>
                {loading ? "Sending..." : <>Build My Free Demo <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ExitIntentModal;
