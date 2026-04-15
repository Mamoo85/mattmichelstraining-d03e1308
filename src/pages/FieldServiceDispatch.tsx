import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DispatchBoard from "@/components/field-service/DispatchBoard";
import TechMap from "@/components/field-service/TechMap";
import DemoModeBadge, { DEMO_MASTER_TOKEN } from "@/components/DemoModeBadge";

type Tab = "board" | "map";

export default function FieldServiceDispatch() {
  const [activeTab, setActiveTab] = useState<Tab>("board");
  const [now, setNow] = useState(new Date());
  const [authState, setAuthState] = useState<"loading" | "authorized" | "denied">("loading");
  const [resolvedClientId, setResolvedClientId] = useState<string>("");

  const params = new URLSearchParams(window.location.search);
  const rawClient = params.get("client") || "";
  const rawToken = params.get("token") || "";
  const isDemo = rawToken === DEMO_MASTER_TOKEN || rawClient === "demo" || params.get("demo") === "1";

  // Verify dispatch token against DB
  useEffect(() => {
    if (isDemo) {
      setResolvedClientId("demo");
      setAuthState("authorized");
      return;
    }

    if (!rawToken) {
      // No token and not demo — check if rawClient is a UUID (legacy access)
      if (rawClient && rawClient.length === 36) {
        setResolvedClientId(rawClient);
        setAuthState("authorized");
      } else {
        setAuthState("denied");
      }
      return;
    }

    // Verify token
    (async () => {
      const { data } = await (supabase as any)
        .from("field_crm_clients")
        .select("id")
        .eq("dispatch_token", rawToken)
        .eq("active", true)
        .maybeSingle();

      if (data?.id) {
        setResolvedClientId(data.id as string);
        setAuthState("authorized");
      } else {
        setAuthState("denied");
      }
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-[#00d4ff] text-lg animate-pulse">Verifying access...</div>
      </div>
    );
  }

  if (authState === "denied") {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center flex-col gap-4">
        <div className="text-red-400 text-xl font-bold">Access Denied</div>
        <p className="text-gray-400 text-sm max-w-md text-center">
          Invalid or expired dispatch token. Contact your account manager for access.
        </p>
      </div>
    );
  }

  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[#0a1628] text-white flex flex-col">
      {isDemo && <DemoModeBadge />}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#1e3a5f] shrink-0">
        <div>
          <span className="font-black text-sm tracking-tight text-white">DETROIT</span>
          <span className="text-[#00d4ff] font-black text-sm tracking-tight"> WEB AGENCY</span>
          <span className="text-gray-500 text-sm ml-2">| Field Service</span>
        </div>
        <div className="text-right">
          <p className="text-gray-300 text-xs">{formattedDate}</p>
          <p className="text-[#00d4ff] text-xs font-mono">{formattedTime}</p>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="flex border-b border-[#1e3a5f] shrink-0">
        <button
          onClick={() => setActiveTab("board")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            activeTab === "board"
              ? "text-[#00d4ff] border-b-2 border-[#00d4ff]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Dispatch Board
        </button>
        <button
          onClick={() => setActiveTab("map")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            activeTab === "map"
              ? "text-[#00d4ff] border-b-2 border-[#00d4ff]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Live Map
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "board" ? (
          <DispatchBoard clientId={resolvedClientId} />
        ) : (
          <TechMap clientId={resolvedClientId} />
        )}
      </div>
    </div>
  );
}