import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const DoNotPressButton = () => {
  const { user } = useAuth();
  const target = user ? "/matrix-merch" : "/matrix";

  return (
    <section className="w-full py-3 px-4 flex justify-center">
      <Link to={target} className="group relative inline-block text-center">
        <div className="absolute inset-0 rounded-sm bg-destructive/10 blur-md animate-pulse group-hover:bg-destructive/20 transition-all duration-500" />
        <div className="relative border border-destructive/60 bg-background px-4 py-2 rounded-sm shadow-[0_0_10px_hsl(0_70%_50%/0.15)] hover:shadow-[0_0_16px_hsl(0_70%_50%/0.3)] transition-all duration-300 group-hover:scale-[1.01]">
          <p className="text-destructive font-bold text-xs uppercase tracking-widest">
            ⚠️ DO NOT PRESS ⚠️
          </p>
        </div>
      </Link>
    </section>
  );
};

export default DoNotPressButton;
