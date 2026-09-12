import { NextResponse } from "next/server";
import { requireTier } from "@/lib/auth/requireTier";
import { buildScormPackage } from "@/lib/scorm/buildPackage";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/studio/courses/[courseId]/scorm">
) {
  await requireTier("PRO");
  const { courseId } = await ctx.params;

  // fetchCourseExportData() (inside buildScormPackage) goes through the
  // same RLS-scoped client as everywhere else in /studio -- a courseId
  // belonging to a different org resolves to "not found" here exactly the
  // way it does on the outline page, not a separate authorization check.
  const result = await buildScormPackage(courseId);

  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 422 });
  }

  return new NextResponse(new Uint8Array(result.zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="course-${courseId}-scorm12.zip"`,
      "X-Etvet-Warnings": encodeURIComponent(JSON.stringify(result.warnings)),
    },
  });
}
