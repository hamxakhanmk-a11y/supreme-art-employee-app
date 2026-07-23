import { redirect } from "next/navigation";

// Landing on /store just picks a default module — the actual UI lives at
// /store/machinery and /store/consumables.
export default function StoreRootPage() {
  redirect("/store/machinery");
}
