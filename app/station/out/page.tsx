import { currentlyOut } from "@/lib/stationServer";
import WhoIsOutClient from "./WhoIsOutClient";

export const dynamic = "force-dynamic";

export default async function WhoIsOutPage() {
  const out = await currentlyOut();
  return <WhoIsOutClient initial={out} />;
}
