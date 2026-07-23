import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { roleCanAccess } from "@/lib/permissions";
import StoreFrame from "./StoreFrame";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parts Store — Supreme Art" };

// The store UI is the ported parts-store.html served from /public/store/index.html.
// This wrapper enforces auth + module permission and hosts it in a full-width
// iframe so the vanilla-JS app doesn't have to be rewritten.
export default async function StorePage() {
  const user = await getSession();
  if (!user) redirect("/login?next=/store");
  const allowed = await roleCanAccess(user.role, "store");
  if (!allowed) redirect("/");
  return <StoreFrame />;
}
