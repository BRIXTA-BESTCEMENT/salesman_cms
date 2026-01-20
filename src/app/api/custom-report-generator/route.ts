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

type ReportTableId = keyof typeof transformerMap;

// --- Auth Check ---
async function getAuthClaims() {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub || !claims.org_id) {
        return new NextResponse('Unauthorized', { status: 401 });
    }
    // Fetch user and company ID (essential for scoping data)
    const currentUser = await prisma.user.findUnique({
        where: { workosUserId: claims.sub },
        select: { companyId: true, role: true },
    });
    
    if (!currentUser) {
        return new NextResponse('User not found', { status: 404 });
    }
    // Note: Returning companyId is essential for data scoping
    return { claims, currentUser };
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
        // 2. Parse Payload from the frontend component (page.tsx)
        const { columns, format, limit } = await req.json() as {
            columns: TableColumn[];
            format: 'xlsx' | 'csv' | 'json'; 
            limit?: number;
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
            const rows = await (fetcher as any)(currentUser.companyId); 
            
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
            
            // Success: Returns JSON to the client for the DataTablePreview
            return NextResponse.json({ data: previewData });
        }

        // --- 5. Handle DOWNLOAD Request (format: 'xlsx' or 'csv') ---
        
        // Fetch ALL data for ALL selected tables
        const dataPerTable: Record<string, any[]> = {};
        for (const table of tableIds) {
            if (table in transformerMap) {
                const fn = transformerMap[table as ReportTableId];
                dataPerTable[table] = await (fn as any)(currentUser.companyId);
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
            return generateAndStreamXlsxMulti(sheets, `${filenameBase}.xlsx`);
        }
        
        return NextResponse.json({ error: 'Invalid format specified' }, { status: 400 });

    } catch (e) {
        console.error('Custom report route error:', e);
        return NextResponse.json({ error: 'Failed to process report request. Check data format in transformers.' }, { status: 500 });
    }
}