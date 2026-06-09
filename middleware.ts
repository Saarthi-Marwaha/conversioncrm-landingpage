import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { DEV_BYPASS_AUTH } from "@/lib/flags";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Routes that require authentication
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");

  // Auth pages — redirect logged-in users away
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  // DEV: skip the login gate so the dashboard is reachable without auth
  if (!user && isProtected && !DEV_BYPASS_AUTH) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - Public API routes: /api/events, /api/widget (widget embed)
     * - Static file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|api/events|api/widget|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
