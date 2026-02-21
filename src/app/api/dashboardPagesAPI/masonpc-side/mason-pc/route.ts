// src/app/api/dashboardPagesAPI/masonpc-side/mason-pc/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, masonPcSide, kycSubmissions, dealers } from '../../../../../../drizzle';
import { eq, and, inArray, desc, asc, getTableColumns } from 'drizzle-orm';
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

// Extend the baked DB schema to include joined user/dealer info and KYC details
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

async function getCachedMasonPcRecords(companyId: number, kycStatusFilter: string | null) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`mason-pc-${companyId}`);

  const filters = [];
  if (kycStatusFilter === 'VERIFIED') {
    filters.push(inArray(masonPcSide.kycStatus, ['verified', 'approved']));
  } else if (kycStatusFilter) {
    const map: Record<string, string> = { PENDING: 'pending', REJECTED: 'rejected', NONE: 'none' };
    if (map[kycStatusFilter]) filters.push(eq(masonPcSide.kycStatus, map[kycStatusFilter]));
  }

  // 1. Fetch all Mason PCs and flatten the user/dealer data natively
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
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(masonPcSide.name))
    .limit(2000);

  if (masonRecords.length === 0) return [];

  // 2. Fetch all related KYC submissions in ONE query (Fixing the N+1 issue)
  const masonIds = masonRecords.map(m => m.id);
  const allKycs = await db
    .select()
    .from(kycSubmissions)
    .where(inArray(kycSubmissions.masonId, masonIds))
    .orderBy(desc(kycSubmissions.createdAt)); // Newest first

  // 3. Group by masonId to quickly look up the latest KYC submission
  const latestKycMap = new Map<string, typeof allKycs[0]>();
  for (const kyc of allKycs) {
    // Because we ordered by desc, the first one we hit for a mason is the latest
    if (!latestKycMap.has(kyc.masonId)) {
      latestKycMap.set(kyc.masonId, kyc);
    }
  }

  // 4. Map the data together into the final shape
  const formattedRecords = masonRecords.map((record): MasonPcFullDetails => {
    const latestKyc = latestKycMap.get(record.id);

    // Normalize Document JSON
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

    // Determine FE display status
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

  return formattedRecords;
}

export async function GET(request: NextRequest) {
  // If you are using Next.js 15+, connection() is used to opt into dynamic rendering
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

    const kycStatusFilter = request.nextUrl.searchParams.get('kycStatus');
    const records = await getCachedMasonPcRecords(currentUser.companyId, kycStatusFilter);

    // Validate the complete row
    const validatedReports = z.array(masonPcFullSchema).safeParse(records);

    if (!validatedReports.success) {
      console.error("Mason PC Validation Error:", validatedReports.error.format());
      return NextResponse.json(records, { status: 200 }); // Graceful fallback
    }

    return NextResponse.json(validatedReports.data, { status: 200 });

  } catch (error: any) {
    console.error("Mason PC Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}