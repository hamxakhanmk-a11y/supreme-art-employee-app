import { fleetMonth } from "@/lib/fleetMonthly";
import { isViewOnly } from "@/lib/pageGuard";
import { karachiNow } from "@/lib/gateTime";
import MonthlyClient from "./MonthlyClient";
import { getSession } from "@/lib/auth";
import { roleCanAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type SP = { month?: string };

// Station → Monthly Report: the fleet sheet the office signs each month
// (Fleet Management — Log Book Details), one row per vehicle.
export default async function MonthlyPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  // Karachi's month: on the server's UTC clock the 1st doesn't start until 5am.
  const month = /^\d{4}-\d{2}$/.test(sp.month || "") ? sp.month! : karachiNow().date.slice(0, 7);
  const [data, readOnly, user] = await Promise.all([fleetMonth(month), isViewOnly("station.monthly"), getSession()]);
  // Consumption links into PSO Cards — only for those who can open it.
  const canOpenCards = !!user && await roleCanAccess(user.role, "station.cards");
  return <MonthlyClient data={data} readOnly={readOnly} canOpenCards={canOpenCards} />;
}
