import { NextResponse } from "next/server";
import { guardAuth } from "@/lib/auth";

// The store's built-in activity feed is not migrated — the employee app has
// its own activity log at /reports/activity, and store actions are logged
// into it (see logActivity calls in the store API routes above).
//
// Return an empty list so the store UI's Activity tab doesn't error out.
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  return NextResponse.json([]);
}
