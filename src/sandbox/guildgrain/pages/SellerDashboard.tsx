import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { PRODUCTS } from "../data/products";
import { mulberry32, seedFromString, seededSalesVelocity } from "../state/seededRandom";
import { computeVelocity } from "../state/useVelocityPrice";

const COLORS = ["#2d4a3d", "#c4654a", "#d4a574", "#7a6f60"];

function buildRevenue() {
  const rng = mulberry32(seedFromString("gg.revenue.v1"));
  return Array.from({ length: 30 }, (_, i) => ({
    day: `D${i + 1}`,
    revenue: Math.round(400 + rng() * 900 + i * 12),
  }));
}

export default function GGSeller() {
  const revenue = buildRevenue();
  const totalRev = revenue.reduce((s, r) => s + r.revenue, 0);

  const topSkus = PRODUCTS.slice(0, 6).map((p) => ({
    name: p.title.split(" ").slice(0, 2).join(" "),
    sold: seededSalesVelocity(p.id),
  })).sort((a, b) => b.sold - a.sold);

  const statusData = [
    { name: "Crafting", value: 14 },
    { name: "Shipped", value: 22 },
    { name: "Delivered", value: 47 },
    { name: "Returned", value: 1 },
  ];

  const [inventory, setInventory] = useState(() => PRODUCTS.slice(0, 6).map((p) => ({ id: p.id, title: p.title, qty: 12 + Math.floor(seededSalesVelocity(p.id) / 5), price: computeVelocity(p.basePrice, seededSalesVelocity(p.id)).price })));
  const [orders, setOrders] = useState<{ id: string; product: string; buyer: string; ts: number }[]>([]);

  useEffect(() => {
    const buyers = ["Avery K.", "Jordan M.", "Sam P.", "Riley T.", "Drew C.", "Casey L."];
    const t = setInterval(() => {
      const p = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      const b = buyers[Math.floor(Math.random() * buyers.length)];
      setOrders((prev) => [{ id: "O" + Math.random().toString(36).slice(2, 6).toUpperCase(), product: p.title, buyer: b, ts: Date.now() }, ...prev].slice(0, 8));
    }, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-8" data-testid="gg-seller-dashboard">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--gg-mute)]">Artisan Dashboard</p>
        <h1 className="gg-serif text-4xl">Studio Overview</h1>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "30-day revenue", value: `$${totalRev.toLocaleString()}` },
          { label: "Orders", value: "84" },
          { label: "Conversion", value: "4.2%" },
          { label: "Avg. order", value: "$" + Math.round(totalRev / 84) },
        ].map((k) => (
          <div key={k.label} className="gg-card p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--gg-mute)]">{k.label}</p>
            <p className="gg-serif mt-2 text-3xl">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="gg-card p-5 lg:col-span-2">
          <h3 className="gg-serif text-xl">Revenue · 30 days</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#7a6f60" tick={{ fontSize: 11 }} />
                <YAxis stroke="#7a6f60" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#2d4a3d" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="gg-card p-5">
          <h3 className="gg-serif text-xl">Order status</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="gg-card p-5">
          <h3 className="gg-serif text-xl">Top sellers</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSkus} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#7a6f60" tick={{ fontSize: 10 }} interval={0} />
                <YAxis stroke="#7a6f60" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="sold" fill="#c4654a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="gg-card p-5">
          <h3 className="gg-serif text-xl">Incoming orders</h3>
          {orders.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--gg-mute)]">Listening for new orders... (one every ~8s)</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm" data-testid="gg-incoming-orders">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between border-b border-[var(--gg-line)] pb-2">
                  <span><strong>{o.id}</strong> · {o.product}</span>
                  <span className="text-xs text-[var(--gg-mute)]">{o.buyer}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Inventory */}
      <div className="gg-card p-5">
        <h3 className="gg-serif text-xl">Inventory</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-[var(--gg-line)] text-left text-xs uppercase tracking-[0.16em] text-[var(--gg-mute)]">
                <th className="py-2">Product</th><th>Price</th><th>Qty</th><th></th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((i) => (
                <tr key={i.id} className="border-b border-[var(--gg-line)]">
                  <td className="py-2.5">{i.title}</td>
                  <td>${i.price.toFixed(2)}</td>
                  <td>{i.qty}</td>
                  <td className="flex gap-1 py-2">
                    <button onClick={() => setInventory((p) => p.map((x) => x.id === i.id ? { ...x, qty: Math.max(0, x.qty - 1) } : x))} className="h-6 w-6 border border-[var(--gg-line)] text-xs" aria-label="Decrease">−</button>
                    <button onClick={() => setInventory((p) => p.map((x) => x.id === i.id ? { ...x, qty: x.qty + 1 } : x))} className="h-6 w-6 border border-[var(--gg-line)] text-xs" aria-label="Increase">+</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
