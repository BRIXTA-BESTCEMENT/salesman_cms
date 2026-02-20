// src/app/api/dashboardPagesAPI/reports/technical-visit-reports/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import prisma from '@/lib/prisma'; 
import { z } from 'zod'; 
import { technicalVisitReportSchema } from '@/lib/shared-zod-schema';

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive',
];

const getISTDateString = (date: Date | null) => {
  if (!date) return '';
  // 'en-CA' locale forces YYYY-MM-DD format
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// 2. The Cached Function
async function getCachedTechnicalVisitReports(companyId: number) {
  'use cache';
  cacheLife('hours');
  cacheTag(`technical-visit-reports-${companyId}`);

  const technicalReports = await prisma.technicalVisitReport.findMany({
    where: {
      user: {
        companyId: companyId,
      },
    },
    include: {
      user: { select: { firstName: true, lastName: true, role: true, email: true, area: true, region: true } },
    },
    orderBy: {
      reportDate: 'desc',
    },
  });

  return technicalReports.map((report: any) => {
    const salesmanName = [report.user?.firstName, report.user?.lastName].filter(Boolean).join(' ') || 'N/A';

    return {
      id: report.id,
      salesmanName: salesmanName,
      role: report.user.role,
      area: report.user.area,
      region: report.user.region,
      siteNameConcernedPerson: report.siteNameConcernedPerson,
      phoneNo: report.phoneNo,
      emailId: report.emailId || '',
      whatsappNo: report.whatsappNo || null,
      marketName: report.marketName || null,
      siteAddress: report.siteAddress || null,
      latitude: report.latitude ? parseFloat(report.latitude.toString()) : null,
      longitude: report.longitude ? parseFloat(report.longitude.toString()) : null,
      date: getISTDateString(report.reportDate),
      visitType: report.visitType,
      visitCategory: report.visitCategory || null,
      customerType: report.customerType || null,
      purposeOfVisit: report.purposeOfVisit || null,
      siteVisitStage: report.siteVisitStage || '',
      constAreaSqFt: report.constAreaSqFt || null,
      siteVisitBrandInUse: report.siteVisitBrandInUse || [],
      currentBrandPrice: report.currentBrandPrice ? parseFloat(report.currentBrandPrice.toString()) : null,
      siteStock: report.siteStock ? parseFloat(report.siteStock.toString()) : null,
      estRequirement: report.estRequirement ? parseFloat(report.estRequirement.toString()) : null,
      supplyingDealerName: report.supplyingDealerName || null,
      nearbyDealerName: report.nearbyDealerName || null,
      associatedPartyName: report.associatedPartyName || '',
      isConverted: report.isConverted ?? null,
      conversionType: report.conversionType || null,
      conversionFromBrand: report.conversionFromBrand || '',
      conversionQuantityValue: report.conversionQuantityValue ? parseFloat(report.conversionQuantityValue.toString()) : null,
      conversionQuantityUnit: report.conversionQuantityUnit || '',
      isTechService: report.isTechService ?? null,
      serviceDesc: report.serviceDesc || null,
      serviceType: report.serviceType || '',
      dhalaiVerificationCode: report.dhalaiVerificationCode || null,
      isVerificationStatus: report.isVerificationStatus || null,
      qualityComplaint: report.qualityComplaint || '',
      influencerName: report.influencerName || null,
      influencerPhone: report.influencerPhone || null,
      isSchemeEnrolled: report.isSchemeEnrolled ?? null,
      influencerProductivity: report.influencerProductivity || null,
      influencerType: report.influencerType || [],
      clientsRemarks: report.clientsRemarks,
      salespersonRemarks: report.salespersonRemarks,
      promotionalActivity: report.promotionalActivity || '',
      channelPartnerVisit: report.channelPartnerVisit || '',
      siteVisitType: report.siteVisitType || null,
      checkInTime: report.checkInTime.toISOString() || '',
      checkOutTime: report.checkOutTime?.toISOString() || '',
      timeSpentinLoc: report.timeSpentinLoc || null,
      inTimeImageUrl: report.inTimeImageUrl || null,
      outTimeImageUrl: report.outTimeImageUrl || null,
      sitePhotoUrl: report.sitePhotoUrl || null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      firstVisitTime: report.firstVisitTime?.toISOString() || null,
      lastVisitTime: report.lastVisitTime?.toISOString() || null,
      firstVisitDay: report.firstVisitDay || null,
      lastVisitDay: report.lastVisitDay || null,
      siteVisitsCount: report.siteVisitsCount || null,
      otherVisitsCount: report.otherVisitsCount || null,
      totalVisitsCount: report.totalVisitsCount || null,
      meetingId: report.meetingId || null,
      pjpId: report.pjpId || null,
      masonId: report.masonId || null,
      siteId: report.siteId || null,
    };
  });
}

export async function GET() {
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User to check role and companyId
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true } // Optimized selection
    });

    // 3. Role-Based Authorization
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({
        error: `Forbidden: Only the following roles can view technical reports: ${allowedRoles.join(', ')}`
      }, { status: 403 });
    }

    // 4. Fetch Cached Data
    const formattedReports = await getCachedTechnicalVisitReports(currentUser.companyId);

    // 5. Validate response array with Zod
    const validated = z.array(technicalVisitReportSchema).parse(formattedReports);

    return NextResponse.json(validated);
  } catch (error) {
    console.error('Error fetching technical visit reports:', error);
    // Return a 500 status with an error message in case of failure
    return NextResponse.json({ message: 'Failed to fetch technical visit reports', error: (error as Error).message }, { status: 500 });
  }
}