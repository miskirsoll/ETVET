"use client";

import { useActionState } from "react";
import { Spinner } from "@/components/Spinner";
import { verifyCoursePassword } from "@/app/c/actions";

type ActionState = { error?: string } | undefined;

export function PasswordForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => verifyCoursePassword(slug, formData),
    undefined
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-xl font-semibold">This course is password-protected</h1>
      <form action={action} className="flex flex-col gap-3">
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
          className="flex items-center justify-center gap-1.5 rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {pending && <Spinner />}
          {pending ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
