import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAgencyRole } from "@/hooks/useAgencyRole";
import { Loader2 } from "lucide-react";

/**
 * Place at a catch-all or login-success route.
 * Redirects agency_admin → /admin, client → /client-portal.
 * Falls through to children if no agency role is found (regular M2 user).
 */
const AgencyRoleRedirect = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { agencyRole, isLoading } = useAgencyRole();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <>{children}</>;

  if (agencyRole === "agency_admin") return <Navigate to="/admin" replace />;
  if (agencyRole === "client") return <Navigate to="/client-portal" replace />;

  return <>{children}</>;
};

export default AgencyRoleRedirect;
