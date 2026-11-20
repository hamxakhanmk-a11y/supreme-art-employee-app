import { redirect } from "next/navigation";

export default function FinanceHome() {
  redirect("/finance/payables");
}
