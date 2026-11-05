// Server-side page guard: redirect users who lack access to a module.
// Use at the top of a module's server page(s):  await requireModule("salary");
import { redirect } from "next/navigation";
import { getSession } from "./auth";
import { getPerm, type ModuleKey } from "./permissions";

export async function requireModule(moduleKey: ModuleKey) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "superadmin") return user;
  const perm = await getPerm(user.role);
  if (!perm.modules.includes(moduleKey)) redirect(`/?denied=${moduleKey}`);
  return user;
}

// Redirect unless the user can access at least one of the given modules.
// Used by container sections (e.g. Procurement) that hold several stages.
export async function requireAnyModule(keys: ModuleKey[], deniedKey = "procurement") {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "superadmin") return user;
  const perm = await getPerm(user.role);
  if (!keys.some(k => perm.modules.includes(k))) redirect(`/?denied=${deniedKey}`);
  return user;
}

// True when the signed-in role can't edit the given section. Used by pure-edit
// pages to render a read-only notice instead of the form.
export async function isViewOnly(moduleKey: ModuleKey): Promise<boolean> {
  const user = await getSession();
  if (!user) return false;              // unauthenticated → other guards handle it
  if (user.role === "superadmin") return false;
  const perm = await getPerm(user.role);
  return !(perm.editModules ?? []).includes(moduleKey);
}

// What the signed-in user may see and edit, for a page that shows some parts only to some roles
// (a tab, a view, a column). The Super Admin sees and edits everything.
export async function grantsOf(): Promise<{ see: (k: ModuleKey) => boolean; edit: (k: ModuleKey) => boolean }> {
  const user = await getSession();
  if (!user) return { see: () => false, edit: () => false };
  if (user.role === "superadmin") return { see: () => true, edit: () => true };
  const perm = await getPerm(user.role);
  const edits = perm.editModules ?? [];
  return { see: k => perm.modules.includes(k), edit: k => perm.modules.includes(k) && edits.includes(k) };
}
