import { NextRequest, NextResponse } from "next/server";
import { guardView, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { decideDeviceTrip, deviceTripTickets, TripDecisionError, type TripDecision } from "@/lib/deviceTripsServer";

export const dynamic = "force-dynamic";

// GET /api/station/device-trips -> { tickets: DeviceTripTicket[] }
// Mid-day trips found in the fingerprint device's punches over the last week,
// pending and decided, newest first.
export async function GET() {
  const guard = await guardView("station");
  if (guard instanceof NextResponse) return guard;
  try {
    return NextResponse.json({ tickets: await deviceTripTickets() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

const DECISIONS: TripDecision[] = ["personal", "official", "left", "dismiss", "reopen"];
const SUMMARY: Record<TripDecision, string> = {
  personal: "approved a fingerprint trip as Personal",
  official: "approved a fingerprint trip as Official",
  left: "marked a fingerprint trip as left for the day",
  dismiss: "dismissed a fingerprint trip (not a trip)",
  reopen: "reopened a fingerprint trip for review",
};

// POST /api/station/device-trips { id, decision, reason? }
// decision: personal | official (creates a Station trip) | left | dismiss | reopen
export async function POST(req: NextRequest) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json().catch(() => ({}));
    const id = parseInt(String(b.id), 10);
    const decision = b.decision as TripDecision;
    if (isNaN(id) || !DECISIONS.includes(decision)) {
      return NextResponse.json({ error: "id and decision (personal, official, left, dismiss, reopen) required" }, { status: 400 });
    }
    const reason = String(b.reason || "").trim().slice(0, 200) || null;
    const res = await decideDeviceTrip(id, decision, guard.name, reason);
    await logActivity({ user: guard, action: "station.device-trip", employeeId: res.ticket.employeeId, summary: `${SUMMARY[decision]} (${res.ticket.date})` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TripDecisionError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
