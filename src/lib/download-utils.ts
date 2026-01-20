// src/lib/download-utils.ts
import { NextResponse } from 'next/server';
import { stringify } from 'csv-stringify';
import ExcelJS from 'exceljs';
import JSZip from "jszip";

export interface StylingOptions {
  headerColor?: string;     // Hex (e.g. #336699)
  headerTextColor?: string; // Hex (e.g. #FFFFFF)
  stripeRows?: boolean;
  fontFamily?: string;
  title?: string; // Optional Title inside the sheet
}

export async function generateAndStreamCsv(data: any[][], filename: string): Promise<NextResponse> {
  const csvString = await new Promise<string>((resolve, reject) => {
    stringify(data, (err, result) => {
      if (err) reject(err);
      resolve(result || '');
    });
  });

  return new NextResponse(csvString, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// Create a ZIP containing multiple CSVs
export async function exportTablesToCSVZip(
  dataByTable: { table: string; columns: string[]; rows: any[] }[]
): Promise<Blob> {
  const zip = new JSZip();

  dataByTable.forEach(({ table, columns, rows }) => {
    const csvContent = toCSV(columns, rows);
    zip.file(`${table}.csv`, csvContent);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  return blob;
}

export async function generateAndStreamXlsx(
  data: any[],
  headers: string[],
  filename: string,
  options?: StylingOptions
): Promise<NextResponse> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(safeSheetName('Report'), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Set defaults if user didn't pick any
  const safeOptions = {
    headerColor: options?.headerColor?.replace('#', '') || '1E293B', // Default Slate
    headerTextColor: options?.headerTextColor?.replace('#', '') || 'FFFFFF',
    stripeRows: options?.stripeRows ?? true,
    fontFamily: options?.fontFamily || 'Calibri',
  };

  // Define columns per headers
  ws.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.max(12, Math.min(40, h.length + 2)),
  }));

  appendRows(ws, data, headers);
  applySheetStyling(ws, headers.length, data.length, safeOptions);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Generates and streams a multi-sheet XLSX.
 */
export async function generateAndStreamXlsxMulti(
  sheets: Record<string, { headers: string[]; rows: any[] }>,
  filename: string
): Promise<NextResponse> {
  const wb = new ExcelJS.Workbook();

  for (const [name, { headers, rows }] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(safeSheetName(name), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.max(12, Math.min(40, h.length + 2)),
      style: { font: { size: 11 } },
    }));

    appendRows(ws, rows, headers);
    styleHeaderAndFilter(ws, headers.length);
    autoSizeColumns(ws);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/* ----------------------------- helpers ----------------------------- */

// Excel helpers
function appendRows(ws: ExcelJS.Worksheet, data: any[], headers: string[]) {
  const isArrayRows = Array.isArray(data[0]);
  if (isArrayRows) {
    (data as any[][]).forEach((row) => {
      const normalized =
        row.length >= headers.length
          ? row.slice(0, headers.length)
          : [...row, ...Array(headers.length - row.length).fill(null)];
      ws.addRow(normalizeCells(normalized));
    });
  } else {
    (data as Record<string, any>[]).forEach((obj) => {
      const row = headers.map((h) => normalizeCell(obj?.[h]));
      ws.addRow(row);
    });
  }
}

function styleHeaderAndFilter(ws: ExcelJS.Worksheet, colCount: number) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FF1F2937' } };
  header.alignment = { vertical: 'middle' };
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colCount },
  };
}

function autoSizeColumns(ws: ExcelJS.Worksheet) {
  // ws.columns can be undefined in typings, guard it
  const cols = ws.columns ?? [];
  cols.forEach((c, idx) => {
    let max = (c.header?.toString().length ?? 10) + 2;

    // some ExcelJS versions have col.eachCell optional in typings; guard it
    const colAny = c as any;
    if (typeof colAny.eachCell === 'function') {
      colAny.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
        max = Math.max(max, estimateWidth(cell.value));
      });
    } else {
      // Fallback: iterate rows and read the Nth cell
      const colNumber = (colAny.number as number) || idx + 1;
      ws.eachRow({ includeEmpty: true }, (row) => {
        const cell = row.getCell(colNumber);
        max = Math.max(max, estimateWidth(cell.value));
      });
    }

    c.width = Math.max(c.width ?? 12, Math.min(60, max));
  });
}

function estimateWidth(v: unknown): number {
  if (v == null) return 0;
  if (v instanceof Date) return 19;
  if (typeof v === 'number') return v.toString().length + 2;
  if (typeof v === 'string') return Math.min(60, v.length + 2);
  const text = (v as any)?.text ?? (v as any)?.toString?.();
  return text ? Math.min(60, String(text).length + 2) : 0;
}

function normalizeCells(arr: any[]): any[] {
  return arr.map(normalizeCell);
}

function normalizeCell(v: any): any {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  return v;
}

function safeSheetName(name: string): string {
  // Excel sheet name must be <= 31 chars and not contain: : \ / ? * [ ]
  const invalid = /[:\\/?*\[\]]/g;
  const sanitized = name.replace(invalid, ' ').trim();
  return sanitized.length > 31 ? sanitized.slice(0, 31) : sanitized || 'Sheet1';
}

function applySheetStyling(
    ws: ExcelJS.Worksheet, 
    colCount: number, 
    rowCount: number, 
    opts: { headerColor: string, headerTextColor: string, stripeRows: boolean, fontFamily: string }
) {
  if (colCount === 0) return;

  // HEADER STYLING
  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  
  headerRow.eachCell((cell) => {
    cell.style = {
      font: { 
        bold: true, 
        color: { argb: 'FF' + opts.headerTextColor }, // Dynamic Text Color
        name: opts.fontFamily,
        size: 11
      },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF' + opts.headerColor }, // Dynamic Bg Color
      },
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: { bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } } }
    };
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colCount } };

  // DATA ROWS
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    // Dynamic Zebra Striping
    if (opts.stripeRows && rowNumber % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= colCount) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }, // Keep stripe light gray to not clash
          };
        }
      });
    }

    // Font Application
    row.eachCell({ includeEmpty: true }, (cell) => {
        if (!cell.font) cell.font = {};
        cell.font.name = opts.fontFamily;
        
        // Borders
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
    });
  });

  autoSizeColumns(ws);
}

// CSV helpers
// Convert rows to CSV string
function toCSV(columns: string[], rows: any[]): string {
  const header = columns.join(",");
  const csvRows = rows.map(row =>
    columns.map(col => JSON.stringify(row[col] ?? "")).join(",")
  );
  return [header, ...csvRows].join("\n");
}