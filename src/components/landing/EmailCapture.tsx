import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, MapPin } from "lucide-react";

const EmailCapture = () => {
  return (
    <div className="mb-10 bg-card shadow-m2 p-5 md:p-8 border-t-4 border-primary">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock size={16} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
          Book a Session
        </span>
      </div>
      <h3 className="text-base md:text-lg font-bold text-foreground mb-1">
        Train with Matt — In Person or Online
      </h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-lg leading-relaxed">
        One-on-one sessions, small group training, and youth athlete development
        in Grosse Pointe Park, MI. Online coaching available anywhere.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/schedule"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
        >
          View Schedule & Book
          <ArrowRight size={14} />
        </Link>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
        <MapPin size={10} /> Grosse Pointe Park, MI · No commitment required
      </p>
    </div>
  );
};

export default EmailCapture;
