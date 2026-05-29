import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminMarketplaceAudit() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Marketplace Audit</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Marketplace audit coming soon — will surface Etsy/Printify listing health,
          missing tags, pricing below cost, and zero-sale listings eligible for reaping.
        </p>
      </CardContent>
    </Card>
  );
}
