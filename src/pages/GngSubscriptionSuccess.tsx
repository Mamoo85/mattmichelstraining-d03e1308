import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function GngSubscriptionSuccess() {
  const [sp] = useSearchParams();
  useEffect(() => { document.title = "You're subscribed · Guilds & Grains"; }, []);
  return (
    <main className="min-h-screen bg-[#fdf6ec] text-[#3d2a1a] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <CheckCircle2 className="w-16 h-16 text-[#7a3e1d] mx-auto mb-6" />
        <h1 className="font-serif text-4xl font-bold mb-3">You're in!</h1>
        <p className="text-[#5b4636] mb-8">
          Welcome to the Guilds &amp; Grains family. Your first box ships within 3 business days. Check your email for confirmation.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/gng"><Button className="bg-[#7a3e1d] hover:bg-[#5b2e15] text-white">Back to shop</Button></Link>
        </div>
        {sp.get("session_id") && (
          <p className="text-xs text-[#9c8369] mt-6">Ref: {sp.get("session_id")?.slice(-12)}</p>
        )}
      </div>
    </main>
  );
}
