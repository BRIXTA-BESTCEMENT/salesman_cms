// src/app/api/dashboardPagesAPI/users-and-team/team-overview/dataFetch/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { users } from '../../../../../../../drizzle';
import { eq, and, asc, aliasedTable } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectUserSchema } from '../../../../../../../drizzle/zodSchemas';
import { verifySession } from '@/lib/auth';

// Explicitly define the UserRow type
type UserRow = InferSelectModel<typeof users>;

export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();

  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.permissions.includes("READ")) {
      return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
    }

    const roleParam = request.nextUrl.searchParams.get('role');
    const roleFilter = roleParam && roleParam !== 'all' ? roleParam : undefined;

    const managers = aliasedTable(users, 'managers');

    // Simple conditions: Just their company, and optionally a specific role
    const conditions = [
      eq(users.companyId, session.companyId),
      ...(roleFilter ? [eq(users.role, roleFilter)] : []),
    ];

    // Explicitly typed to prevent the TypeScript 'never' errors
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

    const formattedTeamData = await Promise.all(teamMembers.map(async ({ member, managerFirstName, managerLastName }) => {
      // Fetch direct reports
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
    console.error("Team Overview Fetch Error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}