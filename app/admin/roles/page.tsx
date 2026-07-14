import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import RolesClient from "./RolesClient";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "superadmin") redirect("/");
  return <RolesClient />;
}
