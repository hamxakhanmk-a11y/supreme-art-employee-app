"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageTabs from "../PageTabs";

type Tab = "out" | "report";

// Station → Who's Out: who is outside, and the report of every trip, one
// switch apart — the same way PSO Cards and Vehicles hold their views.
export default function OutTabs({ tab: initialTab, out, report }: {
  tab: Tab; out: React.ReactNode; report: React.ReactNode;
}) {
  const params = useSearchParams();
  // Switching is instant; the address follows so a refresh or Back stays put.
  const [tab, setTab] = useState<Tab>(initialTab);
  const showTab = (t: Tab) => {
    setTab(t);
    const p = new URLSearchParams(params.toString());
    p.set("tab", t);
    window.history.replaceState(null, "", `/station/out?${p.toString()}`);
  };

  return (
    <div className="fade-up">
      <div className="no-print page-head">
        <h1>🚶 Who&apos;s Out</h1>
        <PageTabs<Tab> value={tab} onChange={showTab} tabs={[
          { key: "out", label: "🚶 Who's Out" },
          { key: "report", label: "📋 Report" },
        ]} />
        <span className="spacer" />
        <Link href="/station" className="btn btn-xs">🏭 Terminal</Link>
      </div>
      {tab === "out" ? out : report}
    </div>
  );
}
