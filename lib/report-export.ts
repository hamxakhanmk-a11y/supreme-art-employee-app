import type { SheetSpec } from "./xlsx";
export function inReportRange(date: string | null | undefined, from: string, to: string) {
 if (from && to && from > to) return false;
 if (!from && !to) return true;
 const day = (date || "").slice(0,10);
 return !!day && (!from || day >= from) && (!to || day <= to);
}
const displayDate = (d: string) => d.split("-").reverse().join("/");
export function reportLetterhead(from: string, to: string): NonNullable<SheetSpec["letterhead"]> {
 const date = from && to ? (from === to ? displayDate(from) : displayDate(from)+" to "+displayDate(to)) : from ? "From "+displayDate(from) : to ? "Through "+displayDate(to) : "All dates";
 return { date, logoUrl: "/logo-urdu.png", company: { name: "SUPREME ART PRIVATE LIMITED" } };
}
