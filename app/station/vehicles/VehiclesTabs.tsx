"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PageTabs from "../PageTabs";
import LogBookClient from "../logbook/LogBookClient";
import VehiclesClient from "./VehiclesClient";

type Tab = "logbook" | "vehicles";
type LogBookProps = React.ComponentProps<typeof LogBookClient>;
type VehiclesProps = React.ComponentProps<typeof VehiclesClient>;

// Station → Vehicles: the Log Book and the list of vehicles, one switch apart.
export default function VehiclesTabs({ tab: initialTab, drivers, ...logBook }: LogBookProps & {
  tab: Tab; drivers: VehiclesProps["drivers"];
}) {
  const router = useRouter();
  const params = useSearchParams();
  // Switching is instant; the address follows so a refresh or Back stays put.
  const [tab, setTab] = useState<Tab>(initialTab);
  const showTab = (t: Tab) => {
    setTab(t);
    const p = new URLSearchParams(params.toString());
    p.set("tab", t);
    window.history.replaceState(null, "", `/station/vehicles?${p.toString()}`);
    // A vehicle added or retired on the other tab belongs in the Log Book's
    // picker too.
    if (t === "logbook") router.refresh();
  };

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🚐 Vehicles</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Vehicles go out and come back at the Station terminal, on the vehicle&apos;s PIN.
          </p>
        </div>
        <Link href="/station" className="btn btn-sm">🏭 Terminal</Link>
      </div>

      <PageTabs<Tab> value={tab} onChange={showTab} tabs={[
        { key: "logbook", label: "📖 Log Book" },
        { key: "vehicles", label: "🚐 All vehicles", count: logBook.vehicles.filter(v => v.active).length || undefined },
      ]} />

      {tab === "logbook"
        ? <LogBookClient {...logBook} onAddVehicle={() => showTab("vehicles")} />
        : <VehiclesClient drivers={drivers} readOnly={logBook.readOnly} />}
    </div>
  );
}
