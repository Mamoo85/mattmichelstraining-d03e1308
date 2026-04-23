import React, { useRef, useState, useEffect } from "react";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Draw baseline
    ctx.save();
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, canvas.offsetHeight - 30);
    ctx.lineTo(canvas.offsetWidth - 20, canvas.offsetHeight - 30);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasDrawn(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, canvas.offsetHeight - 30);
    ctx.lineTo(canvas.offsetWidth - 20, canvas.offsetHeight - 30);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md bg-[#0f1f35] rounded-2xl border border-[#1e3a5f] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e3a5f]">
          <h3 className="text-white font-bold text-lg">Customer Signature</h3>
          <p className="text-gray-400 text-xs mt-1">Have the customer sign below to confirm work completion.</p>
        </div>
        <div className="px-4 py-4">
          <canvas
            ref={canvasRef}
            className="w-full bg-[#0a1628] rounded-xl border border-[#1e3a5f] touch-none"
            style={{ height: 200 }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        </div>
        <div className="flex gap-3 px-4 pb-4">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-[#1e3a5f] text-gray-300 font-semibold">
            Skip
          </button>
          <button onClick={handleClear} className="py-3 px-4 rounded-xl border border-[#1e3a5f] text-gray-300 font-semibold">
            Clear
          </button>
          <button
            onClick={handleSave}
            disabled={!hasDrawn}
            className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold disabled:opacity-40"
          >
            Save Signature
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
