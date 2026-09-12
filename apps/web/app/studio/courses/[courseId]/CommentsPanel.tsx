"use client";

import { useState, useTransition } from "react";
import type { CommentWithAuthor } from "@/lib/comments/data";
import { addComment, resolveComment, deleteComment } from "./comments-actions";

export function CommentsPanel({
  courseId,
  comments,
  currentUserId,
}: {
  courseId: string;
  comments: CommentWithAuthor[];
  currentUserId: string;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Feedback</h2>
      <ul className="flex flex-col gap-2">
        {comments.length === 0 && (
          <li className="text-sm text-black/50 dark:text-white/50">No feedback yet.</li>
        )}
        {comments.map((c) => (
          <li
            key={c.id}
            className={`rounded border border-black/10 p-3 text-sm dark:border-white/10 ${
              c.resolved ? "opacity-50" : ""
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-xs text-black/50 dark:text-white/50">
              <span>
                {c.authorName} · {new Date(c.created_at).toLocaleString()}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await resolveComment(c.id, courseId, !c.resolved);
                    })
                  }
                  className="underline disabled:opacity-50"
                >
                  {c.resolved ? "Reopen" : "Mark resolved"}
                </button>
                {c.author_id === currentUserId && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteComment(c.id, courseId);
                      })
                    }
                    className="text-red-600 underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            <p className="whitespace-pre-wrap">{c.text}</p>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = text.trim();
          if (!trimmed) return;
          startTransition(async () => {
            await addComment(courseId, trimmed);
            setText("");
          });
        }}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Leave feedback…"
          className="flex-1 rounded border border-black/10 px-3 py-2 text-sm dark:border-white/20"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          Post
        </button>
      </form>
    </section>
  );
}
