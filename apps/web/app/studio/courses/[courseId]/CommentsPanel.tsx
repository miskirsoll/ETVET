"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, MessageSquare, RotateCcw, Send, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { Spinner } from "@/components/Spinner";
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
      {comments.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No feedback yet." />
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`rounded border border-black/10 p-3 text-sm shadow-sm dark:border-white/10 ${
                c.resolved ? "opacity-50" : ""
              }`}
            >
              <div className="mb-2 flex items-center justify-between text-xs text-black/50 dark:text-white/50">
                <span className="flex items-center gap-2">
                  <Avatar name={c.authorName} />
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
                    className="flex items-center gap-1 underline disabled:opacity-50"
                  >
                    {c.resolved ? (
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    )}
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
                      className="flex items-center gap-1 text-red-600 underline disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
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
          className="flex items-center gap-1.5 rounded bg-brand px-4 py-2 text-sm text-brand-foreground disabled:opacity-50"
        >
          {pending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />}
          Post
        </button>
      </form>
    </section>
  );
}
