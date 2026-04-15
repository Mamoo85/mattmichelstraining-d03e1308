import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <pre className="text-white/70 text-xs whitespace-pre-wrap font-mono leading-relaxed">
            {content}
          </pre>
        </div>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:border-white/20 transition-colors"
        >
          Close
        </button>
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
        {loading ? (
          <span className="text-[#00d4ff]/70">Running...</span>
        ) : (
          label
        )}
      </span>
    </button>
  );
}

export default function DWACommandDeck() {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);

  const setLoading = (key: string, val: boolean) =>
    setLoadingMap((m) => ({ ...m, [key]: val }));

  const runCheckout = async (plan: "bundle" | "standalone") => {
    const key = `checkout-${plan}`;
    setLoading(key, true);
    try {
      const { data, error } = await supabase.functions.invoke("create-field-service-checkout", {
        body: {
          email: "matt@mattmichelstraining.com",
          name: "Matt Michels",
          company: "Test Company",
          plan,
          test: true,
        },
      });
      if (error) throw error;
      const url = data?.url ?? data?.checkoutUrl ?? data?.checkout_url;
      if (url) {
        window.open(url, "_blank");
        toast.success(`Test checkout opened (${plan})`);
      } else {
        toast.error("No URL returned from checkout function");
      }
    } catch (err: any) {
      toast.error("Checkout failed: " + (err?.message ?? "Unknown error"));
    } finally {
      setLoading(key, false);
    }
  };

  const runOracle = async () => {
    setLoading("oracle", true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-smith-report", {
        method: "POST",
        body: {},
      });
      if (error) throw error;
      const content =
        typeof data === "string"
          ? data
          : JSON.stringify(data, null, 2);
      setModal({ title: "Oracle Report", content });
    } catch (err: any) {
      toast.error("Oracle failed: " + (err?.message ?? "Unknown error"));
    } finally {
      setLoading("oracle", false);
    }
  };

  const runPulse = async () => {
    setLoading("pulse", true);
    try {
      const { data, error } = await supabase.functions.invoke("pulse-sms-monitor", {
        body: {},
      });
      if (error) throw error;
      const content =
        typeof data === "string"
          ? data
          : JSON.stringify(data, null, 2);
      setModal({ title: "Pulse Check", content });
    } catch (err: any) {
      toast.error("Pulse check failed: " + (err?.message ?? "Unknown error"));
    } finally {
      setLoading("pulse", false);
    }
  };

  const openDispatch = () => {
    window.open("/field-service/dispatch", "_blank");
  };

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
    } finally {
      setLoading("tease", false);
    }
  };

  return (
    <div>
      {modal && (
        <ResultModal
          title={modal.title}
          content={modal.content}
          onClose={() => setModal(null)}
        />
      )}

      <p className="text-white/40 text-sm mb-5">
        Trigger automations, run health checks, and open key tools from here.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <ActionButton
          label="Test Checkout (Bundle $0)"
          icon="💳"
          loading={loadingMap["checkout-bundle"] ?? false}
          onClick={() => runCheckout("bundle")}
        />
        <ActionButton
          label="Test Checkout (Standalone $0)"
          icon="🧾"
          loading={loadingMap["checkout-standalone"] ?? false}
          onClick={() => runCheckout("standalone")}
        />
        <ActionButton
          label="Run Oracle"
          icon="🔮"
          loading={loadingMap["oracle"] ?? false}
          onClick={runOracle}
        />
        <p className="col-span-full text-white/30 text-[10px] -mt-2 px-1">Oracle = business health dashboard: MRR, revenue, leads, alerts.</p>
        <ActionButton
          label="Pulse Check"
          icon="📡"
          loading={loadingMap["pulse"] ?? false}
          onClick={runPulse}
        />
        <ActionButton
          label="View Dispatch (Demo)"
          icon="🗺️"
          loading={false}
          onClick={openDispatch}
        />
        <ActionButton
          label="Send DJ Conley Tease"
          icon="🎯"
          loading={loadingMap["tease"] ?? false}
          onClick={runTease}
        />
      </div>

      <div className="mt-6 bg-[#0f1f35] border border-white/10 rounded-xl p-4">
        <p className="text-white/30 text-xs uppercase tracking-wide mb-3">Quick Links</p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/field-service"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs border border-white/10 hover:border-[#00d4ff]/40 hover:text-[#00d4ff]/80 transition-colors"
          >
            Field Service Landing →
          </a>
          <a
            href="/field-service/dispatch"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs border border-white/10 hover:border-[#00d4ff]/40 hover:text-[#00d4ff]/80 transition-colors"
          >
            Dispatcher Login →
          </a>
          <a
            href="/field-service/tech"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs border border-white/10 hover:border-[#00d4ff]/40 hover:text-[#00d4ff]/80 transition-colors"
          >
            Tech App →
          </a>
        </div>
      </div>
    </div>
  );
}
