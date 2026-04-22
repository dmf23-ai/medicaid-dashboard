import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Gatekeeper for the National Medicaid Intelligence Dashboard.
 *
 * Every non-static request passes through here. Visitors without a valid
 * session cookie are redirected to /login with a `next` param so they bounce
 * back to their intended page after signing in.
 *
 * Next.js 16: this file replaces the legacy `middleware.ts` convention.
 * Proxy defaults to the Node.js runtime, so Node's built-in crypto works here.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isAuthenticated = verifySessionToken(token);

  // Always allow the auth endpoints — they need to run even when logged out
  // so the login form can post to them.
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // If the visitor is already signed in, bounce them away from /login so they
  // don't see the prompt again.
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (isAuthenticated) {
    return NextResponse.next();
  }

  // Not authenticated → send to /login, preserving the intended path.
  const loginUrl = new URL("/login", req.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", pathname + search);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on every request except Next.js internals and static files.
  // Auth API routes are handled inside the proxy function above.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|woff|woff2|ttf|otf)$).*)",
  ],
};
