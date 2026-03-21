import { Link } from "react-router-dom";

const DoNotPressButton = () => (
  <section className="w-full py-8 px-4 flex justify-center">
    <Link
      to="/matrix"
      className="group relative block w-full max-w-md text-center"
    >
      {/* Pulsing glow behind */}
      <div className="absolute inset-0 rounded-sm bg-destructive/20 blur-xl animate-pulse group-hover:bg-destructive/30 transition-all duration-500" />

      <div
        className="relative border-2 border-destructive bg-background px-6 py-4 rounded-sm
          shadow-[0_0_20px_hsl(0_70%_50%/0.3)] hover:shadow-[0_0_30px_hsl(0_70%_50%/0.5)]
          transition-all duration-300 group-hover:scale-[1.02] group-hover:animate-[shake_0.4s_ease-in-out]"
      >
        <p className="text-destructive font-black text-lg md:text-xl uppercase tracking-widest">
          ⚠️ DO NOT PRESS THIS BUTTON ⚠️
        </p>
        <p className="text-muted-foreground text-[10px] uppercase tracking-widest mt-1">
          Seriously. Don't.
        </p>
      </div>
    </Link>
  </section>
);

export default DoNotPressButton;
