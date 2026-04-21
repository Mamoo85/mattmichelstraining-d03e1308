import { useEffect } from "react";
import { useParams } from "react-router-dom";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "eauvubfpanpeuxsrqesu";

export default function ProspectRedirect() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    const safe = token ? encodeURIComponent(token) : "";
    window.location.replace(
      `https://${PROJECT_ID}.supabase.co/functions/v1/track-prospect-link?token=${safe}`
    );
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a1628", color: "#00d4ff", fontFamily: "system-ui" }}>
      <div>Loading…</div>
    </div>
  );
}
