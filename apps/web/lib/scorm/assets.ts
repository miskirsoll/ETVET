import "server-only";
import { createHash } from "crypto";
import type { CourseExportData } from "./types";

const DIRECT_FILE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".mp4",
  ".webm",
  ".mov",
];

function looksLikeDirectFile(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return DIRECT_FILE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Best-effort: for the spec's "fully self-contained, works offline" goal,
 * SCORM can only truly embed a direct file link (an uploaded image/audio/
 * video). A third-party embed URL (a YouTube/Vimeo iframe link, for
 * example) has no downloadable file at all -- there's nothing to embed --
 * so those are left as external links and reported as a warning rather
 * than silently pretending they're bundled.
 */
export async function embedAssets(
  data: CourseExportData
): Promise<{ data: CourseExportData; files: Record<string, Buffer>; warnings: string[] }> {
  const files: Record<string, Buffer> = {};
  const warnings: string[] = [];
  const urlToLocalPath = new Map<string, string | null>();

  async function resolve(url: string): Promise<string | null> {
    if (urlToLocalPath.has(url)) return urlToLocalPath.get(url) ?? null;

    if (!looksLikeDirectFile(url)) {
      warnings.push(
        `Asset not embedded (not a direct file link, likely an embed such as YouTube): ${url}`
      );
      urlToLocalPath.set(url, null);
      return null;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        warnings.push(`Asset not embedded (fetch failed with ${response.status}): ${url}`);
        urlToLocalPath.set(url, null);
        return null;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = new URL(url).pathname.split(".").pop() ?? "bin";
      const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
      const localPath = `assets/${hash}.${ext}`;
      files[localPath] = buffer;
      urlToLocalPath.set(url, localPath);
      return localPath;
    } catch (error) {
      warnings.push(
        `Asset not embedded (network error: ${error instanceof Error ? error.message : String(error)}): ${url}`
      );
      urlToLocalPath.set(url, null);
      return null;
    }
  }

  for (const section of data.sections) {
    for (const lesson of section.lessons) {
      for (const block of lesson.blocks) {
        if (block.type !== "image" && block.type !== "audio" && block.type !== "video") continue;
        const url = block.content.url;
        if (typeof url !== "string" || !url) continue;
        const localPath = await resolve(url);
        if (localPath) block.content = { ...block.content, url: localPath };
      }
    }
  }

  return { data, files, warnings };
}
