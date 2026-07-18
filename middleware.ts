import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Auth.js session cookie names (Edge-safe — no next-auth/jose imports). */
function hasSessionCookie(req: NextRequest): boolean {
  return Boolean(
    req.cookies.get("authjs.session-token")?.value ||
      req.cookies.get("__Secure-authjs.session-token")?.value ||
      req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value,
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoggedIn = hasSessionCookie(req);
  const isAuthPage = pathname.startsWith("/login");
  const isPublicApi =
    pathname.startsWith("/api/sync") || pathname.startsWith("/api/auth");

  if (isPublicApi) {
    return NextResponse.next();
  }

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
