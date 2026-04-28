import OutreachObservability from "@/components/admin/OutreachObservability";
import OutreachQueueMonitor from "@/components/admin/OutreachQueueMonitor";
import EnrichmentDLQPanel from "@/components/admin/EnrichmentDLQPanel";
import EnrichmentWalkerAlertsPanel from "@/components/admin/EnrichmentWalkerAlertsPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function OutreachObservabilityPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-4">
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="queue">Live queue</TabsTrigger>
          <TabsTrigger value="dlq">DLQ &amp; Backfill</TabsTrigger>
          <TabsTrigger value="walker">Walker &amp; Alerts</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
