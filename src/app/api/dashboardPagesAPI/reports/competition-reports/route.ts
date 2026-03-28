// src/app/api/dashboardPagesAPI/reports/competition-reports/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, competitionReports } from '../../../../../../drizzle';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { selectCompetitionReportSchema } from '../../../../../../drizzle/zodSchemas';
import { verifySession } from '@/lib/auth';


export async function GET() {
  if (typeof connection === 'function') await connection();

  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.permissions.includes("READ")) {
      return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
    }

    // 3. Fetch Competition Reports for the current company
    const reportsResult = await db
      .select({
        report: competitionReports,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }
      })
      .from(competitionReports)
      .leftJoin(users, eq(competitionReports.userId, users.id))
      .where(eq(users.companyId, session.companyId))
      .orderBy(desc(competitionReports.reportDate));

    // 4. Map Data to Schema
    const formattedReports = reportsResult.map(({ report, user }) => ({
      ...report,
      salesmanName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Unknown',
      date: report.reportDate ? new Date(report.reportDate).toISOString().split('T')[0] : '',
      // Send the raw value. The frontend Zod schema will safely coerce this to a number!
      avgSchemeCost: report.avgSchemeCost,
      remarks: report.remarks || '',
      createdAt: report.createdAt ? new Date(report.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: report.updatedAt ? new Date(report.updatedAt).toISOString() : new Date().toISOString(),
    }));

    // 5. Zod Validation using safeParse
    const validated = z.array(selectCompetitionReportSchema.loose()).safeParse(formattedReports);

    // If backend validation fails, log it but still return the data to the frontend gracefully
    if (!validated.success) {
      console.warn('Backend Zod Validation Warning:', validated.error.format());
      return NextResponse.json(formattedReports, { status: 200 });
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch (error) {
    console.error('Error fetching competition reports:', error);
    return NextResponse.json({
      error: 'Failed to fetch competition reports',
      details: (error as Error).message
    }, { status: 500 });
  }
}