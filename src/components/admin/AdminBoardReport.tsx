import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, RefreshCw, Brain, TrendingUp, Wrench, Eye } from "lucide-react";

const DEPARTMENTS = [
  {
    key: "csuite",
    label: "C-Suite (Strategy & Finance)",
    icon: Brain,
    color: "text-purple-400",
    agents: ["cashier", "red", "rev", "invest", "trim"],
    actionTypes: ["cashier", "red", "rev", "invest", "trim", "revenue", "security", "pricing", "risk"],
  },
  {
    key: "growth",
    label: "Growth & Acquisition",
    icon: TrendingUp,
    color: "text-green-400",
    agents: ["scarlett", "tom", "selma", "solo", "hype"],
    actionTypes: ["scarlett", "tom", "selma", "solo", "hype", "lead", "copy", "marketing", "ad_", "campaign"],
  },
  {
    key: "ops",
    label: "Tech & Operations",
    icon: Wrench,
    color: "text-blue-400",
    agents: ["oz", "ops", "guard", "comply", "drill"],
    actionTypes: ["oz", "ops", "guard", "comply", "drill", "deploy", "build", "onboard", "fulfillment"],
  },
  {
    key: "intel",
    label: "Market Intelligence",
    icon: Eye,
    color: "text-amber-400",
    agents: ["scout", "shield", "vera", "pulse", "zero"],
    actionTypes: ["scout", "shield", "vera", "pulse", "zero", "competitor", "churn", "seo", "monitor"],
  },
];

function matchesDept(actionType: string, patterns: string[]): boolean {
  const lower = actionType.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

export default function AdminBoardReport() {
  const [openDepts, setOpenDepts] = useState<string[]>(["csuite"]);

  const { data: actions, isLoading, refetch } = useQuery({
    queryKey: ["board-report-actions"],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from("ai_action_queue")
        .select("id, action_type, status, ai_result, created_at, context")
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const toggle = (key: string) =>
    setOpenDepts((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const grouped = DEPARTMENTS.map((dept) => ({
    ...dept,
    items: (actions || []).filter((a) => matchesDept(a.action_type, dept.actionTypes)),
  }));

  const uncategorized = (actions || []).filter(
    (a) => !DEPARTMENTS.some((d) => matchesDept(a.action_type, d.actionTypes))
  );

  const totalActions = actions?.length || 0;
  const hasNoData = !isLoading && totalActions === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Agent Board Report</h2>
          <p className="text-sm text-muted-foreground">
            Weekly intelligence from your 31 autonomous agents — grouped by department
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {grouped.map((dept) => (
          <Card key={dept.key} className="bg-card/50">
            <CardContent className="p-3 text-center">
              <dept.icon className={`h-5 w-5 mx-auto mb-1 ${dept.color}`} />
              <div className="text-lg font-bold">{dept.items.length}</div>
              <div className="text-xs text-muted-foreground">{dept.label.split("(")[0].trim()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {grouped.map((dept) => (
        <Collapsible key={dept.key} open={openDepts.includes(dept.key)} onOpenChange={() => toggle(dept.key)}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {openDepts.includes(dept.key) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <dept.icon className={`h-4 w-4 ${dept.color}`} />
                  {dept.label}
                  <Badge variant="secondary" className="ml-auto">{dept.items.length} actions</Badge>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-2 max-h-96 overflow-y-auto">
                {dept.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No agent activity this week</p>
                ) : (
                  dept.items.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3 bg-background/50 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={item.status === "approved" ? "default" : item.status === "pending" ? "secondary" : "outline"} className="text-xs">
                          {item.status}
                        </Badge>
                        <span className="font-medium">{item.action_type}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {item.ai_result?.substring(0, 300)}
                        {(item.ai_result?.length || 0) > 300 ? "…" : ""}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}

      {uncategorized.length > 0 && (
        <Collapsible>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ChevronRight className="h-4 w-4" />
                  Uncategorized
                  <Badge variant="secondary" className="ml-auto">{uncategorized.length}</Badge>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-2 max-h-96 overflow-y-auto">
                {uncategorized.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3 bg-background/50 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{item.status}</Badge>
                      <span className="font-medium">{item.action_type}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2">{item.ai_result?.substring(0, 200)}</p>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
