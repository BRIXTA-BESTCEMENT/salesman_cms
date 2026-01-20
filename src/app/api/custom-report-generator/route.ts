// src/app/api/custom-report-generator/route.ts
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { transformerMap } from '@/lib/reports-transformer';
import { exportTablesToCSVZip, generateAndStreamXlsxMulti } from '@/lib/download-utils';

interface TableColumn {
    table: string;
    column: string;
}

// 1. Defined Interface (Matches Frontend)
interface FilterRule {
    id: string;
    column: string; 
    operator: 'contains' | 'equals' | 'gt' | 'lt';
    value: string;
}

type ReportTableId = keyof typeof transformerMap;

async function getAuthClaims() {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub || !claims.org_id) {
        return new NextResponse('Unauthorized', { status: 401 });
    }
    const currentUser = await prisma.user.findUnique({
        where: { workosUserId: claims.sub },
        select: { companyId: true, role: true },
    });
    
    if (!currentUser) {
        return new NextResponse('User not found', { status: 404 });
    }
    return { claims, currentUser };
}

function rowMatchesFilters(row: any, filters: FilterRule[], tableId: string): boolean {
    if (!filters || filters.length === 0) return true;

    return filters.every(rule => {
        // Skip filtering if this row doesn't have the column (multi-table safety)
        if (row[rule.column] === undefined) return true;

        const cellValue = String(row[rule.column] ?? '').toLowerCase();
        const filterValue = (rule.value ?? '').toLowerCase();

        if (!filterValue) return true;

        switch (rule.operator) {
            case 'contains':
                return cellValue.includes(filterValue);
            case 'equals':
                return cellValue === filterValue;
            case 'gt': {
                const nCell = parseFloat(cellValue);
                const nFilter = parseFloat(filterValue);
                if (!isNaN(nCell) && !isNaN(nFilter)) return nCell > nFilter;
                return cellValue > filterValue;
            }
            case 'lt': {
                const nCell = parseFloat(cellValue);
                const nFilter = parseFloat(filterValue);
                if (!isNaN(nCell) && !isNaN(nFilter)) return nCell < nFilter;
                return cellValue < filterValue;
            }
            default:
                return true;
        }
    });
}

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

export async function POST(req: NextRequest) {
    const authResult = await getAuthClaims();
    if (authResult instanceof NextResponse) return authResult;
    const { currentUser } = authResult;

    try {
        // FIX 1: Destructure 'filters' from the parsed JSON
        const body = await req.json();
        const { columns, format, limit, filters, styleOptions } = body as {
            columns: TableColumn[];
            format: 'xlsx' | 'csv' | 'json'; 
            limit?: number;
            filters?: FilterRule[];
            styleOptions?: any;
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
        
        // --- Handle PREVIEW Request (format: 'json') ---
        if (format === 'json' && tableIds.length > 0) {
            const previewTableId = tableIds[0];
            
            if (!(previewTableId in transformerMap)) {
                return NextResponse.json({ error: `Fetcher not found for table: ${previewTableId}` }, { status: 400 });
            }
            const fetcher = transformerMap[previewTableId as ReportTableId];
            
            // FIX 2: Explicitly type as any[] to solve the "Union Type" mismatch error
            let rows: any[] = await (fetcher as any)(currentUser.companyId); 
            
            // Apply Filters to Preview
            if (filters && filters.length > 0) {
                rows = rows.filter((r) => rowMatchesFilters(r, filters, previewTableId));
            }
            
            const previewCols = grouped[previewTableId];
            const previewData = rows
                .slice(0, limit || 10)
                .map(r => {
                    const obj: Record<string, any> = { id: r.id }; 
                    for (const c of previewCols) {
                        obj[c] = r[c] ?? null; 
                    }
                    return obj;
                });
            
            return NextResponse.json({ data: previewData });
        }

        // --- Handle DOWNLOAD Request (format: 'xlsx' or 'csv') ---
        const dataPerTable: Record<string, any[]> = {};
        for (const table of tableIds) {
            if (table in transformerMap) {
                const fn = transformerMap[table as ReportTableId];
                
                // FIX 3: Explicitly type as any[] here as well
                let rawRows: any[] = await (fn as any)(currentUser.companyId);

                // Apply Filters to Download Data
                if (filters && filters.length > 0) {
                    rawRows = rawRows.filter((row) => rowMatchesFilters(row, filters, table));
                }

                dataPerTable[table] = rawRows;
            }
        }

        const filenameBase = `custom-report-${Date.now()}`;

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
                    "Content-Disposition": `attachment; filename="${filenameBase}.zip"`,
                },
            });
        }
        
        if (format === 'xlsx') {
            const sheets = buildSheetsPayload(grouped, dataPerTable);
            // Pass styleOptions to the generator if needed (update generateAndStreamXlsxMulti signature in download-utils first)
            return generateAndStreamXlsxMulti(sheets, `${filenameBase}.xlsx`);
        }
        
        return NextResponse.json({ error: 'Invalid format specified' }, { status: 400 });

    } catch (e) {
        console.error('Custom report route error:', e);
        return NextResponse.json({ error: 'Failed to process report request.' }, { status: 500 });
    }
}