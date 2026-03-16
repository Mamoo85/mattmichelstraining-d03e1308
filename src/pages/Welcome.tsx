import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import m2Logo from "@/assets/m2-logo.jpg";

const Welcome = () => (
  <div className="min-h-screen bg-background flex items-center justify-center px-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
      className="max-w-lg w-full text-center"
    >
      <img src={m2Logo} alt="M² Training" className="w-20 h-20 object-cover shadow-m2 mx-auto mb-8" />

      <h1 className="text-2xl md:text-3xl font-bold tracking-display text-foreground mb-6 leading-tight">
        TO ALL THE PARENTS<br />OF <span className="text-primary">YOUNG ATHLETES</span>
      </h1>

      <p className="text-sm text-muted-foreground mb-2 text-balance">
        Welcome to M² Training. You just made the best decision for your athlete's future.
      </p>
      <p className="text-sm text-muted-foreground mb-8 text-balance">
        Real training. Real results. Every single time.
      </p>

      <div className="bg-card shadow-m2 p-5 mb-8 text-left">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">What happens next</p>
        <ul className="space-y-2 text-sm text-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary font-mono font-bold">01</span>
            Matt reviews your intake personally
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-mono font-bold">02</span>
            Your custom program is built from scratch
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-mono font-bold">03</span>
            Access your portal to track everything
          </li>
        </ul>
      </div>

      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Enter the Training Portal
        <ArrowRight size={14} />
      </Link>

      <p className="text-[10px] text-muted-foreground mt-6">
        © {new Date().getFullYear()} M² Training · Grosse Pointe Park, MI
      </p>
    </motion.div>
  </div>
);

export default Welcome;
