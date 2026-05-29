import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const event = (payload.event as string) ?? 'paid';

  const saleEvents = ['paid', 'subscription.created'];
  if (!saleEvents.includes(event)) {
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const orderId = (payload.order_id as string) ?? (payload.id as string) ?? null;
  const productId = (payload.product_id as string) ?? null;
  const productTitle = (payload.product_name as string) ?? null;
  const buyerEmail = (payload.email as string) ?? null;
  const amountRaw = payload.amount as string | number | null;
  const amountCents = amountRaw ? Math.round(parseFloat(String(amountRaw)) * 100) : null;
  const currency = (payload.currency as string)?.toUpperCase() ?? 'USD';

  const { error } = await supabase.from('payhip_sales').upsert({
    payhip_order_id: orderId,
    product_id: productId,
    product_title: productTitle,
    buyer_email: buyerEmail,
    amount_cents: amountCents,
    currency,
    event_type: event,
    raw_payload: payload,
  }, { onConflict: 'payhip_order_id' });

  if (error) {
    console.error('payhip-webhook DB error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  console.log(`payhip-webhook: stored ${event} order ${orderId} £/$ ${amountRaw}`);
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
