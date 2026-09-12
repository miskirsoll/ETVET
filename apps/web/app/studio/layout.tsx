import Link from "next/link";
import { requireAuthOrRedirect } from "@/lib/auth/requireTier";
import { signOut } from "@/app/login/actions";
import { TierBadge } from "@/components/TierBadge";

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
          <Link href="/studio" className="font-semibold">
            ETVET Studio
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/studio" className="hover:underline">
              Courses
            </Link>
            <Link href="/studio/themes" className="hover:underline">
              Themes
            </Link>
            <Link href="/studio/live" className="hover:underline">
              Live Sessions
            </Link>
            {session.appUser.role === "ORG_ADMIN" && (
              <Link href="/studio/team" className="hover:underline">
                Team
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-black/60 dark:text-white/60">{session.org.name}</span>
          <TierBadge tier={session.org.subscription_tier} />
          <Link href="/upgrade" className="hover:underline">
            Upgrade
          </Link>
          <form action={signOut}>
            <button type="submit" className="hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
