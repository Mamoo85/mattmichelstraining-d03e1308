import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Home, ArrowRight } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const destination = user ? "/dashboard" : "/";
  const destinationLabel = user ? "Back to Dashboard" : "Back to Home";

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Home size={28} className="text-primary" />
        </div>
        <h1 className="text-4xl font-black uppercase tracking-tight text-foreground mb-2">404</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This page doesn't exist. Let's get you back on track.
        </p>
        <Link
          to={destination}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
        >
          {destinationLabel}
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
