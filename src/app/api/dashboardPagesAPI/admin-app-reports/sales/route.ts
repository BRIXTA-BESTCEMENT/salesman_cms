// src/app/api/dashboardPagesAPI/admin-app-reports/sales/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { salesReports } from '../../../../../../drizzle/schema';
import { desc } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';

export async function GET(request: NextRequest) {
    if (typeof connection === 'function') await connection();
    try {
        const session = await verifySession();
        if (!session || !session.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        // ✅ GET Latest Excel Data
        if (action === 'latest') {
            const [latestRow] = await db
                .select()
                .from(salesReports)
                .orderBy(desc(salesReports.reportDate))
                .limit(1);

            if (!latestRow) {
                return NextResponse.json({ success: true, data: null });
            }

            const recentRows = await db
                .select()
                .from(salesReports)
                .orderBy(desc(salesReports.reportDate))
                .limit(10);

            let bestCollectionData: any[] = [];
            for (const row of recentRows) {
                const cols = row.collectionDataPayload as any[];
                if (cols && cols.length > 0) {
                    bestCollectionData = cols;
                    break;
                }
            }

            return NextResponse.json({
                success: true,
                data: {
                    id: latestRow.id,
                    reportDate: latestRow.reportDate,
                    salesDataPayload: latestRow.salesDataPayload || [],
                    collectionDataPayload: bestCollectionData,
                }
            });
        }

        // ✅ GET All Manual Data
        if (action === 'manual-data') {
            const allReports = await db
                .select({
                    nonTrade: salesReports.nonTradeDataPayload,
                })
                .from(salesReports)
                .orderBy(desc(salesReports.createdAt));

            const aggregatedNonTrade: any[] = [];
            allReports.forEach((row) => {
                if (Array.isArray(row.nonTrade)) aggregatedNonTrade.push(...row.nonTrade);
            });

            return NextResponse.json({
                success: true,
                data: { nonTradeApprovals: aggregatedNonTrade }
            });
        }

        return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });

    } catch (err) {
        console.error("[SALES REPORT FETCH ERROR]", err);
        return NextResponse.json({ success: false, error: "Failed to fetch Sales report" }, { status: 500 });
    }
}