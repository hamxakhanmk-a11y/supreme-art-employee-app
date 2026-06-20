import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, destroySession, clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
