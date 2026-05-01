import { Lock } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  monthlyPrice: number;
  lockedSince: string | Date;
  product?: string;
}

const LockedPriceBadge = ({ monthlyPrice, lockedSince, product = "Managed Website" }: Props) => {
  const since = typeof lockedSince === "string" ? new Date(lockedSince) : lockedSince;
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Locked at ${monthlyPrice.toFixed(0)}/mo · forever
          </p>
          <p className="text-xs text-muted-foreground">
            {product} · since {format(since, "MMM yyyy")} · every future upgrade is free
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default LockedPriceBadge;
