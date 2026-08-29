import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// A parent-signup account can't use the rest of the app until they've
// linked at least one student via OTP. This is ALSO checked in
// src/app/layout.tsx, but that check alone is not sufficient: Next.js App
// Router layouts are not re-executed on client-side <Link> navigations that
// keep the same layout, so a redirect living only in the root layout only
// fires on the very first full page load -- after that, a gated parent
// clicking "Home" in the nav sails right through, since the layout never
// re-runs. Middleware runs on every navigation, including client-side RSC
// fetches, so this is the one place the gate can't be skipped. The
// layout.tsx check is kept too, as a harmless backstop for the initial load.
//
// This can't query Prisma directly to check ParentStudentLink: middleware
// runs on the Edge runtime by default, and this project's installed
// Next.js version (15.5.23) does NOT actually register middleware at all
// when `export const config = { runtime: "nodejs" }` is set on
// src/middleware.ts, despite that being the documented syntax for the
// (blog-announced-stable-in-15.5) Node.js middleware runtime -- verified by
// reproducing an empty middleware-manifest.json in `next build` output with
// that config present (both with and without a Prisma import in this
// file), and a populated one with only that one config key removed. Rather
// than ship against a feature that doesn't actually work in this
// environment, this instead checks a denormalized boolean cached on the
// Supabase Auth user's app_metadata (edge-safe, no DB access needed) --
// src/app/api/family/parent-link/confirm/route.ts sets
// `hasLinkedStudent: true` there the moment a link is created, and
// src/app/api/family/link-objection/[token]/reject/route.ts clears it if a
// revocation leaves no non-revoked links -- mirroring how this codebase
// elsewhere already treats a VerificationRecord as a "synced cache" of
// StudentRecord.universityEmailVerifiedAt. Prisma-backed hasLinkedStudent()
// in src/lib/auth.ts remains the real source of truth for every other
// check (including the layout.tsx backstop); this is only a fast,
// edge-readable copy for this one gate.
// Kept in sync with src/app/layout.tsx's PARENT_LINK_GATE_EXEMPT_PATHS --
// see that file's comment for why /family/invite/accept is exempt too, not
// just /family/connect-student.
const PARENT_LINK_GATE_EXEMPT_PATHS = [
  "/family/connect-student",
  "/family/invite/accept",
];

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
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // API routes are exempt: they have their own auth checks, and this is the
  // exact mechanism a gated parent uses to link a student in the first
  // place (POST /api/family/parent-link/*) -- redirecting those would break
  // them, returning HTML instead of the JSON the client fetch() expects.
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api");

  // signedUpAsParent is set once, at account creation, from this same
  // user_metadata.persona field (see syncUserFromAuth in
  // src/lib/onboarding.ts) and nothing else ever writes to it afterward, so
  // it's a stable signal here too.
  const isSignedUpAsParent = authUser?.user_metadata?.persona === "parent";
  const hasLinkedStudentFlag = authUser?.app_metadata?.hasLinkedStudent === true;

  if (
    authUser &&
    isSignedUpAsParent &&
    !hasLinkedStudentFlag &&
    !isApiRoute &&
    !PARENT_LINK_GATE_EXEMPT_PATHS.includes(pathname)
  ) {
    const redirectResponse = NextResponse.redirect(
      new URL(PARENT_LINK_GATE_EXEMPT_PATHS[0], request.url),
    );
    // Carry over any refreshed session cookies set on `response` above --
    // otherwise a token refresh that happened on this same request would
    // be silently dropped by returning a fresh redirect response instead.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}
