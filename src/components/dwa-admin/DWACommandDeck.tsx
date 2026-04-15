import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ResultModalProps {
  title: string;
  content: string;
  onClose: () => void;
}

function ResultModal({ title, content, onClose }: ResultModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#0f1f35] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-auto">
          <pre className="text-white/70 text-xs whitespace-pre-wrap font-mono leading-relaxed">{content}</pre>
        </div>
        <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:border-white/20 transition-colors">Close</button>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  icon: string;
  loading: boolean;
  onClick: () => void;
}

function ActionButton({ label, icon, loading, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="bg-[#0f1f35] border border-white/10 rounded-xl p-5 flex flex-col items-center gap-3 hover:border-[#00d4ff]/50 transition-colors disabled:opacity-50 group"
    >
      <span className="text-2xl group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-white text-sm font-medium text-center leading-snug">
        {loading ? <span className="text-[#00d4ff]/70">Running...</span> : label}
      </span>
    </button>
  );
}

export default function DWACommandDeck() {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoCompany, setDemoCompany] = useState("");
  const [demoContact, setDemoContact] = useState("");

  const setLoading = (key: string, val: boolean) =>
    setLoadingMap((m) => ({ ...m, [key]: val }));

  const seedDemoData = async () => {
    setLoading("seed", true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-demo-environment", {
        body: { action: "seed" },
      });
      if (error) throw error;
      toast.success(`Demo data seeded! ${data?.counts?.candidates} candidates, ${data?.counts?.leads} leads`);
    } catch (err: any) {
      toast.error("Seed failed: " + (err?.message ?? "Unknown error"));
    } finally { setLoading("seed", false); }
  };

  const clearDemoData = async () => {
    setLoading("clear", true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-demo-environment", {
        body: { action: "clear" },
      });
      if (error) throw error;
      toast.success("Demo data cleared!");
    } catch (err: any) {
      toast.error("Clear failed: " + (err?.message ?? "Unknown error"));
    } finally { setLoading("clear", false); }
  };



  const runCheckout = async (plan: "bundle" | "standalone") => {
    const key = `checkout-${plan}`;
    setLoading(key, true);
    try {
      const { data, error } = await supabase.functions.invoke("create-field-service-checkout", {
        body: { email: "matt@mattmichelstraining.com", name: "Matt Michels", company: "Test Company", plan, test: true },
      });
      if (error) throw error;
      const url = data?.url ?? data?.checkoutUrl ?? data?.checkout_url;
      if (url) { window.open(url, "_blank"); toast.success(`Test checkout opened (${plan})`); }
      else toast.error("No URL returned from checkout function");
    } catch (err: any) {
      toast.error("Checkout failed: " + (err?.message ?? "Unknown error"));
    } finally { setLoading(key, false); }
  };

  const runOracle = async () => {
    setLoading("oracle", true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-smith-report", { method: "POST", body: {} });
      if (error) throw error;
      setModal({ title: "Oracle Report", content: typeof data === "string" ? data : JSON.stringify(data, null, 2) });
    } catch (err: any) {
      toast.error("Oracle failed: " + (err?.message ?? "Unknown error"));
    } finally { setLoading("oracle", false); }
  };

  const runPulse = async () => {
    setLoading("pulse", true);
    try {
      const { data, error } = await supabase.functions.invoke("pulse-sms-monitor", { body: {} });
      if (error) throw error;
      setModal({ title: "Pulse Check", content: typeof data === "string" ? data : JSON.stringify(data, null, 2) });
    } catch (err: any) {
      toast.error("Pulse check failed: " + (err?.message ?? "Unknown error"));
    } finally { setLoading("pulse", false); }
  };

  const openDispatch = () => window.open("/field-service/dispatch", "_blank");

  const runTease = async () => {
    setLoading("tease", true);
    try {
      const { data, error } = await supabase.functions.invoke("techalert-tease-conley", {
        body: { to_email: "matt@mattmichelstraining.com" },
      });
      if (error) throw error;
      toast.success(`Tease email sent! ${data?.total} candidates (${data?.blurred} blurred)`);
    } catch (err: any) {
      toast.error("Tease failed: " + (err?.message ?? "Unknown error"));
    } finally { setLoading("tease", false); }
  };

  const sendDemoEmail = async () => {
    if (!demoEmail) { toast.error("Email is required"); return; }
    setLoading("demo", true);
    try {
      const { data, error } = await supabase.functions.invoke("product-demo-email", {
        body: {
          to_email: demoEmail,
          company_name: demoCompany || undefined,
          contact_name: demoContact || undefined,
        },
      });
      if (error) throw error;
      toast.success(`Demo email sent to ${demoEmail}! ${data?.total} candidates shown.`);
      setDemoOpen(false);
      setDemoEmail("");
      setDemoCompany("");
      setDemoContact("");
    } catch (err: any) {
      toast.error("Demo email failed: " + (err?.message ?? "Unknown error"));
    } finally { setLoading("demo", false); }
  };

  return (
    <div>
      {modal && <ResultModal title={modal.title} content={modal.content} onClose={() => setModal(null)} />}

      <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent className="bg-[#0f1f35] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Send Product Demo Email</DialogTitle>
            <DialogDescription className="text-white/40">Full tour: FieldDesk + SiteRadar + TechAlert with real candidate data</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-white/50 text-xs block mb-1">Recipient Email *</label>
              <input
                type="email"
                value={demoEmail}
                onChange={(e) => setDemoEmail(e.target.value)}
                placeholder="pat@djconley.com"
                className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#00d4ff]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">Company Name</label>
              <input
                type="text"
                value={demoCompany}
                onChange={(e) => setDemoCompany(e.target.value)}
                placeholder="DJ Conley Associates"
                className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#00d4ff]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1">Contact Name</label>
              <input
                type="text"
                value={demoContact}
                onChange={(e) => setDemoContact(e.target.value)}
                placeholder="Pat"
                className="w-full bg-[#0a1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#00d4ff]/50 focus:outline-none"
              />
            </div>
            <button
              onClick={sendDemoEmail}
              disabled={loadingMap["demo"]}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#0066ff] text-white font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {loadingMap["demo"] ? "Sending..." : "🚀 Send Demo Email"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-white/40 text-sm mb-5">
        Trigger automations, run health checks, and open key tools from here.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <ActionButton label="Test Checkout (Bundle $0)" icon="💳" loading={loadingMap["checkout-bundle"] ?? false} onClick={() => runCheckout("bundle")} />
        <ActionButton label="Test Checkout (Standalone $0)" icon="🧾" loading={loadingMap["checkout-standalone"] ?? false} onClick={() => runCheckout("standalone")} />
        <ActionButton label="Run Oracle" icon="🔮" loading={loadingMap["oracle"] ?? false} onClick={runOracle} />
        <p className="col-span-full text-white/30 text-[10px] -mt-2 px-1">Oracle = business health dashboard: MRR, revenue, leads, alerts.</p>
        <ActionButton label="Pulse Check" icon="📡" loading={loadingMap["pulse"] ?? false} onClick={runPulse} />
        <ActionButton label="View Dispatch (Demo)" icon="🗺️" loading={false} onClick={openDispatch} />
        <ActionButton label="Send DJ Conley Tease" icon="🎯" loading={loadingMap["tease"] ?? false} onClick={runTease} />
        <ActionButton
          label="Send Product Demo Email"
          icon="🚀"
          loading={loadingMap["demo"] ?? false}
          onClick={() => setDemoOpen(true)}
        />
      </div>

      <div className="mt-6 bg-[#0f1f35] border border-white/10 rounded-xl p-4">
        <p className="text-white/30 text-xs uppercase tracking-wide mb-3">Quick Links</p>
        <div className="flex flex-wrap gap-3">
          <a href="/field-service" target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs border border-white/10 hover:border-[#00d4ff]/40 hover:text-[#00d4ff]/80 transition-colors">Field Service Landing →</a>
          <a href="/field-service/dispatch" target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs border border-white/10 hover:border-[#00d4ff]/40 hover:text-[#00d4ff]/80 transition-colors">Dispatcher Login →</a>
          <a href="/field-service/tech" target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs border border-white/10 hover:border-[#00d4ff]/40 hover:text-[#00d4ff]/80 transition-colors">Tech App →</a>
        </div>
      </div>
    </div>
  );
}
