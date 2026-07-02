import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <header className={cn("flex items-start justify-between gap-4 px-4 pt-6 pb-2", className)}>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-display text-ink-900">{title}</h1>
        {subtitle && <p className="text-body text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </header>
  );
}
