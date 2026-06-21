import { NextResponse } from "next/server";
import { getSession, countUsers } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (user) {
    return NextResponse.json({ authenticated: true, needsSetup: false, user, emailConfigured: isEmailConfigured() });
  }
  const total = await countUsers();
  return NextResponse.json({ authenticated: false, needsSetup: total === 0, emailConfigured: isEmailConfigured() });
}
