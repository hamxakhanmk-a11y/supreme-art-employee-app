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
  letterhead?: { code?: string; issue?: string; date: string; logoUrl: string;
    company: { name: string } };
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

async function addStyledSheet(wb: ExcelWorkbook, spec: SheetSpec) {
  const nCols = spec.headers.length;
  const headerRow = spec.letterhead ? 4 : 2;
  const freeze = spec.freezeCols ?? 2;
  const ws = wb.addWorksheet(spec.sheetName.slice(0, 31), {
    views: [{ state: "frozen", xSplit: freeze, ySplit: headerRow }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  if (!spec.letterhead) {
  // Row 1 — merged title banner
  ws.mergeCells(1, 1, 1, nCols);
  const title = ws.getCell(1, 1);
  title.value = spec.title;
  title.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFA32D2D" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 22;

  } else {
    const h = spec.letterhead;
    const merge = (row: number, start: number, end: number, value: string) => {
      ws.mergeCells(row, start, row, end);
      const c = ws.getCell(row, start);
      c.value = value; c.font = { name: "Times New Roman", size: 11 };
      c.alignment = { vertical: "middle", wrapText: true }; c.border = BORDER;
      return c;
    };
    ws.mergeCells(1, 1, 2, 1);
    const control = merge(3, 2, nCols, [h.code, "Date: " + h.date, h.issue ? "Issue Status: " + h.issue : ""].filter(Boolean).join("     |     "));
    control.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getRow(1).height = 29;
    const logoName = ws.getCell(3, 1);
    logoName.value = h.company.name;
    logoName.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFA32D2D" } };
    logoName.alignment = { horizontal: "center", vertical: "middle", shrinkToFit: true };
    ws.getRow(2).height = 29;
    ws.getRow(3).height = 20;
    const response = await fetch(h.logoUrl);
    if (!response.ok) throw new Error("Unable to load the company logo. Please retry the export.");
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject; reader.readAsDataURL(blob);
    });
    const imageId = wb.addImage({ base64, extension: "png" });
    const logoColumnPixels = (spec.colWidths?.[0] ?? 14) * 7 + 5;
    const logoWidth = Math.min(135, logoColumnPixels - 12);
    ws.addImage(imageId, {
      tl: { col: (logoColumnPixels - logoWidth) / (2 * logoColumnPixels), row: 0.14 },
      ext: { width: logoWidth, height: Math.round(logoWidth * 292 / 600) },
    });
    ws.mergeCells(1, 2, 2, nCols);
    const title = ws.getCell(1, 2);
    title.value = spec.title;
    title.font = { name: "Times New Roman", size: 16, bold: true };
    title.alignment = { horizontal: "center", vertical: "middle" };
    for (let row = 1; row <= 3; row++) for (let col = 1; col <= nCols; col++) {
      ws.getCell(row,col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
    }
    ws.pageSetup.paperSize = 9; ws.pageSetup.printTitlesRow = "1:4";
    ws.headerFooter.oddFooter = "&L" + h.company.name + "&RPage &P of &N";
  }
  const header = ws.getRow(headerRow);
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

  if (spec.letterhead) {
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + spec.rows.length, column: nCols } };
    ws.pageSetup.printArea = "A1:" + ws.getColumn(nCols).letter + ws.rowCount;
  }
  return ws;
}

export async function downloadRegisterXlsx(opts: SheetSpec & { filename: string }) {
  const { wb } = await loadExcel();
  await addStyledSheet(wb, opts);
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
  for (const s of sheets) await addStyledSheet(wb, s);
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), opts.filename);
}
