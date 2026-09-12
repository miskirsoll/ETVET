export type SubscriptionTier = "FREE" | "PRO" | "MAXPRO";

export type OrgRole =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "AUTHOR"
  | "TRAINER"
  | "LEARNER"
  | "REVIEWER";

export type LessonType = "BLOCK" | "QUIZ";
export type CourseStatus = "DRAFT" | "PUBLISHED";

export interface Organization {
  id: string;
  name: string;
  subscription_tier: SubscriptionTier;
  created_at: string;
}

export interface AppUser {
  id: string;
  org_id: string;
  role: OrgRole;
  display_name: string | null;
  created_at: string;
}

export interface OrgInvite {
  id: string;
  org_id: string;
  role: OrgRole;
  token: string;
  created_by: string | null;
  email: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
}

export interface ThemeColors {
  primary: string;
  background: string;
  text: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
}

export interface ThemeLayoutConfig {
  width: "narrow" | "wide";
  animations: boolean;
}

export interface Theme {
  id: string;
  org_id: string;
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  logo_url: string | null;
  layout_config: ThemeLayoutConfig;
  created_at: string;
}

export const DEFAULT_THEME_COLORS: ThemeColors = {
  primary: "#171717",
  background: "#ffffff",
  text: "#171717",
};

export const DEFAULT_THEME_FONTS: ThemeFonts = {
  heading: "system-ui, sans-serif",
  body: "system-ui, sans-serif",
};

export const DEFAULT_THEME_LAYOUT: ThemeLayoutConfig = {
  width: "narrow",
  animations: true,
};

export const FONT_CHOICES = [
  { label: "System UI", value: "system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Monospace", value: "ui-monospace, monospace" },
  { label: "Rounded", value: "'Trebuchet MS', sans-serif" },
];

export interface Course {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  cover_image_url: string | null;
  theme_id: string | null;
  nav_settings: { sidebar: "visible" | "hidden" | "off"; navigation: "free" | "sequential" };
  status: CourseStatus;
  publish_slug: string | null;
  publish_password: string | null;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  course_id: string;
  title: string;
  order: number;
}

export interface Lesson {
  id: string;
  section_id: string;
  type: LessonType;
  title: string;
  icon: string | null;
  order: number;
  pass_threshold: number;
  randomize_questions: boolean;
  draw_count: number | null;
  time_limit_seconds: number | null;
}

export type QuestionType =
  | "multiple_choice"
  | "multiple_response"
  | "true_false"
  | "fill_blank"
  | "matching";

export interface Question {
  id: string;
  lesson_id: string;
  type: QuestionType;
  order: number;
  prompt: string;
  config: Record<string, unknown>;
}

export interface QuestionChoice {
  id: string;
  question_id: string;
  order: number;
  text: string;
  is_correct: boolean;
  feedback: string | null;
}

export type BlockType =
  | "heading"
  | "text"
  | "statement"
  | "quote"
  | "list"
  | "image"
  | "video"
  | "audio"
  | "divider"
  | "continue"
  | "button"
  | "interactive";

export interface Block {
  id: string;
  lesson_id: string;
  type: BlockType;
  order: number;
  config: Record<string, unknown>;
  content: Record<string, unknown>;
}

export type ProgressStatus = "in_progress" | "completed" | "passed" | "failed";

export interface LearnerProgress {
  id: string;
  course_id: string;
  lesson_id: string | null;
  user_id: string | null;
  anon_token: string | null;
  status: ProgressStatus;
  score: number | null;
  time_spent_seconds: number;
  updated_at: string;
}

// ---------- Module B: Live Interactive Sessions (MAXPRO) ----------

export type LiveSessionStatus = "draft" | "live" | "ended";

// scale/ranking/100-point-allocation/reactions are deferred -- see
// PLANNING.md. Same config-jsonb pattern, no editor/player UI yet.
export type LiveSlideType = "poll" | "word_cloud" | "open_ended" | "quiz" | "qa_board";

export interface LiveSession {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  join_code: string;
  status: LiveSessionStatus;
  current_slide_id: string | null;
  locked: boolean;
  created_at: string;
}

export interface PollConfig {
  prompt: string;
  options: string[];
  multiple_response?: boolean;
}

export interface WordCloudConfig {
  prompt: string;
}

export interface OpenEndedConfig {
  prompt: string;
}

export interface QuizSlideConfig {
  prompt: string;
  options: string[];
  correct_index: number;
  time_limit_seconds: number;
}

export interface QaBoardConfig {
  prompt: string;
}

export type LiveSlideConfig = PollConfig | WordCloudConfig | OpenEndedConfig | QuizSlideConfig | QaBoardConfig;

export interface LiveSlide {
  id: string;
  session_id: string;
  type: LiveSlideType;
  order: number;
  config: Record<string, unknown>;
}

export interface LiveResponse {
  id: string;
  live_slide_id: string;
  participant_token: string;
  display_name: string | null;
  response: Record<string, unknown>;
  is_correct: boolean | null;
  response_time_ms: number | null;
  submitted_at: string;
}

export type QaQuestionStatus = "pending" | "approved" | "hidden" | "answered";

export interface QaQuestion {
  id: string;
  session_id: string;
  participant_token: string;
  display_name: string | null;
  text: string;
  upvotes: number;
  status: QaQuestionStatus;
  created_at: string;
}

// ---------- Module C: The Bridge (MAXPRO) ----------

export type InteractiveBlockMode = "sync" | "async";

export interface InteractiveBlock {
  id: string;
  block_id: string;
  live_session_id: string | null;
  mode: InteractiveBlockMode;
}
