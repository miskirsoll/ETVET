"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { GripVertical, Layers, Lock, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { Block, BlockType, InteractiveBlock, LiveSession, SubscriptionTier } from "@/lib/types/db";
import {
  createBlock,
  deleteBlock,
  reorderBlocks,
  updateBlockContent,
  setInteractiveBlockConfig,
} from "@/app/studio/actions";
import { FileUpload } from "@/components/FileUpload";

const BLOCK_TYPES: { type: BlockType; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "statement", label: "Statement" },
  { type: "quote", label: "Quote" },
  { type: "list", label: "List" },
  { type: "image", label: "Image" },
  { type: "video", label: "Video" },
  { type: "audio", label: "Audio" },
  { type: "divider", label: "Divider" },
  { type: "continue", label: "Continue" },
  { type: "button", label: "Button" },
  { type: "interactive", label: "Interactive" },
];

export interface CourseLessonRef {
  id: string;
  title: string;
}

export function BlockEditor({
  lessonId,
  initialBlocks,
  courseLessons,
  orgId,
  tier,
  liveSessions,
  interactiveBlocksByBlockId,
}: {
  lessonId: string;
  initialBlocks: Block[];
  courseLessons: CourseLessonRef[];
  orgId: string;
  tier: SubscriptionTier;
  liveSessions: LiveSession[];
  interactiveBlocksByBlockId: Record<string, InteractiveBlock>;
}) {
  const [blocks, setBlocks] = useState(
    [...initialBlocks].sort((a, b) => a.order - b.order)
  );
  const [interactiveBlocks, setInteractiveBlocks] = useState(interactiveBlocksByBlockId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    const next = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(next);
    reorderBlocks(next.map((b) => b.id));
  }

  async function addBlock(type: BlockType) {
    const block = await createBlock(lessonId, type);
    if (!block) return;
    setBlocks((prev) => [...prev, block]);
    if (type === "interactive") {
      setInteractiveBlocks((prev) => ({
        ...prev,
        [block.id]: { id: "", block_id: block.id, live_session_id: null, mode: "async" },
      }));
    }
  }

  function updateBlock(id: string, content: Block["content"]) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
    updateBlockContent(id, content);
  }

  async function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    await deleteBlock(id);
  }

  return (
    <div className="flex flex-col gap-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-3">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                courseLessons={courseLessons}
                orgId={orgId}
                liveSessions={liveSessions}
                interactiveBlock={interactiveBlocks[block.id]}
                onChange={(content) => updateBlock(block.id, content)}
                onDelete={() => removeBlock(block.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {blocks.length === 0 && (
        <EmptyState icon={Layers} title="No blocks yet — add one below." />
      )}

      <div className="flex flex-wrap gap-2 border-t border-black/10 pt-4 dark:border-white/10">
        {BLOCK_TYPES.map(({ type, label }) =>
          type === "interactive" && tier !== "MAXPRO" ? (
            <Link
              key={type}
              href="/upgrade?required=MAXPRO"
              className="flex items-center gap-1.5 rounded border border-black/15 px-3 py-1.5 text-sm text-black/40 dark:border-white/20 dark:text-white/40"
              title="Interactive blocks require MAXPRO"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden />
              {label}
            </Link>
          ) : (
            <button
              key={type}
              onClick={() => addBlock(type)}
              className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
            >
              + {label}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function SortableBlock({
  block,
  courseLessons,
  orgId,
  liveSessions,
  interactiveBlock,
  onChange,
  onDelete,
}: {
  block: Block;
  courseLessons: CourseLessonRef[];
  orgId: string;
  liveSessions: LiveSession[];
  interactiveBlock: InteractiveBlock | undefined;
  onChange: (content: Block["content"]) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: block.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded border border-black/10 p-4 shadow-sm dark:border-white/10"
    >
      <div className="mb-2 flex items-center justify-between text-xs text-black/40 dark:text-white/40">
        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label={`Drag to reorder block: ${block.type}`}
          className="flex cursor-grab items-center gap-1.5 bg-transparent p-0 uppercase tracking-wide"
        >
          <GripVertical className="h-4 w-4" aria-hidden />
          {block.type}
        </button>
        <button onClick={onDelete} className="flex items-center gap-1 text-red-600 hover:underline">
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Delete
        </button>
      </div>
      {block.type === "interactive" ? (
        <InteractiveBlockFields
          blockId={block.id}
          liveSessions={liveSessions}
          interactiveBlock={interactiveBlock}
        />
      ) : (
        <BlockFields block={block} courseLessons={courseLessons} orgId={orgId} onChange={onChange} />
      )}
    </li>
  );
}

function InteractiveBlockFields({
  blockId,
  liveSessions,
  interactiveBlock,
}: {
  blockId: string;
  liveSessions: LiveSession[];
  interactiveBlock: InteractiveBlock | undefined;
}) {
  const [liveSessionId, setLiveSessionId] = useState(interactiveBlock?.live_session_id ?? "");
  const [mode, setMode] = useState<"sync" | "async">(interactiveBlock?.mode ?? "async");

  function save(next: { live_session_id: string | null; mode: "sync" | "async" }) {
    setInteractiveBlockConfig(blockId, next);
  }

  const inputClass = "w-full rounded border border-black/10 px-3 py-2 text-sm dark:border-white/20 bg-transparent";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-black/50 dark:text-white/50">
        Links this block to a Live Session. <strong>Sync</strong>: acts as a join point into a
        live, presenter-run session. <strong>Async</strong>: shows the session&apos;s first slide
        directly on the page, self-paced, with a running aggregate — no presenter needed.
      </p>
      <select
        className={inputClass}
        value={liveSessionId}
        onChange={(e) => {
          setLiveSessionId(e.target.value);
          save({ live_session_id: e.target.value || null, mode });
        }}
      >
        <option value="">Choose a live session…</option>
        {liveSessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title} ({s.status})
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={mode}
        onChange={(e) => {
          const nextMode = e.target.value as "sync" | "async";
          setMode(nextMode);
          save({ live_session_id: liveSessionId || null, mode: nextMode });
        }}
      >
        <option value="async">Async (self-paced, always open)</option>
        <option value="sync">Sync (join point into a live session)</option>
      </select>
      {liveSessions.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          No live sessions yet — create one under Live Sessions first.
        </p>
      )}
    </div>
  );
}

function BlockFields({
  block,
  courseLessons,
  orgId,
  onChange,
}: {
  block: Block;
  courseLessons: CourseLessonRef[];
  orgId: string;
  onChange: (content: Block["content"]) => void;
}) {
  const inputClass =
    "w-full rounded border border-black/10 px-3 py-2 text-sm dark:border-white/20 bg-transparent";

  switch (block.type) {
    case "heading":
    case "text":
    case "statement":
      return (
        <textarea
          className={inputClass}
          rows={block.type === "text" ? 4 : 2}
          defaultValue={String(block.content.text ?? "")}
          onBlur={(e) => onChange({ ...block.content, text: e.target.value })}
        />
      );
    case "quote":
      return (
        <div className="flex flex-col gap-2">
          <textarea
            className={inputClass}
            rows={2}
            defaultValue={String(block.content.text ?? "")}
            onBlur={(e) => onChange({ ...block.content, text: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Attribution"
            defaultValue={String(block.content.attribution ?? "")}
            onBlur={(e) => onChange({ ...block.content, attribution: e.target.value })}
          />
        </div>
      );
    case "list":
      return (
        <textarea
          className={inputClass}
          rows={4}
          placeholder="One item per line"
          defaultValue={((block.content.items as string[] | undefined) ?? []).join("\n")}
          onBlur={(e) =>
            onChange({
              ...block.content,
              items: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
            })
          }
        />
      );
    case "image": {
      const decorative = Boolean(block.content.decorative);
      return (
        <div className="flex flex-col gap-2">
          <input
            className={inputClass}
            placeholder="Image URL"
            key={String(block.content.url ?? "")}
            defaultValue={String(block.content.url ?? "")}
            onBlur={(e) => onChange({ ...block.content, url: e.target.value })}
          />
          <FileUpload
            orgId={orgId}
            accept="image/*"
            label="Upload image"
            onUploaded={(url) => onChange({ ...block.content, url })}
          />
          {!decorative && (
            <input
              className={inputClass}
              placeholder="Alt text"
              defaultValue={String(block.content.alt ?? "")}
              onBlur={(e) => onChange({ ...block.content, alt: e.target.value })}
            />
          )}
          <label className="flex items-center gap-2 text-xs text-black/60 dark:text-white/60">
            <input
              type="checkbox"
              checked={decorative}
              onChange={(e) =>
                onChange({
                  ...block.content,
                  decorative: e.target.checked,
                  alt: e.target.checked ? "" : block.content.alt,
                })
              }
            />
            Decorative image (purely visual — screen readers will skip it instead of
            reading empty/missing alt text)
          </label>
        </div>
      );
    }
    case "video":
      return (
        <div className="flex flex-col gap-2">
          <input
            className={inputClass}
            placeholder="Video URL or embed link (e.g. YouTube)"
            key={String(block.content.url ?? "")}
            defaultValue={String(block.content.url ?? "")}
            onBlur={(e) => onChange({ ...block.content, url: e.target.value })}
          />
          <FileUpload
            orgId={orgId}
            accept="video/*"
            label="Upload video file"
            onUploaded={(url) => onChange({ ...block.content, url })}
          />
          <textarea
            className={inputClass}
            placeholder="Transcript (shown as text below the video, for anyone who can't watch/hear it)"
            rows={3}
            defaultValue={String(block.content.transcript ?? "")}
            onBlur={(e) => onChange({ ...block.content, transcript: e.target.value })}
          />
        </div>
      );
    case "audio":
      return (
        <div className="flex flex-col gap-2">
          <input
            className={inputClass}
            placeholder="Audio file URL (e.g. hosted mp3)"
            key={String(block.content.url ?? "")}
            defaultValue={String(block.content.url ?? "")}
            onBlur={(e) => onChange({ ...block.content, url: e.target.value })}
          />
          <FileUpload
            orgId={orgId}
            accept="audio/*"
            label="Upload audio file"
            onUploaded={(url) => onChange({ ...block.content, url })}
          />
          <textarea
            className={inputClass}
            placeholder="Transcript (shown as text below the player, for anyone who can't listen)"
            rows={3}
            defaultValue={String(block.content.transcript ?? "")}
            onBlur={(e) => onChange({ ...block.content, transcript: e.target.value })}
          />
        </div>
      );
    case "divider":
      return <hr className="border-black/10 dark:border-white/10" />;
    case "continue":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-black/50 dark:text-white/50">
            Learners won&apos;t see anything below this block until they click it.
          </p>
          <input
            className={inputClass}
            placeholder="Button label"
            defaultValue={String(block.content.label ?? "Continue")}
            onBlur={(e) => onChange({ ...block.content, label: e.target.value })}
          />
        </div>
      );
    case "button": {
      const targetType = String(block.content.target_type ?? "next");
      return (
        <div className="flex flex-col gap-2">
          <input
            className={inputClass}
            placeholder="Button label"
            defaultValue={String(block.content.label ?? "Next")}
            onBlur={(e) => onChange({ ...block.content, label: e.target.value })}
          />
          <select
            className={inputClass}
            value={targetType}
            onChange={(e) => onChange({ ...block.content, target_type: e.target.value })}
          >
            <option value="next">Go to next lesson</option>
            <option value="lesson">Jump to a specific lesson</option>
            <option value="url">Open a URL</option>
          </select>
          {targetType === "lesson" && (
            <select
              className={inputClass}
              value={String(block.content.lesson_id ?? "")}
              onChange={(e) => onChange({ ...block.content, lesson_id: e.target.value })}
            >
              <option value="">Choose a lesson…</option>
              {courseLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          )}
          {targetType === "url" && (
            <input
              className={inputClass}
              placeholder="https://…"
              defaultValue={String(block.content.url ?? "")}
              onBlur={(e) => onChange({ ...block.content, url: e.target.value })}
            />
          )}
        </div>
      );
    }
    default:
      return null;
  }
}
