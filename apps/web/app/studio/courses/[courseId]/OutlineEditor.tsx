"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import type { Lesson, Section } from "@/lib/types/db";
import {
  createSection,
  deleteSection,
  reorderSections,
  createLesson,
  deleteLesson,
  reorderLessons,
} from "@/app/studio/actions";

export function OutlineEditor({
  courseId,
  initialSections,
  initialLessons,
}: {
  courseId: string;
  initialSections: Section[];
  initialLessons: Lesson[];
}) {
  const [sections, setSections] = useState(initialSections);
  const [lessons, setLessons] = useState(initialLessons);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function refresh() {
    startTransition(() => router.refresh());
  }

  function onSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const next = arrayMove(sections, oldIndex, newIndex);
    setSections(next);
    reorderSections(courseId, next.map((s) => s.id)).then(refresh);
  }

  async function addSection() {
    if (!newSectionTitle.trim()) return;
    await createSection(courseId, newSectionTitle.trim());
    setNewSectionTitle("");
    refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-3">
            {sections.map((section) => (
              <SortableSection
                key={section.id}
                courseId={courseId}
                section={section}
                lessons={lessons
                  .filter((l) => l.section_id === section.id)
                  .sort((a, b) => a.order - b.order)}
                onLessonsChange={(next) =>
                  setLessons((prev) => [...prev.filter((l) => l.section_id !== section.id), ...next])
                }
                refresh={refresh}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="flex gap-2">
        <input
          type="text"
          value={newSectionTitle}
          onChange={(e) => setNewSectionTitle(e.target.value)}
          placeholder="New section title"
          className="flex-1 rounded border border-black/10 px-3 py-2 text-sm dark:border-white/20"
        />
        <button
          onClick={addSection}
          className="rounded bg-foreground px-4 py-2 text-sm text-background"
        >
          Add section
        </button>
      </div>
    </div>
  );
}

function SortableSection({
  courseId,
  section,
  lessons,
  onLessonsChange,
  refresh,
}: {
  courseId: string;
  section: Section;
  lessons: Lesson[];
  onLessonsChange: (lessons: Lesson[]) => void;
  refresh: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: section.id,
  });
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onLessonDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);
    const next = arrayMove(lessons, oldIndex, newIndex);
    onLessonsChange(next);
    reorderLessons(courseId, next.map((l) => l.id)).then(refresh);
  }

  async function addLesson(type: "BLOCK" | "QUIZ") {
    if (!newLessonTitle.trim()) return;
    await createLesson(courseId, section.id, newLessonTitle.trim(), type);
    setNewLessonTitle("");
    refresh();
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded border border-black/10 p-4 dark:border-white/10"
    >
      <div className="flex items-center justify-between">
        <button {...attributes} {...listeners} className="cursor-grab font-medium">
          ⠿ {section.title}
        </button>
        <button
          onClick={() => deleteSection(courseId, section.id).then(refresh)}
          className="text-sm text-red-600 hover:underline"
        >
          Delete section
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onLessonDragEnd}
      >
        <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <ul className="mt-3 flex flex-col gap-2 pl-4">
            {lessons.map((lesson) => (
              <SortableLesson
                key={lesson.id}
                courseId={courseId}
                lesson={lesson}
                refresh={refresh}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="mt-3 flex gap-2 pl-4">
        <input
          type="text"
          value={newLessonTitle}
          onChange={(e) => setNewLessonTitle(e.target.value)}
          placeholder="New lesson title"
          className="flex-1 rounded border border-black/10 px-3 py-1.5 text-sm dark:border-white/20"
        />
        <button
          onClick={() => addLesson("BLOCK")}
          className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
        >
          + Block lesson
        </button>
        <button
          onClick={() => addLesson("QUIZ")}
          className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
        >
          + Quiz lesson
        </button>
      </div>
    </li>
  );
}

function SortableLesson({
  courseId,
  lesson,
  refresh,
}: {
  courseId: string;
  lesson: Lesson;
  refresh: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: lesson.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center justify-between rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10"
    >
      <div className="flex items-center gap-2">
        <span {...attributes} {...listeners} className="cursor-grab">
          ⠿
        </span>
        <Link href={`/studio/courses/${courseId}/lessons/${lesson.id}`} className="hover:underline">
          {lesson.title}
        </Link>
        <span className="text-xs text-black/40 dark:text-white/40">{lesson.type}</span>
      </div>
      <button
        onClick={() => deleteLesson(courseId, lesson.id).then(refresh)}
        className="text-red-600 hover:underline"
      >
        Delete
      </button>
    </li>
  );
}
