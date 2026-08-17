import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server Component / Server Action / Route Handler client. Reads and, where
 * possible, refreshes the auth cookie. `cookies()` is async under this
 * Next.js version (16), unlike the 14/15 APIs most Supabase examples show.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render (not an action/route
            // handler) — cookies() rejects writes there. The proxy.ts
            // session refresh covers this case instead.
          }
        },
      },
    }
  );
}
