import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPerm } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Land on the first stage the role can access.
export default async function ProcurementHome() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "superadmin") redirect("/procurement/demand");
  const perm = await getPerm(user.role);
  if (perm.modules.includes("demand")) redirect("/procurement/demand");
  if (perm.modules.includes("po")) redirect("/procurement/po");
  if (perm.modules.includes("grn")) redirect("/procurement/grn");
  redirect("/");
}
