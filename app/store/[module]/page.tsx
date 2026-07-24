import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { roleCanAccess } from "@/lib/permissions";
import StoreFrame from "../StoreFrame";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parts Store — Supreme Art" };

// /store/machinery  and  /store/consumables
// Anything else 404s so a stray URL can't silently pick the wrong module.
export default async function StoreModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (module !== "machinery" && module !== "consumables") notFound();

  const user = await getSession();
  if (!user) redirect(`/login?next=/store/${module}`);
  const allowed = await roleCanAccess(user.role, "store");
  if (!allowed) redirect("/");
  return <StoreFrame module={module} />;
}
