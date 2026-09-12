import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Checks and records a hit against a rate limit bucket (see migration
 * 0013_rate_limits.sql). Fails OPEN (returns true) on an infra error --
 * an abuse-mitigation check going down shouldn't itself take down the
 * feature it's protecting.
 */
export async function checkRateLimit(
  key: string,
  maxHits: number,
  windowSeconds: number
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });
  if (error) return true;
  return data === true;
}
