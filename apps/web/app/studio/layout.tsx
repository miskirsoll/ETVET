import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireAuthOrRedirect } from "@/lib/auth/requireTier";
import { signOut } from "@/app/login/actions";
import { TierBadge } from "@/components/TierBadge";
import { Logo } from "@/components/Logo";
import { StudioNav } from "./StudioNav";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuthOrRedirect();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-3 dark:border-white/10">
        <div className="flex items-center gap-6">
          <Link href="/studio">
            <Logo />
          </Link>
          <StudioNav role={session.appUser.role} />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-black/60 dark:text-white/60">{session.org.name}</span>
          <TierBadge tier={session.org.subscription_tier} />
          <Link href="/upgrade" className="rounded px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
            Upgrade
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
