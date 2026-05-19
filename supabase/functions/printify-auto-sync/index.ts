// Printify → Etsy auto-sync + listing auditor
// - Publishes any unpublished Printify products to Etsy
// - Audits all products for duplicates, totes, and bad descriptions
// Cron: every 4 hours

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const PRINTIFY_API = 'https://api.printify.com/v1';
const PRINTIFY_TOKEN = Deno.env.get('PRINTIFY_API_TOKEN');
const PRINTIFY_SHOP_ID = Deno.env.get('PRINTIFY_SHOP_ID');

type PrintifyProduct = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  blueprint_id: number;
  visible: boolean;
  is_locked: boolean;
  external?: { id: string; handle: string } | null;
};

async function pfFetch(path: string, init: RequestInit = {}) {
  const r = await fetch(`${PRINTIFY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${PRINTIFY_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DWA-AutoSync/1.0',
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leave null */ }
  if (!r.ok) throw new Error(`Printify ${r.status} ${path}: ${text.slice(0, 300)}`);
  return json;
}

async function listAllProducts(): Promise<PrintifyProduct[]> {
  const all: PrintifyProduct[] = [];
  let page = 1;
  const limit = 50;
  while (true) {
    const data = await pfFetch(`/shops/${PRINTIFY_SHOP_ID}/products.json?limit=${limit}&page=${page}`);
    const items: PrintifyProduct[] = data?.data ?? [];
    all.push(...items);
    if (items.length < limit) break;
    page += 1;
    if (page > 50) break; // hard cap safety
  }
  return all;
}

async function publishProduct(id: string) {
  return pfFetch(`/shops/${PRINTIFY_SHOP_ID}/products/${id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: true, description: true, images: true, variants: true,
      tags: true, keyFeatures: true, shipping_template: true,
    }),
  });
}

// Blueprint families to detect type mismatches.
// (Common Printify blueprint IDs — extend as needed.)
const BLUEPRINT_FAMILY: Record<number, 'tee' | 'hoodie' | 'mug' | 'tote' | 'sweatshirt' | 'other'> = {
  6: 'tee', 12: 'tee', 36: 'tee', 145: 'tee', 384: 'tee', // common tees
  77: 'hoodie', 92: 'hoodie', 314: 'hoodie',
  9: 'mug', 168: 'mug', 478: 'mug', 1094: 'mug',
  113: 'tote', 326: 'tote',
  49: 'sweatshirt', 80: 'sweatshirt',
};

function normalizeTitle(t: string) {
  return (t || '')
    .toLowerCase()
    .replace(/[–—-]\s*(tee|t-shirt|mug|hoodie|tote|sweatshirt|crewneck).*$/i, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function auditProducts(products: PrintifyProduct[]) {
  const issues: Array<{
    id: string; title: string; type: string; detail: string;
  }> = [];

  // Duplicate detection by normalized title
  const groups: Record<string, PrintifyProduct[]> = {};
  for (const p of products) {
    const key = normalizeTitle(p.title);
    if (!key) continue;
    (groups[key] ||= []).push(p);
  }
  for (const [key, group] of Object.entries(groups)) {
    if (group.length > 1) {
      // Only flag dupes within the same blueprint family
      const byFam: Record<string, PrintifyProduct[]> = {};
      for (const g of group) {
        const fam = BLUEPRINT_FAMILY[g.blueprint_id] || `bp${g.blueprint_id}`;
        (byFam[fam] ||= []).push(g);
      }
      for (const [fam, fams] of Object.entries(byFam)) {
        if (fams.length > 1) {
          for (const dup of fams) {
            issues.push({
              id: dup.id, title: dup.title,
              type: 'duplicate',
              detail: `${fams.length} ${fam} products share normalized title "${key}"`,
            });
          }
        }
      }
    }
  }

  for (const p of products) {
    const fam = BLUEPRINT_FAMILY[p.blueprint_id];
    const titleLower = (p.title || '').toLowerCase();
    const descLower = (p.description || '').toLowerCase();

    // Flag any tote (per project rule: totes are deprecated)
    if (fam === 'tote' || titleLower.includes('tote bag') || titleLower.includes(' tote')) {
      issues.push({ id: p.id, title: p.title, type: 'tote', detail: `Blueprint ${p.blueprint_id} = tote (deprecated)` });
    }

    // Title too long for Etsy (140 chars)
    if ((p.title || '').length > 140) {
      issues.push({ id: p.id, title: p.title, type: 'title_too_long', detail: `${p.title.length} chars (>140)` });
    }

    // Empty / missing description
    if (!p.description || p.description.replace(/<[^>]+>/g, '').trim().length < 40) {
      issues.push({ id: p.id, title: p.title, type: 'thin_description', detail: 'Description missing or under 40 chars' });
    }

    // Type mismatch: title says one product type, blueprint is another
    if (fam) {
      const otherTypes = ['tee', 't-shirt', 'mug', 'hoodie', 'tote', 'sweatshirt'].filter(t =>
        t !== fam && !(fam === 'tee' && t === 't-shirt')
      );
      for (const t of otherTypes) {
        if (titleLower.includes(` ${t}`) || titleLower.endsWith(t)) {
          issues.push({
            id: p.id, title: p.title, type: 'type_mismatch',
            detail: `Title mentions "${t}" but blueprint ${p.blueprint_id} is ${fam}`,
          });
          break;
        }
      }
    }

    // Description references wrong product type
    if (fam === 'mug' && /\b(t-shirt|tee shirt|hoodie|tote)\b/.test(descLower)) {
      issues.push({ id: p.id, title: p.title, type: 'description_mismatch', detail: 'Mug description mentions apparel' });
    }
    if ((fam === 'tee' || fam === 'hoodie') && /\b(mug|ceramic|11oz|15oz|dishwasher)\b/.test(descLower)) {
      issues.push({ id: p.id, title: p.title, type: 'description_mismatch', detail: 'Apparel description mentions mug' });
    }
  }

  return issues;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!PRINTIFY_TOKEN || !PRINTIFY_SHOP_ID) {
    return new Response(JSON.stringify({ error: 'PRINTIFY_API_TOKEN / PRINTIFY_SHOP_ID not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body.mode || 'sync_and_audit'; // 'sync_only' | 'audit_only' | 'sync_and_audit' | 'cleanup'

  try {
    const products = await listAllProducts();

    const sync = { attempted: 0, succeeded: 0, failed: 0, published: [] as any[], errors: [] as any[] };
    if (mode === 'sync_only' || mode === 'sync_and_audit') {
      const unpublished = products.filter(p => !p.external?.id && !p.is_locked);
      for (const p of unpublished) {
        sync.attempted += 1;
        try {
          await publishProduct(p.id);
          sync.succeeded += 1;
          sync.published.push({ id: p.id, title: p.title });
        } catch (e) {
          sync.failed += 1;
          sync.errors.push({ id: p.id, title: p.title, error: String(e).slice(0, 200) });
        }
      }
    }

    const issues = auditProducts(products);

    // Cleanup mode: auto-delete duplicates (keep newest) + tote blueprints
    const cleanup = { deleted: [] as any[], errors: [] as any[] };
    if (mode === 'cleanup') {
      const toDelete = new Set<string>();

      // Duplicates: keep highest id (newest), delete the rest
      const dupGroups: Record<string, PrintifyProduct[]> = {};
      for (const i of issues.filter(x => x.type === 'duplicate')) {
        const p = products.find(pp => pp.id === i.id);
        if (!p) continue;
        const key = `${BLUEPRINT_FAMILY[p.blueprint_id] || p.blueprint_id}::${normalizeTitle(p.title)}`;
        (dupGroups[key] ||= []).push(p);
      }
      for (const group of Object.values(dupGroups)) {
        const sorted = [...group].sort((a, b) => String(b.id).localeCompare(String(a.id)));
        for (const dup of sorted.slice(1)) toDelete.add(dup.id);
      }

      // Totes (deprecated)
      for (const i of issues.filter(x => x.type === 'tote')) toDelete.add(i.id);

      for (const id of toDelete) {
        const p = products.find(pp => pp.id === id);
        try {
          await pfFetch(`/shops/${PRINTIFY_SHOP_ID}/products/${id}.json`, { method: 'DELETE' });
          cleanup.deleted.push({ id, title: p?.title });
        } catch (e) {
          cleanup.errors.push({ id, title: p?.title, error: String(e).slice(0, 200) });
        }
      }
    }

    const audit = mode === 'sync_only' ? null : { total: products.length, issues };

    return new Response(JSON.stringify({
      ok: true,
      mode,
      total_products: products.length,
      sync,
      audit,
      cleanup: mode === 'cleanup' ? cleanup : undefined,
      ran_at: new Date().toISOString(),
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
