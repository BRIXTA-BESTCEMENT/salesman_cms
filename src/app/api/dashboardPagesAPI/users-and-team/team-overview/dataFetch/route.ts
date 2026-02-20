// src/app/api/dashboardPagesAPI/users-and-team/team-overview/dataFetch/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { Prisma, PrismaClient } from '../../../../../../../prisma/generated/client';
import { ROLE_HIERARCHY } from '@/lib/roleHierarchy';

// Define the roles that are allowed to view the Team Overview page.
// This list includes all roles except 'junior-executive' and 'executive'.
const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',];

export async function GET(request: NextRequest) {
  await connection();
  try {
    // 1. Get the claims from the JWT.
    const claims = await getTokenClaims();

    // 2. Authentication Check: Ensure a user is logged in.
    if (!claims || !claims.sub) {
      console.log('Unauthorized access: No claims or subject found.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Fetch the current user to get their role and companyId.
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      include: { company: true },
    });

    // 4. Role-Based Authorization Check: Ensure the user has the correct role.
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      console.log(`Forbidden access: User with role '${currentUser?.role}' attempted to access team overview.`);
      return NextResponse.json(
        { error: `Forbidden: Only the following roles can view this page: ${allowedRoles.join(', ')}` },
        { status: 403 }
      );
    }

    // Read and validate role filter from query string
    const roleParam = request.nextUrl.searchParams.get('role') ?? undefined;
    const roleFilter =
      roleParam && roleParam !== 'all' && ROLE_HIERARCHY.includes(roleParam) ? roleParam : undefined;

    const whereClause: any = {
      companyId: currentUser.companyId,
    };
    if (roleFilter) {
      whereClause.role = roleFilter;
    }
    // 5. Fetch all users within the same company as the current user.
    // The include block is updated to use the correct relation names from your schema: 'reportsTo' and 'reports'.
    const teamMembers = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        area: true, // You may need area/region for display/future filtering
        region: true,
        reportsToId: true,
  
        isTechnicalRole: true, 
        reportsTo: true, // Includes the manager's data
        reports: true, // Includes the list of direct reports
      },
      orderBy: {
        firstName: 'asc',
      },
    });

    // 6. Format the data for the frontend table.
    const formattedTeamData = teamMembers.map((member:any) => {
      // Create the managedBy string from the manager's first and last name using the 'reportsTo' relation.
      const managedBy = member.reportsTo
        ? `${member.reportsTo.firstName || ''} ${member.reportsTo.lastName || ''}`.trim()
        : 'none';

      // Create a comma-separated string of direct report names using the 'reports' relation.
      const manages = member.reports
        .map((report:any) => `${report.firstName || ''} ${report.lastName || ''}`.trim())
        .filter(Boolean) // Filter out any empty strings
        .join(', ') || 'None';

      // Create a structured array of objects for the popover
      const managesReports = member.reports.map((report:any) => ({
        name: `${report.firstName || ''} ${report.lastName || ''}`.trim(),
        role: report.role,
      }));

      const managesIds = member.reports.map((report:any) => report.id);

      return {
        id: member.id,
        name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
        role: member.role,
        managedBy,
        manages,
        managesReports,
        managedById: member.reportsToId,
        managesIds,
        isTechnicalRole: member.isTechnicalRole,
      };
    });

    // 7. Return the formatted data.
    return NextResponse.json(formattedTeamData, { status: 200 });

  } catch (error) {
    console.error('Error fetching team data:', error);
    // Handle specific Prisma errors if needed, otherwise return a generic server error.
    if (error instanceof PrismaClient) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
