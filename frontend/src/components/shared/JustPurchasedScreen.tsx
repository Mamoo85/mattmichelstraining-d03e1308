export function isJustPurchased(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("just_purchased") === "true";
}

interface JustPurchasedScreenProps {
  productName?: string;
  onDismiss?: () => void;
}

const JustPurchasedScreen = ({ productName, onDismiss }: JustPurchasedScreenProps) => (
  <div className="fixed inset-0 bg-background/90 z-50 flex items-center justify-center">
    <div className="text-center space-y-4 p-8">
      <p className="text-2xl font-bold">🎉 Welcome{productName ? ` to ${productName}` : ""}!</p>
      <p className="text-muted-foreground">Your account is being set up…</p>
      {onDismiss && (
        <button className="text-primary underline text-sm" onClick={onDismiss}>
          Continue
        </button>
      )}
    </div>
  </div>
);
export default JustPurchasedScreen;
