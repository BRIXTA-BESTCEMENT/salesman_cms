// src/app/api/dashboardPagesAPI/reports/technical-visit-reports/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma'; // Use shared prisma instance
import { z } from 'zod'; // Import Zod
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

// GET /api/dashboardPagesAPI/technical-reports
// Fetches all technical visit reports from the database
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

    // 4. Fetch Data
    const technicalReports = await prisma.technicalVisitReport.findMany({
      where: {
        user: { // Access the User relation
          companyId: currentUser.companyId, // Filter by the admin/manager's company
        },
      },
      include: {
        // Use `select` within `include` to fetch specific user fields
        user: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
            email: true,
            area: true,
            region: true,
          },
        },
      },
      orderBy: {
        reportDate: 'desc', // Order the results by report date in descending order
      },
    });

    // 5. Format the data to match the Zod Schema
    const formattedReports = technicalReports.map((report: any) => {
      // Construct salesmanName
      const salesmanName = [report.user?.firstName, report.user?.lastName]
        .filter(Boolean)
        .join(' ') || 'N/A';

      return {
        // --- Core Identity ---
        id: report.id,
        salesmanName: salesmanName,
        role: report.user.role,

        // --- Contact & Location ---
        area: report.user.area,
        region: report.user.region,
        siteNameConcernedPerson: report.siteNameConcernedPerson,
        phoneNo: report.phoneNo,
        emailId: report.emailId || '', // Map null to empty string per Zod schema
        whatsappNo: report.whatsappNo || null,
        marketName: report.marketName || null,
        siteAddress: report.siteAddress || null,
        latitude: report.latitude ? parseFloat(report.latitude.toString()) : null,
        longitude: report.longitude ? parseFloat(report.longitude.toString()) : null,

        // --- Visit Details ---
        date: getISTDateString(report.reportDate),
        visitType: report.visitType,
        visitCategory: report.visitCategory || null,
        customerType: report.customerType || null,
        purposeOfVisit: report.purposeOfVisit || null,

        // --- Construction & Site Status ---
        siteVisitStage: report.siteVisitStage || '', // Map null to empty string
        constAreaSqFt: report.constAreaSqFt || null,
        siteVisitBrandInUse: report.siteVisitBrandInUse || [],

        // Decimal Conversions
        currentBrandPrice: report.currentBrandPrice ? parseFloat(report.currentBrandPrice.toString()) : null,
        siteStock: report.siteStock ? parseFloat(report.siteStock.toString()) : null,
        estRequirement: report.estRequirement ? parseFloat(report.estRequirement.toString()) : null,

        // --- Dealers ---
        supplyingDealerName: report.supplyingDealerName || null,
        nearbyDealerName: report.nearbyDealerName || null,
        associatedPartyName: report.associatedPartyName || '', // Legacy: Map null to empty

        // --- Conversion Data ---
        isConverted: report.isConverted ?? null, // Boolean: use ?? to preserve false
        conversionType: report.conversionType || null,
        conversionFromBrand: report.conversionFromBrand || '', // Map null to empty string
        conversionQuantityValue: report.conversionQuantityValue ? parseFloat(report.conversionQuantityValue.toString()) : null,
        conversionQuantityUnit: report.conversionQuantityUnit || '', // Map null to empty string

        // --- Technical Services ---
        isTechService: report.isTechService ?? null, // Boolean
        serviceDesc: report.serviceDesc || null,
        serviceType: report.serviceType || '', // Map null to empty string
        dhalaiVerificationCode: report.dhalaiVerificationCode || null,
        isVerificationStatus: report.isVerificationStatus || null,
        qualityComplaint: report.qualityComplaint || '',

        // --- Influencer / Mason ---
        influencerName: report.influencerName || null,
        influencerPhone: report.influencerPhone || null,
        isSchemeEnrolled: report.isSchemeEnrolled ?? null, // Boolean
        influencerProductivity: report.influencerProductivity || null,
        influencerType: report.influencerType || [],

        // --- Remarks ---
        clientsRemarks: report.clientsRemarks,
        salespersonRemarks: report.salespersonRemarks,
        promotionalActivity: report.promotionalActivity || '',
        channelPartnerVisit: report.channelPartnerVisit || '',
        siteVisitType: report.siteVisitType || null,

        // --- Media & Time ---
        checkInTime: report.checkInTime.toISOString() || '',
        checkOutTime: report.checkOutTime?.toISOString() || '',
        timeSpentinLoc: report.timeSpentinLoc || null,
        inTimeImageUrl: report.inTimeImageUrl || null,
        outTimeImageUrl: report.outTimeImageUrl || null,
        sitePhotoUrl: report.sitePhotoUrl || null,

        // --- History & Counters ---
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
        firstVisitTime: report.firstVisitTime?.toISOString() || null,
        lastVisitTime: report.lastVisitTime?.toISOString() || null,
        firstVisitDay: report.firstVisitDay || null,
        lastVisitDay: report.lastVisitDay || null,
        siteVisitsCount: report.siteVisitsCount || null,
        otherVisitsCount: report.otherVisitsCount || null,
        totalVisitsCount: report.totalVisitsCount || null,

        // --- IDs ---
        meetingId: report.meetingId || null,
        pjpId: report.pjpId || null,
        masonId: report.masonId || null,
        siteId: report.siteId || null,
      };
    });

    // 6. Validate response array with Zod
    const validated = z.array(technicalVisitReportSchema).parse(formattedReports);

    return NextResponse.json(validated);
  } catch (error) {
    console.error('Error fetching technical visit reports:', error);
    // Return a 500 status with an error message in case of failure
    return NextResponse.json({ message: 'Failed to fetch technical visit reports', error: (error as Error).message }, { status: 500 });
  }
}