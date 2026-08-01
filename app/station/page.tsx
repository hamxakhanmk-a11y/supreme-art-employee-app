import StationClient from "./StationClient";
import { isViewOnly } from "@/lib/pageGuard";
import { ViewOnlyNotice } from "@/components/MeProvider";

export const dynamic = "force-dynamic";

export default async function StationPage() {
  if (await isViewOnly("station")) return <ViewOnlyNotice />;
  return <StationClient />;
}
