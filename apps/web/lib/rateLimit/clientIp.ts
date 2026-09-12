import "server-only";
import { headers } from "next/headers";

/** Best-effort caller IP from the proxy chain -- good enough to key a rate
 *  limit bucket, not something to trust for authorization decisions. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
