// src/app/api/dashboardPagesAPI/users-and-team/team-overview/dataFetch/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users } from '../../../../../../../drizzle';
import { eq, and, asc, aliasedTable } from 'drizzle-orm';
import type { InferSelectModel } from "drizzle-orm";
import { ROLE_HIERARCHY } from '@/lib/roleHierarchy';
import { z } from 'zod';
import { selectUserSchema } from '../../../../../../../drizzle/zodSchemas';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',];

type UserRow = InferSelectModel<typeof users>;

export async function GET(request: NextRequest) {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ id: users.id, role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden` }, { status: 403 });
    }

    const roleParam = request.nextUrl.searchParams.get('role') ?? undefined;
    const roleFilter = roleParam && roleParam !== 'all' && ROLE_HIERARCHY.includes(roleParam) ? roleParam : undefined;

    // Self-join aliases for hierarchy
    const managers = aliasedTable(users, 'managers');
    const reports = aliasedTable(users, 'reports');
    const conditions = [
      eq(users.companyId, currentUser.companyId),
      ...(roleFilter ? [eq(users.role, roleFilter)] : []),
    ];

    const teamMembers: {
      member: UserRow;
      managerFirstName: string | null;
      managerLastName: string | null;
    }[] = await db
      .select({
        member: users,
        managerFirstName: managers.firstName,
        managerLastName: managers.lastName,
      })
      .from(users)
      .leftJoin(managers, eq(users.reportsToId, managers.id))
      .where(and(...conditions))
      .orderBy(asc(users.firstName));

    // Fetch reports in a separate step to avoid massive Cartesian products from double-joins
    const formattedTeamData = await Promise.all(teamMembers.map(async ({ member, managerFirstName, managerLastName }) => {
      const directReports = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, role: users.role })
        .from(users)
        .where(eq(users.reportsToId, member.id));

      const managedBy = managerFirstName ? `${managerFirstName} ${managerLastName || ''}`.trim() : 'none';
      const manages = directReports.map(r => `${r.firstName || ''} ${r.lastName || ''}`.trim()).filter(Boolean).join(', ') || 'None';

      return {
        ...member,
        name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
        managedBy,
        manages,
        managesReports: directReports.map(r => ({ name: `${r.firstName || ''} ${r.lastName || ''}`.trim(), role: r.role })),
        managedById: member.reportsToId,
        managesIds: directReports.map(r => r.id),
      };
    }));

    return NextResponse.json(z.array(selectUserSchema.loose()).parse(formattedTeamData), { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}