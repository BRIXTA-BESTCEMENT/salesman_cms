// src/app/api/dashboardPagesAPI/slm-geotracking/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, journeyOps, companies } from '../../../../../drizzle';
import { eq, and, gte, lte, desc, sql, getTableColumns } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectJourneyOpsSchema } from '../../../../../drizzle/zodSchemas';

// Roles allowed to view tracking
const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',
];

// 1. Extend the baked DB schema to explicitly type the JSONB extracted fields
const frontendTrackingSchema = selectJourneyOpsSchema.extend({
  id: z.string(), // explicitly mapping the opId to a string ID
  salesmanName: z.string(),
  employeeId: z.string().nullable().optional(),
  workosOrganizationId: z.string().nullable().optional(),
  salesmanRole: z.string(),
  area: z.string(),
  region: z.string(),
  
  // Extracted JSON payload fields mapped to strict types
  latitude: z.number(),
  longitude: z.number(),
  totalDistanceTravelled: z.number(),
  recordedAt: z.string(),
  accuracy: z.number().nullable(),
  speed: z.number().nullable(),
  heading: z.number().nullable(),
  altitude: z.number().nullable(),
  locationType: z.string().nullable(),
  activityType: z.string().nullable(),
  appState: z.string().nullable(),
  batteryLevel: z.number().nullable(),
  isCharging: z.boolean(),
  networkStatus: z.string().nullable(),
  ipAddress: z.string().nullable(),
  siteName: z.string().nullable(),
  checkInTime: z.string().nullable(),
  checkOutTime: z.string().nullable(),
  isActive: z.boolean(),
  destLat: z.number().nullable(),
  destLng: z.number().nullable(),
  
  createdAt: z.string(),
  updatedAt: z.string(),
});

// 2. Explicit type to survive Next.js 'use cache' boundary collapse
type TrackingRow = InferSelectModel<typeof journeyOps> & {
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  userRole: string | null;
  userArea: string | null;
  userRegion: string | null;
  userSalesmanLoginId: string | null;
  companyWorkosOrgId: string | null;
};

// 3. The Cached Function
async function getCachedTracking(companyId: number, startDateParam: string | null, endDateParam: string | null) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`slm-geotracking-${companyId}`);

  const filters = [eq(users.companyId, companyId)];

  // JSONB Filter for status: 'COMPLETED' using native Drizzle SQL tag
  filters.push(sql`${journeyOps.payload} @> '{"status": "COMPLETED"}'::jsonb`);

  if (startDateParam) {
    const start = new Date(startDateParam);
    const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
    end.setHours(23, 59, 59, 999);

    filters.push(gte(journeyOps.createdAt, start.toISOString()));
    filters.push(lte(journeyOps.createdAt, end.toISOString()));
  }

  // Use getTableColumns to flatten the query and bypass TS inference bugs
  const results: TrackingRow[] = await db
    .select({
      ...getTableColumns(journeyOps),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      userRole: users.role,
      userArea: users.area,
      userRegion: users.region,
      userSalesmanLoginId: users.salesmanLoginId,
      companyWorkosOrgId: companies.workosOrganizationId,
    })
    .from(journeyOps)
    .leftJoin(users, eq(journeyOps.userId, users.id))
    .leftJoin(companies, eq(users.companyId, companies.id))
    .where(and(...filters))
    .orderBy(desc(journeyOps.createdAt))
    .limit(startDateParam ? 1000 : 350);

  return results.map((row) => {
    // Safely extract from the JSONB payload
    const payload = (row.payload && typeof row.payload === 'object') ? row.payload as any : {};

    return {
      ...row,
      id: String(row.opId), // Convert bigint to string safely for the frontend
      salesmanName: row.userFirstName && row.userLastName ? `${row.userFirstName} ${row.userLastName}` : row.userEmail || 'Unknown',
      employeeId: row.userSalesmanLoginId ?? null,
      workosOrganizationId: row.companyWorkosOrgId ?? null,
      salesmanRole: row.userRole ?? '',
      area: row.userArea ?? '',
      region: row.userRegion ?? '',
      
      // JSON Payload extraction
      latitude: Number(payload.latitude) || 0,
      longitude: Number(payload.longitude) || 0,
      totalDistanceTravelled: Number(payload.totalDistance) || 0,
      recordedAt: payload.endedAt || (row.createdAt ? new Date(row.createdAt).toISOString() : ''),
      accuracy: Number(payload.accuracy) || null,
      speed: Number(payload.speed) || null,
      heading: Number(payload.heading) || null,
      altitude: Number(payload.altitude) || null,
      locationType: payload.locationType || row.type,
      activityType: payload.activityType || null,
      appState: payload.appState || null,
      batteryLevel: Number(payload.batteryLevel) || null,
      isCharging: Boolean(payload.isCharging),
      networkStatus: payload.networkStatus || null,
      ipAddress: payload.ipAddress || null,
      siteName: payload.siteName || null,
      checkInTime: payload.checkInTime || null,
      checkOutTime: payload.checkOutTime || null,
      isActive: Boolean(payload.isActive),
      destLat: Number(payload.destLat) || null,
      destLng: Number(payload.destLng) || null,
      
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
      updatedAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
    };
  });
}

export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();

  try {
    const claims = await getTokenClaims();

    // 1. Authentication
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch User & Company via Drizzle
    const currentUserResult = await db
      .select({ id: users.id, role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Date Filters
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const formattedReports = await getCachedTracking(currentUser.companyId, startDateParam, endDateParam);

    // 4. Validate using extended schema safely
    const validatedData = z.array(frontendTrackingSchema).safeParse(formattedReports);

    if (!validatedData.success) {
      console.error("Tracking Geo Validation Error:", validatedData.error.format());
      
      // Fallback response with bigint sanitizer
      const safeDataFallback = JSON.parse(
        JSON.stringify(formattedReports, (_, v) => typeof v === "bigint" ? Number(v) : v)
      );
      return NextResponse.json(safeDataFallback, { status: 200 });
    }

    // Pass the strictly validated data through the bigint JSON stringifier safely
    const safeData = JSON.parse(
      JSON.stringify(validatedData.data, (_, v) =>
        typeof v === "bigint" ? Number(v) : v
      )
    );

    return NextResponse.json(safeData, { status: 200 });

  } catch (error) {
    console.error('Error fetching tracking data:', error);
    return NextResponse.json({ error: 'Failed to fetch tracking data', details: (error as Error).message }, { status: 500 });
  }
}