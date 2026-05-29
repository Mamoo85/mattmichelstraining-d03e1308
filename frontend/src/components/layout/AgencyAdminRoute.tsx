import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAgencyRole } from "@/hooks/useAgencyRole";
import { Loader2 } from "lucide-react";

const AgencyAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isAgencyAdmin, isLoading } = useAgencyRole();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAgencyAdmin) return <Navigate to="/client-portal" replace />;

  return <>{children}</>;
};

export default AgencyAdminRoute;
