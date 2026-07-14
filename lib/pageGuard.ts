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
