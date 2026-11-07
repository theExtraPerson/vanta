import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Keeps the Supabase session alive between requests.
 *
 * @supabase/ssr stores the session in cookies that expire, so without a proxy
 * refresh the very next server render sees no user and the dashboard bounces
 * the visitor back to /login. This runs on every page request, refreshes the
 * tokens when needed and forwards the new cookies.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touching getUser() is what triggers the refresh + setAll above.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // every route except static assets and image optimisation
    "/((?!_next/static|_next/image|favicon.ico|brand/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
