"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { Play, Presentation, RotateCcw, Square } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import type { LiveSession } from "@/lib/types/db";
import { startSession, endSession } from "../actions";

const STATUS_STYLES: Record<LiveSession["status"], string> = {
  live: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  draft: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60",
  ended: "bg-black/5 text-black/40 dark:bg-white/5 dark:text-white/40",
};

export function SessionControls({ session }: { session: LiveSession }) {
  const [pending, startTransition] = useTransition();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const router = useRouter();

  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join/${session.join_code}` : "";

  useEffect(() => {
    if (session.status !== "live" || !joinUrl) return;
    QRCode.toDataURL(joinUrl, { width: 160 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [session.status, joinUrl]);

  return (
    <div className="flex flex-col gap-4 rounded border border-black/10 p-4 shadow-sm dark:border-white/10">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          Status:
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[session.status]}`}>
            {session.status}
          </span>
        </span>
        <div className="flex gap-2">
          {session.status !== "live" && (
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await startSession(session.id);
                  router.refresh();
                })
              }
              className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-sm text-brand-foreground disabled:opacity-50"
            >
              {pending ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : session.status === "ended" ? (
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden />
              )}
              {session.status === "ended" ? "Restart" : "Start session"}
            </button>
          )}
          {session.status === "live" && (
            <>
              <Link
                href={`/studio/live/${session.id}/present`}
                className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-sm text-brand-foreground"
              >
                <Presentation className="h-3.5 w-3.5" aria-hidden />
                Present
              </Link>
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await endSession(session.id);
                    router.refresh();
                  })
                }
                className="flex items-center gap-1.5 rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
              >
                {pending ? <Spinner className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" aria-hidden />}
                End session
              </button>
            </>
          )}
        </div>
      </div>

      {session.status === "live" && (
        <div className="flex items-center gap-4 text-sm">
          <div>
            <p className="text-black/60 dark:text-white/60">Join code</p>
            <p className="text-2xl font-bold tracking-widest">{session.join_code}</p>
            <p className="mt-1 text-black/60 dark:text-white/60">{joinUrl}</p>
          </div>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR code to join" className="h-24 w-24" />
          )}
        </div>
      )}
    </div>
  );
}
