interface LeadDetailDrawerProps {
  open?: boolean;
  onClose?: () => void;
  lead?: Record<string, unknown>;
}

const LeadDetailDrawer = ({ open, onClose }: LeadDetailDrawerProps) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div className="w-96 bg-background p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-muted-foreground">Lead details — coming soon</p>
      </div>
    </div>
  );
};
export default LeadDetailDrawer;
