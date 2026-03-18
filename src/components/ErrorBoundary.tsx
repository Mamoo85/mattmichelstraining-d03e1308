import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      /loading chunk|failed to fetch dynamically imported module|import/i.test(error.message);
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Error boundary caught — could report to analytics
  }

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <RefreshCw className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-lg font-black uppercase tracking-tight text-foreground">
            Connection interrupted
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {this.state.isChunkError
              ? "A page failed to load — likely a weak signal or a new version was deployed."
              : "Something unexpected happened."}
            {" "}Please check your signal and try again.
          </p>
          <button
            onClick={this.handleReload}
            className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
