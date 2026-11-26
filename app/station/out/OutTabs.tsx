"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageTabs from "../PageTabs";
import DeviceTripsPanel from "./DeviceTripsPanel";
import { useCanEdit } from "@/components/MeProvider";
import type { DeviceTripTicket } from "@/lib/deviceTripsServer";

type Tab = "out" | "report" | "device";

// Station → Who's Out: who is outside, the report of every trip, and the
// fingerprint device's mid-day trips waiting for review, one switch apart —
// the same way PSO Cards and Vehicles hold their views.
export default function OutTabs({ tab: initialTab, out, report }: {
  tab: Tab; out: React.ReactNode; report: React.ReactNode;
}) {
  const params = useSearchParams();
  const canEdit = useCanEdit("station");
  // Switching is instant; the address follows so a refresh or Back stays put.
  const [tab, setTab] = useState<Tab>(initialTab);
  const showTab = (t: Tab) => {
    setTab(t);
    const p = new URLSearchParams(params.toString());
    p.set("tab", t);
    window.history.replaceState(null, "", `/station/out?${p.toString()}`);
  };

  // Device trip tickets: loaded in the background so Who's Out itself isn't
  // slowed down, and so the tab can show how many are waiting.
  const [tickets, setTickets] = useState<DeviceTripTicket[] | null>(null);
  const [ticketsError, setTicketsError] = useState("");
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [reloads, setReloads] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/station/device-trips", { cache: "no-store" })
      .then(async res => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        return j.tickets as DeviceTripTicket[];
      })
      .then(t => { if (!cancelled) { setTickets(t); setTicketsError(""); } })
      .catch(e => { if (!cancelled) setTicketsError(e instanceof Error ? e.message : "Couldn't load device trips"); })
      .finally(() => { if (!cancelled) setTicketsLoading(false); });
    return () => { cancelled = true; };
  }, [reloads]);
  const pending = tickets?.filter(t => t.status === "pending" && t.kind !== "still-out").length ?? "";

  return (
    <div className="fade-up">
      <div className="no-print page-head">
        <h1>🚶 Who&apos;s Out</h1>
        <PageTabs<Tab> value={tab} onChange={showTab} tabs={[
          { key: "out", label: "🚶 Who's Out" },
          { key: "report", label: "📋 Report" },
          { key: "device", label: "☝ Device trips", count: pending },
        ]} />
        <span className="spacer" />
        <Link href="/station" className="btn btn-xs">🏭 Terminal</Link>
      </div>
      {tab === "out" ? out : tab === "report" ? report : (
        <DeviceTripsPanel tickets={tickets} error={ticketsError} loading={ticketsLoading} canEdit={canEdit}
          onChanged={() => { setTicketsLoading(true); setReloads(n => n + 1); }} />
      )}
    </div>
  );
}
