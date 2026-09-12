"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Block, BlockType } from "@/lib/types/db";
import { createBlock, deleteBlock, reorderBlocks, updateBlockContent } from "@/app/studio/actions";

const BLOCK_TYPES: { type: BlockType; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "statement", label: "Statement" },
  { type: "quote", label: "Quote" },
  { type: "list", label: "List" },
  { type: "image", label: "Image" },
  { type: "video", label: "Video" },
  { type: "divider", label: "Divider" },
  { type: "continue", label: "Continue" },
  { type: "button", label: "Button" },
];

export interface CourseLessonRef {
  id: string;
  title: string;
}

export function BlockEditor({
  lessonId,
  initialBlocks,
  courseLessons,
}: {
  lessonId: string;
  initialBlocks: Block[];
  courseLessons: CourseLessonRef[];
}) {
  const [blocks, setBlocks] = useState(
    [...initialBlocks].sort((a, b) => a.order - b.order)
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
    if (block) setBlocks((prev) => [...prev, block]);
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
                onChange={(content) => updateBlock(block.id, content)}
                onDelete={() => removeBlock(block.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {blocks.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">
          No blocks yet — add one below.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-black/10 pt-4 dark:border-white/10">
        {BLOCK_TYPES.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => addBlock(type)}
            className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
          >
            + {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SortableBlock({
  block,
  courseLessons,
  onChange,
  onDelete,
}: {
  block: Block;
  courseLessons: CourseLessonRef[];
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
      className="rounded border border-black/10 p-4 dark:border-white/10"
    >
      <div className="mb-2 flex items-center justify-between text-xs text-black/40 dark:text-white/40">
        <span {...attributes} {...listeners} className="cursor-grab uppercase tracking-wide">
          ⠿ {block.type}
        </span>
        <button onClick={onDelete} className="text-red-600 hover:underline">
          Delete
        </button>
      </div>
      <BlockFields block={block} courseLessons={courseLessons} onChange={onChange} />
    </li>
  );
}

function BlockFields({
  block,
  courseLessons,
  onChange,
}: {
  block: Block;
  courseLessons: CourseLessonRef[];
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
    case "image":
      return (
        <div className="flex flex-col gap-2">
          <input
            className={inputClass}
            placeholder="Image URL"
            defaultValue={String(block.content.url ?? "")}
            onBlur={(e) => onChange({ ...block.content, url: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Alt text"
            defaultValue={String(block.content.alt ?? "")}
            onBlur={(e) => onChange({ ...block.content, alt: e.target.value })}
          />
        </div>
      );
    case "video":
      return (
        <input
          className={inputClass}
          placeholder="Video URL or embed link (e.g. YouTube)"
          defaultValue={String(block.content.url ?? "")}
          onBlur={(e) => onChange({ ...block.content, url: e.target.value })}
        />
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
