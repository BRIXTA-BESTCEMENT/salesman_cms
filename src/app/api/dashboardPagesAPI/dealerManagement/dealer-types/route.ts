// src/app/api/dashboardPagesAPI/dealerManagement/dealer-types/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, dealers } from '../../../../../../drizzle';
import { eq } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';

export async function GET() {
  await connection();
  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.permissions.includes('READ')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // Fetch all unique types for the current company's dealers
    const uniqueTypes = await db
      .selectDistinct({ type: dealers.type })
      .from(dealers)
      .leftJoin(users, eq(dealers.userId, users.id))
      .where(eq(users.companyId, session.companyId));

    // Extract the string values from the query results and filter out nulls
    const type = uniqueTypes.map((a) => a.type).filter(Boolean);

    return NextResponse.json({ type }, { status: 200 });

  } catch (error) {
    console.error('Error fetching types:', error);
    return NextResponse.json({ error: 'Failed to fetch types' }, { status: 500 });
  }
}