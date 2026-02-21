// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editDealerMapping/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from "next/server";
import { getTokenClaims } from "@workos-inc/authkit-nextjs";
import { db } from '@/lib/drizzle';
import { users, dealers } from '../../../../../../../drizzle';
import { eq, and, or, isNull, inArray } from 'drizzle-orm';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager', 
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager', 
  'senior-manager', 'manager', 'assistant-manager'];

export async function GET(request: NextRequest) {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const userId = parseInt(url.searchParams.get("userId") || '0');
    if (!userId) return NextResponse.json({ error: "Invalid userId" }, { status: 400 });

    const [caller] = await db.select({ companyId: users.companyId, role: users.role }).from(users).where(eq(users.workosUserId, claims.sub)).limit(1);
    if (!caller || !allowedRoles.includes(caller.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    const claims = await getTokenClaims();
    if (!claims?.sub || !allowedRoles.includes(claims.role as string)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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