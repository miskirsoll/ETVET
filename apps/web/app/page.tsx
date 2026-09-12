import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, GraduationCap } from "lucide-react";
import { getSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/studio");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-sm">
        <GraduationCap className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="text-4xl font-bold">ETVET</h1>
      <p className="text-lg text-black/70 dark:text-white/70">
        Author self-paced courses and run live interactive sessions, from one
        login, one dashboard, one platform.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="flex items-center gap-1.5 rounded bg-brand px-5 py-2.5 text-brand-foreground shadow-sm transition-shadow hover:shadow-md"
        >
          Get started
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link
          href="/login"
          className="rounded border border-black/15 px-5 py-2.5 transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
