"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "./actions";

type ActionState = { error?: string } | undefined;

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => signIn(formData),
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          className="rounded border border-black/10 px-3 py-2 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          name="password"
          required
          className="rounded border border-black/10 px-3 py-2 dark:border-white/20"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-black/60 dark:text-white/60">
        No account? <Link href="/signup" className="underline">Create one</Link>
      </p>
    </form>
  );
}
