// Turns one person's raw device punches into IN/OUT moves, groups them into
// work days, and works out the spells between them. Pure (no db) so it can be
// tested and used anywhere. Display only for now: it doesn't feed worked
// hours or yield.
//
// The device records punch state 255 ("not set") because nobody presses an
// In/Out key, so direction is inferred from the person's previous punch, across
// midnight: after an OUT the next punch is IN; after an IN it's OUT, unless that
// IN is so old that they must have forgotten to punch out, in which case the
// new punch starts afresh as IN. So someone in at 08:00 and out at 02:00 is one
// shift, and the 02:00 punch is their OUT.
//
// The state the device stores on a punch is ignored (TRUST_DEVICE_STATE). From
// 18 to 24 Nov 2026 the device's punch state mode was switched on without being
// set up, so it stamped one fixed state (Check-In, then OT-Out) on every punch;
// trusting those turned arrivals into OUTs and carried the error into the next
// day. The mode is off again. Set this to true only once the device is set up to
// record real In/Out states and workers use them.
export const TRUST_DEVICE_STATE = false;
//
// A work day is the date its shift started on: moves after midnight belong to
// the day of the IN that opened the shift.

// Taps by the same person within this window count as one punch.
export const DUPLICATE_WINDOW_SECONDS = 120;
// An IN with no punch for this long is taken to have a missed OUT.
export const MAX_SHIFT_HOURS = 20;
// After an OUT, an IN at least this much later on a new date starts a new work
// day; a shorter gap (a break, an errand) continues the same one.
export const NEW_DAY_GAP_HOURS = 4;

const KARACHI_OFFSET_MS = 5 * 3600_000;

export type Direction = "in" | "out";

export type RawPunch = { punchedAt: Date | string; punchState: number | null; verifyMethod: string | null };

export type Move = {
  at: string;            // ISO
  direction: Direction;
  fromDevice: boolean;   // direction came from the device's punch state, not inferred
  verifyMethod: string | null;
  duplicates: number;    // extra taps folded into this one
  workDay: string;       // YYYY-MM-DD (Karachi) of the shift this move belongs to
  missedOutBefore: boolean; // the previous IN never got an OUT
};

export type Spell = { kind: "inside" | "outside"; from: string; to: string | null; minutes: number };

export type DayTimeline = {
  moves: Move[];
  spells: Spell[];
  firstIn: string | null;
  lastOut: string | null;
  insideMinutes: number;
  outsideMinutes: number;   // time out between moves, not counting before the first IN or after the last OUT
  current: Direction | null;
  flags: string[];
};

// ZK punch states: 0 check-in, 1 check-out, 2 break-out, 3 break-in, 4 OT-in, 5 OT-out.
function stateDirection(state: number | null): Direction | null {
  if (state === 0 || state === 3 || state === 4) return "in";
  if (state === 1 || state === 2 || state === 5) return "out";
  return null;
}

export const karachiDate = (t: number) => new Date(t + KARACHI_OFFSET_MS).toISOString().slice(0, 10);
const minutesBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60_000));

/**
 * All of one person's moves, in order, with their work day. Pass punches from
 * at least the day before the days you want, so a shift running past midnight
 * (or a person still inside) is known.
 */
export function buildMoves(punches: RawPunch[]): Move[] {
  const sorted = punches
    .map(p => ({ ...p, t: new Date(p.punchedAt).getTime() }))
    .sort((a, b) => a.t - b.t);

  const moves: Move[] = [];
  let lastKept = -Infinity;
  let workDay = "";
  for (const p of sorted) {
    if (p.t - lastKept < DUPLICATE_WINDOW_SECONDS * 1000) {
      moves[moves.length - 1].duplicates++;
      continue;
    }
    lastKept = p.t;
    const prev = moves[moves.length - 1];
    const gapHours = prev ? (p.t - Date.parse(prev.at)) / 3600_000 : Infinity;
    const staleIn = prev?.direction === "in" && gapHours >= MAX_SHIFT_HOURS;
    const own = TRUST_DEVICE_STATE ? stateDirection(p.punchState) : null;
    const direction: Direction = own ?? (prev?.direction === "in" && !staleIn ? "out" : "in");

    const date = karachiDate(p.t);
    const newShift = direction === "in" && (!prev || staleIn || (prev.direction === "out" && gapHours >= NEW_DAY_GAP_HOURS));
    if (!workDay || (newShift && date !== workDay)) workDay = date;

    moves.push({
      at: new Date(p.t).toISOString(),
      direction,
      fromDevice: own !== null,
      verifyMethod: p.verifyMethod,
      duplicates: 0,
      workDay,
      missedOutBefore: staleIn && direction === "in",
    });
  }
  return moves;
}

const hhmm = (iso: string) => new Date(Date.parse(iso) + KARACHI_OFFSET_MS).toISOString().slice(11, 16);
/** HH:MM in Karachi time, as the attendance register stores check-in/out. */
export const karachiHHMM = hhmm;

// Overtime is recorded in steps of this many minutes, rounded down (the
// Overtime page takes hours in steps of 0.5).
export const OVERTIME_STEP_MINUTES = 30;

/**
 * Overtime for one work day from the device: time inside after the shift end
 * (e.g. 16:45) on that day, including after midnight. Only time inside counts,
 * so a dinner break out and back in isn't overtime. Sunday is the off day, so
 * all time inside counts. Not rounded.
 */
export function deviceOvertimeMinutes(spells: Spell[], workDay: string, shiftEnd: string): number {
  const sunday = new Date(`${workDay}T00:00:00Z`).getUTCDay() === 0;
  const cutoff = sunday ? -Infinity : Date.parse(`${workDay}T${shiftEnd}:00+05:00`);
  let total = 0;
  for (const s of spells) {
    if (s.kind !== "inside" || s.minutes <= 0) continue;
    const from = Date.parse(s.from);
    const to = from + s.minutes * 60_000;
    const start = Math.max(from, cutoff);
    if (to > start) total += (to - start) / 60_000;
  }
  return Math.floor(total);
}

// A work day whose first IN is at or after this time (Karachi) is a night
// shift, e.g. 16:40 to 08:00. The day-shift rules (lateness after 08:10,
// overtime after 16:45) don't fit it, so the device fills nothing for it and
// HR enters it by hand.
export const NIGHT_SHIFT_FROM = "12:00";
export const isNightShift = (firstIn: string | null) => !!firstIn && hhmm(firstIn) >= NIGHT_SHIFT_FROM;

/** Overtime minutes as hours for the Overtime page, rounded down to OVERTIME_STEP_MINUTES. */
export const overtimeHours = (minutes: number) =>
  (Math.floor(minutes / OVERTIME_STEP_MINUTES) * OVERTIME_STEP_MINUTES) / 60;

/**
 * The spells and totals for one work day.
 * @param moves the person's moves for that work day, in order (from buildMoves)
 * @param next  their first move after that day, if any, to tell whether the last IN was left open
 * @param now   current time, for a shift still running
 */
export function buildDayTimeline(moves: Move[], next: Move | undefined, now: Date): DayTimeline {
  const flags: string[] = [];
  const spells: Spell[] = [];
  const nowIso = now.toISOString();
  const last = moves[moves.length - 1];
  // The day ends on an IN that's recent with nothing after it: still inside.
  const running = last?.direction === "in" && !next && (now.getTime() - Date.parse(last.at)) / 3600_000 < MAX_SHIFT_HOURS;
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const after = moves[i + 1];
    if (after && after.direction === m.direction && !after.missedOutBefore) {
      flags.push(`Two ${m.direction.toUpperCase()}s in a row at ${hhmm(m.at)}`);
    }
    // Nothing after the last OUT is counted: they've left, or are out and
    // haven't come back yet (shown by `current`).
    if (!after && m.direction === "out") break;
    if (after) {
      // An IN that never got an OUT before the next shift adds no time.
      const missed = after.missedOutBefore;
      spells.push({ kind: m.direction === "in" ? "inside" : "outside", from: m.at, to: missed ? null : after.at, minutes: missed ? 0 : minutesBetween(m.at, after.at) });
      if (missed) flags.push(`No OUT punch after IN at ${hhmm(m.at)}`);
      continue;
    }
    // Last move is an IN: runs until now, or was left open.
    spells.push({ kind: "inside", from: m.at, to: null, minutes: running ? minutesBetween(m.at, nowIso) : 0 });
    if (!running) flags.push(`No OUT punch after IN at ${hhmm(m.at)}`);
  }
  if (moves.length && moves[0].direction === "out") flags.push("First punch of the day is an OUT");

  const sum = (kind: Spell["kind"]) => spells.filter(s => s.kind === kind).reduce((n, s) => n + s.minutes, 0);
  return {
    moves,
    spells,
    firstIn: moves.find(m => m.direction === "in")?.at ?? null,
    lastOut: last?.direction === "out" ? last.at : null,
    insideMinutes: sum("inside"),
    outsideMinutes: sum("outside"),
    // An IN left open isn't "inside now"; we don't know where they are.
    current: !last ? null : last.direction === "out" ? "out" : running ? "in" : null,
    flags,
  };
}
