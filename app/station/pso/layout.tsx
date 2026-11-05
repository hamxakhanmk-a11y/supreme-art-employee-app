import { requireAnyModule } from "@/lib/pageGuard";

// PSO Cards — Cards Logbook, All cards, Top-ups, each its own permission row; any one opens the page.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAnyModule(["station.cards", "station.cardlist", "station.topups"], "station.cards");
  return <>{children}</>;
}
