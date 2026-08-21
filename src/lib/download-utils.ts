// src/lib/download-utils.ts
import { NextResponse } from 'next/server';
import { stringify } from 'csv-stringify';
import { stringify as stfy } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import JSZip from "jszip";

/**
 * Generates and streams a SINGLE BIG CSV file.
 * @param data The data to be written to the CSV, including headers.
 * @param filename The desired filename for the download.
 * @returns A NextResponse containing the CSV file.
 */
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

/**
 * Generates and streams a single-sheet XLSX using ExcelJS.
 * Accepts either array-of-objects (keys must match headers) or array-of-arrays.
 */
export async function generateAndStreamXlsx(
  data: any[],
  headers: string[],
  filename: string
): Promise<NextResponse> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(safeSheetName('Report'), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Define columns per headers
  ws.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.max(12, Math.min(40, h.length + 2)),
    style: { font: { size: 11 } },
  }));

  appendRows(ws, data, headers);
  styleHeaderAndFilter(ws, headers.length);
  autoSizeColumns(ws);

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

// function estimateWidth(v: unknown): number {
//   if (v == null) return 0;
//   if (v instanceof Date) return 19;
//   if (typeof v === 'number') return v.toString().length + 2;
//   if (typeof v === 'string') return Math.min(60, v.length + 2);
//   const text = (v as any)?.text ?? (v as any)?.toString?.();
//   return text ? Math.min(60, String(text).length + 2) : 0;
// }

function normalizeCells(arr: any[]): any[] {
  return arr.map(normalizeCell);
}

function normalizeCell(v: any): any {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  return v;
}

// CSV helpers
// Convert rows to CSV string
function toCSV(columns: string[], rows: any[]): string {
  // Now stringify returns a string synchronously
  return stfy(
    rows.map(row => columns.map(col => normalizeCell(row[col] ?? ""))),
    {
      header: true,
      columns,
    }
  );
}

function autoSizeColumns(ws: ExcelJS.Worksheet) {
    const cols = ws.columns ?? [];
    cols.forEach((c) => {
        const headerLength = String(c.header ?? '').length;
        c.width = Math.max(12, Math.min(35, headerLength + 4));
    });
}

export function safeSheetName(name: string, used: Set<string> = new Set()): string {
    const invalid = /[:\\/?*\[\]]/g;
    const base = name.replace(invalid, ' ').trim().slice(0, 31) || 'Sheet';
    
    let result = base;
    let i = 1;
    while (used.has(result)) {
        const suffix = `_${i++}`;
        result = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    }
    used.add(result);
    return result;
}