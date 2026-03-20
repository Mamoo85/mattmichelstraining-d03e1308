interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  timestamp?: string;
  children?: React.ReactNode;
}

const SectionHeader = ({ title, subtitle, timestamp, children }: SectionHeaderProps) => (
  <div className="flex items-center gap-4 mb-6">
    <div className="w-1 h-8 bg-primary rounded-full" />
    <div className="flex-1">
      <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground">{title}</h2>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      )}
      {timestamp && (
        <span className="text-[10px] font-mono text-muted-foreground">{timestamp}</span>
      )}
    </div>
    {children}
  </div>
);

export default SectionHeader;
