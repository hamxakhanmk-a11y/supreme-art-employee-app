import { sql, type SQL } from "drizzle-orm";

// When a gate entry happened. Server-only.
//
// Two things this exists to get right:
//
// 1. Karachi time, always. The server runs in UTC, so anything read off the
//    server's own clock — toTimeString(), toISOString() — is five hours behind
//    the gate, and between midnight and 5am even has yesterday's date.
//
// 2. Entries made after the fact. The guard writes up yesterday's trip this
//    morning, so the date and time can be given; left blank, they are now.

export type GateWhen = {
  /** Local (Karachi) date, YYYY-MM-DD. */
  date: string;
  /** Local (Karachi) time, HH:MM. */
  time: string;
  /** True when the date or time was typed rather than taken off the clock. */
  manual: boolean;
  /** The same moment as a timestamptz, for columns that store one. */
  stamp: SQL;
  error?: string;
};

export function karachiNow(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

// Reads { date?, at? } off a request body.
export function gateWhen(b: { date?: unknown; at?: unknown } | null | undefined): GateWhen {
  const now = karachiNow();
  const fail = (error: string): GateWhen => ({ date: now.date, time: now.time, manual: false, stamp: sql`now()`, error });

  const rawDate = typeof b?.date === "string" ? b.date.trim() : "";
  const rawTime = typeof b?.at === "string" ? b.at.trim() : "";
  if (rawDate && !DATE_RE.test(rawDate)) return fail("The date must be written as YYYY-MM-DD");
  if (rawTime && !TIME_RE.test(rawTime)) return fail("The time must be written as HH:MM");

  const date = rawDate || now.date;
  // Today with no time means now. An earlier day with no time has no honest
  // default — any guess would sit in the log looking like a fact.
  const time = rawTime ? rawTime.padStart(5, "0") : (date === now.date ? now.time : "");
  if (!time) return fail("Give the time as well — for an earlier day it can't be taken from the clock.");

  if (date > now.date || (date === now.date && time > now.time)) {
    return fail("That date and time is still to come — check them.");
  }

  const manual = !!(rawDate || rawTime);
  return {
    date, time, manual,
    // Untouched, it is the exact instant; typed, it is that minute in Karachi.
    stamp: manual ? sql`((${date}::date + ${time}::time) AT TIME ZONE 'Asia/Karachi')` : sql`now()`,
  };
}

// "2026-10-04" + "18:30" ordering, for comparing two local moments held as
// strings. A missing time sorts as the start of its day.
export function localKey(date: string, time: string | null | undefined): string {
  return `${date} ${time || "00:00"}`;
}
