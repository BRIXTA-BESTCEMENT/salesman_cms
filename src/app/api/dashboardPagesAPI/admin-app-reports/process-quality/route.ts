// src/app/api/dashboardPagesAPI/admin-app-reports/process-quality/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { processReports } from '../../../../../../drizzle/schema';
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

        // ✅ GET Latest Process Report
        if (action === 'latest') {
            const result = await db
                .select()
                .from(processReports)
                .orderBy(desc(processReports.reportDate))
                .limit(1);

            return NextResponse.json({
                success: true,
                data: result.length > 0 ? result[0] : null,
            });
        }

        // ✅ GET All Process Reports
        const reportDate = searchParams.get('reportDate');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        const conditions = [];

        if (reportDate) conditions.push(eq(processReports.reportDate, reportDate));
        if (fromDate) conditions.push(gte(processReports.reportDate, fromDate));
        if (toDate) conditions.push(lte(processReports.reportDate, toDate));

        const reports = await db
            .select()
            .from(processReports)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(processReports.reportDate));

        return NextResponse.json({
            success: true,
            count: reports.length,
            data: reports,
        });

    } catch (err) {
        console.error("[PROCESS REPORTS ERROR]", err);
        return NextResponse.json({
            success: false,
            error: "Failed to fetch process reports",
        }, { status: 500 });
    }
}