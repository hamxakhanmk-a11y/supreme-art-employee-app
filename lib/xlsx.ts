// Real .xlsx export (Office Open XML) via ExcelJS, dynamically imported so the
// library is only pulled into a lazy chunk when the user actually exports.

type Cell = string | number | null | undefined;

// Fill colors for attendance day-codes (by leading letter), matching the app.
const DAY_FILL: Record<string, string> = {
  P: "FFDCF5DC", // present (green)
  A: "FFFCDADA", // absent (red)
  L: "FFFDEBD0", // leave (amber)
  H: "FFCFFAFE", // holiday (cyan)
};
const THIN = { style: "thin" as const, color: { argb: "FFDDDDDD" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface SheetSpec {
  sheetName: string;
  title: string;
  headers: string[];
  rows: Cell[][];
  dayRange?: [number, number]; // inclusive 0-based column indices to color by code
  freezeCols?: number;         // sticky leading columns (default 2)
  colWidths?: number[];        // explicit per-column widths (else sized for the register)
}

// Render one styled worksheet (title banner + header row + bordered data).
// Shared by the single-sheet and multi-sheet exporters below.
type ExcelWorkbook = Awaited<ReturnType<typeof loadExcel>>["wb"];
async function loadExcel() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Supreme Art HR Portal";
  wb.created = new Date();
  return { ExcelJS, wb };
}

function addStyledSheet(wb: ExcelWorkbook, spec: SheetSpec) {
  const nCols = spec.headers.length;
  const freeze = spec.freezeCols ?? 2;
  const ws = wb.addWorksheet(spec.sheetName.slice(0, 31), {
    views: [{ state: "frozen", xSplit: freeze, ySplit: 2 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Row 1 — merged title banner
  ws.mergeCells(1, 1, 1, nCols);
  const title = ws.getCell(1, 1);
  title.value = spec.title;
  title.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFA32D2D" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 22;

  // Row 2 — headers
  const header = ws.getRow(2);
  spec.headers.forEach((h, i) => {
    const c = header.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EEE4" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = BORDER;
  });
  header.height = 26;

  // Data rows
  for (const row of spec.rows) {
    const r = ws.addRow(row as (string | number)[]);
    r.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = BORDER;
      cell.alignment = { horizontal: col <= 2 ? "left" : "center", vertical: "top", wrapText: true };
      cell.font = { size: 10 };
      if (spec.dayRange) {
        const idx = col - 1;
        if (idx >= spec.dayRange[0] && idx <= spec.dayRange[1]) {
          const code = String(cell.value ?? "").trim().charAt(0);
          const fill = DAY_FILL[code];
          if (fill) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
            cell.font = { size: 10, bold: true };
          }
        }
      }
    });
  }

  // Column widths
  ws.columns.forEach((col, i) => {
    if (spec.colWidths) col.width = spec.colWidths[i] ?? 12;
    else if (i === 0) col.width = 14;
    else if (i === 1) col.width = 22;
    else if (spec.dayRange && i >= spec.dayRange[0] && i <= spec.dayRange[1]) col.width = 4.5;
    else col.width = 11;
  });

  return ws;
}

export async function downloadRegisterXlsx(opts: SheetSpec & { filename: string }) {
  const { wb } = await loadExcel();
  addStyledSheet(wb, opts);
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), opts.filename);
}

// Multi-sheet workbook — one styled worksheet per spec. Used by the procurement
// report's "All" export so each document type gets its own fully-detailed tab.
export async function downloadWorkbookXlsx(opts: { filename: string; sheets: SheetSpec[] }) {
  const { wb } = await loadExcel();
  const sheets = opts.sheets.length ? opts.sheets : [{
    sheetName: "Empty", title: "No data", headers: ["—"], rows: [],
  }];
  for (const s of sheets) addStyledSheet(wb, s);
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), opts.filename);
}
