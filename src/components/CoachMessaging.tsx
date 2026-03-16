import { useState } from "react";
import { Send } from "lucide-react";
import SectionHeader from "./SectionHeader";

const mockMessages = [
  { from: "coach", text: "Your son looked great yesterday. His CNS is adapting — the speed on that last set was real. We bump the load next week.", time: "14:32" },
  { from: "athlete", text: "He said his legs felt heavy during basketball practice. Should we back off?", time: "14:45" },
  { from: "coach", text: "That's normal adaptation, not fatigue. Trust the process. His body is building the foundation that'll carry him through college. Send me a video of his next squat set.", time: "15:02" },
];

const CoachMessaging = () => {
  const [message, setMessage] = useState("");

  return (
    <div>
      <SectionHeader title="Message Matt" timestamp="Last active: Today 15:02" />

      <div className="bg-card shadow-m2 flex flex-col h-[400px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mockMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === "athlete" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] p-3 ${
                msg.from === "athlete"
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-muted"
              }`}>
                <p className="text-sm text-foreground">{msg.text}</p>
                <span className="text-[10px] font-mono text-muted-foreground mt-1 block">
                  {msg.from === "coach" ? "MATT" : "YOU"} · {msg.time}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <input
            type="text"
            placeholder="Message Matt..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
          />
          <button className="bg-primary text-primary-foreground px-3 py-2 hover:opacity-90 transition-m2">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoachMessaging;
