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
] as const;

// Workflow: PR Raised -> Approved -> Material Received -> Closed
export const PR_STATUSES = ["PR Raised", "Approved", "Material Received", "Closed"] as const;
export type PrStatus = typeof PR_STATUSES[number];

export const PR_HOD = ["Approved", "Not Approved"] as const;

export const PR_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  "PR Raised":         { color: "#0C447C", bg: "#E6F1FB" },
  "Approved":          { color: "#D97706", bg: "#FAEEDA" },
  "Material Received": { color: "#15803D", bg: "#EAF3DE" },
  "Closed":            { color: "#475569", bg: "#e9edf2" },
};
