// src/app/api/dashboardPagesAPI/users-and-team/team-overview/dataFetch/route.ts
import 'server-only';
import { NextRequest, NextResponse, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, roles, userRoles } from '../../../../../../../drizzle';
import { eq, and, sql } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();

  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.permissions.includes('READ')) {
      return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role');

    // 1. Database-Level Filtering
    const filters = [eq(users.companyId, session.companyId)];

    if (roleFilter && roleFilter !== 'all') {
      filters.push(eq(roles.orgRole, roleFilter));
    }

    // 2. Fetch and Aggregate inside Postgres
    const rawMembers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        reportsToId: users.reportsToId,
        area: users.area,
        region: users.region,
        isTechnicalRole: users.isTechnicalRole,
        orgRole: sql<string>`COALESCE(MAX(${roles.orgRole}), 'Unassigned')`,
        jobRole: sql<string[]>`COALESCE(array_agg(${roles.jobRole}) FILTER (WHERE ${roles.jobRole} IS NOT NULL), '{}')`
      })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .leftJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(...filters))
      // FIX: Explicitly list all selected raw columns in the groupBy
      .groupBy(
        users.id,
        users.firstName,
        users.lastName,
        users.reportsToId,
        users.area,
        users.region,
        users.isTechnicalRole
      );

    // 3. Fast In-Memory Manager Lookup
    const userMap = new Map<number, { name: string; orgRole: string }>();
    rawMembers.forEach((m) => {
      userMap.set(m.id, {
        name: `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || 'Unknown',
        orgRole: m.orgRole || 'N/A',
      });
    });

    // 4. Map the Final Hierarchy
    const formattedTeam = rawMembers.map((member) => {
      const memberName = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || 'Unknown';
      const manager = member.reportsToId ? userMap.get(member.reportsToId) : null;

      const directReports = rawMembers
        .filter((sub) => sub.reportsToId === member.id)
        .map((sub) => ({
          name: `${sub.firstName ?? ''} ${sub.lastName ?? ''}`.trim() || 'Unknown',
          orgRole: sub.orgRole || 'N/A',
        }));

      const managesIds = rawMembers
        .filter((sub) => sub.reportsToId === member.id)
        .map((sub) => sub.id);

      return {
        id: member.id,
        name: memberName,
        orgRole: member.orgRole,
        jobRole: member.jobRole || [],
        managedBy: manager ? manager.name : null,
        manages: directReports.length > 0 ? `${directReports.length} direct reports` : 'None',
        managedById: member.reportsToId,
        managesIds: managesIds,
        managesReports: directReports,
        area: member.area,
        region: member.region,
        isTechnicalRole: Boolean(member.isTechnicalRole),
      };
    });

    // 5. Sort alphabetically by name
    formattedTeam.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(formattedTeam, { status: 200 });
  } catch (error: any) {
    console.error('Failed to fetch team overview data:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}