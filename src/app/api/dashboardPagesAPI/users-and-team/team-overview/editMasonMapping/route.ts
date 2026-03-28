// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editMasonMapping/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from "next/server";
import { db } from '@/lib/drizzle';
import { users, masonPcSide, dealers } from '../../../../../../../drizzle';
import { eq, and, or, isNull, inArray } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';

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
    const [caller] = await db
      .select({ companyId: users.companyId, role: users.role })
      .from(users).where(eq(users.id, session.userId))
      .limit(1);

    const area = url.searchParams.get("area");
    const region = url.searchParams.get("region");

    const masons = await db.select({
      id: masonPcSide.id,
      name: masonPcSide.name,
      phoneNumber: masonPcSide.phoneNumber,
      dealerName: dealers.name,
      dealerArea: dealers.area,
      dealerRegion: dealers.region
    })
      .from(masonPcSide)
      .leftJoin(users, eq(masonPcSide.userId, users.id))
      .leftJoin(dealers, eq(masonPcSide.dealerId, dealers.id))
      .where(and(
        or(eq(users.companyId, caller.companyId), isNull(masonPcSide.userId)),
        area ? eq(dealers.area, area) : undefined,
        region ? eq(dealers.region, region) : undefined
      ));

    const assigned = await db.select({ id: masonPcSide.id }).from(masonPcSide).where(eq(masonPcSide.userId, userId));

    return NextResponse.json({
      masons: masons.map(m => ({ ...m, dealer: { name: m.dealerName, area: m.dealerArea, region: m.dealerRegion } })),
      assignedMasonIds: assigned.map(m => m.id)
    });
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

    const { userId, masonIds } = await request.json();

    await db.transaction(async (tx) => {
      await tx.update(masonPcSide).set({ userId: null }).where(eq(masonPcSide.userId, userId));
      if (masonIds.length > 0) {
        await tx.update(masonPcSide).set({ userId }).where(inArray(masonPcSide.id, masonIds));
      }
    });

    return NextResponse.json({ message: "Mason mapping updated" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}