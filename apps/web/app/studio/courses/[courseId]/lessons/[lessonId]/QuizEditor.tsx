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
import type { Lesson, Question, QuestionChoice, QuestionType } from "@/lib/types/db";
import {
  createQuestion,
  updateQuestionPrompt,
  deleteQuestion,
  reorderQuestions,
  addChoice,
  updateChoice,
  setSingleCorrectChoice,
  deleteChoice,
  updateQuizSettings,
} from "@/app/studio/quiz-actions";

const QUESTION_TYPES: { type: QuestionType; label: string }[] = [
  { type: "multiple_choice", label: "Multiple choice" },
  { type: "multiple_response", label: "Multiple response" },
  { type: "true_false", label: "True / False" },
];

export function QuizEditor({
  lessonId,
  lesson,
  initialQuestions,
  initialChoices,
}: {
  lessonId: string;
  lesson: Lesson;
  initialQuestions: Question[];
  initialChoices: QuestionChoice[];
}) {
  const [questions, setQuestions] = useState(
    [...initialQuestions].sort((a, b) => a.order - b.order)
  );
  const [choicesByQuestion, setChoicesByQuestion] = useState<Record<string, QuestionChoice[]>>(
    () => {
      const map: Record<string, QuestionChoice[]> = {};
      for (const q of initialQuestions) map[q.id] = [];
      for (const c of initialChoices) {
        (map[c.question_id] ??= []).push(c);
      }
      for (const id in map) map[id].sort((a, b) => a.order - b.order);
      return map;
    }
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    const next = arrayMove(questions, oldIndex, newIndex);
    setQuestions(next);
    reorderQuestions(next.map((q) => q.id));
  }

  async function addQuestion(type: QuestionType) {
    const result = await createQuestion(lessonId, type);
    if (!result) return;
    setQuestions((prev) => [...prev, result.question]);
    setChoicesByQuestion((prev) => ({ ...prev, [result.question.id]: result.choices }));
  }

  async function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    await deleteQuestion(id);
  }

  function setChoicesFor(questionId: string, choices: QuestionChoice[]) {
    setChoicesByQuestion((prev) => ({ ...prev, [questionId]: choices }));
  }

  return (
    <div className="flex flex-col gap-6">
      <QuizSettingsPanel lessonId={lessonId} lesson={lesson} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-4">
            {questions.map((question, index) => (
              <SortableQuestion
                key={question.id}
                index={index}
                question={question}
                choices={choicesByQuestion[question.id] ?? []}
                onChoicesChange={(choices) => setChoicesFor(question.id, choices)}
                onDelete={() => removeQuestion(question.id)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {questions.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">
          No questions yet — add one below.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-black/10 pt-4 dark:border-white/10">
        {QUESTION_TYPES.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => addQuestion(type)}
            className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
          >
            + {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuizSettingsPanel({ lessonId, lesson }: { lessonId: string; lesson: Lesson }) {
  const [passThreshold, setPassThreshold] = useState(lesson.pass_threshold);
  const [randomize, setRandomize] = useState(lesson.randomize_questions);
  const [drawCount, setDrawCount] = useState(lesson.draw_count ?? 0);
  const [timeLimitMin, setTimeLimitMin] = useState(
    lesson.time_limit_seconds ? Math.round(lesson.time_limit_seconds / 60) : 0
  );

  function save(overrides: Partial<{
    pass_threshold: number;
    randomize_questions: boolean;
    draw_count: number | null;
    time_limit_seconds: number | null;
  }>) {
    updateQuizSettings(lessonId, {
      pass_threshold: passThreshold,
      randomize_questions: randomize,
      draw_count: randomize && drawCount > 0 ? drawCount : null,
      time_limit_seconds: timeLimitMin > 0 ? timeLimitMin * 60 : null,
      ...overrides,
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-4 rounded border border-black/10 p-4 text-sm dark:border-white/10">
      <label className="flex flex-col gap-1">
        Pass threshold (%)
        <input
          type="number"
          min={0}
          max={100}
          value={passThreshold}
          onChange={(e) => setPassThreshold(Number(e.target.value))}
          onBlur={() => save({ pass_threshold: passThreshold })}
          className="w-24 rounded border border-black/10 px-2 py-1 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1">
        Time limit (minutes, 0 = untimed)
        <input
          type="number"
          min={0}
          value={timeLimitMin}
          onChange={(e) => setTimeLimitMin(Number(e.target.value))}
          onBlur={() => save({ time_limit_seconds: timeLimitMin > 0 ? timeLimitMin * 60 : null })}
          className="w-24 rounded border border-black/10 px-2 py-1 dark:border-white/20"
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={randomize}
          onChange={(e) => {
            setRandomize(e.target.checked);
            save({ randomize_questions: e.target.checked });
          }}
        />
        Randomize + draw a subset per attempt
      </label>
      {randomize && (
        <label className="flex flex-col gap-1">
          Questions per attempt
          <input
            type="number"
            min={1}
            value={drawCount}
            onChange={(e) => setDrawCount(Number(e.target.value))}
            onBlur={() => save({ draw_count: drawCount > 0 ? drawCount : null })}
            className="w-24 rounded border border-black/10 px-2 py-1 dark:border-white/20"
          />
        </label>
      )}
    </div>
  );
}

function SortableQuestion({
  index,
  question,
  choices,
  onChoicesChange,
  onDelete,
}: {
  index: number;
  question: Question;
  choices: QuestionChoice[];
  onChoicesChange: (choices: QuestionChoice[]) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: question.id,
  });

  async function addOption() {
    const choice = await addChoice(question.id);
    if (choice) onChoicesChange([...choices, choice]);
  }

  function editChoiceText(id: string, text: string) {
    onChoicesChange(choices.map((c) => (c.id === id ? { ...c, text } : c)));
    updateChoice(id, { text });
  }

  function markCorrect(id: string) {
    if (question.type === "multiple_response") {
      const target = choices.find((c) => c.id === id);
      const next = !target?.is_correct;
      onChoicesChange(choices.map((c) => (c.id === id ? { ...c, is_correct: next } : c)));
      updateChoice(id, { is_correct: next });
    } else {
      onChoicesChange(choices.map((c) => ({ ...c, is_correct: c.id === id })));
      setSingleCorrectChoice(question.id, id);
    }
  }

  async function removeOption(id: string) {
    onChoicesChange(choices.filter((c) => c.id !== id));
    await deleteChoice(id);
  }

  const canEditChoiceText = question.type !== "true_false";
  const canAddChoices = question.type === "multiple_choice" || question.type === "multiple_response";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded border border-black/10 p-4 dark:border-white/10"
    >
      <div className="mb-3 flex items-center justify-between text-xs text-black/40 dark:text-white/40">
        <span {...attributes} {...listeners} className="cursor-grab uppercase tracking-wide">
          ⠿ Question {index + 1} — {question.type.replace("_", " ")}
        </span>
        <button onClick={onDelete} className="text-red-600 hover:underline">
          Delete
        </button>
      </div>

      <textarea
        className="mb-3 w-full rounded border border-black/10 px-3 py-2 text-sm dark:border-white/20 bg-transparent"
        rows={2}
        defaultValue={question.prompt}
        onBlur={(e) => updateQuestionPrompt(question.id, e.target.value)}
      />

      <ul className="flex flex-col gap-2">
        {choices.map((choice) => (
          <li key={choice.id} className="flex items-center gap-2 text-sm">
            <input
              type={question.type === "multiple_response" ? "checkbox" : "radio"}
              name={`question-${question.id}`}
              checked={choice.is_correct}
              onChange={() => markCorrect(choice.id)}
            />
            {canEditChoiceText ? (
              <input
                type="text"
                defaultValue={choice.text}
                onBlur={(e) => editChoiceText(choice.id, e.target.value)}
                className="flex-1 rounded border border-black/10 px-2 py-1 dark:border-white/20 bg-transparent"
              />
            ) : (
              <span className="flex-1">{choice.text}</span>
            )}
            {canAddChoices && (
              <button onClick={() => removeOption(choice.id)} className="text-red-600 hover:underline">
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {canAddChoices && (
        <button
          onClick={addOption}
          className="mt-2 rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
        >
          + Add option
        </button>
      )}
    </li>
  );
}
