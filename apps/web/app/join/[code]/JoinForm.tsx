"use client";

import { useActionState } from "react";
import { joinSession } from "../actions";

type ActionState = { error?: string } | undefined;

export function JoinForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => joinSession(code, formData),
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Display name (optional — leave blank to stay anonymous)
        <input
          type="text"
          name="displayName"
          maxLength={60}
          className="rounded border border-black/10 px-3 py-2 dark:border-white/20"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {pending ? "Joining…" : "Join session"}
      </button>
    </form>
  );
}
