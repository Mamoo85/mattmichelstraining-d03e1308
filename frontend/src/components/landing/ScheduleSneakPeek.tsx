import { Link } from "react-router-dom";
import { Lock, CalendarClock, Clock, MapPin, Video, Zap } from "lucide-react";
import vidSquat from "@/assets/vid-squat.mp4.asset.json";
import vidTraining from "@/assets/vid-training.mp4.asset.json";

const fakeSlots = [
  { time: "7:00 AM", taken: true },
  { time: "8:00 AM", taken: false },
  { time: "9:30 AM", taken: false },
  { time: "10:30 AM", taken: true },
  { time: "12:00 PM", taken: false },
  { time: "3:00 PM", taken: true },
  { time: "4:30 PM", taken: false },
  { time: "6:00 PM", taken: true },
];

const ScheduleSneakPeek = () => (
  <div className="relative overflow-hidden">
    {/* Video hero */}
    <div className="relative h-48 sm:h-56 overflow-hidden mb-6">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        src={vidSquat.url}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarClock size={16} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Book a Session</span>
        </div>
        <h3 className="text-lg font-bold text-foreground leading-tight">
          Train 1-on-1 with Coach Matt
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          In-person or video · 30 & 60-minute sessions
        </p>
      </div>
    </div>

    {/* Blurred schedule preview */}
    <div className="relative">
      <div className="blur-[2px] select-none pointer-events-none">
        <div className="flex gap-1.5 overflow-hidden mb-3">
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
            <div
              key={d}
              className={`flex-1 text-center py-2 text-[10px] font-bold uppercase tracking-widest ${
                i === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {fakeSlots.map((slot) => (
            <div
              key={slot.time}
              className={`p-2.5 text-center border ${
                slot.taken
                  ? "bg-muted/50 border-border text-muted-foreground/40 line-through"
                  : "bg-card border-border"
              }`}
            >
              <Clock size={10} className="mx-auto mb-0.5 text-primary/60" />
              <span className="text-[11px] font-mono font-bold">{slot.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-[1px]">
        <div className="bg-card/95 backdrop-blur-md border border-primary/20 p-6 text-center max-w-xs shadow-lg">
          <Lock size={20} className="text-primary mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground mb-1">Members Book First</p>
          <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
            Subscribers get priority scheduling and session credits. Start your free trial to access real-time availability.
          </p>
          <Link
            to="/auth?trial=true"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Zap size={12} />
            Start Free Trial
          </Link>
        </div>
      </div>
    </div>

    {/* Info strip */}
    <div className="grid grid-cols-3 gap-2 mt-5">
      {[
        { icon: MapPin, label: "Grosse Pointe", sub: "In-Person" },
        { icon: Video, label: "Anywhere", sub: "Video Call" },
        { icon: Clock, label: "30 & 60 min", sub: "Sessions" },
      ].map(({ icon: Icon, label, sub }) => (
        <div key={label} className="bg-card border border-border p-3 text-center">
          <Icon size={14} className="mx-auto text-primary mb-1" />
          <span className="text-[11px] font-bold text-foreground block">{label}</span>
          <span className="text-[9px] text-muted-foreground">{sub}</span>
        </div>
      ))}
    </div>

    {/* Second video strip */}
    <div className="relative h-24 overflow-hidden mt-5">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        src={vidTraining.url}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-background/80 backdrop-blur-sm px-4 py-2 border border-primary/20">
          Real coaching · Real results · Zero gimmicks
        </span>
      </div>
    </div>
  </div>
);

export default ScheduleSneakPeek;
