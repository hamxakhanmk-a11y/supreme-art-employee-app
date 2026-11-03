// Small helpers for the search boxes and sort dropdowns on the attendance and leave screens.

/** True when every word typed appears in at least one of the fields (case-insensitive). Blank matches everything. */
export function matchesQuery(query: string, fields: unknown[]): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields.filter(f => f !== null && f !== undefined && f !== "").map(f => String(f).toLowerCase()).join("  ");
  return words.every(w => hay.includes(w));
}

/** The usual employee fields: name (both orders), employee ID, department, designation. */
export function empMatches(query: string, e: { firstName: string; lastName: string; employeeId: string; department?: string | null; designation?: string | null }): boolean {
  return matchesQuery(query, [e.firstName, e.lastName, `${e.firstName} ${e.lastName}`, e.employeeId, e.department, e.designation]);
}

/** Text compare that reads numbers as numbers (SAPL-9 before SAPL-21) and puts blanks last. */
export function cmpText(a: string | null | undefined, b: string | null | undefined): number {
  const x = (a ?? "").trim(), y = (b ?? "").trim();
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
}
