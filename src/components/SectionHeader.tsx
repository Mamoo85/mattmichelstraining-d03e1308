interface SectionHeaderProps {
  title: string;
  timestamp?: string;
  children?: React.ReactNode;
}

const SectionHeader = ({ title, timestamp, children }: SectionHeaderProps) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-0.5 h-6 bg-primary" />
    <div className="flex-1">
      <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">{title}</h2>
      {timestamp && (
        <span className="text-[10px] font-mono text-muted-foreground">{timestamp}</span>
      )}
    </div>
    {children}
  </div>
);

export default SectionHeader;
