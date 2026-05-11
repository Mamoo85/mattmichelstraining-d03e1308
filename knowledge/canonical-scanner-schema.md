# Canonical Scanner Schema & Mapping Rules

All 200+ scanner sources now feed a single, unified targeting model. Any new fetcher participates automatically — no code changes required in the consumer products.

## Tables

| Table | Purpose | Dedup key |
|---|---|---|
| `canonical_companies` | Businesses / orgs | `lower(domain)` or `license_number` |
| `canonical_people` | Owners, candidates, counsel, decision-makers | `lower(email)` |
| `canonical_places` | Addresses, parcels, zip/county/region zones | `lower(formatted_address)` |
| `canonical_events` | Every timestamped scanner observation | `(source, external_id)` |
| `canonical_signals` | Denormalized, scored, lead-ready rows fanned out to one or more products | — |
| `scanner_source_mappings` | Per-source rules: entity type, event type, field map, default score, target products | `source` |

A convenience view `public.v_canonical_targeting_feed` (security_invoker) returns undelivered signals joined to entities — the canonical feed for downstream product UIs.

## Event categories

`weather | permit | legal | financial | hiring | directory | registry | web | property | enrichment`

## How a new source becomes targeting-ready

1. Add the fetcher to `_shared/scanner-extras-*.ts` and register it in `_shared/scanner-extras-dispatcher.ts`.
2. The dispatcher pipes every successful run through `persistCanonicalRows()` (see `_shared/canonical-mapper.ts`).
3. If a row exists in `scanner_source_mappings` for that source, its `field_map`, `event_type`, `default_score`, and `target_products` are honored exactly.
4. If no mapping exists, the mapper uses `inferCategory(source)` (keyword heuristic) + `CATEGORY_TEMPLATES` to assign a safe default. The source still produces canonical rows; admins can refine later via the registry.

## field_map JSON

Maps canonical keys → raw row paths (dot/bracket notation supported). Recognised keys:

```
company_name, domain, email, phone, full_name,
address, city, state, zip, county, parcel_id, lat, lon,
external_id, occurred_at, title, description, estimated_value, url
```

Any key omitted falls back to the `COMMON_FIELDS` heuristic list in `canonical-mapper.ts`, so partial mappings work.

## Fan-out

`target_products` (text[]) lets one source feed many products. Example: `wayne_sheriff_sales` feeds `mortgage_radar`, `trade_radar`, and `dead_lead_pool` from a single fetch — one event, three signals.

## Scoring & urgency

Per-source `default_score` (0–10) and `default_urgency` (`cold|normal|warm|hot|critical`). Downstream scorers can update `canonical_signals.score` after enrichment / corroboration.

## Delivery tracking

`canonical_signals.delivered_to_client_id` + `delivered_at` allow products to mark which signals have been surfaced to which customers — eliminating duplicate alerts and powering "what's new since last login" feeds.

## RLS

All canonical tables: service_role full, admins read via `public.has_role(auth.uid(), 'admin')`. Products query via service-role edge functions; admin UIs query through RLS as admins.
