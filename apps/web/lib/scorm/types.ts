import type { BlockType, LessonType, QuestionType } from "@/lib/types/db";

export interface ExportChoice {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface ExportQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  choices: ExportChoice[];
}

export interface ExportBlock {
  id: string;
  type: BlockType;
  content: Record<string, unknown>;
}

export interface ExportLesson {
  id: string;
  type: LessonType;
  title: string;
  blocks: ExportBlock[];
  questions: ExportQuestion[];
  pass_threshold: number;
  randomize_questions: boolean;
  draw_count: number | null;
  time_limit_seconds: number | null;
}

export interface ExportSection {
  id: string;
  title: string;
  lessons: ExportLesson[];
}

export interface CourseExportData {
  id: string;
  title: string;
  sections: ExportSection[];
}

export interface ScormBuildResult {
  ok: true;
  zip: Buffer;
  warnings: string[];
}

export interface ScormBuildError {
  ok: false;
  errors: string[];
}
