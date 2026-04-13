interface EnterpriseFooterBlockProps {
  accentColor?: string;
  isDark?: boolean;
}

export default function EnterpriseFooterBlock({
  accentColor = "#e8621a",
  isDark = false,
}: EnterpriseFooterBlockProps) {
  return (
    <div className={`border-t px-4 py-10 text-center ${isDark ? "border-white/10" : "border-border"}`}>
      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? "text-slate-500" : "text-muted-foreground"}`}>
        Enterprise / Custom Needs?
      </p>
      <p className={`text-sm mb-4 max-w-sm mx-auto ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
        Need a custom arrangement, multiple locations, or want to talk through the product before signing up?
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        <a
          href="tel:+13139921219"
          style={{ color: accentColor }}
          className="text-sm font-bold hover:underline"
        >
          (313) 992-1219
        </a>
        <span className={`hidden sm:inline text-xs ${isDark ? "text-slate-600" : "text-muted-foreground/50"}`}>·</span>
        <a
          href="mailto:matt@detroitwebagent.com"
          style={{ color: accentColor }}
          className="text-sm font-bold hover:underline"
        >
          matt@detroitwebagent.com
        </a>
      </div>
    </div>
  );
}
