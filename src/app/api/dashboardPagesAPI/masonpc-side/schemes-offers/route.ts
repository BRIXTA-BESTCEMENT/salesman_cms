// src/app/api/dashboardPagesAPI/masonpc-side/schemes-offers/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, schemesOffers } from '../../../../../../drizzle';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { selectSchemesOffersSchema, insertSchemesOffersSchema } from '../../../../../../drizzle/zodSchemas';
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

    const schemes = await db
      .select()
      .from(schemesOffers)
      .orderBy(desc(schemesOffers.startDate))
      .limit(500);

    const formattedSchemes = schemes.map(scheme => ({
      ...scheme,
      startDate: scheme.startDate ?? null,
      endDate: scheme.endDate ?? null,
    }));

    const validatedSchemes = z.array(selectSchemesOffersSchema).parse(formattedSchemes);
    return NextResponse.json(validatedSchemes, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching schemes:', error);
    return NextResponse.json({ error: 'Failed to fetch data', details: error.message }, { status: 500 });
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

    const body = await request.json();
    // Validate against baked insert schema
    const parsed = insertSchemesOffersSchema.parse({
      name: body.name,
      description: body.description,
      startDate: body.startDate ? new Date(body.startDate).toISOString() : null,
      endDate: body.endDate ? new Date(body.endDate).toISOString() : null,
    });

    const [newScheme] = await db
      .insert(schemesOffers)
      .values(parsed)
      .returning();

    return NextResponse.json(newScheme, { status: 201 });
  } catch (error: any) {
    console.error('Error creating scheme:', error);
    return NextResponse.json({ error: 'Failed to create scheme', details: error.message }, { status: 500 });
  }
}