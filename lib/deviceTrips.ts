// Finds mid-day trips in one person's fingerprint punches: someone at work who
// punches before TRIP_CUTOFF on the day they arrived is stepping out, and their
// next punch brings them back. Each one becomes a ticket on Station → Who's Out
// for an admin to mark Personal or Official; only then is it a Station trip and
// counted in the register. Pure (no db).
//
// - A punch at or after TRIP_CUTOFF is going home, not a trip.
// - Sunday (the off day) and night shifts (first IN at or after
//   NIGHT_SHIFT_FROM) have no trips.
// - The return closes the trip whatever its time; the Station rule then counts
//   minutes only up to the shift end (16:45).
// - No return that day: "no-return" once the day is over (the admin can mark it
//   Left for the day), "still-out" while it isn't.
import { isNightShift, karachiDate, karachiHHMM, type Move } from "@/lib/deviceAttendance";

export const TRIP_CUTOFF = "16:00";

export type DeviceTripKind = "returned" | "no-return" | "still-out";
export type FoundTrip = { workDay: string; outAt: string; inAt: string | null; kind: DeviceTripKind };

/**
 * @param moves   one person's moves for ONE work day, in order (from buildMoves)
 * @param dayOver true once the work day can have no more punches (a later work
 *                day has started, or it's past the shift end and the day is not today)
 */
export function findDeviceTrips(moves: Move[], dayOver: boolean): FoundTrip[] {
  if (!moves.length) return [];
  const workDay = moves[0].workDay;
  const sunday = new Date(`${workDay}T00:00:00Z`).getUTCDay() === 0;
  const firstIn = moves.find(m => m.direction === "in")?.at ?? null;
  if (sunday || isNightShift(firstIn)) return [];

  const trips: FoundTrip[] = [];
  for (let i = 1; i < moves.length; i++) {
    const m = moves[i];
    if (m.direction !== "out" || moves[i - 1].direction !== "in") continue;
    const t = Date.parse(m.at);
    if (karachiDate(t) !== workDay || karachiHHMM(m.at) >= TRIP_CUTOFF) continue;
    const back = moves[i + 1];
    if (back && back.direction === "in" && !back.missedOutBefore) {
      trips.push({ workDay, outAt: m.at, inAt: back.at, kind: "returned" });
      i++; // the return is not a new departure
    } else {
      trips.push({ workDay, outAt: m.at, inAt: null, kind: dayOver ? "no-return" : "still-out" });
    }
  }
  return trips;
}
