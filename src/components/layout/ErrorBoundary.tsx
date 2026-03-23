import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, WifiOff, AlertTriangle } from "lucide-react";
import { safeLocalStorage, safeSessionStorage } from "@/lib/browserStorage";

interface Props {
  children: ReactNode;
}

type ErrorKind = "chunk" | "network" | "unknown";

interface State {
  hasError: boolean;
  errorKind: ErrorKind;
  autoRetried: boolean;
}

function classifyError(error: Error): ErrorKind {
  const msg = error.message?.toLowerCase() ?? "";
  if (
    /loading chunk|failed to fetch dynamically imported module|import|loading css chunk|load failed|typeerror.*module/i.test(msg)
  ) {
    return "chunk";
  }
  if (/networkerror|failed to fetch|load failed|cors|blocked/i.test(msg)) {
    return "network";
  }
  return "unknown";
}

const MESSAGES: Record<ErrorKind, { title: string; body: string }> = {
  chunk: {
    title: "New version available",
    body: "A new version of the app was deployed while you were using it. Please reload to get the latest version.",
  },
  network: {
    title: "Connection issue",
    body: "A request was blocked or failed — this can happen on privacy browsers (like Freespoke or Brave) that restrict third-party connections. Try disabling shields/ad-blockers for this site, or switch to a standard browser.",
  },
  unknown: {
    title: "Something went wrong",
    body: "An unexpected error occurred. Reloading usually fixes it. If the problem persists, try clearing your browser cache.",
  },
};

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorKind: "unknown", autoRetried: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorKind: classifyError(error), autoRetried: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Always log the real error for diagnostics
    console.error("[ErrorBoundary]", error.message, error.stack);
    console.error("[ErrorBoundary] Component stack:", info.componentStack);

    // Auto-retry once for ALL error types by reloading — most transient
    // errors (chunk, network, timing) resolve on a fresh load.
    const retryKey = "m2-eb-retried";
    const alreadyRetried = safeSessionStorage.getItem(retryKey);
    if (!alreadyRetried) {
      safeSessionStorage.setItem(retryKey, "1");
      this.setState({ autoRetried: true });
      setTimeout(() => window.location.reload(), 1500);
    } else {
      // Clear the flag so a future session can retry again
      safeSessionStorage.removeItem(retryKey);
    }
  }

  handleReload = () => window.location.reload();

  handleClearAndReload = () => {
    try {
      safeLocalStorage.removeItem("m2-query-cache");
      safeLocalStorage.removeItem("m2_offline_queue");
      // Clear all caches
      if ("caches" in window) {
        caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
      }
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { errorKind, autoRetried } = this.state;
    const msg = MESSAGES[errorKind];
    const Icon = errorKind === "network" ? WifiOff : errorKind === "chunk" ? RefreshCw : AlertTriangle;

    if (!autoRetried && safeSessionStorage.getItem("m2-eb-retried") === "1") {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center max-w-sm space-y-3">
            <RefreshCw className="w-8 h-8 text-primary mx-auto animate-spin" />
            <p className="text-sm text-muted-foreground">Reloading…</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <Icon className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-lg font-black uppercase tracking-tight text-foreground">
            {msg.title}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {msg.body}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={this.handleReload}
              className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>
            <button
              onClick={this.handleClearAndReload}
              className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Clear cache &amp; reload
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground/70 leading-snug pt-2">
            If you're using a privacy browser or opened this from a social media app, tap the menu (⋮ or ⋯) and select <strong>"Open in Chrome"</strong> or <strong>"Open in Safari"</strong>.
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
