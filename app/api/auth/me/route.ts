import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, getSession } from "@/lib/auth";
import { getPerm } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) {
    // stale: this browser still holds a sign-in that has been ended (logged out from Admin -> Users, disabled or
    // removed) - the login page then sends it through /api/auth/logout to wipe what the app left on that computer.
    const stale = !!(await cookies()).get(COOKIE_NAME)?.value;
    return NextResponse.json({ authenticated: false, ...(stale ? { stale: true } : {}) });
  }
  const perm = await getPerm(user.role);
  return NextResponse.json({
    authenticated: true,
    user,
    modules: perm.modules,
    editModules: perm.editModules ?? [],
    canEdit: perm.canEdit,
  });
}
