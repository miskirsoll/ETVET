import type { Block } from "@/lib/types/db";

export function BlockView({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-6">
      {[...blocks]
        .sort((a, b) => a.order - b.order)
        .map((block) => (
          <div key={block.id}>{renderBlock(block)}</div>
        ))}
    </div>
  );
}

function renderBlock(block: Block) {
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
    default:
      return null;
  }
}
