import Link from "next/link";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { requireCourseAccess } from "@/lib/auth/requireCourseAccess";
import { createClient } from "@/lib/supabase/server";
import { getCourseOutline } from "@/app/c/[slug]/data";
import { flattenLessonOrder } from "@/lib/course/order";
import { completionRate, averageQuizScore, distinctLearnerCount } from "@/lib/analytics/compute";
import { pollCounts, wordCloudWeights, textResponses, quizLeaderboard } from "@/lib/live/aggregate";
import type {
  Block,
  InteractiveBlock,
  LearnerProgress,
  LiveResponse,
  LiveSession,
  LiveSlide,
  QaQuestion,
} from "@/lib/types/db";

export default async function CourseAnalyticsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await requireTierOrRedirect("MAXPRO");
  const { courseId } = await params;
  const course = await requireCourseAccess(courseId, session);
  const supabase = await createClient();

  const { sections, lessons } = await getCourseOutline(courseId);
  const ordered = flattenLessonOrder(sections, lessons);
  const lastLessonId = ordered.length ? ordered[ordered.length - 1].id : null;
  const quizLessonIds = new Set(lessons.filter((l) => l.type === "QUIZ").map((l) => l.id));
  const lessonsById = new Map(lessons.map((l) => [l.id, l]));

  const { data: progressRows } = await supabase
    .from("learner_progress")
    .select("*")
    .eq("course_id", courseId);
  const progress = (progressRows ?? []) as LearnerProgress[];

  const learners = distinctLearnerCount(progress);
  const rate = completionRate(progress, lastLessonId);
  const avgScore = averageQuizScore(progress, quizLessonIds);

  const lessonIds = lessons.map((l) => l.id);
  const { data: blocks } = lessonIds.length
    ? await supabase.from("blocks").select("*").in("lesson_id", lessonIds).eq("type", "interactive")
    : { data: [] as Block[] };
  const blocksById = new Map(((blocks ?? []) as Block[]).map((b) => [b.id, b]));

  const blockIds = [...blocksById.keys()];
  const { data: interactiveBlocks } = blockIds.length
    ? await supabase.from("interactive_blocks").select("*").in("block_id", blockIds)
    : { data: [] as InteractiveBlock[] };

  const sessionIds = [
    ...new Set(
      ((interactiveBlocks ?? []) as InteractiveBlock[])
        .map((ib) => ib.live_session_id)
        .filter((id): id is string => !!id)
    ),
  ];
  const { data: liveSessions } = sessionIds.length
    ? await supabase.from("live_sessions").select("*").in("id", sessionIds)
    : { data: [] as LiveSession[] };
  const sessionsById = new Map(((liveSessions ?? []) as LiveSession[]).map((s) => [s.id, s]));

  const { data: liveSlides } = sessionIds.length
    ? await supabase.from("live_slides").select("*").in("session_id", sessionIds).order("order")
    : { data: [] as LiveSlide[] };
  const slidesBySession = new Map<string, LiveSlide[]>();
  for (const slide of (liveSlides ?? []) as LiveSlide[]) {
    const list = slidesBySession.get(slide.session_id) ?? [];
    list.push(slide);
    slidesBySession.set(slide.session_id, list);
  }

  const slideIds = ((liveSlides ?? []) as LiveSlide[]).map((s) => s.id);
  const { data: liveResponses } = slideIds.length
    ? await supabase.from("live_responses").select("*").in("live_slide_id", slideIds)
    : { data: [] as LiveResponse[] };
  const responsesBySlide = new Map<string, LiveResponse[]>();
  for (const r of (liveResponses ?? []) as LiveResponse[]) {
    const list = responsesBySlide.get(r.live_slide_id) ?? [];
    list.push(r);
    responsesBySlide.set(r.live_slide_id, list);
  }

  // qa_board slides don't store answers as live_responses -- Q&A questions
  // live in their own table keyed by session_id, not by a specific slide
  // (see migration 0009_live_sessions.sql).
  const { data: qaQuestions } = sessionIds.length
    ? await supabase.from("qa_questions").select("*").in("session_id", sessionIds)
    : { data: [] as QaQuestion[] };
  const qaQuestionsBySession = new Map<string, QaQuestion[]>();
  for (const q of (qaQuestions ?? []) as QaQuestion[]) {
    const list = qaQuestionsBySession.get(q.session_id) ?? [];
    list.push(q);
    qaQuestionsBySession.set(q.session_id, list);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{course.title} — Analytics</h1>
        <Link href={`/studio/courses/${courseId}`} className="text-sm underline">
          Back to course
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Learners started" value={String(learners)} />
        <StatCard
          label="Completion rate"
          value={rate === null ? "—" : `${Math.round(rate * 100)}%`}
        />
        <StatCard
          label="Avg. quiz score"
          value={avgScore === null ? "—" : `${Math.round(avgScore)}%`}
        />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Interactive blocks (The Bridge)</h2>
        {blockIds.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            No interactive blocks in this course yet.
          </p>
        ) : (
          ((interactiveBlocks ?? []) as InteractiveBlock[]).map((ib) => {
            const block = blocksById.get(ib.block_id);
            const lesson = block ? lessonsById.get(block.lesson_id) : undefined;
            const session = ib.live_session_id ? sessionsById.get(ib.live_session_id) : undefined;
            const slides = ib.live_session_id ? slidesBySession.get(ib.live_session_id) ?? [] : [];

            return (
              <div key={ib.id} className="rounded border border-black/10 p-4 dark:border-white/10">
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="font-medium">{lesson?.title ?? "Untitled lesson"}</h3>
                  <span className="text-xs text-black/50 dark:text-white/50">
                    {ib.mode} · {session?.title ?? "no session linked"}
                  </span>
                </div>
                {slides.length === 0 ? (
                  <p className="text-sm text-black/50 dark:text-white/50">
                    No slides in the linked session.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {slides.map((slide) => (
                      <SlideSummary
                        key={slide.id}
                        slide={slide}
                        responses={responsesBySlide.get(slide.id) ?? []}
                        qaQuestions={
                          ib.live_session_id ? qaQuestionsBySession.get(ib.live_session_id) ?? [] : []
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-black/10 p-4 dark:border-white/10">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-black/50 dark:text-white/50">{label}</div>
    </div>
  );
}

function SlideSummary({
  slide,
  responses,
  qaQuestions,
}: {
  slide: LiveSlide;
  responses: LiveResponse[];
  qaQuestions: QaQuestion[];
}) {
  const prompt = String(slide.config.prompt ?? "");

  if (slide.type === "poll") {
    const options = (slide.config.options as string[] | undefined) ?? [];
    const counts = pollCounts(responses, options.length);
    const max = Math.max(1, ...counts);
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{prompt}</p>
        {options.map((option, i) => (
          <div key={i}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{option}</span>
              <span>{counts[i]}</span>
            </div>
            <div className="h-3 rounded bg-black/5 dark:bg-white/5">
              <div
                className="h-3 rounded bg-foreground"
                style={{ width: `${(counts[i] / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (slide.type === "word_cloud") {
    const weights = wordCloudWeights(responses);
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{prompt}</p>
        <div className="flex flex-wrap gap-2">
          {weights.length === 0 ? (
            <span className="text-xs text-black/50 dark:text-white/50">No responses yet.</span>
          ) : (
            weights.map(({ word, count }, i) => (
              <span key={i} className="rounded bg-black/5 px-2 py-1 text-sm dark:bg-white/5">
                {word} ({count})
              </span>
            ))
          )}
        </div>
      </div>
    );
  }

  if (slide.type === "open_ended") {
    const texts = textResponses(responses);
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{prompt}</p>
        {texts.length === 0 ? (
          <span className="text-xs text-black/50 dark:text-white/50">No responses yet.</span>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {texts.map((t, i) => (
              <li key={i} className="rounded bg-black/5 px-2 py-1 dark:bg-white/5">
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (slide.type === "quiz") {
    const leaderboard = quizLeaderboard(responses);
    const correct = responses.filter((r) => r.is_correct).length;
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{prompt}</p>
        <p className="text-xs text-black/50 dark:text-white/50">
          {responses.length} response{responses.length === 1 ? "" : "s"}, {correct} correct,{" "}
          {leaderboard.length} participant{leaderboard.length === 1 ? "" : "s"}
        </p>
      </div>
    );
  }

  // qa_board -- questions are per-session, not per-slide (see the
  // qa_questions fetch above), so a session with multiple qa_board slides
  // would show the same full list under each; only one qa_board slide per
  // session is expected in practice.
  const sorted = [...qaQuestions].sort((a, b) => b.upvotes - a.upvotes);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{prompt || "Q&A board"}</p>
      {sorted.length === 0 ? (
        <span className="text-xs text-black/50 dark:text-white/50">No questions yet.</span>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {sorted.map((q) => (
            <li
              key={q.id}
              className="flex items-center justify-between rounded bg-black/5 px-2 py-1 dark:bg-white/5"
            >
              <span>{q.text}</span>
              <span className="text-xs text-black/50 dark:text-white/50">▲ {q.upvotes}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
