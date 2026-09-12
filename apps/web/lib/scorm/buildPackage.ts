import "server-only";
import JSZip from "jszip";
import { fetchCourseExportData } from "./fetchCourseExportData";
import { embedAssets } from "./assets";
import { generateManifest } from "./manifest";
import { generateIndexHtml, generateStylesCss, generatePlayerJs } from "./player";
import { generateScormApiJs } from "./scormApiAdapter";
import { generateSuspendDataJs } from "./suspendData";
import { validateManifest } from "./validate";
import type { ScormBuildError, ScormBuildResult } from "./types";

export async function buildScormPackage(courseId: string): Promise<ScormBuildResult | ScormBuildError> {
  const courseData = await fetchCourseExportData(courseId);
  if (!courseData) return { ok: false, errors: ["Course not found."] };

  const totalLessons = courseData.sections.reduce((n, s) => n + s.lessons.length, 0);
  if (totalLessons === 0) {
    return { ok: false, errors: ["This course has no lessons yet -- nothing to export."] };
  }

  const { data: withEmbeddedAssets, files: assetFiles, warnings } = await embedAssets(courseData);

  const runtimeFiles: Record<string, string> = {
    "index.html": generateIndexHtml(withEmbeddedAssets),
    "styles.css": generateStylesCss(),
    "scorm-api.js": generateScormApiJs(),
    "suspend-data.js": generateSuspendDataJs(),
    "player.js": generatePlayerJs(),
  };

  const allFileNames = [...Object.keys(runtimeFiles), ...Object.keys(assetFiles)];
  const manifestXml = generateManifest(courseId, courseData.title, allFileNames);

  const manifestErrors = validateManifest(manifestXml, new Set(allFileNames));
  if (manifestErrors.length > 0) {
    return { ok: false, errors: manifestErrors };
  }

  const zip = new JSZip();
  zip.file("imsmanifest.xml", manifestXml);
  for (const [name, content] of Object.entries(runtimeFiles)) {
    zip.file(name, content);
  }
  for (const [name, buffer] of Object.entries(assetFiles)) {
    zip.file(name, buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { ok: true, zip: zipBuffer, warnings };
}
