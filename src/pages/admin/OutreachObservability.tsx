import OutreachObservability from "@/components/admin/OutreachObservability";
import OutreachQueueMonitor from "@/components/admin/OutreachQueueMonitor";
import EnrichmentDLQPanel from "@/components/admin/EnrichmentDLQPanel";
import EnrichmentWalkerAlertsPanel from "@/components/admin/EnrichmentWalkerAlertsPanel";
import EnrichmentTimelinePanel from "@/components/admin/EnrichmentTimelinePanel";
import WalkerTargetsPanel from "@/components/admin/WalkerTargetsPanel";
import AlertLogSearchPanel from "@/components/admin/AlertLogSearchPanel";
import CronStatusWidget from "@/components/admin/CronStatusWidget";
import RerunEnrichmentDialog from "@/components/admin/RerunEnrichmentDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";

export default function OutreachObservabilityPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-4">
      <div className="flex justify-end">
        <Link to="/dwa-admin/wave5">
          <Button variant="outline" size="sm">
            <LayoutDashboard className="w-4 h-4 mr-2" /> Wave 5 dashboard
          </Button>
        </Link>
      </div>
      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="queue">Live queue</TabsTrigger>
          <TabsTrigger value="dlq">DLQ &amp; Backfill</TabsTrigger>
          <TabsTrigger value="walker">Walker &amp; Alerts</TabsTrigger>
          <TabsTrigger value="alert-log">Alert log</TabsTrigger>
          <TabsTrigger value="crons">Crons</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="targets">Targets &amp; Cooldowns</TabsTrigger>
          <TabsTrigger value="rerun">Re-run</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <OutreachObservability />
        </TabsContent>
        <TabsContent value="queue" className="mt-4">
          <OutreachQueueMonitor />
        </TabsContent>
        <TabsContent value="dlq" className="mt-4">
          <EnrichmentDLQPanel />
        </TabsContent>
        <TabsContent value="walker" className="mt-4">
          <EnrichmentWalkerAlertsPanel />
        </TabsContent>
        <TabsContent value="alert-log" className="mt-4">
          <AlertLogSearchPanel />
        </TabsContent>
        <TabsContent value="crons" className="mt-4">
          <CronStatusWidget />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <EnrichmentTimelinePanel />
        </TabsContent>
        <TabsContent value="targets" className="mt-4">
          <WalkerTargetsPanel />
        </TabsContent>
        <TabsContent value="rerun" className="mt-4">
          <RerunEnrichmentDialog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
