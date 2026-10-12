import { requireModule } from "@/lib/pageGuard";

// PSO Cards — logbook, card list, top-ups — its own permission row.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModule("station.cards");
  return <>{children}</>;
}
