import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (user) return NextResponse.json({ authenticated: true, user });
  return NextResponse.json({ authenticated: false });
}
