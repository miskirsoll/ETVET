import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-brand-text hover:underline dark:text-white/60"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      {children}
    </Link>
  );
}
