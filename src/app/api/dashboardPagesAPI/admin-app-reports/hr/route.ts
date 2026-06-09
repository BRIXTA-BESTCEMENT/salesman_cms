// src/app/api/dashboardPagesAPI/admin-app-reports/hr/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { hrReports } from '../../../../../../drizzle/schema';
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

        // ✅ GET Latest Excel Report
        if (action === 'latest') {
            const result = await db
                .select()
                .from(hrReports)
                .orderBy(desc(hrReports.reportDate))
                .limit(1);

            return NextResponse.json({ success: true, data: result.length ? result[0] : null });
        }

        // ✅ GET All Manual Data
        if (action === 'manual-data') {
            const allReports = await db
                .select({
                    vacancies: hrReports.vacancies,
                    underperformersPlant: hrReports.underperformersPlant,
                    underperformersHO: hrReports.underperformersHO,
                    statutoryClearances: hrReports.statutoryClearances,
                    interviewCandidates: hrReports.interviewCandidates,
                })
                .from(hrReports)
                .orderBy(desc(hrReports.createdAt));

            const aggregatedVacancies: any[] = [];
            const aggregatedPlant: any[] = [];
            const aggregatedHO: any[] = [];
            const aggregatedClearances: any[] = [];
            const aggregatedInterviews: any[] = [];

            allReports.forEach((row) => {
                if (Array.isArray(row.vacancies)) aggregatedVacancies.push(...row.vacancies);
                if (Array.isArray(row.underperformersPlant)) aggregatedPlant.push(...row.underperformersPlant);
                if (Array.isArray(row.underperformersHO)) aggregatedHO.push(...row.underperformersHO);
                if (Array.isArray(row.statutoryClearances)) aggregatedClearances.push(...row.statutoryClearances);
                if (Array.isArray(row.interviewCandidates)) aggregatedInterviews.push(...row.interviewCandidates);
            });

            return NextResponse.json({
                success: true,
                data: {
                    vacancies: aggregatedVacancies,
                    underperformersPlant: aggregatedPlant,
                    underperformersHO: aggregatedHO,
                    statutoryClearances: aggregatedClearances,
                    interviewCandidates: aggregatedInterviews,
                }
            });
        }

        return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });

    } catch (err) {
        console.error("[HR REPORT FETCH ERROR]", err);
        return NextResponse.json({ success: false, error: "Failed to fetch HR report" }, { status: 500 });
    }
}