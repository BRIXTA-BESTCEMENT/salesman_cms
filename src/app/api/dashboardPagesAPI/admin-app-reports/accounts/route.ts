// src/app/api/dashboardPagesAPI/admin-app-reports/accounts/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { accountsReports } from '../../../../../../drizzle/schema';
import { desc, eq, gte, lte, and } from 'drizzle-orm';
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

        // ✅ GET Latest Report
        if (action === 'latest') {
            const result = await db
                .select()
                .from(accountsReports)
                .orderBy(desc(accountsReports.reportDate))
                .limit(1);

            return NextResponse.json({
                success: true,
                data: result.length > 0 ? result[0] : null,
            });
        }

        // ✅ GET All Reports (Default)
        const reportDate = searchParams.get('reportDate');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        const conditions = [];

        if (reportDate) conditions.push(eq(accountsReports.reportDate, reportDate));
        if (fromDate) conditions.push(gte(accountsReports.reportDate, fromDate));
        if (toDate) conditions.push(lte(accountsReports.reportDate, toDate));

        const reports = await db
            .select()
            .from(accountsReports)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(accountsReports.reportDate));

        return NextResponse.json({
            success: true,
            count: reports.length,
            data: reports,
        });

    } catch (err) {
        console.error("[ACCOUNTS REPORTS ERROR]", err);
        return NextResponse.json({
            success: false,
            error: "Failed to fetch accounts reports",
        }, { status: 500 });
    }
}