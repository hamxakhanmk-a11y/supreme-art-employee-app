import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, destroySession, clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Leaving tells the browser to wipe what this site keeps on that computer - its cookies, saved data (the screens'
// remembered filters, etc.) and saved copies of pages - so nothing of the app is left behind on a shared PC.
// Chrome's history list itself can't be touched by any website.
const CLEAR = { "Clear-Site-Data": '"cache", "cookies", "storage"', "Cache-Control": "no-store" };

// POST — sign out (the Sign out button).
export async function POST() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();
  return NextResponse.json({ ok: true }, { headers: CLEAR });
}

// GET ?reason=signed_out&next=/page — where an open page goes when it finds it has been signed out (logged out
// from Admin → Users, or disabled): the site's data is wiped, then on to the login, which brings them back to
// the page after signing in again.
export async function GET(req: NextRequest) {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();
  const reason = req.nextUrl.searchParams.get("reason") === "signed_out" ? "signed_out" : "";
  const nextRaw = req.nextUrl.searchParams.get("next") || "/";
  // Only a page of this app (not "//elsewhere").
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";
  const to = "/login?" + new URLSearchParams({ ...(reason ? { error: reason } : {}), next }).toString();
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signed out</title>
<meta http-equiv="refresh" content="0;url=${to.replace(/"/g, "&quot;")}"></head>
<body style="font-family:sans-serif;color:#555;padding:40px">Signing out…<script>location.replace(${JSON.stringify(to)})</script></body></html>`;
  return new NextResponse(html, { headers: { ...CLEAR, "Content-Type": "text/html; charset=utf-8" } });
}
