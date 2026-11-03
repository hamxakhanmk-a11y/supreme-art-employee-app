// Turns one person's raw device punches for a day into a sequence of IN/OUT
// moves and the spells between them. Pure (no db) so it can be tested and used
// anywhere. Display only for now: it doesn't feed worked hours or yield.
//
// The device records punch state 255 ("not set") because nobody presses an
// In/Out key, so direction is inferred: the first punch of the day is IN and
// each one after flips it. If the device is ever set up to record the state,
// a punch's own state wins and the alternation carries on from there.

// Taps by the same person within this window count as one punch.
export const DUPLICATE_WINDOW_SECONDS = 120;

export type Direction = "in" | "out";

export type RawPunch = { punchedAt: Date | string; punchState: number | null; verifyMethod: string | null };

export type Move = {
  at: string;            // ISO
  direction: Direction;
  fromDevice: boolean;   // direction came from the device's punch state, not inferred
  verifyMethod: string | null;
  duplicates: number;    // extra taps folded into this one
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

const minutesBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60_000));

/**
 * @param punches one person's punches for one day, any order
 * @param until   end of open spells: now for today, end of day for past days
 * @param ongoing true when `until` is now, so an open spell is still running rather than unfinished
 */
export function buildDayTimeline(punches: RawPunch[], until: Date, ongoing: boolean): DayTimeline {
  const sorted = punches
    .map(p => ({ ...p, t: new Date(p.punchedAt).getTime() }))
    .sort((a, b) => a.t - b.t);

  const moves: Move[] = [];
  let lastKept = -Infinity;
  for (const p of sorted) {
    if (p.t - lastKept < DUPLICATE_WINDOW_SECONDS * 1000) {
      moves[moves.length - 1].duplicates++;
      continue;
    }
    lastKept = p.t;
    const own = stateDirection(p.punchState);
    const prev = moves[moves.length - 1]?.direction;
    moves.push({
      at: new Date(p.t).toISOString(),
      direction: own ?? (prev === "in" ? "out" : "in"),
      fromDevice: own !== null,
      verifyMethod: p.verifyMethod,
      duplicates: 0,
    });
  }

  const flags: string[] = [];
  const spells: Spell[] = [];
  const untilIso = until.toISOString();
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const next = moves[i + 1];
    if (next && next.direction === m.direction) {
      flags.push(`Two ${m.direction.toUpperCase()}s in a row at ${m.at}`);
    }
    // Nothing after the last OUT is counted: they've left for the day, or are
    // out and haven't come back yet (shown by `current`).
    if (!next && m.direction === "out") break;
    // A last IN on a past day has no end we know of (flagged below), so it adds
    // no time; today it runs until now.
    spells.push({
      kind: m.direction === "in" ? "inside" : "outside",
      from: m.at,
      to: next ? next.at : null,
      minutes: next ? minutesBetween(m.at, next.at) : ongoing ? minutesBetween(m.at, untilIso) : 0,
    });
  }

  const last = moves[moves.length - 1];
  if (last?.direction === "in" && !ongoing) flags.push("No final OUT punch");
  if (moves.length && moves[0].direction === "out") flags.push("First punch of the day is an OUT");

  const sum = (kind: Spell["kind"]) => spells.filter(s => s.kind === kind).reduce((n, s) => n + s.minutes, 0);
  return {
    moves,
    spells,
    firstIn: moves.find(m => m.direction === "in")?.at ?? null,
    lastOut: last?.direction === "out" ? last.at : null,
    insideMinutes: sum("inside"),
    outsideMinutes: sum("outside"),
    current: last?.direction ?? null,
    flags,
  };
}
