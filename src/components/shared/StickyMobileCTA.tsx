type Props = {
  label: string;
  onClick: () => void;
};

/** Fixed bottom CTA on mobile only. Hidden on md+. */
export default function StickyMobileCTA({ label, onClick }: Props) {
  return (
    <div
      className="md:hidden"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
        background: "linear-gradient(to top, rgba(3,7,17,0.98) 60%, rgba(3,7,17,0))",
        backdropFilter: "blur(8px)",
      }}
    >
      <button
        onClick={onClick}
        style={{
          width: "100%",
          background: "linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)",
          color: "#0a1628",
          border: "none",
          borderRadius: 12,
          padding: "16px 20px",
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: 0.3,
          boxShadow: "0 8px 24px rgba(0,212,255,0.35)",
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    </div>
  );
}
