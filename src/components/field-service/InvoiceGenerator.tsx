// InvoiceGenerator — printable HTML invoice for FieldDesk jobs
// Opens in a new tab with print-ready CSS. No dependencies needed.
// Used from DispatchBoard job detail panel.

import { useState } from "react";

interface LineItem {
  description: string;
  quantity: string;
  rate: string;
}

interface InvoiceGeneratorProps {
  job: {
    id: string;
    title: string;
    field_service_customers: { company_name: string; phone: string } | null;
    field_service_techs: { name: string } | null;
    scheduled_date: string | null;
  };
  contractorName?: string;
  onClose: () => void;
}

export default function InvoiceGenerator({ job, contractorName, onClose }: InvoiceGeneratorProps) {
  const today = new Date().toISOString().split("T")[0];
  const dueDefault = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(dueDefault);
  const [clientName, setClientName] = useState(job.field_service_customers?.company_name || "");
  const [clientAddress, setClientAddress] = useState("");
  const [notes, setNotes] = useState(job.title || "");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "Labor", quantity: "1", rate: "" },
    { description: "Parts / Materials", quantity: "1", rate: "" },
  ]);

  const addItem = () => setLineItems((prev) => [...prev, { description: "", quantity: "1", rate: "" }]);
  const removeItem = (i: number) => setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LineItem, value: string) => {
    setLineItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const subtotal = lineItems.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    return sum + qty * rate;
  }, 0);

  const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const handlePrint = () => {
    const itemRows = lineItems
      .filter((item) => item.description.trim())
      .map((item) => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const total = qty * rate;
        return `
          <tr>
            <td>${item.description}</td>
            <td style="text-align:center">${qty}</td>
            <td style="text-align:right">${rate ? fmt(rate) : "—"}</td>
            <td style="text-align:right">${total ? fmt(total) : "—"}</td>
          </tr>`;
      }).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; background: #fff; padding: 48px; max-width: 760px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand { font-size: 22px; font-weight: 800; color: #0f172a; }
    .brand-sub { font-size: 13px; color: #64748b; margin-top: 3px; }
    .invoice-meta { text-align: right; }
    .invoice-title { font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
    .invoice-num { font-size: 14px; color: #64748b; margin-top: 4px; }
    .section { margin-bottom: 32px; }
    .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 8px; }
    .bill-to { font-size: 15px; font-weight: 700; color: #0f172a; }
    .bill-sub { font-size: 13px; color: #475569; margin-top: 3px; }
    .dates { display: flex; gap: 48px; }
    .date-block { }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
    th { padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; text-align: left; }
    th:last-child, th:nth-child(3), th:nth-child(2) { text-align: right; }
    th:nth-child(2) { text-align: center; }
    td { padding: 12px 12px; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9; }
    .total-row td { padding: 14px 12px; font-size: 16px; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a; border-bottom: none; background: #f8fafc; }
    .notes { background: #f8fafc; border-radius: 8px; padding: 16px 18px; margin-bottom: 32px; }
    .notes p { font-size: 13px; color: #475569; line-height: 1.6; }
    .footer { border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; }
    @media print {
      body { padding: 24px; }
      @page { margin: 0.5in; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${contractorName || "Your Company"}</div>
      <div class="brand-sub">Powered by FieldDesk · Detroit Web Agency</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-num">${invoiceNumber}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:36px">
    <div>
      <div class="section-label">Bill To</div>
      <div class="bill-to">${clientName || "Client Name"}</div>
      ${clientAddress ? `<div class="bill-sub">${clientAddress.replace(/\n/g, "<br>")}</div>` : ""}
    </div>
    <div class="dates" style="text-align:right">
      <div>
        <div class="section-label">Invoice Date</div>
        <div class="bill-to" style="font-size:14px">${new Date(invoiceDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
      </div>
      <div>
        <div class="section-label">Due Date</div>
        <div class="bill-to" style="font-size:14px">${new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="total-row">
        <td colspan="3" style="text-align:right">Total Due</td>
        <td style="text-align:right">${fmt(subtotal)}</td>
      </tr>
    </tbody>
  </table>

  ${notes ? `<div class="notes"><div class="section-label" style="margin-bottom:6px">Job Reference / Notes</div><p>${notes}</p></div>` : ""}

  <div class="footer">
    Thank you for your business. Please remit payment by ${new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f1f35] border border-[#1e3a5f] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e3a5f]">
          <div>
            <h3 className="text-white font-bold text-base">Generate Invoice</h3>
            <p className="text-gray-400 text-xs mt-0.5 truncate max-w-[280px]">{job.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Invoice meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1">Invoice #</label>
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1">Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1">Bill To</label>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#00d4ff]" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]" />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1">Client Address (optional)</label>
            <textarea value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} rows={2} placeholder="123 Main St, Detroit, MI 48201" className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 resize-none focus:outline-none focus:border-[#00d4ff]" />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Line Items</label>
              <button onClick={addItem} className="text-[#00d4ff] text-xs font-semibold hover:underline">+ Add Item</button>
            </div>
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 px-1">
                <span className="col-span-6 text-gray-500 text-[11px] uppercase tracking-wide">Description</span>
                <span className="col-span-2 text-gray-500 text-[11px] uppercase tracking-wide text-center">Qty</span>
                <span className="col-span-3 text-gray-500 text-[11px] uppercase tracking-wide text-right">Rate ($)</span>
                <span className="col-span-1" />
              </div>
              {lineItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    placeholder="Description"
                    className="col-span-6 bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-2 py-1.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#00d4ff]"
                  />
                  <input
                    value={item.quantity}
                    onChange={(e) => updateItem(i, "quantity", e.target.value)}
                    type="number"
                    min="0"
                    step="0.5"
                    className="col-span-2 bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none focus:border-[#00d4ff]"
                  />
                  <input
                    value={item.rate}
                    onChange={(e) => updateItem(i, "rate", e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="col-span-3 bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-2 py-1.5 text-white text-sm text-right placeholder-gray-600 focus:outline-none focus:border-[#00d4ff]"
                  />
                  <button
                    onClick={() => removeItem(i)}
                    className="col-span-1 text-gray-600 hover:text-red-400 text-lg leading-none text-center"
                  >×</button>
                </div>
              ))}
            </div>
            {subtotal > 0 && (
              <div className="flex justify-end mt-3 pt-3 border-t border-[#1e3a5f]">
                <span className="text-white font-bold text-base">Total: {fmt(subtotal)}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1">Job Reference / Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-[#00d4ff]" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handlePrint}
              className="flex-1 py-3 bg-[#00d4ff] text-[#0a1628] font-bold text-sm rounded-xl hover:bg-[#00bce8] transition-colors"
            >
              🖨️ Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 border border-[#1e3a5f] text-gray-400 text-sm rounded-xl hover:border-[#00d4ff] transition-colors"
            >
              Cancel
            </button>
          </div>
          <p className="text-gray-600 text-xs text-center">Opens in new tab — use browser's "Save as PDF" option</p>
        </div>
      </div>
    </div>
  );
}
