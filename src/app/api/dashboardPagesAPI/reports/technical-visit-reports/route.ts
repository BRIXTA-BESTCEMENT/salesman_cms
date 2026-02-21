// src/app/api/dashboardPagesAPI/reports/technical-visit-reports/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, technicalVisitReports } from '../../../../../../drizzle';
import { eq, desc, getTableColumns } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod'; 
import { selectTechnicalVisitReportSchema } from '../../../../../../drizzle/zodSchemas';

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive',
];

const getISTDateString = (date: string | Date | null) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// 1. Extend the baked DB schema to strictly type the joined and formatted fields
const frontendTechnicalReportSchema = selectTechnicalVisitReportSchema.extend({
  salesmanName: z.string(),
  role: z.string(),
  area: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  date: z.string(),
  
  // Overriding decimal/numeric types from DB strings to JS numbers
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  currentBrandPrice: z.number().nullable(),
  siteStock: z.number().nullable(),
  estRequirement: z.number().nullable(),
  conversionQuantityValue: z.number().nullable(),
  
  // Enforce the empty string fallbacks for the frontend
  conversionFromBrand: z.string(),
  conversionQuantityUnit: z.string(),
  serviceType: z.string(),
  qualityComplaint: z.string(),
  promotionalActivity: z.string(),
  channelPartnerVisit: z.string(),
  siteVisitStage: z.string(),
  associatedPartyName: z.string(),
  
  // Formatting standardizations
  checkInTime: z.string(),
  checkOutTime: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  firstVisitTime: z.string().nullable(),
  lastVisitTime: z.string().nullable(),
});

// 2. Explicit type to survive Next.js 'use cache' boundary collapse
type TechnicalReportRow = InferSelectModel<typeof technicalVisitReports> & {
  userFirstName: string | null;
  userLastName: string | null;
  userRole: string | null;
  userEmail: string | null;
  userArea: string | null;
  userRegion: string | null;
};

// 3. The Cached Function
async function getCachedTechnicalVisitReports(companyId: number) {
  'use cache';
  cacheLife('hours');
  cacheTag(`technical-visit-reports-${companyId}`);

  // Use getTableColumns and explicit typing to prevent `never[]` collapse
  const results: TechnicalReportRow[] = await db
    .select({
      ...getTableColumns(technicalVisitReports),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userRole: users.role,
      userEmail: users.email,
      userArea: users.area,
      userRegion: users.region,
    })
    .from(technicalVisitReports)
    .leftJoin(users, eq(technicalVisitReports.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(technicalVisitReports.reportDate));

  return results.map((row) => {
    const salesmanName = [row.userFirstName, row.userLastName].filter(Boolean).join(' ') || row.userEmail || 'N/A';
    const toFloat = (val: any) => val ? parseFloat(val.toString()) : null;

    return {
      ...row,
      salesmanName,
      role: row.userRole || 'Unknown',
      area: row.userArea || '',
      region: row.userRegion || '',
      emailId: row.emailId || '',
      latitude: toFloat(row.latitude),
      longitude: toFloat(row.longitude),
      date: getISTDateString(row.reportDate),
      currentBrandPrice: toFloat(row.currentBrandPrice),
      siteStock: toFloat(row.siteStock),
      estRequirement: toFloat(row.estRequirement),
      conversionQuantityValue: toFloat(row.conversionQuantityValue),
      
      // RESTORED FRONTEND FALLBACKS: Replace nulls with empty strings
      conversionFromBrand: row.conversionFromBrand || '',
      conversionQuantityUnit: row.conversionQuantityUnit || '',
      serviceType: row.serviceType || '',
      qualityComplaint: row.qualityComplaint || '',
      promotionalActivity: row.promotionalActivity || '',
      channelPartnerVisit: row.channelPartnerVisit || '',
      siteVisitStage: row.siteVisitStage || '',
      associatedPartyName: row.associatedPartyName || '',
      
      // Handle timestamp strings
      checkInTime: row.checkInTime ? new Date(row.checkInTime).toISOString() : '',
      checkOutTime: row.checkOutTime ? new Date(row.checkOutTime).toISOString() : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
      firstVisitTime: row.firstVisitTime ? new Date(row.firstVisitTime).toISOString() : null,
      lastVisitTime: row.lastVisitTime ? new Date(row.lastVisitTime).toISOString() : null,
    };
  });
}

export async function GET() {
  if (typeof connection === 'function') await connection();
  
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch Current User
    const currentUserResult = await db
      .select({ id: users.id, role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    // Authorization Check
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({
        error: `Forbidden: Insufficient permissions to view technical reports.`
      }, { status: 403 });
    }

    // Fetch Cached Data
    const formattedReports = await getCachedTechnicalVisitReports(currentUser.companyId);

    // Validate using strictly extended Schema instead of `.loose()`
    const validated = z.array(frontendTechnicalReportSchema).safeParse(formattedReports);

    if (!validated.success) {
      console.error('Technical Reports Validation Error:', validated.error.format());
      // Graceful fallback: return the formatted data directly so the UI doesn't crash completely
      return NextResponse.json(formattedReports, { status: 200 });
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch (error) {
    console.error('Error fetching technical visit reports:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch technical visit reports', 
      error: (error as Error).message 
    }, { status: 500 });
  }
}