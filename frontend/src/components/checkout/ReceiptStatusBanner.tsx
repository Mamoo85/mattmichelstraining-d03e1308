const ReceiptStatusBanner = ({ status }: { status?: string }) => (
  <div className="px-4 py-2 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
    {status ?? "Payment confirmed"}
  </div>
);
export default ReceiptStatusBanner;
