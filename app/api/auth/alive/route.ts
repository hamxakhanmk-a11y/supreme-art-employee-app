import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — is this browser still signed in? The open app asks every few seconds while it is on screen, so a person
// logged out from Admin → Users (or disabled) leaves the app without having to reload. Kept to the one session
// lookup; /api/auth/me also loads the role's permissions and is asked on focus.
export async function GET() {
  const user = await getSession();
  return user
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false }, { status: 401 });
}
