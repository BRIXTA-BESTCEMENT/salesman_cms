// src/app/api/dashboardPagesAPI/logistics-io/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, logisticsIO } from '../../../../../drizzle';
import { eq, and, gte, lte, ilike, desc } from 'drizzle-orm';
import { z } from 'zod';
import { selectLogisticsIOSchema } from '../../../../../drizzle/zodSchemas';
import { verifySession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();

  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.permissions.includes('READ')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // --- 3. FILTER LOGIC ---
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const zoneParam = searchParams.get('zone');
    const districtParam = searchParams.get('district');
    const sourceParam = searchParams.get('sourceName');

    // Build the dynamic where clause for Drizzle
    const filters = [];

    // Date Filter (Postgres timestamps in Drizzle mode: 'string' or 'date')
    if (startDateParam) {
      const start = new Date(startDateParam);
      const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
      end.setHours(23, 59, 59, 999);

      filters.push(gte(logisticsIO.createdAt, start));
      filters.push(lte(logisticsIO.createdAt, end));
    }

    // Prisma's `equals: x, mode: 'insensitive'` is the exact equivalent of SQL ILIKE without wildcards
    if (zoneParam) {
      filters.push(ilike(logisticsIO.zone, zoneParam));
    }
    if (districtParam) {
      filters.push(ilike(logisticsIO.district, districtParam));
    }
    if (sourceParam) {
      filters.push(ilike(logisticsIO.partyName, sourceParam));
    }

    // 4. Fetch Data
    const logisticsRecords = await db
      .select()
      .from(logisticsIO)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(logisticsIO.createdAt));

    // 5. Map Data to Schema
    const formattedRecords = logisticsRecords.map((record) => {
      return {
        ...record,
        // Fallback null arrays to empty arrays so Zod validation passes safely
        invoiceNos: record.invoiceNos ?? [],
        billNos: record.billNos ?? [],
        gateOutInvoiceNos: record.gateOutInvoiceNos ?? [],
        gateOutBillNos: record.gateOutBillNos ?? [],

        // Note: Drizzle's date() natively returns standard strings ('YYYY-MM-DD')
        // Timestamps are already strings due to `mode: 'string'` in your schema.
        // We ensure strict ISO string format for timestamps just in case.
        createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : new Date().toISOString(),
      };
    });

    // 6. Zod Validation using the Drizzle-baked schema
    // Safe parse prevents a 500 error if a single row has a slight structural anomaly
    const validatedData = z.array(selectLogisticsIOSchema).safeParse(formattedRecords);

    if (!validatedData.success) {
      console.error("Logistics Validation Error:", validatedData.error.format());
      // Return unvalidated data as fallback so the UI table doesn't completely crash, 
      // but the console logs the exact Zod error to fix later.
      return NextResponse.json(formattedRecords, { status: 200 });
    }

    return NextResponse.json(validatedData.data, { status: 200 });

  } catch (error) {
    console.error('Error fetching logistics reports:', error);
    return NextResponse.json(
      { message: 'Failed to fetch logistics reports', error: (error as Error).message },
      { status: 500 }
    );
  }
}