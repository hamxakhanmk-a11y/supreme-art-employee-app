import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminUsersClient from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getSession();
  if (!user) redirect("/login?next=/admin/users");
  if (user.role !== "superadmin") redirect("/");
  return <AdminUsersClient currentUserId={user.id} />;
}
