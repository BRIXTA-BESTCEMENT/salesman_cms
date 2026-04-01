// src/app/api/dashboardPagesAPI/reports/technical-visit-reports/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, technicalVisitReports } from '../../../../../../drizzle';
import { count, eq, desc, getTableColumns, and, or, ilike, SQL, gte, lte } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectTechnicalVisitReportSchema } from '../../../../../../drizzle/zodSchemas';
import { verifySession } from '@/lib/auth';

const getISTDateString = (date: string | Date | null) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const frontendTechnicalReportSchema = selectTechnicalVisitReportSchema.extend({
  salesmanName: z.string(),
  area: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  date: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  currentBrandPrice: z.number().nullable(),
  siteStock: z.number().nullable(),
  estRequirement: z.number().nullable(),
  conversionQuantityValue: z.number().nullable(),
  conversionFromBrand: z.string(),
  conversionQuantityUnit: z.string(),
  serviceType: z.string(),
  qualityComplaint: z.string(),
  promotionalActivity: z.string(),
  channelPartnerVisit: z.string(),
  siteVisitStage: z.string(),
  associatedPartyName: z.string(),
  checkInTime: z.string(),
  checkOutTime: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  firstVisitTime: z.string().nullable(),
  lastVisitTime: z.string().nullable(),
});

type TechnicalReportRow = InferSelectModel<typeof technicalVisitReports> & {
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  userArea: string | null;
  userRegion: string | null;
};

async function getCachedTechnicalVisitReports(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null,
  area: string | null,
  region: string | null,
  customerType: string | null,
  startDate: string | null, 
  endDate: string | null
) {
  'use cache';
  cacheLife('hours');
  cacheTag(`technical-visit-reports-${companyId}`);

  const filterKey = `${search}-${area}-${region}-${startDate}-${endDate}-${customerType}`;
  cacheTag(`technical-visit-reports-${companyId}-${page}-${filterKey}`);

  // Strictly type as SQL[] to prevent undefined errors in and()
  const filters: SQL[] = [eq(users.companyId, companyId)];

  if (search) {
    const searchCondition = or(
      ilike(users.firstName, `%${search}%`),
      ilike(users.lastName, `%${search}%`),
      ilike(technicalVisitReports.siteNameConcernedPerson, `%${search}%`),
      ilike(technicalVisitReports.associatedPartyName, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }

  if (area) filters.push(eq(users.area, area));
  if (region) filters.push(eq(users.region, region));
  if (customerType) filters.push(eq(technicalVisitReports.customerType, customerType));

  if (startDate) filters.push(gte(technicalVisitReports.reportDate, startDate));
  if (endDate) filters.push(lte(technicalVisitReports.reportDate, endDate));

  const whereClause = and(...filters);

  const results: TechnicalReportRow[] = await db
    .select({
      ...getTableColumns(technicalVisitReports),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      userArea: users.area,
      userRegion: users.region,
    })
    .from(technicalVisitReports)
    .leftJoin(users, eq(technicalVisitReports.userId, users.id))
    .where(whereClause)
    .orderBy(desc(technicalVisitReports.reportDate))
    .limit(pageSize)
    .offset(page * pageSize);

  const totalCountResult = await db
    .select({ count: count() })
    .from(technicalVisitReports)
    .leftJoin(users, eq(technicalVisitReports.userId, users.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  const formatted = results.map((row) => {
    const salesmanName =
      [row.userFirstName, row.userLastName].filter(Boolean).join(' ')
      || row.userEmail
      || 'N/A';

    const toFloat = (val: any) =>
      val == null ? null : parseFloat(val.toString());

    return {
      ...row,
      salesmanName,
      area: row.userArea || '',
      region: row.userRegion || '',
      latitude: toFloat(row.latitude),
      longitude: toFloat(row.longitude),
      date: getISTDateString(row.reportDate),
      currentBrandPrice: toFloat(row.currentBrandPrice),
      siteStock: toFloat(row.siteStock),
      estRequirement: toFloat(row.estRequirement),
      conversionQuantityValue: toFloat(row.conversionQuantityValue),
      conversionFromBrand: row.conversionFromBrand || '',
      conversionQuantityUnit: row.conversionQuantityUnit || '',
      serviceType: row.serviceType || '',
      qualityComplaint: row.qualityComplaint || '',
      promotionalActivity: row.promotionalActivity || '',
      channelPartnerVisit: row.channelPartnerVisit || '',
      siteVisitStage: row.siteVisitStage || '',
      associatedPartyName: row.associatedPartyName || '',
      checkInTime: row.checkInTime ? new Date(row.checkInTime).toISOString() : '',
      checkOutTime: row.checkOutTime ? new Date(row.checkOutTime).toISOString() : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
      firstVisitTime: row.firstVisitTime ? new Date(row.firstVisitTime).toISOString() : null,
      lastVisitTime: row.lastVisitTime ? new Date(row.lastVisitTime).toISOString() : null,
    };
  });

  return { data: formatted, totalCount };
}

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

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    // Hard cap at 500 to protect the server and front-end memory
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);

    const search = searchParams.get('search');
    const area = searchParams.get('area');
    const region = searchParams.get('region');
    const customerType = searchParams.get('customerType');

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const result = await getCachedTechnicalVisitReports(
      session.companyId,
      page,
      pageSize,
      search,
      area,
      region,
      customerType,
      startDate,
      endDate
    );

    const validated = z
      .array(frontendTechnicalReportSchema)
      .safeParse(result.data);

    return NextResponse.json({
      data: validated.success ? validated.data : result.data,
      totalCount: result.totalCount,
      page,
      pageSize,
    });

  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to fetch technical visit reports', error: (error as Error).message },
      { status: 500 }
    );
  }
}