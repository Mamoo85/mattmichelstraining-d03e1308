import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { format } from "date-fns";

interface ChangelogEntry {
  id: string;
  ship_date: string;
  product: string;
  title: string;
  body: string;
  tags: string[];
}

const Changelog = () => {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("product_changelog")
        .select("id, ship_date, product, title, body, tags")
        .eq("is_public", true)
        .order("ship_date", { ascending: false })
        .limit(200);
      if (!error && data) setEntries(data as ChangelogEntry[]);
      setLoading(false);
    })();
  }, []);

  const grouped = entries.reduce<Record<string, ChangelogEntry[]>>((acc, e) => {
    const key = format(new Date(e.ship_date), "MMMM yyyy");
    (acc[key] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>What's New — Detroit Web Agency Changelog</title>
        <meta
          name="description"
          content="Every upgrade we ship — forever — is free for our clients. See what's new this week."
        />
        <link rel="canonical" href="https://detroitwebagent.com/changelog" />
      </Helmet>

      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium text-primary uppercase tracking-wide">
              Forever Pricing
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            What we shipped
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Your price never goes up. Every upgrade we ship — forever — is free.
            We push improvements every single day. You're not buying a snapshot,
            you're buying the cutting edge for life.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {loading && <p className="text-muted-foreground">Loading…</p>}
        {!loading && entries.length === 0 && (
          <p className="text-muted-foreground">No entries yet.</p>
        )}

        {Object.entries(grouped).map(([month, items]) => (
          <section key={month} className="mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              {month}
            </h2>
            <div className="space-y-4">
              {items.map((e) => (
                <Card key={e.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="text-xl">{e.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {e.product} ·{" "}
                          {format(new Date(e.ship_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {e.tags.map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground/90 whitespace-pre-line">
                      {e.body}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
};

export default Changelog;
