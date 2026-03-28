// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editDealerMapping/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from "next/server";
import { db } from '@/lib/drizzle';
import { users, dealers } from '../../../../../../../drizzle';
import { eq, and, or, isNull, inArray } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';

const allowedAdminRoles = ["Admin"];

export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.permissions.includes("READ")) {
      return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const userId = parseInt(url.searchParams.get("userId") || '0');
    if (!userId) return NextResponse.json({ error: "Invalid userId" }, { status: 400 });

    const [caller] = await db
      .select({ companyId: users.companyId, role: users.role })
      .from(users).where(eq(users.id, session.userId))
      .limit(1);
    if (!caller || !allowedAdminRoles.includes(caller.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const area = url.searchParams.get("area");
    const region = url.searchParams.get("region");

    // Fetch dealers for the company or unassigned ones
    const companyDealers = await db.select({ id: dealers.id, name: dealers.name, area: dealers.area, region: dealers.region })
      .from(dealers)
      .leftJoin(users, eq(dealers.userId, users.id))
      .where(and(
        or(eq(users.companyId, caller.companyId), isNull(dealers.userId)),
        area ? eq(dealers.area, area) : undefined,
        region ? eq(dealers.region, region) : undefined
      ));

    const assigned = await db.select({ id: dealers.id }).from(dealers).where(eq(dealers.userId, userId));

    return NextResponse.json({ dealers: companyDealers, assignedDealerIds: assigned.map(d => d.id) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const hasRequiredPerms = session.permissions.includes('UPDATE') || session.permissions.includes('WRITE');
    if (!hasRequiredPerms) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { userId, dealerIds } = await request.json();

    await db.transaction(async (tx) => {
      await tx.update(dealers).set({ userId: null }).where(eq(dealers.userId, userId));
      if (dealerIds.length > 0) {
        await tx.update(dealers).set({ userId }).where(inArray(dealers.id, dealerIds));
      }
    });

    return NextResponse.json({ message: "Dealer mapping updated" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}