import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ActionButtonProps extends ButtonProps {
  loading?: boolean;
}

const ActionButton = ({ loading, children, disabled, ...props }: ActionButtonProps) => (
  <Button disabled={loading || disabled} {...props}>
    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
    {children}
  </Button>
);

export default ActionButton;
