// src/app/api/dashboardPagesAPI/masonpc-side/mason-pc/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { masonPCSideSchema } from '@/lib/shared-zod-schema';

// Re-using the allowed roles from your sample. Adjust as needed.
const allowedRoles = [
  'president',
  'senior-general-manager',
  'general-manager',
  'assistant-sales-manager',
  'area-sales-manager',
  'regional-sales-manager',
  'senior-manager',
  'manager',
  'assistant-manager',
  'senior-executive',
  'executive',
];

// Define acceptable status values for type safety in the FE
export type KycStatus = 'none' | 'pending' | 'verified' | 'approved' | 'rejected';
export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NONE';

// --- ZOD: Full row including joined KYC info ---
const masonPcFullSchema = masonPCSideSchema.extend({
  kycStatus: z.string().nullable().optional(),

  // FE display status
  kycVerificationStatus: z.string().default('NONE'),

  // KYC details from KYCSubmission
  kycAadhaarNumber: z.string().nullable().optional(),
  kycPanNumber: z.string().nullable().optional(),
  kycVoterIdNumber: z.string().nullable().optional(),

  // FORCE this to be a simple key -> url map
  kycDocuments: z.record(z.string(), z.string()).nullable().optional(),

  kycSubmissionRemark: z.string().nullable().optional(),
  kycSubmittedAt: z.string().nullable().optional(),

  // Joined user info
  salesmanName: z.string().optional(),
  role: z.string().optional(),
  area: z.string().optional(),
  region: z.string().optional(),

  dealerName: z.string().optional().nullable(),
  siteName: z.string().optional().nullable(),
});

export type MasonPcFullDetails = z.infer<typeof masonPcFullSchema>;

// 2. The Cached Function
async function getCachedMasonPcRecords(
  companyId: number,
  kycStatusFilter: string | null
) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`mason-pc-${companyId}`);

  const whereClause: any = {};

  if (kycStatusFilter === 'VERIFIED') {
    whereClause.kycStatus = { in: ['verified', 'approved'] };
  } else {
    const filterToDbMap: Record<string, string> = {
      PENDING: 'pending',
      REJECTED: 'rejected',
      NONE: 'none',
    };

    if (kycStatusFilter && filterToDbMap[kycStatusFilter]) {
      whereClause.kycStatus = filterToDbMap[kycStatusFilter];
    }
  }

  const masonPcRecords = await prisma.mason_PC_Side.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          area: true,
          region: true,
        },
      },
      dealer: { select: { id: true, name: true } },
      kycSubmissions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          aadhaarNumber: true,
          panNumber: true,
          voterIdNumber: true,
          documents: true,
          remark: true,
          createdAt: true,
        },
      },
    },
    orderBy: { name: 'asc' },
    take: 2000,
  });

  const formattedRecords = masonPcRecords.map(
    (record): MasonPcFullDetails => {
      const salesmanName =
        [record.user?.firstName, record.user?.lastName]
          .filter(Boolean)
          .join(' ') || 'N/A';

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

      const latestKycSubmission = record.kycSubmissions?.[0];
      const rawDocs = latestKycSubmission?.documents;

      let normalizedDocs: Record<string, string> | null = null;

      if (rawDocs) {
        if (typeof rawDocs === 'string') {
          try {
            const parsed = JSON.parse(rawDocs);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              const entries = Object.entries(parsed).filter(
                ([, v]) => typeof v === 'string' && (v as string).length > 0,
              ) as [string, string][];
              normalizedDocs = Object.fromEntries(entries);
            }
          } catch {
            normalizedDocs = null;
          }
        } else if (typeof rawDocs === 'object' && !Array.isArray(rawDocs)) {
          const entries = Object.entries(
            rawDocs as Record<string, unknown>,
          ).filter(
            ([, v]) => typeof v === 'string' && (v as string).length > 0,
          ) as [string, string][];
          normalizedDocs = Object.fromEntries(entries);
        }
      }

      return {
        ...record,
        salesmanName,
        role: record.user?.role ?? 'N/A',
        area: record.user?.area ?? 'N/A',
        region: record.user?.region ?? 'N/A',
        dealerName: record.dealer?.name ?? null,
        kycVerificationStatus: displayStatus,
        kycAadhaarNumber: latestKycSubmission?.aadhaarNumber ?? null,
        kycPanNumber: latestKycSubmission?.panNumber ?? null,
        kycVoterIdNumber: latestKycSubmission?.voterIdNumber ?? null,
        kycDocuments: normalizedDocs,
        kycSubmissionRemark: latestKycSubmission?.remark ?? null,
        kycSubmittedAt:
          latestKycSubmission?.createdAt?.toISOString() ?? null,
      };
    },
  );

  return formattedRecords;
}

export async function GET(request: NextRequest) {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true },
    });

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only allowed roles can access this data.' },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const kycStatusFilter = searchParams.get('kycStatus');

    const formattedRecords = await getCachedMasonPcRecords(currentUser.companyId, kycStatusFilter);

    const validatedReports = z.array(masonPcFullSchema).parse(formattedRecords);

    return NextResponse.json(validatedReports, { status: 200 });
  } catch (error) {
    console.error('Error fetching mason/pc data:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Failed to fetch mason/pc data' }, { status: 500 });
  }
}
