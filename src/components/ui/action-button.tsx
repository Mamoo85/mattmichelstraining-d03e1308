// Shared action button enforcing the "no dead clicks" pattern:
// single-flight lock, disabled state, busy label, and a spinner.
// Use this for any button that calls supabase.functions.invoke
// or hits a payment endpoint so we can never double-charge.

import { CSSProperties, ReactNode, useRef, useState } from "react";

interface Props {
  onClick: () => void | Promise<unknown>;
  children: ReactNode;
  busyLabel?: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  style?: CSSProperties;
  className?: string;
  ariaLabel?: string;
  variant?: "primary" | "secondary" | "danger";
}

const VARIANTS: Record<NonNullable<Props["variant"]>, CSSProperties> = {
  primary: { background: "#00d4ff", color: "#0a1628" },
  secondary: { background: "transparent", color: "#00d4ff", border: "1px solid #1e3a5f" },
  danger: { background: "#ef4444", color: "#fff" },
};

const BUSY_STYLE: CSSProperties = {
  background: "#1e3a5f",
  color: "#94a3b8",
  cursor: "not-allowed",
};

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "actionspin 0.7s linear infinite",
        verticalAlign: "middle",
        marginRight: 8,
      }}
    />
  );
}

export default function ActionButton({
  onClick,
  children,
  busyLabel,
  disabled = false,
  type = "button",
  style,
  className,
  ariaLabel,
  variant = "primary",
}: Props) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const handle = async () => {
    if (lock.current || busy || disabled) return;
    lock.current = true;
    setBusy(true);
    try {
      await onClick();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const merged: CSSProperties = {
    width: "100%",
    border: "none",
    borderRadius: 8,
    padding: "16px 20px",
    minHeight: 52,
    fontSize: 16,
    fontWeight: 800,
    cursor: busy || disabled ? "not-allowed" : "pointer",
    touchAction: "manipulation",
    transition: "background 0.15s",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...VARIANTS[variant],
    ...(busy || disabled ? BUSY_STYLE : null),
    ...style,
  };

  return (
    <>
      <style>{`@keyframes actionspin{to{transform:rotate(360deg)}}`}</style>
      <button
        type={type}
        onClick={type === "submit" ? undefined : handle}
        disabled={busy || disabled}
        aria-busy={busy}
        aria-label={ariaLabel}
        className={className}
        style={merged}
      >
        {busy ? (
          <>
            <Spinner /> {busyLabel ?? "Processing…"}
          </>
        ) : (
          children
        )}
      </button>
    </>
  );
}
