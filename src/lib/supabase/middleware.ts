import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on every request. Required by the
// @supabase/ssr cookie-based auth pattern — without this, sessions expire
// silently in Server Components (which can't write cookies themselves).
//
// Also propagates the current pathname as a request header (x-pathname) --
// Server Components have no other way to read the current URL, and
// src/app/layout.tsx needs it to know whether to redirect a not-yet-linked
// parent account away from a page other than /family/connect-student.
export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: Record<string, unknown>;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touches the session so an expired access token gets refreshed via the
  // refresh token before it's read anywhere else in the request.
  await supabase.auth.getUser();

  return response;
}
