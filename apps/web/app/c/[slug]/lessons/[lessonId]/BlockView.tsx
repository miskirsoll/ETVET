"use client";

import { useState } from "react";
import type { Block, Theme } from "@/lib/types/db";

/** Splits into runs that end right after (and include) each 'continue' block. */
function splitIntoSegments(blocks: Block[]): Block[][] {
  const segments: Block[][] = [[]];
  for (const block of blocks) {
    segments[segments.length - 1].push(block);
    if (block.type === "continue") segments.push([]);
  }
  return segments.filter((s) => s.length > 0);
}

export function BlockView({
  blocks,
  slug,
  nextHref,
  theme,
}: {
  blocks: Block[];
  slug: string;
  nextHref: string | null;
  theme?: Theme | null;
}) {
  const segments = splitIntoSegments([...blocks].sort((a, b) => a.order - b.order));
  const [revealedCount, setRevealedCount] = useState(1);
  const visible = segments.slice(0, revealedCount).flatMap((segment, segmentIndex) =>
    segment.map((block) => ({ block, segmentIndex }))
  );
  const animate = theme ? theme.layout_config.animations : true;
  const accentColor = theme?.colors.primary;

  return (
    <div className="flex flex-col gap-6">
      {visible.map(({ block, segmentIndex }) => (
        <div key={block.id} className={animate ? "etvet-animate-in" : undefined}>
          {renderBlock(block, slug, nextHref, accentColor, () =>
            setRevealedCount((c) => Math.max(c, segmentIndex + 2))
          )}
        </div>
      ))}
    </div>
  );
}

function renderBlock(
  block: Block,
  slug: string,
  nextHref: string | null,
  accentColor: string | undefined,
  onContinue: () => void
) {
  switch (block.type) {
    case "heading":
      return <h2 className="text-xl font-semibold">{String(block.content.text ?? "")}</h2>;
    case "text":
      return <p className="whitespace-pre-wrap">{String(block.content.text ?? "")}</p>;
    case "statement":
      return (
        <p className="rounded bg-black/5 p-4 text-lg font-medium dark:bg-white/5">
          {String(block.content.text ?? "")}
        </p>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-black/20 pl-4 italic dark:border-white/20">
          <p>{String(block.content.text ?? "")}</p>
          {!!block.content.attribution && (
            <footer className="mt-1 text-sm text-black/50 dark:text-white/50">
              — {String(block.content.attribution)}
            </footer>
          )}
        </blockquote>
      );
    case "list":
      return (
        <ul className="list-disc space-y-1 pl-5">
          {((block.content.items as string[] | undefined) ?? []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "image":
      return block.content.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={String(block.content.url)}
          alt={String(block.content.alt ?? "")}
          className="max-w-full rounded"
        />
      ) : null;
    case "video":
      return block.content.url ? (
        <div className="aspect-video w-full overflow-hidden rounded">
          <iframe
            src={String(block.content.url)}
            className="h-full w-full"
            allowFullScreen
            title="Video"
          />
        </div>
      ) : null;
    case "divider":
      return <hr className="border-black/10 dark:border-white/10" />;
    case "continue":
      return (
        <button
          onClick={onContinue}
          className="rounded bg-foreground px-5 py-2.5 text-sm text-background"
          style={accentColor ? { backgroundColor: accentColor } : undefined}
        >
          {String(block.content.label ?? "Continue")}
        </button>
      );
    case "button": {
      const label = String(block.content.label ?? "Next");
      const targetType = String(block.content.target_type ?? "next");
      let href: string | null = null;
      if (targetType === "next") href = nextHref;
      else if (targetType === "lesson" && block.content.lesson_id)
        href = `/c/${slug}/lessons/${block.content.lesson_id}`;
      else if (targetType === "url" && block.content.url) href = String(block.content.url);

      if (!href) return null;
      const isExternal = targetType === "url";
      return (
        <a
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noreferrer" : undefined}
          className="inline-block rounded border border-black/15 px-5 py-2.5 text-sm dark:border-white/20"
          style={accentColor ? { borderColor: accentColor, color: accentColor } : undefined}
        >
          {label}
        </a>
      );
    }
    default:
      return null;
  }
}
