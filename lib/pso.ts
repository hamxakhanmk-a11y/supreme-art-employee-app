// What a PSO card's balance means at a glance. Shared by the PSO Cards page
// and the station terminal, so a card reads the same colour in both.

export type BalanceState = "none" | "red" | "amber" | "ok";

export function balanceState(balance: number | null | undefined, low: number): BalanceState {
  if (balance === null || balance === undefined) return "none";
  if (balance <= 0) return "red";
  if (balance < low) return "amber";
  return "ok";
}

export const BALANCE_COLOR: Record<BalanceState, string> = {
  none: "var(--text3)",
  red: "#DC2626",
  amber: "#B45309",
  ok: "var(--text)",
};

export const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
