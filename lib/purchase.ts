// Dropdown lists for the Purchase Requisition register — taken verbatim from
// the company's Excel workbook ("PR REGISTER" sheet lookup columns).

export const PR_DEPARTMENTS = [
  "Accounts & Finance",
  "Production & Design",
  "HR & Administration",
  "Cash Section",
  "Repair & Maintenance",
  "Import",
] as const;

export const PR_CATEGORIES = [
  "Other Production",
  "Travelling",
  "CEO Kitchen Expense",
  "CEO Other Expense",
  "Postage & Courier",
  "Canteen Charges",
  "Raw Material",
  "Printing & Stationary",
  "R/M Machinary",
  "Misc Expense",
  "R/M Office Equipment",
  "R/M Vehicles",
] as const;

export const PR_UNITS = [
  "Pieces",
  "Packets",
  "Packs",
  "Pairs",
  "KGs",
  "Grams",
  "Litre",
  "Metric Ton",
  "Sq cm",
  "Sq meter",
] as const;

// A single line item on a requisition. `value` is the cost of that item and is
// filled in by the requester *after* the material is received.
export type PrItem = {
  itemName: string;
  category: string;
  quantity: number | null;
  uom: string;
  value: number | null;
};

export const emptyPrItem = (): PrItem => ({
  itemName: "", category: "", quantity: null, uom: "", value: null,
});

// Parse the stored items JSON (or an already-parsed array) into clean PrItems.
// Falls back to synthesising one item from a legacy row's scalar columns so old
// single-line rows still render in the multi-item UI.
export function parsePrItems(raw: {
  items?: unknown; itemName?: string | null; category?: string | null;
  quantity?: unknown; uom?: string | null; value?: unknown;
}): PrItem[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw.items)) arr = raw.items;
  else if (typeof raw.items === "string" && raw.items.trim()) {
    try { const p = JSON.parse(raw.items); if (Array.isArray(p)) arr = p; } catch { /* ignore */ }
  }
  const items: PrItem[] = arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      itemName: String(x.itemName ?? "").trim(),
      category: String(x.category ?? "").trim(),
      quantity: x.quantity === null || x.quantity === undefined || x.quantity === "" ? null : Number(x.quantity),
      uom: String(x.uom ?? "").trim(),
      value: x.value === null || x.value === undefined || x.value === "" ? null : Number(x.value),
    }))
    .filter((it) => it.itemName || it.quantity !== null || it.value !== null);

  if (items.length === 0 && (raw.itemName || raw.quantity != null || raw.value != null)) {
    items.push({
      itemName: (raw.itemName ?? "").trim(),
      category: (raw.category ?? "").trim(),
      quantity: raw.quantity == null || raw.quantity === "" ? null : Number(raw.quantity),
      uom: (raw.uom ?? "").trim(),
      value: raw.value == null || raw.value === "" ? null : Number(raw.value),
    });
  }
  return items;
}

// Sum of item values, or null when no item has been valued yet.
export function prItemsTotal(items: PrItem[]): number | null {
  const valued = items.filter((i) => i.value !== null && !isNaN(i.value as number));
  if (valued.length === 0) return null;
  return valued.reduce((s, i) => s + (i.value as number), 0);
}

// Workflow: PR Raised -> Approved -> Material Received -> Closed
export const PR_STATUSES = ["PR Raised", "Approved", "Material Received", "Closed"] as const;
export type PrStatus = typeof PR_STATUSES[number];

export const PR_HOD = ["Approved", "Not Approved"] as const;
export const PR_HR = ["Approved", "Rejected"] as const;

export const PR_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  "PR Raised":         { color: "#0C447C", bg: "#E6F1FB" },
  "Approved":          { color: "#D97706", bg: "#FAEEDA" },
  "Material Received": { color: "#15803D", bg: "#EAF3DE" },
  "Closed":            { color: "#475569", bg: "#e9edf2" },
};
