import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "sae_session";

const PUBLIC_PATHS = [
  "/login",
];

const PUBLIC_API_PREFIXES = [
  "/api/auth/google",   // start + callback (unauthenticated by nature)
  "/api/auth/logout",
  "/api/auth/me",
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some(p => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  // Cookie presence check only — real validation happens in route handlers / pages.
  const hasCookie = !!req.cookies.get(COOKIE_NAME)?.value;
  if (hasCookie) return NextResponse.next();

  // API requests: return 401 JSON
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Pages: redirect to /login?next=...
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Run on every route except static files and image optimisations
    "/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|css|js|map|woff|woff2|ttf)$).*)",
  ],
};
