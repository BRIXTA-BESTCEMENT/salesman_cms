// src/app/api/dashboardPagesAPI/masonpc-side/mason-pc/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, masonPcSide, kycSubmissions, dealers } from '../../../../../../drizzle';
import { eq, and, or, ilike, inArray, desc, asc, getTableColumns, sql, SQL, count } from 'drizzle-orm';
import { z } from 'zod';
import { selectMasonPcSideSchema } from '../../../../../../drizzle/zodSchemas';

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager', 
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager', 
  'senior-manager', 'manager', 'assistant-manager', 
  'senior-executive', 'executive'
];

export type KycStatus = 'none' | 'pending' | 'verified' | 'approved' | 'rejected';
export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NONE';

const masonPcFullSchema = selectMasonPcSideSchema.extend({
  salesmanName: z.string().optional(),
  role: z.string().optional(),
  area: z.string().optional(),
  region: z.string().optional(),
  dealerName: z.string().optional().nullable(),
  
  kycVerificationStatus: z.string().default('NONE'),
  kycAadhaarNumber: z.string().nullable().optional(),
  kycPanNumber: z.string().nullable().optional(),
  kycVoterIdNumber: z.string().nullable().optional(),
  kycDocuments: z.record(z.string(), z.string()).nullable().optional(),
  kycSubmissionRemark: z.string().nullable().optional(),
  kycSubmittedAt: z.string().nullable().optional(),
});

type MasonPcFullDetails = z.infer<typeof masonPcFullSchema>;

async function getCachedMasonPcRecords(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null,
  kycStatusFilter: string | null,
  roleFilter: string | null,
  areaFilter: string | null,
  regionFilter: string | null
) {
  'use cache';
  cacheLife('minutes');
  
  const filterKey = `${search}-${kycStatusFilter}-${roleFilter}-${areaFilter}-${regionFilter}`;
  cacheTag(`mason-pc-${companyId}-${page}-${filterKey}`);

  const filters: SQL[] = []; // Not scoping by users.companyId yet because masonPcSide might not have a userId assigned

  if (kycStatusFilter === 'VERIFIED') {
    filters.push(inArray(masonPcSide.kycStatus, ['verified', 'approved']));
  } else if (kycStatusFilter && kycStatusFilter !== 'all') {
    const map: Record<string, string> = { PENDING: 'pending', REJECTED: 'rejected', NONE: 'none' };
    if (map[kycStatusFilter]) filters.push(eq(masonPcSide.kycStatus, map[kycStatusFilter]));
  }

  if (search) {
    const searchCondition = or(
        ilike(masonPcSide.name, `%${search}%`),
        ilike(masonPcSide.phoneNumber, `%${search}%`),
        ilike(dealers.name, `%${search}%`),
        ilike(users.firstName, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }

  if (roleFilter && roleFilter !== 'all') filters.push(eq(users.role, roleFilter));
  if (areaFilter && areaFilter !== 'all') filters.push(eq(users.area, areaFilter));
  if (regionFilter && regionFilter !== 'all') filters.push(eq(users.region, regionFilter));

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const masonRecords = await db
    .select({
      ...getTableColumns(masonPcSide),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userRole: users.role,
      userArea: users.area,
      userRegion: users.region,
      dealerNameStr: dealers.name
    })
    .from(masonPcSide)
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .leftJoin(dealers, eq(masonPcSide.dealerId, dealers.id))
    .where(whereClause)
    .limit(pageSize)
    .offset(page * pageSize);

  const totalCountResult = await db
    .select({ count: count() })
    .from(masonPcSide)
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .leftJoin(dealers, eq(masonPcSide.dealerId, dealers.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  if (masonRecords.length === 0) return { data: [], totalCount };

  const masonIds = masonRecords.map(m => m.id);
  const allKycs = await db
    .select()
    .from(kycSubmissions)
    .where(inArray(kycSubmissions.masonId, masonIds))
    .orderBy(desc(kycSubmissions.createdAt));

  const latestKycMap = new Map<string, typeof allKycs[0]>();
  for (const kyc of allKycs) {
    if (!latestKycMap.has(kyc.masonId)) {
      latestKycMap.set(kyc.masonId, kyc);
    }
  }

  const formattedRecords = masonRecords.map((record): MasonPcFullDetails => {
    const latestKyc = latestKycMap.get(record.id);

    let normalizedDocs: Record<string, string> | null = null;
    if (latestKyc?.documents) {
      const raw = typeof latestKyc.documents === 'string' 
        ? JSON.parse(latestKyc.documents) 
        : latestKyc.documents;
        
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const entries = Object.entries(raw).filter(([, v]) => typeof v === 'string' && v.length > 0);
        normalizedDocs = Object.fromEntries(entries) as Record<string, string>;
      }
    }

    let displayStatus: KycVerificationStatus;
    switch (record.kycStatus) {
      case 'verified':
      case 'approved':
        displayStatus = 'VERIFIED';
        break;
      case 'pending':
        displayStatus = 'PENDING';
        break;
      case 'rejected':
        displayStatus = 'REJECTED';
        break;
      default:
        displayStatus = 'NONE';
    }

    return {
      ...record,
      salesmanName: `${record.userFirstName || ''} ${record.userLastName || ''}`.trim() || 'N/A',
      role: record.userRole ?? 'N/A',
      area: record.userArea ?? 'N/A',
      region: record.userRegion ?? 'N/A',
      dealerName: record.dealerNameStr ?? null,
      
      kycVerificationStatus: displayStatus,
      kycAadhaarNumber: latestKyc?.aadhaarNumber ?? null,
      kycPanNumber: latestKyc?.panNumber ?? null,
      kycVoterIdNumber: latestKyc?.voterIdNumber ?? null,
      kycDocuments: normalizedDocs,
      kycSubmissionRemark: latestKyc?.remark ?? null,
      kycSubmittedAt: latestKyc?.createdAt ?? null,
    };
  });

  return { data: formattedRecords, totalCount };
}

export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();

  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);
      
    const currentUser = currentUserResult[0];

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
    
    const search = searchParams.get('search');
    const kycStatusFilter = searchParams.get('kycStatus');
    const roleFilter = searchParams.get('role');
    const areaFilter = searchParams.get('area');
    const regionFilter = searchParams.get('region');

    const result = await getCachedMasonPcRecords(
      currentUser.companyId,
      page,
      pageSize,
      search,
      kycStatusFilter,
      roleFilter,
      areaFilter,
      regionFilter
    );

    const validatedReports = z.array(masonPcFullSchema).safeParse(result.data);

    if (!validatedReports.success) {
      console.error("Mason PC Validation Error:", validatedReports.error.format());
      return NextResponse.json({
        data: result.data,
        totalCount: result.totalCount,
        page,
        pageSize
      }, { status: 200 }); 
    }

    return NextResponse.json({
        data: validatedReports.data,
        totalCount: result.totalCount,
        page,
        pageSize
    }, { status: 200 });

  } catch (error: any) {
    console.error("Mason PC Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}