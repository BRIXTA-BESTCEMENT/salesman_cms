// src/app/api/custom-report-generator/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { users } from '../../../../drizzle';
import { eq } from 'drizzle-orm';
import { transformerMap } from '@/lib/reports-transformer';
import { exportTablesToCSVZip, generateAndStreamXlsxMulti } from '@/lib/download-utils';
import { verifySession } from '@/lib/auth';

interface TableColumn {
    table: string;
    column: string;
}

interface FilterRule {
    id: string;
    column: string;
    operator: 'contains' | 'equals' | 'gt' | 'lt';
    value: string;
}

type ReportTableId = keyof typeof transformerMap;

// --- Auth Check ---
async function getAuthClaims() {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await db
        .select({ companyId: users.companyId, role: users.role })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

    const currentUser = result[0];

    if (!currentUser) {
        return new NextResponse('User not found', { status: 404 });
    }
    return { session, currentUser };
}

// Helper to safely parse dates, especially the en-IN DD/MM/YYYY format from the transformer
function parseDateSafely(val: any): Date {
    if (!val) return new Date(NaN);
    
    // 1. Try standard JS parsing first (handles "27 Mar 2026" from formatDateTimeIST)
    let d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    
    // 2. Fallback for 'en-IN' DD/MM/YYYY format (handles "27/03/2026" from formatDateIST)
    if (typeof val === 'string' && val.includes('/')) {
        const parts = val.split('/');
        if (parts.length === 3) {
            // Rearrange DD/MM/YYYY to YYYY-MM-DD for standard ISO parsing
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return new Date(`${year}-${month}-${day}T00:00:00Z`);
        }
    }
    
    return new Date(NaN);
}

// --- Filtering Logic ---
function applyFilters(rows: any[], filters: FilterRule[]): any[] {
    if (!filters || filters.length === 0) return rows;

    return rows.filter(row => {
        // A row must satisfy ALL applicable filters (AND logic)
        return filters.every(filter => {
            if (!(filter.column in row)) {
                return true;
            }

            const rawValue = row[filter.column];
            const cellValueStr = String(rawValue ?? '').trim().toLowerCase();
            const filterValueStr = (filter.value ?? '').trim().toLowerCase();

            if (!filterValueStr) return true;

            // --- 3. Handle Date Ranges (Comma Separated) ---
            if (filterValueStr.includes(',')) {
                const [startStr, endStr] = filterValueStr.split(',');

                // USE THE NEW PARSER HERE
                const cellDate = parseDateSafely(rawValue); 
                const startDate = new Date(startStr);
                const endDate = endStr ? new Date(endStr) : new Date(8640000000000000);

                if (!isNaN(cellDate.getTime()) && !isNaN(startDate.getTime())) {
                    return cellDate >= startDate && cellDate <= endDate;
                }
            }

            // --- 4. Standard Operators ---
            switch (filter.operator) {
                case 'contains':
                    return cellValueStr.includes(filterValueStr);

                case 'equals':
                    return cellValueStr === filterValueStr;

                case 'gt': {
                    // USE THE NEW PARSER HERE
                    const cellDate = parseDateSafely(rawValue);
                    const filterDate = new Date(filterValueStr);
                    if (!isNaN(cellDate.getTime()) && !isNaN(filterDate.getTime()) && filterValueStr.includes('-')) {
                        return cellDate > filterDate;
                    }

                    const numCell = parseFloat(cellValueStr);
                    const numFilter = parseFloat(filterValueStr);
                    if (!isNaN(numCell) && !isNaN(numFilter)) {
                        return numCell > numFilter;
                    }

                    return cellValueStr > filterValueStr;
                }

                case 'lt': {
                    // USE THE NEW PARSER HERE
                    const cellDate = parseDateSafely(rawValue);
                    const filterDate = new Date(filterValueStr);
                    if (!isNaN(cellDate.getTime()) && !isNaN(filterDate.getTime()) && filterValueStr.includes('-')) {
                        return cellDate < filterDate;
                    }

                    const numCell = parseFloat(cellValueStr);
                    const numFilter = parseFloat(filterValueStr);
                    if (!isNaN(numCell) && !isNaN(numFilter)) {
                        return numCell < numFilter;
                    }

                    return cellValueStr < filterValueStr;
                }

                default:
                    return true;
            }
        });
    });
}

/**
 * Helper to structure data for generateAndStreamXlsxMulti.
 */
function buildSheetsPayload(
    groupedColumns: Record<string, string[]>,
    dataPerTable: Record<string, any[]>
): Record<string, { headers: string[]; rows: any[] }> {
    const sheets: Record<string, { headers: string[]; rows: any[] }> = {};

    for (const [tableId, columns] of Object.entries(groupedColumns)) {
        const rows = dataPerTable[tableId] ?? [];

        sheets[tableId] = {
            headers: columns,
            rows: rows.map(row => {
                const obj: Record<string, any> = {};
                for (const c of columns) obj[c] = (row as any)[c] ?? null;
                return obj;
            }),
        };
    }
    return sheets;
}

// POST HANDLER 
export async function POST(req: NextRequest) {
    // 1. Auth Check
    const authResult = await getAuthClaims();
    if (authResult instanceof NextResponse) return authResult;
    const { currentUser } = authResult;

    try {
        // 2. Parse Payload
        // ADDED: filters destructuring
        const { columns, format, limit, filters } = await req.json() as {
            columns: TableColumn[];
            format: 'xlsx' | 'csv' | 'json';
            limit?: number;
            filters?: FilterRule[];
        };

        if (!columns || columns.length === 0) {
            return NextResponse.json({ error: 'No columns selected' }, { status: 400 });
        }

        // 3. Group columns by table ID 
        const grouped = columns.reduce((acc, col) => {
            acc[col.table] = acc[col.table] || [];
            if (!acc[col.table].includes(col.column)) {
                acc[col.table].push(col.column);
            }
            return acc;
        }, {} as Record<string, string[]>);

        const tableIds = Object.keys(grouped);

        // --- 4. Handle PREVIEW Request (format: 'json') ---
        if (format === 'json' && tableIds.length > 0) {
            const previewTableId = tableIds[0];

            if (!(previewTableId in transformerMap)) {
                return NextResponse.json({ error: `Fetcher not found for table: ${previewTableId}` }, { status: 400 });
            }
            const fetcher = transformerMap[previewTableId as ReportTableId];

            // Fetch full data using the transformer
            let rows = await (fetcher as any)(currentUser.companyId);

            // ADDED: Apply filters to preview data server-side (optional but good for consistency)
            // Note: In your current UI, you filter preview client-side, but this ensures API correctness.
            rows = applyFilters(rows, filters || []);

            // Select only requested columns and limit the rows for preview
            const previewCols = grouped[previewTableId];
            const previewData = (rows as any[])
                .slice(0, limit || 10)
                .map(r => {
                    const obj: Record<string, any> = { id: (r as any).id };
                    for (const c of previewCols) {
                        obj[c] = (r as any)[c] ?? null;
                    }
                    return obj;
                });

            return NextResponse.json({ data: previewData });
        }

        // --- 5. Handle DOWNLOAD Request (format: 'xlsx' or 'csv') ---

        const dataPerTable: Record<string, any[]> = {};
        for (const table of tableIds) {
            if (table in transformerMap) {
                const fn = transformerMap[table as ReportTableId];
                // A. Fetch Raw Data
                const rawRows = await (fn as any)(currentUser.companyId);
                // B. Apply Filters
                dataPerTable[table] = applyFilters(rawRows, filters || []);
            }
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).replace(/ /g, '-'); // Result: "10-Feb-2026"

        const filenameBase = `report_${dateStr}`;

        if (format === 'csv') {
            const dataByTable = tableIds.map((table) => {
                const cols = grouped[table];
                const rows = (dataPerTable[table] ?? []).map(r => {
                    const obj: Record<string, any> = {};
                    for (const c of cols) obj[c] = (r as any)[c] ?? null;
                    return obj;
                });
                return { table, columns: cols, rows };
            });

            const zipBlob = await exportTablesToCSVZip(dataByTable);
            const buffer = Buffer.from(await zipBlob.arrayBuffer());

            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    "Content-Type": "application/zip",
                },
            });
        }

        if (format === 'xlsx') {
            const sheets = buildSheetsPayload(grouped, dataPerTable);
            return generateAndStreamXlsxMulti(sheets, `${filenameBase}.xlsx`);
        }

        return NextResponse.json({ error: 'Invalid format specified' }, { status: 400 });

    } catch (e) {
        console.error('Custom report route error:', e);
        return NextResponse.json({ error: 'Failed to process report request. Check data format in transformers.' }, { status: 500 });
    }
}