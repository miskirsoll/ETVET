import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/studio");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold">ETVET</h1>
      <p className="text-lg text-black/70 dark:text-white/70">
        Author self-paced courses and run live interactive sessions, from one
        login, one dashboard, one platform.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded bg-foreground px-5 py-2.5 text-background"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded border border-black/15 px-5 py-2.5 dark:border-white/20"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
