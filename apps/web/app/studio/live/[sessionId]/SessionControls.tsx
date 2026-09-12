"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import type { LiveSession } from "@/lib/types/db";
import { startSession, endSession } from "../actions";

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
    <div className="flex flex-col gap-4 rounded border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Status: {session.status}</span>
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
              className="rounded bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
            >
              {session.status === "ended" ? "Restart" : "Start session"}
            </button>
          )}
          {session.status === "live" && (
            <>
              <Link
                href={`/studio/live/${session.id}/present`}
                className="rounded bg-foreground px-3 py-1.5 text-sm text-background"
              >
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
                className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
              >
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
