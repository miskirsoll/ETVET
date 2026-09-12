import { GraduationCap } from "lucide-react";

export function Logo({ label = "ETVET Studio" }: { label?: string }) {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="flex h-6 w-6 items-center justify-center rounded bg-brand text-brand-foreground">
        <GraduationCap className="h-4 w-4" aria-hidden />
      </span>
      {label}
    </span>
  );
}
