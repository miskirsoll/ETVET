import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-black/15 px-6 py-10 text-center dark:border-white/20">
      <Icon className="h-8 w-8 text-black/25 dark:text-white/25" aria-hidden />
      <p className="text-sm text-black/50 dark:text-white/50">{title}</p>
      {action}
    </div>
  );
}
