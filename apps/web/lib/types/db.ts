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
}

export type BlockType =
  | "heading"
  | "text"
  | "statement"
  | "quote"
  | "list"
  | "image"
  | "video"
  | "divider";

export interface Block {
  id: string;
  lesson_id: string;
  type: BlockType;
  order: number;
  config: Record<string, unknown>;
  content: Record<string, unknown>;
}
