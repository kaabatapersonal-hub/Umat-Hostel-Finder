import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "default" | "warning";
}

export function StatCard({ label, value, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-ink-500">{label}</span>
        <Icon className={cn("size-4", tone === "warning" ? "text-gold-600" : "text-brand-800")} strokeWidth={1.75} />
      </div>
      <span className="font-display text-display text-ink-900">{value.toLocaleString()}</span>
    </div>
  );
}
