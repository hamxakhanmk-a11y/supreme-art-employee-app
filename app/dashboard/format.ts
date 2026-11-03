// Formatting shared by the Super Admin dashboard and its expense page.
export const pkr = (n: number) => Math.round(n).toLocaleString("en-US");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dmy = (d: string) => (d ? `${d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : "");
export const monthLabel = (ym: string) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
export const rangeLabel = (from: string, to: string) => (from === to ? dmy(from) : `${dmy(from)} – ${dmy(to)}`);
