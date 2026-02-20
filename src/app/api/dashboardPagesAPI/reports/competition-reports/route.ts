// src/app/api/dashboardPagesAPI/reports/competition-reports/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod'; // 1. Added Zod Import
import {competitionReportSchema} from '@/lib/shared-zod-schema';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',];

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User to check role and companyId
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true } // Optimized selection
    });

    // --- UPDATED ROLE-BASED AUTHORIZATION ---
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Only the following roles can view competition reports: ${allowedRoles.join(', ')}` }, { status: 403 });
    }

    // Fetch Competition Reports for the current user's company
    const competitionReports = await prisma.competitionReport.findMany({
      where: {
        user: { // Access the User relation
          companyId: currentUser.companyId, // Filter by the admin/manager's company
        },
      },
      include: {
        user: { // Include salesman details to get their name
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        reportDate: 'desc', // Order by latest reports first
      },
    });

    // Map the data to match the frontend's CompetitionReport schema (camelCase, combined fields)
    const formattedReports = competitionReports.map((report:any) => ({
      id: report.id,
      salesmanName: `${report.user.firstName || ''} ${report.user.lastName || ''}`.trim() || report.user.email,
      brandName: report.brandName,
      date: report.reportDate.toISOString().split('T')[0], // Format date as YYYY-MM-DD string
      billing: report.billing,
      nod: report.nod,
      retail: report.retail,
      schemesYesNo: report.schemesYesNo,
      avgSchemeCost: report.avgSchemeCost.toNumber(), // Convert Decimal to Number
      remarks: report.remarks || '', // Ensure remarks is a string, even if null in DB
      // ADDED: Missing timestamp fields
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    }));

    // 3. Added Zod Validation
    const validated = z.array(competitionReportSchema).parse(formattedReports);

    return NextResponse.json(validated, { status: 200 });
  } catch (error) {
    console.error('Error fetching competition reports:', error);
    return NextResponse.json({ error: 'Failed to fetch competition reports', details: (error as Error).message }, { status: 500 });
  }
}
