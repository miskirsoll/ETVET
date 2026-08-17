"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "../login/actions";

type ActionState = { error?: string } | undefined;

export function SignupForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => signUp(formData),
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Organization name
        <input
          type="text"
          name="orgName"
          required
          className="rounded border border-black/10 px-3 py-2 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input
          type="text"
          name="displayName"
          className="rounded border border-black/10 px-3 py-2 dark:border-white/20"
        />
      </label>
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
          minLength={6}
          className="rounded border border-black/10 px-3 py-2 dark:border-white/20"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create organization"}
      </button>
      <p className="text-sm text-black/60 dark:text-white/60">
        Already have an account? <Link href="/login" className="underline">Sign in</Link>
      </p>
    </form>
  );
}
