import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPerm } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ authenticated: false });
  const perm = await getPerm(user.role);
  return NextResponse.json({
    authenticated: true,
    user,
    modules: perm.modules,
    canEdit: perm.canEdit,
  });
}
