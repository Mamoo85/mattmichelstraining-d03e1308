interface EmptyDashboardStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyDashboardState = ({ title = "No data yet", description, action }: EmptyDashboardStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
    <p className="text-lg font-semibold">{title}</p>
    {description && <p className="text-muted-foreground text-sm max-w-sm">{description}</p>}
    {action}
  </div>
);
export default EmptyDashboardState;
