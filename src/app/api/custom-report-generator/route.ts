// src/app/api/custom-report-generator/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { users } from '../../../../drizzle';
import { eq } from 'drizzle-orm';
import { transformerMap } from '@/lib/reports-transformer';
import { exportTablesToCSVZip, generateAndStreamXlsxMulti } from '@/lib/download-utils';
import { verifySession } from '@/lib/auth';

export interface FilterRule {
    id: string;
    table: string;
    column: string;
    operator: 'contains' | 'equals' | 'gt' | 'lt';
    value: string;
}

export type ReportQueryOptions = {
    filters?: FilterRule[];
    startDate?: string | Date;
    endDate?: string | Date;
    limit?: number;
};

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
    const authResult = await getAuthClaims();
    if (authResult instanceof NextResponse) return authResult;
    const { currentUser } = authResult;

    try {
        const { columns, format, limit, filters, startDate, endDate } = await req.json() as {
            columns: { table: string; column: string }[];
            format: 'xlsx' | 'csv' | 'json';
            limit?: number;
            filters?: FilterRule[];
            startDate?: string | Date;
            endDate?: string | Date;
        };

        if (!columns || columns.length === 0) {
            return NextResponse.json({ error: 'No columns selected' }, { status: 400 });
        }

        const grouped = columns.reduce((acc, col) => {
            acc[col.table] = acc[col.table] || [];
            if (!acc[col.table].includes(col.column)) {
                acc[col.table].push(col.column);
            }
            return acc;
        }, {} as Record<string, string[]>);

        const tableIds = Object.keys(grouped);

        // PREVIEW
        if (format === 'json' && tableIds.length > 0) {
            const previewTableId = tableIds[0];
            if (!(previewTableId in transformerMap)) {
                return NextResponse.json({ error: 'Fetcher not found' }, { status: 400 });
            }
            const fetcher = transformerMap[previewTableId as keyof typeof transformerMap];
            
            const rows = await (fetcher as any)(currentUser.companyId, {
                filters: (filters || []).filter(f => f.table === previewTableId),
                startDate,
                endDate,
                limit: limit || 500
            });

            const previewCols = grouped[previewTableId];
            const previewData = rows.map((r: any) => {
                const obj: Record<string, any> = { id: r.id };
                for (const c of previewCols) obj[c] = r[c] ?? null;
                return obj;
            });
            return NextResponse.json({ data: previewData });
        }

        // DOWNLOAD
        const dataPerTable: Record<string, any[]> = {};
        for (const table of tableIds) {
            if (table in transformerMap) {
                const fn = transformerMap[table as keyof typeof transformerMap];
                dataPerTable[table] = await (fn as any)(currentUser.companyId, {
                    filters: (filters || []).filter(f => f.table === table),
                    startDate,
                    endDate
                });
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