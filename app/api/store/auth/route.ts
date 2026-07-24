import { NextRequest, NextResponse } from "next/server";
import { getSession, type Role } from "@/lib/auth";

// Compatibility shim for the ported store HTML.
// The store's original vanilla-JS UI expects its own /api/auth endpoint to
// tell it who the current user is. Here we translate the employee-app session
// into the shape the store UI expects, so the store screens boot without
// showing their built-in login page.
//
// Login/logout/set-password/setup/change-password etc. are no-ops here —
// authentication is handled by the employee app.

// Map an employee-app role onto the store app's role vocabulary.
// The store recognises: 'admin' (full incl. users), 'machinery', 'consumables',
// 'ceo' (read-only-ish). Superadmins/admins/hr act as store admins; ceo stays
// ceo; anything else falls back to 'machinery' with default read access.
function toStoreRole(role: Role): "admin" | "machinery" | "consumables" | "ceo" {
  if (role === "ceo") return "ceo";
  if (role === "superadmin" || role === "admin" || role === "hr") return "admin";
  return "machinery";
}

async function meResponse() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ authenticated: false, needsSetup: false, emailConfigured: false });
  }
  return NextResponse.json({
    authenticated: true,
    emailConfigured: false,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: toStoreRole(user.role),
    },
  });
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "me";
  if (action === "me") return meResponse();
  if (action === "set-password") {
    // Store's set-password token-check endpoint. Not applicable here.
    return NextResponse.json({ valid: false, reason: "Not supported — set your password in the main app." });
  }
  return NextResponse.json({ error: "Not supported in the merged app. Use the main app for auth." }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "";
  if (action === "logout") {
    // Don't tear down the shared employee-app session on a store-tab logout —
    // the user might still have the main app open. Just answer OK so the store
    // UI clears its local state; a real sign-out happens from the top nav.
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({
    error: "Authentication is handled by the main app. Please sign in there.",
  }, { status: 400 });
}
