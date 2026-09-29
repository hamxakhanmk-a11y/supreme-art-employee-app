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
  // The store is a static file in public/, so a browser can go on serving the
  // copy it already has — an iframe especially — and a deploy that changed it
  // looks like a deploy that did nothing. Stamping the commit into the URL
  // makes every deploy a new address, which no cache can answer from memory.
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || "dev";
  return <StoreFrame module={module} version={version} />;
}
