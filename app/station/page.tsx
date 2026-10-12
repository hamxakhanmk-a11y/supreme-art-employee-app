import { redirect } from "next/navigation";
import StationClient from "./StationClient";
import { isViewOnly } from "@/lib/pageGuard";
import { getSession } from "@/lib/auth";
import { getPerm } from "@/lib/permissions";
import { ViewOnlyNotice } from "@/components/MeProvider";

export const dynamic = "force-dynamic";

// The gate terminal (Station). A role that has only the office sections —
// Vehicles, PSO Cards, the Monthly Report — lands on the first of those.
const OFFICE_PAGES = [
  ["station.vehicles", "/station/vehicles"],
  ["station.cards", "/station/pso"],
  ["station.monthly", "/station/monthly"],
] as const;

export default async function StationPage() {
  const user = await getSession();
  if (user && user.role !== "superadmin") {
    const { modules } = await getPerm(user.role);
    if (!modules.includes("station")) {
      const next = OFFICE_PAGES.find(([key]) => modules.includes(key));
      redirect(next ? next[1] : "/?denied=station");
    }
  }
  if (await isViewOnly("station")) return <ViewOnlyNotice />;
  return <StationClient />;
}
