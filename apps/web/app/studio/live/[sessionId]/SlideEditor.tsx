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
import type { LiveSlide, LiveSlideType } from "@/lib/types/db";
import { createSlide, updateSlideConfig, deleteSlide, reorderSlides } from "../actions";

const SLIDE_TYPES: { type: LiveSlideType; label: string }[] = [
  { type: "poll", label: "Poll" },
  { type: "word_cloud", label: "Word Cloud" },
  { type: "open_ended", label: "Open-ended" },
  { type: "quiz", label: "Quiz" },
  { type: "qa_board", label: "Q&A Board" },
];

export function SlideEditor({
  sessionId,
  initialSlides,
}: {
  sessionId: string;
  initialSlides: LiveSlide[];
}) {
  const [slides, setSlides] = useState([...initialSlides].sort((a, b) => a.order - b.order));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    const next = arrayMove(slides, oldIndex, newIndex);
    setSlides(next);
    reorderSlides(next.map((s) => s.id));
  }

  async function addSlide(type: LiveSlideType) {
    const slide = await createSlide(sessionId, type);
    if (slide) setSlides((prev) => [...prev, slide]);
  }

  function updateSlide(id: string, config: Record<string, unknown>) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, config } : s)));
    updateSlideConfig(id, config);
  }

  async function removeSlide(id: string) {
    setSlides((prev) => prev.filter((s) => s.id !== id));
    await deleteSlide(id);
  }

  return (
    <div className="flex flex-col gap-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-3">
            {slides.map((slide, index) => (
              <SortableSlide
                key={slide.id}
                index={index}
                slide={slide}
                onChange={(config) => updateSlide(slide.id, config)}
                onDelete={() => removeSlide(slide.id)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {slides.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">No slides yet — add one below.</p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-black/10 pt-4 dark:border-white/10">
        {SLIDE_TYPES.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => addSlide(type)}
            className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
          >
            + {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SortableSlide({
  index,
  slide,
  onChange,
  onDelete,
}: {
  index: number;
  slide: LiveSlide;
  onChange: (config: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: slide.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded border border-black/10 p-4 dark:border-white/10"
    >
      <div className="mb-3 flex items-center justify-between text-xs text-black/40 dark:text-white/40">
        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label={`Drag to reorder slide ${index + 1}`}
          className="cursor-grab bg-transparent p-0 uppercase tracking-wide"
        >
          ⠿ Slide {index + 1} — {slide.type.replace("_", " ")}
        </button>
        <button onClick={onDelete} className="text-red-600 hover:underline">
          Delete
        </button>
      </div>
      <SlideFields slide={slide} onChange={onChange} />
    </li>
  );
}

function SlideFields({
  slide,
  onChange,
}: {
  slide: LiveSlide;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const inputClass = "w-full rounded border border-black/10 px-3 py-2 text-sm dark:border-white/20 bg-transparent";

  const prompt = (
    <textarea
      className={inputClass}
      rows={2}
      placeholder="Prompt"
      key={`prompt-${slide.id}`}
      defaultValue={String(slide.config.prompt ?? "")}
      onBlur={(e) => onChange({ ...slide.config, prompt: e.target.value })}
    />
  );

  switch (slide.type) {
    case "word_cloud":
    case "open_ended":
    case "qa_board":
      return <div className="flex flex-col gap-2">{prompt}</div>;
    case "poll":
      return (
        <div className="flex flex-col gap-2">
          {prompt}
          <textarea
            className={inputClass}
            rows={3}
            placeholder="One option per line"
            defaultValue={((slide.config.options as string[] | undefined) ?? []).join("\n")}
            onBlur={(e) =>
              onChange({
                ...slide.config,
                options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!slide.config.multiple_response}
              onChange={(e) => onChange({ ...slide.config, multiple_response: e.target.checked })}
            />
            Allow multiple choices per participant
          </label>
        </div>
      );
    case "quiz": {
      const options = (slide.config.options as string[] | undefined) ?? [];
      return (
        <div className="flex flex-col gap-2">
          {prompt}
          <textarea
            className={inputClass}
            rows={3}
            placeholder="One option per line"
            defaultValue={options.join("\n")}
            onBlur={(e) => {
              const next = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
              onChange({ ...slide.config, options: next });
            }}
          />
          <label className="flex items-center gap-2 text-xs">
            Correct option (index from 0)
            <input
              type="number"
              min={0}
              className="w-16 rounded border border-black/10 px-2 py-1 dark:border-white/20"
              defaultValue={Number(slide.config.correct_index ?? 0)}
              onBlur={(e) => onChange({ ...slide.config, correct_index: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            Time limit (seconds)
            <input
              type="number"
              min={5}
              className="w-16 rounded border border-black/10 px-2 py-1 dark:border-white/20"
              defaultValue={Number(slide.config.time_limit_seconds ?? 20)}
              onBlur={(e) => onChange({ ...slide.config, time_limit_seconds: Number(e.target.value) })}
            />
          </label>
        </div>
      );
    }
    default:
      return null;
  }
}
