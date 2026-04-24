import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { HelpCircle, ShieldCheck, Lock, Phone, RefreshCw } from "lucide-react";

interface Props {
  productLabel: string;
}

export function HowItWorksSheet({ productLabel }: Props) {
  const steps = [
    { icon: ShieldCheck, title: "Pick a HOT lead", body: "We score every signal 1–10 across cross-referenced sources. HOT = act today." },
    { icon: Lock, title: "Pay once · single buyer", body: `One ${productLabel.toLowerCase().replace(/s$/, "")} = one buyer. The moment you unlock it, it disappears from the marketplace.` },
    { icon: Phone, title: "Get the dossier in 60 seconds", body: "Verified phone, equity range, signal trail, suggested opener — emailed and downloadable." },
    { icon: RefreshCw, title: "Refund if uncontactable", body: "Bad number, dead address, or we got it wrong? Full refund — no questions, no hoops." },
  ];
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="fixed right-3 bottom-3 z-40 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-intel-teal text-background text-xs font-mono uppercase tracking-wider shadow-lg shadow-intel-teal/30 hover:bg-intel-teal/90 md:bottom-6 md:right-6"
          aria-label="How this works"
        >
          <HelpCircle className="w-3.5 h-3.5" /> How this works · 15s
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl">How {productLabel} work</SheetTitle>
          <SheetDescription>Read this once. We won't ask again.</SheetDescription>
        </SheetHeader>
        <ol className="mt-6 space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 p-3 rounded-lg border border-border/40 bg-card/50">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-intel-teal/15 border border-intel-teal/40 flex items-center justify-center">
                <s.icon className="w-4 h-4 text-intel-teal" />
              </div>
              <div>
                <p className="text-sm font-bold mb-0.5">{i + 1}. {s.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[11px] text-center text-muted-foreground font-mono uppercase tracking-wider">
          No subscriptions. No contracts. Just leads.
        </p>
      </SheetContent>
    </Sheet>
  );
}
