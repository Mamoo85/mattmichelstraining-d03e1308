import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Entry {
  id: string;
  ship_date: string;
  title: string;
  product: string;
}

const WhatsNewBanner = () => {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("product_changelog")
        .select("id, ship_date, title, product")
        .eq("is_public", true)
        .order("ship_date", { ascending: false })
        .limit(3);
      if (data) setEntries(data as Entry[]);
    })();
  }, []);

  if (entries.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">What's new — yours, free, forever</h3>
          </div>
          <Link
            to="/changelog"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Full changelog <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="text-sm flex items-start gap-2">
              <span className="text-muted-foreground text-xs mt-0.5 shrink-0 w-20">
                {format(new Date(e.ship_date), "MMM d")}
              </span>
              <div>
                <span className="font-medium">{e.title}</span>
                <span className="text-muted-foreground text-xs ml-2">{e.product}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default WhatsNewBanner;
