import { NextResponse } from "next/server";
import { guardAuth } from "@/lib/auth";

// The store's user-management UI is deliberately disabled after the merge.
// Auth + user administration lives in the employee app. Return an empty
// list so the store's Users tab renders without errors; writes are 405.
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  return NextResponse.json([]);
}

export function POST()   { return NextResponse.json({ error: "Manage users in the main app." }, { status: 405 }); }
export function PUT()    { return NextResponse.json({ error: "Manage users in the main app." }, { status: 405 }); }
export function DELETE() { return NextResponse.json({ error: "Manage users in the main app." }, { status: 405 }); }
