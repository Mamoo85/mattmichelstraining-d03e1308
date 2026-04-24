import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface ProvenanceTooltipProps {
  source: string;
  url?: string | null;
  fetchedAt?: string | null;
}

/** Hover any data point → shows source + scanner timestamp. Builds buyer trust. */
export function ProvenanceTooltip({ source, url, fetchedAt }: ProvenanceTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center text-muted-foreground hover:text-intel-teal transition-colors">
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs bg-popover border-border">
          <div className="text-xs space-y-1">
            <div className="font-mono text-intel-teal">SOURCE: {source}</div>
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="block underline text-foreground/70 truncate">
                {url}
              </a>
            )}
            {fetchedAt && (
              <div className="text-muted-foreground">Verified {new Date(fetchedAt).toLocaleDateString()}</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
