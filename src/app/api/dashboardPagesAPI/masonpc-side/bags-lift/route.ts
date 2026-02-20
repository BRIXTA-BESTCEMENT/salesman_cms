// src/app/api/dashboardPagesAPI/masonpc-side/bags-lift/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive',
];

const formatUserName = (user: { firstName: string | null, lastName: string | null, email: string } | null) => {
  if (!user) return null;
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || user.email;
};

// 1. Define the Schema outside so both functions can use it
const bagLiftResponseSchema = z.object({
  id: z.string(),
  masonId: z.string(),
  masonName: z.string(),
  phoneNumber: z.string().nullable().optional(),
  dealerName: z.string().nullable(),
  purchaseDate: z.string(),
  bagCount: z.number().int(),
  pointsCredited: z.number().int(),
  status: z.string(),
  approvedBy: z.number().int().nullable(),
  approverName: z.string().nullable(),
  associatedSalesmanName: z.string().nullable(),
  approvedAt: z.string().nullable(),
  createdAt: z.string(),
  imageUrl: z.string().nullable().optional(),
  siteKeyPersonName: z.string().nullable().optional(),
  siteKeyPersonPhone: z.string().nullable().optional(),
  siteName: z.string().nullable().optional(),
  siteAddress: z.string().nullable().optional(),
  verificationSiteImageUrl: z.string().nullable().optional(),
  verificationProofImageUrl: z.string().nullable().optional(),
  role: z.string().optional(),
  area: z.string().optional(),
  region: z.string().optional(),
});

// 2. The Cached Function: Handled on the server, completely isolated from runtime user data
async function getCachedBagLifts(companyId: number) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`bags-lift-${companyId}`); // Unique tag per company

  const bagLiftRecords = await prisma.bagLift.findMany({
    where: {
      OR: [
        { mason: { user: { companyId: companyId } } },
        { mason: { userId: null } }
      ]
    },
    select: {
      id: true,
      masonId: true,
      purchaseDate: true,
      bagCount: true,
      pointsCredited: true,
      status: true,
      approvedBy: true,
      approvedAt: true,
      createdAt: true,
      imageUrl: true,
      siteKeyPersonName: true,
      siteKeyPersonPhone: true,
      verificationSiteImageUrl: true,
      verificationProofImageUrl: true,
      mason: { 
          select: { 
              name: true,
              phoneNumber: true,
              user: {
                  select: {
                      firstName: true,
                      lastName: true,
                      email: true,
                      role: true,
                      area: true,
                      region: true
                  }
              }
          } 
      },
      site: {
        select: {
          siteName: true,
          address: true,
        }
      },
      dealer: { select: { name: true } },
      approver: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: {
      purchaseDate: 'desc',
    },
    take: 1000,
  });

  // Map and format the data
  return bagLiftRecords.map(record => ({
    id: record.id,
    masonId: record.masonId,
    masonName: record.mason.name,
    phoneNumber: record.mason.phoneNumber ?? '-',
    dealerName: record.dealer?.name ?? null,
    purchaseDate: record.purchaseDate.toISOString(),
    bagCount: record.bagCount,
    pointsCredited: record.pointsCredited,
    status: record.status,
    approvedBy: record.approvedBy,
    
    approverName: formatUserName(record.approver),
    associatedSalesmanName: formatUserName(record.mason.user),

    approvedAt: record.approvedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    imageUrl: record.imageUrl,
    siteKeyPersonName: record.siteKeyPersonName,
    siteKeyPersonPhone: record.siteKeyPersonPhone,
    siteName: record.site?.siteName ?? null,
    siteAddress: record.site?.address ?? null,
    verificationSiteImageUrl: record.verificationSiteImageUrl,
    verificationProofImageUrl: record.verificationProofImageUrl,
    
    role: record.mason.user?.role ?? 'N/A',
    area: record.mason.user?.area ?? 'N/A',
    region: record.mason.user?.region ?? 'N/A',
  }));
}

export async function GET() {
  try {
    const claims = await getTokenClaims();

    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { role: true, companyId: true }
    });

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden` }, { status: 403 });
    }

    // Call the purely cached function
    const formattedReports = await getCachedBagLifts(currentUser.companyId);

    const validatedReports = z.array(bagLiftResponseSchema).parse(formattedReports);

    return NextResponse.json(validatedReports, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching bag-lift data:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to fetch bag-lift data' }, { status: 500 });
  }
}