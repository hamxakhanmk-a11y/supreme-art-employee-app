"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PageTabs from "../PageTabs";
import LogBookClient from "../logbook/LogBookClient";
import VehiclesClient from "./VehiclesClient";
import MonthlyReport from "./MonthlyReport";
import type { FleetMonth } from "@/lib/fleetMonthly";

type Tab = "logbook" | "vehicles" | "report";
type LogBookProps = React.ComponentProps<typeof LogBookClient>;
type VehiclesProps = React.ComponentProps<typeof VehiclesClient>;

// Station → Vehicles: the Log Book and the list of vehicles, one switch apart.
export default function VehiclesTabs({ tab: initialTab, drivers, monthly, ...logBook }: LogBookProps & {
  tab: Tab; drivers: VehiclesProps["drivers"]; monthly: FleetMonth;
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
    if (t !== "vehicles") router.refresh();
  };
  // Another vehicle or month of the Log Book.
  const openPage = (patch: { vehicle?: number; month?: string }) => {
    const p = new URLSearchParams(params.toString());
    p.set("tab", tab === "report" ? "report" : "logbook");
    p.set("vehicle", String(patch.vehicle ?? logBook.vehicleId));
    p.set("month", patch.month ?? logBook.month);
    router.push(`/station/vehicles?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="fade-up">
      <div className="no-print page-head">
        <h1>🚐 Vehicles</h1>
        <PageTabs<Tab> value={tab} onChange={showTab} tabs={[
          { key: "logbook", label: "📖 Log Book" },
          { key: "vehicles", label: "🚐 All vehicles", count: logBook.vehicles.filter(v => v.active).length || undefined },
          { key: "report", label: "📊 Monthly Report" },
        ]} />
        <span className="spacer" />
        {/* Which page of the book: vehicle and month, at the right of the title
            line rather than on a row of their own. */}
        {tab === "logbook" && logBook.vehicles.length > 0 && (
          <span className="head-filter">
            <select value={logBook.vehicleId} onChange={e => openPage({ vehicle: Number(e.target.value) })} style={{ minWidth: 180 }}>
              {logBook.vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNo}{v.name ? ` — ${v.name}` : ""}{v.active ? "" : " (retired)"}
                </option>
              ))}
            </select>
            <input type="month" value={logBook.month} onChange={e => e.target.value && openPage({ month: e.target.value })} />
          </span>
        )}
        {tab === "report" && (
          <span className="head-filter">
            Month
            <input type="month" value={logBook.month} onChange={e => e.target.value && openPage({ month: e.target.value })} />
          </span>
        )}
        <Link href="/station" className="btn btn-xs">🏭 Terminal</Link>
      </div>

      {tab === "logbook"
        ? <LogBookClient {...logBook} filtersInHead onAddVehicle={() => showTab("vehicles")} />
        : tab === "report"
          ? <MonthlyReport data={monthly} readOnly={logBook.readOnly} />
          : <VehiclesClient drivers={drivers} readOnly={logBook.readOnly} />}
    </div>
  );
}
