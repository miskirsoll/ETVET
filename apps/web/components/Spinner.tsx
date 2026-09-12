import { Loader2 } from "lucide-react";

/** Drop into a pending button alongside its label, e.g. {pending && <Spinner />} Saving… */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}
