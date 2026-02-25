// src/lib/reports-transformer.ts
import { db } from '@/lib/drizzle';
import {
  users, dealers, dailyVisitReports, technicalVisitReports, technicalSites,
  salesOrders, permanentJourneyPlans, competitionReports, dailyTasks,
  salesmanAttendance, salesmanLeaveApplications, journeyOps, dealerReportsAndScores,
  ratings, dealerBrandMapping, brands, tsoMeetings, rewards, giftAllocationLogs,
  masonPcSide, schemesOffers, masonOnScheme, masonsOnMeetings, rewardCategories,
  kycSubmissions, tsoAssignments, bagLifts, rewardRedemptions, pointsLedger, logisticsIo,
  siteAssociatedUsers, siteAssociatedDealers, siteAssociatedMasons
} from '../../drizzle/schema';
import { eq, desc, and, or, inArray, getTableColumns, aliasedTable, sql, isNull } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

// --- HELPERS ---

export const formatUserName = (user: { firstName?: string | null, lastName?: string | null, email?: string | null } | null): string => {
  if (!user) return '';
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || user.email || '';
};

export const formatDateIST = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

export const formatDateTimeIST = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).replace(/,/g, '').toUpperCase();
};

export const formatTimeStr12Hr = (timeStr: string | null | undefined): string | null => {
  if (!timeStr) return null;
  const trimmed = timeStr.trim();
  if (trimmed.toUpperCase().includes('AM') || trimmed.toUpperCase().includes('PM')) return trimmed;
  try {
    const parts = trimmed.split(':');
    if (parts.length < 2) return trimmed;
    let h = parseInt(parts[0], 10);
    if (isNaN(h)) return trimmed;
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
  } catch {
    return trimmed;
  }
};

const toNum = (v: any): number | null => (v == null ? null : Number(v));

type FlattenedUserRow = InferSelectModel<typeof users> & {
  managerFirstName: string | null;
  managerLastName: string | null;
  managerEmail: string | null;
};

// --- TRANSFORMERS ---

export async function getFlattenedUsers(companyId: number) {
  const reportsToUsers = aliasedTable(users, 'reportsTo');

  const rawUsers: FlattenedUserRow[] = await db
    .select({
      ...getTableColumns(users),
      managerFirstName: reportsToUsers.firstName,
      managerLastName: reportsToUsers.lastName,
      managerEmail: reportsToUsers.email,
    })
    .from(users)
    .leftJoin(reportsToUsers, eq(users.reportsToId, reportsToUsers.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(users.createdAt));

  return rawUsers.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    role: u.role,
    phoneNumber: u.phoneNumber ?? null,
    status: u.status,
    region: u.region ?? null,
    area: u.area ?? null,
    isTechnicalRole: u.isTechnicalRole ?? null,
    reportsToManagerName: formatUserName({ firstName: u.managerFirstName, lastName: u.managerLastName, email: u.managerEmail }) || null,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : '',
  }));
}

export async function getFlattenedDealers(companyId: number) {
  const rawDealers = await db
    .select({
      ...getTableColumns(dealers),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(dealers)
    .leftJoin(users, eq(dealers.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(dealers.createdAt));

  return rawDealers.map((d) => ({
    id: d.id, type: d.type, name: d.name, region: d.region, area: d.area, phoneNo: d.phoneNo,
    address: d.address, pinCode: d.pinCode ?? null, feedbacks: d.feedbacks, remarks: d.remarks ?? null,
    dealerDevelopmentStatus: d.dealerdevelopmentstatus ?? null, dealerDevelopmentObstacle: d.dealerdevelopmentobstacle ?? null,
    verificationStatus: d.verificationStatus, whatsappNo: d.whatsappNo ?? null, emailId: d.emailId ?? null, nameOfFirm: d.nameOfFirm ?? null, underSalesPromoterName: d.underSalesPromoterName ?? null,
    businessType: d.businessType ?? null, gstinNo: d.gstinNo ?? null, panNo: d.panNo ?? null, tradeLicNo: d.tradeLicNo ?? null,
    aadharNo: d.aadharNo ?? null, godownSizeSqFt: d.godownSizeSqft ?? null, godownCapacityMTBags: d.godownCapacityMtBags ?? null,
    godownAddressLine: d.godownAddressLine ?? null, godownLandMark: d.godownLandmark ?? null, godownDistrict: d.godownDistrict ?? null,
    godownArea: d.godownArea ?? null, godownRegion: d.godownRegion ?? null, godownPinCode: d.godownPincode ?? null,
    residentialAddressLine: d.residentialAddressLine ?? null, residentialLandMark: d.residentialLandmark ?? null,
    residentialDistrict: d.residentialDistrict ?? null, residentialArea: d.residentialArea ?? null, residentialRegion: d.residentialRegion ?? null,
    residentialPinCode: d.residentialPincode ?? null, bankAccountName: d.bankAccountName ?? null, bankName: d.bankName ?? null,
    bankBranchAddress: d.bankBranchAddress ?? null, bankAccountNumber: d.bankAccountNumber ?? null, bankIfscCode: d.bankIfscCode ?? null,
    brandName: d.brandName ?? null, noOfDealers: d.noOfDealers ?? null, areaCovered: d.areaCovered ?? null,
    noOfEmployeesInSales: d.noOfEmployeesInSales ?? null, declarationName: d.declarationName ?? null,
    declarationPlace: d.declarationPlace ?? null, tradeLicencePicUrl: d.tradeLicencePicUrl ?? null, shopPicUrl: d.shopPicUrl ?? null,
    dealerPicUrl: d.dealerPicUrl ?? null, blankChequePicUrl: d.blankChequePicUrl ?? null, partnershipDeedPicUrl: d.partnershipDeedPicUrl ?? null,

    dateOfBirth: formatDateIST(d.dateOfBirth) ?? null,
    anniversaryDate: formatDateIST(d.anniversaryDate) ?? null,
    declarationDate: formatDateIST(d.declarationDate) ?? null,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : '',
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : '',

    latitude: toNum(d.latitude),
    longitude: toNum(d.longitude),
    totalPotential: toNum(d.totalPotential) || 0,
    bestPotential: toNum(d.bestPotential) || 0,
    monthlySaleMT: toNum(d.monthlySaleMt),
    projectedMonthlySalesBestCementMT: toNum(d.projectedMonthlySalesBestCementMt),

    brandSelling: (d.brandSelling || []).join(', '),
    associatedSalesmanName: formatUserName({ firstName: d.userFirstName, lastName: d.userLastName, email: d.userEmail }) || null,
  }));
}

export async function getFlattenedDailyVisitReports(companyId: number) {
  const subDealers = aliasedTable(dealers, 'subDealers');

  const raw = await db
    .select({
      ...getTableColumns(dailyVisitReports),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      dealerName: dealers.name,
      subDealerName: subDealers.name,
    })
    .from(dailyVisitReports)
    .leftJoin(users, eq(dailyVisitReports.userId, users.id))
    .leftJoin(dealers, eq(dailyVisitReports.dealerId, dealers.id))
    .leftJoin(subDealers, eq(dailyVisitReports.subDealerId, subDealers.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(dailyVisitReports.reportDate));

  return raw.map((r) => ({
    id: r.id,
    reportDate: formatDateIST(r.reportDate) || '',
    dealerType: r.dealerType,
    dealerName: r.dealerName ?? null,
    subDealerName: r.subDealerName ?? null,
    location: r.location,
    latitude: toNum(r.latitude) || 0,
    longitude: toNum(r.longitude) || 0,
    visitType: r.visitType,
    dealerTotalPotential: toNum(r.dealerTotalPotential) || 0,
    dealerBestPotential: toNum(r.dealerBestPotential) || 0,
    brandSelling: (r.brandSelling || []).join(', '),
    contactPerson: r.contactPerson ?? null,
    contactPersonPhoneNo: r.contactPersonPhoneNo ?? null,
    todayOrderMt: toNum(r.todayOrderMt) || 0,
    todayCollectionRupees: toNum(r.todayCollectionRupees) || 0,
    overdueAmount: toNum(r.overdueAmount),
    feedbacks: r.feedbacks,
    solutionBySalesperson: r.solutionBySalesperson ?? null,
    anyRemarks: r.anyRemarks ?? null,
    checkInTime: formatDateTimeIST(r.checkInTime),
    checkOutTime: r.checkOutTime ? formatDateTimeIST(r.checkOutTime) : null,
    timeSpentinLoc: r.timeSpentInLoc ?? null,
    inTimeImageUrl: r.inTimeImageUrl ?? null,
    outTimeImageUrl: r.outTimeImageUrl ?? null,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
    salesmanName: formatUserName({ firstName: r.userFirstName, lastName: r.userLastName, email: r.userEmail }),
    salesmanEmail: r.userEmail || '',
  }));
}

export async function getFlattenedTechnicalVisitReports(companyId: number) {
  const rawReports = await db
    .select({
      ...getTableColumns(technicalVisitReports),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(technicalVisitReports)
    .leftJoin(users, eq(technicalVisitReports.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(technicalVisitReports.reportDate));

  return rawReports.map((r) => ({
    id: r.id,
    visitType: r.visitType,
    siteNameConcernedPerson: r.siteNameConcernedPerson,
    phoneNo: r.phoneNo,
    emailId: r.emailId ?? null,
    clientsRemarks: r.clientsRemarks,
    salespersonRemarks: r.salespersonRemarks,
    siteVisitStage: r.siteVisitStage ?? null,
    conversionFromBrand: r.conversionFromBrand ?? null,
    conversionQuantityUnit: r.conversionQuantityUnit ?? null,
    associatedPartyName: r.associatedPartyName ?? null,
    serviceType: r.serviceType ?? null,
    qualityComplaint: r.qualityComplaint ?? null,
    promotionalActivity: r.promotionalActivity ?? null,
    channelPartnerVisit: r.channelPartnerVisit ?? null,
    siteVisitType: r.siteVisitType ?? null,
    dhalaiVerificationCode: r.dhalaiVerificationCode ?? null,
    isVerificationStatus: r.isVerificationStatus ?? null,
    meetingId: r.meetingId ?? null,
    timeSpentinLoc: r.timeSpentInLoc ?? null,
    inTimeImageUrl: r.inTimeImageUrl ?? null,
    outTimeImageUrl: r.outTimeImageUrl ?? null,

    reportDate: formatDateIST(r.reportDate) || '',
    checkInTime: formatDateTimeIST(r.checkInTime),
    checkOutTime: r.checkOutTime ? formatDateTimeIST(r.checkOutTime) : null,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
    firstVisitTime: r.firstVisitTime ? formatDateTimeIST(r.firstVisitTime) : null,
    lastVisitTime: r.lastVisitTime ? formatDateTimeIST(r.lastVisitTime) : null,

    conversionQuantityValue: toNum(r.conversionQuantityValue),
    siteVisitBrandInUse: (r.siteVisitBrandInUse || []).join(', '),
    influencerType: (r.influencerType || []).join(', '),

    purposeOfVisit: r.purposeOfVisit ?? null,
    sitePhotoUrl: r.sitePhotoUrl ?? null,
    firstVisitDay: r.firstVisitDay ?? null,
    lastVisitDay: r.lastVisitDay ?? null,
    siteVisitsCount: r.siteVisitsCount ?? null,
    otherVisitsCount: r.otherVisitsCount ?? null,
    totalVisitsCount: r.totalVisitsCount ?? null,
    region: r.region ?? null,
    area: r.area ?? null,
    latitude: toNum(r.latitude),
    longitude: toNum(r.longitude),
    pjpId: r.pjpId ?? null,
    masonId: r.masonId ?? null,
    siteId: r.siteId ?? null,
    marketName: r.marketName ?? null,
    siteAddress: r.siteAddress ?? null,
    whatsappNo: r.whatsappNo ?? null,
    visitCategory: r.visitCategory ?? null,
    customerType: r.customerType ?? null,
    constAreaSqFt: r.constAreaSqFt ?? null,
    supplyingDealerName: r.supplyingDealerName ?? null,
    nearbyDealerName: r.nearbyDealerName ?? null,
    conversionType: r.conversionType ?? null,
    serviceDesc: r.serviceDesc ?? null,
    influencerName: r.influencerName ?? null,
    influencerPhone: r.influencerPhone ?? null,
    influencerProductivity: r.influencerProductivity ?? null,
    isConverted: r.isConverted ?? null,
    isTechService: r.isTechService ?? null,
    isSchemeEnrolled: r.isSchemeEnrolled ?? null,
    currentBrandPrice: toNum(r.currentBrandPrice),
    siteStock: toNum(r.siteStock),
    estRequirement: toNum(r.estRequirement),
    salesmanName: formatUserName({ firstName: r.userFirstName, lastName: r.userLastName, email: r.userEmail }),
    salesmanEmail: r.userEmail || '',
  }));
}

export async function getFlattenedTechnicalSites(companyId: number) {
  // Fetch all sites - to mimic Prisma's behavior, we'll fetch them flat then fetch associations manually
  const sites = await db.select().from(technicalSites).orderBy(desc(technicalSites.createdAt));

  if (sites.length === 0) return [];
  const siteIds = sites.map(s => s.id);

  // Parallel batched fetches to avoid N+1
  const [allUsers, allDealers, allMasons] = await Promise.all([
    db.select({ siteId: siteAssociatedUsers.a, userFirstName: users.firstName, userLastName: users.lastName, userEmail: users.email })
      .from(siteAssociatedUsers).innerJoin(users, eq(siteAssociatedUsers.b, users.id))
      .where(inArray(siteAssociatedUsers.a, siteIds)),
    db.select({ siteId: siteAssociatedDealers.b, name: dealers.name })
      .from(siteAssociatedDealers).innerJoin(dealers, eq(siteAssociatedDealers.a, dealers.id))
      .where(inArray(siteAssociatedDealers.b, siteIds)),
    db.select({ siteId: siteAssociatedMasons.b, name: masonPcSide.name })
      .from(siteAssociatedMasons).innerJoin(masonPcSide, eq(siteAssociatedMasons.a, masonPcSide.id))
      .where(inArray(siteAssociatedMasons.b, siteIds))
  ]);

  const groupMap = (arr: any[], key: string) => arr.reduce((acc, item) => {
    if (!acc[item[key]]) acc[item[key]] = [];
    acc[item[key]].push(item);
    return acc;
  }, {});

  const usersMap = groupMap(allUsers, 'siteId');
  const dealersMap = groupMap(allDealers, 'siteId');
  const masonsMap = groupMap(allMasons, 'siteId');

  return sites.map((s) => {
    const siteUsers = usersMap[s.id] || [];
    const siteDealers = dealersMap[s.id] || [];
    const siteMasons = masonsMap[s.id] || [];

    const firstVisitRaw = (s as any).firstVisitDate || (s as any).firstVistDate;

    return {
      id: s.id,
      siteName: s.siteName,
      concernedPerson: s.concernedPerson,
      phoneNo: s.phoneNo,
      address: s.address ?? null,
      latitude: toNum(s.latitude),
      longitude: toNum(s.longitude),
      siteType: s.siteType ?? null,
      area: s.area ?? null,
      region: s.region ?? null,
      keyPersonName: s.keyPersonName ?? null,
      keyPersonPhoneNum: s.keyPersonPhoneNum ?? null,
      stageOfConstruction: s.stageOfConstruction ?? null,
      constructionStartDate: formatDateIST(s.constructionStartDate) ?? null,
      constructionEndDate: formatDateIST(s.constructionEndDate) ?? null,
      firstVistDate: formatDateIST(firstVisitRaw) ?? null,
      lastVisitDate: formatDateIST(s.lastVisitDate) ?? null,
      convertedSite: s.convertedSite ?? false,
      needFollowUp: s.needFollowUp ?? false,
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : '',
      updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : '',

      associatedSalesmen: siteUsers.map((u: any) => formatUserName({ firstName: u.userFirstName, lastName: u.userLastName, email: u.userEmail })).join(', '),
      associatedDealers: siteDealers.map((d: any) => d.name).join(', '),
      associatedMasons: siteMasons.map((m: any) => m.name).join(', '),
    };
  });
}

export async function getFlattenedPermanentJourneyPlans(companyId: number) {
  const createdByUsers = aliasedTable(users, 'createdBy');

  const rawReports = await db
    .select({
      ...getTableColumns(permanentJourneyPlans),
      salesmanFirstName: users.firstName,
      salesmanLastName: users.lastName,
      salesmanEmail: users.email,
      creatorFirstName: createdByUsers.firstName,
      creatorLastName: createdByUsers.lastName,
      creatorEmail: createdByUsers.email,
      creatorRole: createdByUsers.role,
      dealerName: dealers.name,
      siteName: technicalSites.siteName,
    })
    .from(permanentJourneyPlans)
    .leftJoin(users, eq(permanentJourneyPlans.userId, users.id))
    .leftJoin(createdByUsers, eq(permanentJourneyPlans.createdById, createdByUsers.id))
    .leftJoin(dealers, eq(permanentJourneyPlans.dealerId, dealers.id))
    .leftJoin(technicalSites, eq(permanentJourneyPlans.siteId, technicalSites.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(permanentJourneyPlans.planDate));

  if (rawReports.length === 0) return [];
  const pjpIds = rawReports.map(r => r.id);

  const tasks = await db.select({ id: dailyTasks.id, pjpId: dailyTasks.id })
    .from(dailyTasks).where(inArray(dailyTasks.id, pjpIds));

  const tasksByPjpId = tasks.reduce((acc, t) => {
    if (t.pjpId) {
      if (!acc[t.pjpId]) acc[t.pjpId] = [];
      acc[t.pjpId].push(t.id);
    }
    return acc;
  }, {} as Record<string, string[]>);

  return rawReports.map((r) => {
    const visitTargetName = r.dealerName ?? r.siteName ?? null;

    return {
      id: r.id,
      areaToBeVisited: r.areaToBeVisited,
      route: r.route ?? null,
      description: r.description ?? null,
      status: r.status,
      verificationStatus: r.verificationStatus || 'PENDING',
      additionalVisitRemarks: r.additionalVisitRemarks ?? null,
      plannedNewSiteVisits: r.plannedNewSiteVisits ?? 0,
      plannedFollowUpSiteVisits: r.plannedFollowUpSiteVisits ?? 0,
      plannedNewDealerVisits: r.plannedNewDealerVisits ?? 0,
      plannedInfluencerVisits: r.plannedInfluencerVisits ?? 0,
      influencerName: r.influencerName ?? null,
      influencerPhone: r.influencerPhone ?? null,
      activityType: r.activityType ?? null,
      noOfConvertedBags: r.noofConvertedBags ?? 0,
      noOfMasonPcSchemes: r.noofMasonpcInSchemes ?? 0,
      diversionReason: r.diversionReason ?? null,

      planDate: formatDateIST(r.planDate) || '',
      createdAt: formatDateTimeIST(r.createdAt),
      updatedAt: formatDateTimeIST(r.updatedAt),

      userId: String(r.userId),
      dealerId: r.dealerId,
      siteId: r.siteId,
      visitDealerName: visitTargetName,
      taskIds: tasksByPjpId[r.id] || [],

      assignedSalesmanName: formatUserName({ firstName: r.salesmanFirstName, lastName: r.salesmanLastName, email: r.salesmanEmail }),
      assignedSalesmanEmail: r.salesmanEmail || '',
      creatorName: formatUserName({ firstName: r.creatorFirstName, lastName: r.creatorLastName, email: r.creatorEmail }),
      creatorEmail: r.creatorEmail || '',
      createdByRole: r.creatorRole || '',
      dealerName: r.dealerName ?? null,
    };
  });
}

export async function getFlattenedCompetitionReports(companyId: number) {
  const rawReports = await db
    .select({
      ...getTableColumns(competitionReports),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(competitionReports)
    .leftJoin(users, eq(competitionReports.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(competitionReports.reportDate));

  return rawReports.map((r) => ({
    id: r.id,
    brandName: r.brandName,
    billing: r.billing,
    nod: r.nod,
    retail: r.retail,
    schemesYesNo: r.schemesYesNo,
    remarks: r.remarks ?? null,
    reportDate: formatDateIST(r.reportDate) || '',
    avgSchemeCost: toNum(r.avgSchemeCost) || 0,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
    salesmanName: formatUserName({ firstName: r.userFirstName, lastName: r.userLastName, email: r.userEmail }),
    salesmanEmail: r.userEmail || '',
  }));
}

export async function getFlattenedDailyTasks(companyId: number) {
  const rawReports = await db
    .select({
      ...getTableColumns(dailyTasks),
      salesmanFirstName: users.firstName,
      salesmanLastName: users.lastName,
      salesmanEmail: users.email,
      dealerNameStr: dealers.name,
    })
    .from(dailyTasks)
    .leftJoin(users, eq(dailyTasks.userId, users.id))
    .leftJoin(dealers, eq(dailyTasks.dealerId, dealers.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(dailyTasks.taskDate));

  return rawReports.map((r) => ({
    id: r.id,
    pjpBatchId: r.pjpBatchId ?? null,
    visitType: r.visitType ?? null,

    // Dealer Details
    dealerId: r.dealerId ?? null,
    dealerName: r.dealerNameStr ?? r.dealerNameSnapshot ?? null,
    dealerMobile: r.dealerMobile ?? null,

    // Routing & Location
    zone: r.zone ?? null,
    area: r.area ?? null,
    route: r.route ?? null,

    // Task Specifics
    objective: r.objective ?? null,
    requiredVisitCount: r.requiredVisitCount ?? null,
    week: r.week ?? null,
    status: r.status,

    // Dates
    taskDate: formatDateIST(r.taskDate) || '',
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),

    // Assigned User Details
    assignedSalesmanName: formatUserName({
      firstName: r.salesmanFirstName,
      lastName: r.salesmanLastName,
      email: r.salesmanEmail
    }),
    assignedSalesmanEmail: r.salesmanEmail || '',
  }));
}

export async function getFlattenedSalesmanAttendance(companyId: number) {
  const rawReports = await db
    .select({
      ...getTableColumns(salesmanAttendance),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(salesmanAttendance)
    .leftJoin(users, eq(salesmanAttendance.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(salesmanAttendance.attendanceDate));

  return rawReports.map((r) => ({
    id: r.id,
    locationName: r.locationName,
    role: r.role || '',
    inTimeImageCaptured: r.inTimeImageCaptured,
    outTimeImageCaptured: r.outTimeImageCaptured,
    inTimeImageUrl: r.inTimeImageUrl ?? null,
    outTimeImageUrl: r.outTimeImageUrl ?? null,

    attendanceDate: formatDateIST(r.attendanceDate) || '',
    inTimeTimestamp: formatDateTimeIST(r.inTimeTimestamp) || '-',
    outTimeTimestamp: r.outTimeTimestamp ? formatDateTimeIST(r.outTimeTimestamp) : null,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),

    inTimeLatitude: toNum(r.inTimeLatitude) || 0,
    inTimeLongitude: toNum(r.inTimeLongitude) || 0,
    inTimeAccuracy: toNum(r.inTimeAccuracy),
    inTimeSpeed: toNum(r.inTimeSpeed),
    inTimeHeading: toNum(r.inTimeHeading),
    inTimeAltitude: toNum(r.inTimeAltitude),
    outTimeLatitude: toNum(r.outTimeLatitude),
    outTimeLongitude: toNum(r.outTimeLongitude),
    outTimeAccuracy: toNum(r.outTimeAccuracy),
    outTimeSpeed: toNum(r.outTimeSpeed),
    outTimeHeading: toNum(r.outTimeHeading),
    outTimeAltitude: toNum(r.outTimeAltitude),

    salesmanName: formatUserName({ firstName: r.userFirstName, lastName: r.userLastName, email: r.userEmail }),
    salesmanEmail: r.userEmail || '',
  }));
}

export async function getFlattenedSalesmanLeaveApplication(companyId: number) {
  const rawReports = await db
    .select({
      ...getTableColumns(salesmanLeaveApplications),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(salesmanLeaveApplications)
    .leftJoin(users, eq(salesmanLeaveApplications.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(salesmanLeaveApplications.startDate));

  return rawReports.map((r) => ({
    id: r.id,
    leaveType: r.leaveType,
    reason: r.reason,
    status: r.status,
    adminRemarks: r.adminRemarks ?? null,
    startDate: formatDateIST(r.startDate) || '',
    endDate: formatDateIST(r.endDate) || '',
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
    salesmanName: formatUserName({ firstName: r.userFirstName, lastName: r.userLastName, email: r.userEmail }),
    salesmanEmail: r.userEmail || '',
  }));
}

export async function getFlattenedSalesOrders(companyId: number) {
  const orders = await db
    .select({
      ...getTableColumns(salesOrders),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      userRole: users.role,
      dealerNameStr: dealers.name,
      dealerRegion: dealers.region,
      dealerArea: dealers.area,
      dealerPhone: dealers.phoneNo,
      dealerAddressStr: dealers.address,
    })
    .from(salesOrders)
    .leftJoin(users, eq(salesOrders.userId, users.id))
    .leftJoin(dealers, eq(salesOrders.dealerId, dealers.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(salesOrders.createdAt));

  return orders.map((o) => {
    const qty = toNum(o.orderQty) ?? 0;
    const unitPrice = toNum(o.itemPriceAfterDiscount) ?? toNum(o.itemPrice) ?? 0;
    const orderTotal = Number((qty * unitPrice).toFixed(2));

    const receivedPayment = toNum(o.receivedPayment);
    const pendingPayment = o.pendingPayment != null ? toNum(o.pendingPayment) : Number((orderTotal - (receivedPayment ?? 0)).toFixed(2));

    return {
      id: o.id,
      userId: o.userId ?? null,
      dealerId: o.dealerId ?? null,
      dvrId: o.dvrId ?? null,
      pjpId: o.pjpId ?? null,
      salesmanName: formatUserName({ firstName: o.userFirstName, lastName: o.userLastName, email: o.userEmail }) || o.userEmail || null,
      salesmanEmail: o.userEmail ?? null,
      salesmanRole: o.userRole ?? null,
      dealerName: o.dealerNameStr ?? null,
      dealerRegion: o.dealerRegion ?? null,
      dealerArea: o.dealerArea ?? null,
      dealerPhone: o.dealerPhone ?? null,
      dealerAddress: o.dealerAddressStr ?? null,

      orderDate: formatDateIST(o.orderDate) || '',
      orderPartyName: o.orderPartyName,
      partyPhoneNo: o.partyPhoneNo ?? null,
      partyArea: o.partyArea ?? null,
      partyRegion: o.partyRegion ?? null,
      partyAddress: o.partyAddress ?? null,

      deliveryDate: formatDateIST(o.deliveryDate),
      deliveryArea: o.deliveryArea ?? null,
      deliveryRegion: o.deliveryRegion ?? null,
      deliveryAddress: o.deliveryAddress ?? null,
      deliveryLocPincode: o.deliveryLocPincode ?? null,

      paymentMode: o.paymentMode ?? null,
      paymentTerms: o.paymentTerms ?? null,
      paymentAmount: toNum(o.paymentAmount),
      receivedPayment,
      receivedPaymentDate: formatDateIST(o.receivedPaymentDate),
      pendingPayment,

      orderQty: toNum(o.orderQty),
      orderUnit: o.orderUnit ?? null,
      itemPrice: toNum(o.itemPrice),
      discountPercentage: toNum(o.discountPercentage),
      itemPriceAfterDiscount: toNum(o.itemPriceAfterDiscount),

      itemType: o.itemType ?? null,
      itemGrade: o.itemGrade ?? null,
      orderTotal,
      estimatedDelivery: formatDateIST(o.deliveryDate),
      remarks: null,
      createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : '',
      updatedAt: o.updatedAt ? new Date(o.updatedAt).toISOString() : '',
    };
  });
}

export async function getFlattenedGeoTracking(companyId: number) {
  const rawReports = await db
    .select({
      opId: journeyOps.opId,
      journeyId: journeyOps.journeyId,
      createdAt: journeyOps.createdAt,
      payload: journeyOps.payload,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(journeyOps)
    .leftJoin(users, eq(journeyOps.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(journeyOps.createdAt));

  return rawReports.map((op) => {
    const p = (op.payload && typeof op.payload === 'object') ? op.payload as any : {};

    return {
      id: op.opId,
      journeyId: op.journeyId,
      salesmanName: formatUserName({ firstName: op.userFirstName, lastName: op.userLastName, email: op.userEmail }),
      salesmanEmail: op.userEmail || '',

      latitude: Number(p.latitude) || 0,
      longitude: Number(p.longitude) || 0,
      recordedAt: p.endedAt || formatDateTimeIST(op.createdAt),
      accuracy: p.accuracy ? Number(p.accuracy) : null,
      speed: p.speed ? Number(p.speed) : null,
      heading: p.heading ? Number(p.heading) : null,
      altitude: p.altitude ? Number(p.altitude) : null,
      locationType: p.locationType || null,
      activityType: p.activityType || null,
      appState: p.appState || null,
      batteryLevel: p.batteryLevel ? Number(p.batteryLevel) : null,
      isCharging: Boolean(p.isCharging),
      networkStatus: p.networkStatus || null,
      ipAddress: p.ipAddress || null,
      siteName: p.siteName || null,
      checkInTime: formatDateTimeIST(p.checkInTime),
      checkOutTime: p.checkOutTime ? formatDateTimeIST(p.checkOutTime) : null,
      totalDistanceTravelled: p.totalDistance !== undefined ? Number(p.totalDistance) : null,
      isActive: Boolean(p.isActive),
      destLat: p.destLat ? Number(p.destLat) : null,
      destLng: p.destLng ? Number(p.destLng) : null,
      createdAt: op.createdAt ? new Date(op.createdAt).toISOString() : '',
      updatedAt: op.createdAt ? new Date(op.createdAt).toISOString() : '',
    };
  });
}

export async function getFlattenedDealerReportsAndScores(companyId: number) {
  const rawReports = await db
    .select({
      ...getTableColumns(dealerReportsAndScores),
      dealerName: dealers.name,
      dealerRegion: dealers.region,
      dealerArea: dealers.area,
    })
    .from(dealerReportsAndScores)
    .leftJoin(dealers, eq(dealerReportsAndScores.dealerId, dealers.id))
    .leftJoin(users, eq(dealers.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(dealerReportsAndScores.lastUpdatedDate));

  return rawReports.map((r) => ({
    id: r.id,
    lastUpdatedDate: r.lastUpdatedDate ? new Date(r.lastUpdatedDate).toISOString() : '',
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
    dealerScore: toNum(r.dealerScore) || 0,
    trustWorthinessScore: toNum(r.trustWorthinessScore) || 0,
    creditWorthinessScore: toNum(r.creditWorthinessScore) || 0,
    orderHistoryScore: toNum(r.orderHistoryScore) || 0,
    visitFrequencyScore: toNum(r.visitFrequencyScore) || 0,
    dealerName: r.dealerName || 'Unknown',
    dealerRegion: r.dealerRegion || '',
    dealerArea: r.dealerArea || '',
  }));
}

export async function getFlattenedRatings(companyId: number) {
  const rawReports = await db
    .select({
      ...getTableColumns(ratings),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(ratings)
    .leftJoin(users, eq(ratings.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(ratings.id));

  return rawReports.map((r) => ({
    id: r.id,
    area: r.area,
    region: r.region,
    rating: r.rating,
    salesmanName: formatUserName({ firstName: r.userFirstName, lastName: r.userLastName, email: r.userEmail }),
    salesmanEmail: r.userEmail || '',
  }));
}

export async function getFlattenedDealerBrandCapacities(companyId: number) {
  const rows = await db
    .select({
      ...getTableColumns(dealerBrandMapping),
      brandName: brands.brandName,
      dealerName: dealers.name,
      dealerRegion: dealers.region,
      dealerArea: dealers.area,
    })
    .from(dealerBrandMapping)
    .leftJoin(dealers, eq(dealerBrandMapping.dealerId, dealers.id))
    .leftJoin(brands, eq(dealerBrandMapping.brandId, brands.id))
    .leftJoin(users, eq(dealers.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(dealerBrandMapping.dealerId);

  return rows.map((r) => ({
    id: r.id,
    dealerId: r.dealerId,
    capacityMT: toNum(r.capacityMt) || 0,
    bestCapacityMT: toNum(r.bestCapacityMt),
    brandGrowthCapacityPercent: toNum(r.brandGrowthCapacityPercent),
    userId: r.userId ?? null,
    brandName: r.brandName || 'Unknown',
    dealerName: r.dealerName || 'Unknown',
    dealerRegion: r.dealerRegion || '',
    dealerArea: r.dealerArea || '',
  }));
}

export async function getFlattenedTSOMeeetings(companyId: number) {
  const raw = await db
    .select({
      ...getTableColumns(tsoMeetings),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      userRole: users.role,
    })
    .from(tsoMeetings)
    .leftJoin(users, eq(tsoMeetings.createdByUserId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(tsoMeetings.date));

  return raw.map((r) => ({
    id: r.id,
    type: r.type,
    date: r.date ? new Date(r.date).toISOString().slice(0, 10) : null,
    totalExpenses: toNum(r.totalExpenses),
    participantsCount: r.participantsCount ?? null,
    zone: r.zone ?? '',
    market: r.market ?? '',
    dealerName: r.dealerName ?? '',
    dealerAddress: r.dealerAddress ?? '',
    conductedBy: r.conductedBy ?? '',
    giftType: r.giftType ?? '',
    accountJsbJud: r.accountJsbJud ?? '',
    billSubmitted: r.billSubmitted ? 'Yes' : 'No',
    meetImageUrl: r.meetImageUrl ?? '',
    siteId: r.siteId ?? '',
    createdByUserName: formatUserName({ firstName: r.userFirstName, lastName: r.userLastName, email: r.userEmail }) || r.userEmail || '',
    createdByUserEmail: r.userEmail || '',
    creatorRole: r.userRole ?? '',
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
  }));
}

export async function getFlattenedRewards() {
  const raw = await db.select().from(rewards).orderBy(rewards.itemName);
  return raw.map((r) => ({
    id: r.id,
    itemName: r.itemName,
    pointCost: r.pointCost,
    totalAvailableQuantity: r.totalAvailableQuantity,
    stock: r.stock,
    isActive: r.isActive,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
  }));
}

export async function getFlattenedGiftAllocationLogs(companyId: number) {
  const sourceUsers = aliasedTable(users, 'sourceUser');
  const destUsers = aliasedTable(users, 'destUser');

  const raw = await db
    .select({
      ...getTableColumns(giftAllocationLogs),
      itemName: rewards.itemName,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      sourceFirstName: sourceUsers.firstName,
      sourceLastName: sourceUsers.lastName,
      sourceEmail: sourceUsers.email,
      destFirstName: destUsers.firstName,
      destLastName: destUsers.lastName,
      destEmail: destUsers.email,
    })
    .from(giftAllocationLogs)
    .leftJoin(rewards, eq(giftAllocationLogs.rewardId, rewards.id))
    .leftJoin(users, eq(giftAllocationLogs.userId, users.id))
    .leftJoin(sourceUsers, eq(giftAllocationLogs.sourceUserId, sourceUsers.id))
    .leftJoin(destUsers, eq(giftAllocationLogs.destinationUserId, destUsers.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(giftAllocationLogs.createdAt));

  return raw.map((r) => ({
    id: r.id,
    itemName: r.itemName || 'Unknown Item',
    salesmanName: formatUserName({ firstName: r.userFirstName, lastName: r.userLastName, email: r.userEmail }),
    salesmanEmail: r.userEmail || '',
    transactionType: r.transactionType,
    quantity: r.quantity,
    sourceUserName: formatUserName({ firstName: r.sourceFirstName, lastName: r.sourceLastName, email: r.sourceEmail }),
    destinationUserName: formatUserName({ firstName: r.destFirstName, lastName: r.destLastName, email: r.destEmail }),
    technicalVisitReportId: r.relatedReportId ?? null,
    dealerVisitReportId: null, // Legacy, keeping null for backwards compatibility
    createdAt: formatDateTimeIST(r.createdAt),
  }));
}

export async function getFlattenedMasonPCSide(companyId: number) {
  const raw = await db
    .select({
      ...getTableColumns(masonPcSide),
      dealerNameStr: dealers.name,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(masonPcSide)
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .leftJoin(dealers, eq(masonPcSide.dealerId, dealers.id))
    .where(or(eq(users.companyId, companyId), isNull(masonPcSide.userId)))
    .orderBy(masonPcSide.name);

  if (raw.length === 0) return [];
  const masonIds = raw.map(m => m.id);

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

  return raw.map((r) => {
    const latestKyc = latestKycMap.get(r.id);
    return {
      id: r.id,
      name: r.name,
      phoneNumber: r.phoneNumber,
      firebaseUid: r.firebaseUid ?? null,
      kycDocumentName: r.kycDocName ?? null,
      kycDocumentIdNum: r.kycDocIdNum ?? null,
      kycStatus: r.kycStatus ?? null,
      bagsLifted: r.bagsLifted ?? null,
      pointsBalance: r.pointsBalance ?? null,
      isReferred: r.isReferred ?? null,
      referredByUser: r.referredByUser ?? null,
      referredToUser: r.referredToUser ?? null,
      dealerName: r.dealerNameStr ?? null,
      associatedSalesman: formatUserName({ firstName: r.userFirstName, lastName: r.userLastName, email: r.userEmail }) || null,
      kycSubmittedAt: latestKyc?.createdAt ? formatDateTimeIST(latestKyc.createdAt) : null,
    };
  });
}

export async function getFlattenedSchemesOffers() {
  const raw = await db.select().from(schemesOffers).orderBy(schemesOffers.name);
  return raw.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    startDate: r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : null,
    endDate: r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : null,
  }));
}

export async function getFlattenedMasonsOnSchemes(companyId: number) {
  const raw = await db
    .select({
      ...getTableColumns(masonOnScheme),
      masonName: masonPcSide.name,
      schemeName: schemesOffers.name,
    })
    .from(masonOnScheme)
    .leftJoin(masonPcSide, eq(masonOnScheme.masonId, masonPcSide.id))
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .leftJoin(schemesOffers, eq(masonOnScheme.schemeId, schemesOffers.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(masonOnScheme.enrolledAt));

  return raw.map((r) => ({
    masonId: r.masonId,
    masonName: r.masonName || 'Unknown',
    schemeId: r.schemeId,
    schemeName: r.schemeName || 'Unknown',
    enrolledAt: r.enrolledAt ? new Date(r.enrolledAt).toISOString() : null,
    status: r.status ?? null,
  }));
}

export async function getFlattenedMasonsOnMeetings(companyId: number) {
  const raw = await db
    .select({
      ...getTableColumns(masonsOnMeetings),
      masonName: masonPcSide.name,
      meetingType: tsoMeetings.type,
      meetingDate: tsoMeetings.date,
    })
    .from(masonsOnMeetings)
    .leftJoin(masonPcSide, eq(masonsOnMeetings.masonId, masonPcSide.id))
    .leftJoin(tsoMeetings, eq(masonsOnMeetings.meetingId, tsoMeetings.id))
    .leftJoin(users, eq(tsoMeetings.createdByUserId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(masonsOnMeetings.attendedAt));

  return raw.map((r) => ({
    masonId: r.masonId,
    masonName: r.masonName || 'Unknown',
    meetingId: r.meetingId,
    meetingType: r.meetingType || 'Unknown',
    meetingDate: r.meetingDate ? new Date(r.meetingDate).toISOString().slice(0, 10) : '',
    attendedAt: r.attendedAt ? new Date(r.attendedAt).toISOString() : '',
  }));
}

export async function getFlattenedRewardCategories() {
  const raw = await db.select().from(rewardCategories).orderBy(rewardCategories.name);
  return raw.map((r) => ({
    id: r.id,
    name: r.name,
  }));
}

export async function getFlattenedKYCSubmissions(companyId: number) {
  const raw = await db
    .select({
      ...getTableColumns(kycSubmissions),
      masonName: masonPcSide.name,
    })
    .from(kycSubmissions)
    .leftJoin(masonPcSide, eq(kycSubmissions.masonId, masonPcSide.id))
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(kycSubmissions.createdAt));

  return raw.map((r) => ({
    id: r.id,
    masonId: r.masonId,
    masonName: r.masonName || 'Unknown',
    aadhaarNumber: r.aadhaarNumber ?? null,
    panNumber: r.panNumber ?? null,
    voterIdNumber: r.voterIdNumber ?? null,
    status: r.status,
    remark: r.remark ?? null,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
  }));
}

export async function getFlattenedTSOAssignments(companyId: number) {
  const raw = await db
    .select({
      ...getTableColumns(tsoAssignments),
      masonName: masonPcSide.name,
      tsoFirstName: users.firstName,
      tsoLastName: users.lastName,
      tsoEmail: users.email,
    })
    .from(tsoAssignments)
    .leftJoin(masonPcSide, eq(tsoAssignments.masonId, masonPcSide.id))
    .leftJoin(users, eq(tsoAssignments.tsoId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(tsoAssignments.createdAt));

  return raw.map((r) => ({
    masonId: r.masonId,
    masonName: r.masonName || 'Unknown',
    tsoId: r.tsoId,
    tsoName: formatUserName({ firstName: r.tsoFirstName, lastName: r.tsoLastName, email: r.tsoEmail }),
    tsoEmail: r.tsoEmail || '',
    createdAt: r.createdAt ? formatDateTimeIST(r.createdAt) : '',
  }));
}

export async function getFlattenedBagLifts(companyId: number) {
  const approverUsers = aliasedTable(users, 'approver');
  const masonUsers = aliasedTable(users, 'masonUser');

  const raw = await db
    .select({
      ...getTableColumns(bagLifts),
      masonName: masonPcSide.name,
      masonPhone: masonPcSide.phoneNumber,
      dealerName: dealers.name,
      siteNameStr: technicalSites.siteName,
      siteAddressStr: technicalSites.address,
      approverFirstName: approverUsers.firstName,
      approverLastName: approverUsers.lastName,
      approverEmail: approverUsers.email,
      salesmanFirstName: masonUsers.firstName,
      salesmanLastName: masonUsers.lastName,
      salesmanEmail: masonUsers.email,
    })
    .from(bagLifts)
    .leftJoin(masonPcSide, eq(bagLifts.masonId, masonPcSide.id))
    .leftJoin(masonUsers, eq(masonPcSide.userId, masonUsers.id))
    .leftJoin(dealers, eq(bagLifts.dealerId, dealers.id))
    .leftJoin(technicalSites, eq(bagLifts.siteId, technicalSites.id))
    .leftJoin(approverUsers, eq(bagLifts.approvedBy, approverUsers.id))
    .where(or(eq(masonUsers.companyId, companyId), isNull(masonUsers.id)))
    .orderBy(desc(bagLifts.createdAt));

  return raw.map((r) => ({
    id: r.id,
    masonId: r.masonId,
    masonName: r.masonName || 'Unknown',
    phoneNumber: r.masonPhone || null,
    dealerId: r.dealerId ?? null,
    dealerName: r.dealerName ?? null,
    siteId: r.siteId ?? null,
    siteName: r.siteNameStr ?? null,
    siteAddress: r.siteAddressStr ?? null,
    siteKeyPersonName: r.siteKeyPersonName ?? null,
    siteKeyPersonPhone: r.siteKeyPersonPhone ?? null,
    imageUrl: r.imageUrl ?? null,
    verificationSiteImageUrl: r.verificationSiteImageUrl ?? null,
    verificationProofImageUrl: r.verificationProofImageUrl ?? null,

    purchaseDate: r.purchaseDate ? new Date(r.purchaseDate).toISOString().slice(0, 10) : '',
    bagCount: r.bagCount,
    pointsCredited: r.pointsCredited,
    status: r.status,
    approvedByUserId: r.approvedBy ?? null,
    approverName: formatUserName({ firstName: r.approverFirstName, lastName: r.approverLastName, email: r.approverEmail }),
    associatedSalesmanName: formatUserName({ firstName: r.salesmanFirstName, lastName: r.salesmanLastName, email: r.salesmanEmail }),
    approvedAt: r.approvedAt ? new Date(r.approvedAt).toISOString() : null,
    createdAt: formatDateTimeIST(r.createdAt),
  }));
}

export async function getFlattenedRewardRedemptions(companyId: number) {
  const raw = await db
    .select({
      ...getTableColumns(rewardRedemptions),
      masonName: masonPcSide.name,
      rewardName: rewards.itemName,
    })
    .from(rewardRedemptions)
    .leftJoin(masonPcSide, eq(rewardRedemptions.masonId, masonPcSide.id))
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .leftJoin(rewards, eq(rewardRedemptions.rewardId, rewards.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(rewardRedemptions.createdAt));

  return raw.map((r) => ({
    id: r.id,
    masonId: r.masonId,
    masonName: r.masonName || 'Unknown',
    rewardId: r.rewardId,
    rewardName: r.rewardName || 'Unknown',
    quantity: r.quantity,
    status: r.status,
    pointsDebited: r.pointsDebited,
    deliveryName: r.deliveryName ?? null,
    deliveryPhone: r.deliveryPhone ?? null,
    deliveryAddress: r.deliveryAddress ?? null,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
  }));
}

export async function getFlattenedPointsLedger(companyId: number) {
  const raw = await db
    .select({
      ...getTableColumns(pointsLedger),
      masonName: masonPcSide.name,
    })
    .from(pointsLedger)
    .leftJoin(masonPcSide, eq(pointsLedger.masonId, masonPcSide.id))
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(pointsLedger.createdAt));

  if (raw.length === 0) return [];
  const sourceIds = raw.map(r => r.sourceId).filter(Boolean) as string[];

  // Parallel fetch for polymorphic descriptions
  const [associatedBagLifts, associatedRedemptions] = await Promise.all([
    db.select({ id: bagLifts.id, bagCount: bagLifts.bagCount, dealerName: dealers.name })
      .from(bagLifts).leftJoin(dealers, eq(bagLifts.dealerId, dealers.id))
      .where(inArray(bagLifts.id, sourceIds)),
    db.select({ id: rewardRedemptions.id, rewardName: rewards.itemName })
      .from(rewardRedemptions).leftJoin(rewards, eq(rewardRedemptions.rewardId, rewards.id))
      .where(inArray(rewardRedemptions.id, sourceIds))
  ]);

  const blMap = new Map(associatedBagLifts.map(bl => [bl.id, bl]));
  const rrMap = new Map(associatedRedemptions.map(rr => [rr.id, rr]));

  return raw.map((r) => {
    let description = r.memo;
    if (r.sourceId) {
      if (blMap.has(r.sourceId)) {
        const bl = blMap.get(r.sourceId)!;
        const dealerInfo = bl.dealerName ? ` @ ${bl.dealerName}` : '';
        description = `Lifted ${bl.bagCount} bags${dealerInfo}`;
      } else if (rrMap.has(r.sourceId)) {
        const rr = rrMap.get(r.sourceId)!;
        description = `Redeemed: ${rr.rewardName ?? 'Unknown Item'}`;
      }
    }

    return {
      id: r.id,
      masonId: r.masonId,
      masonName: r.masonName || 'Unknown',
      sourceType: r.sourceType,
      points: r.points,
      memo: r.memo ?? null,
      createdAt: formatDateTimeIST(r.createdAt),
      sourceDescription: description ?? null,
    };
  });
}

export async function getFlattenedLogisticsIO(startDate?: Date, endDate?: Date) {
  const filters = [];
  if (startDate && endDate) {
    // End date is inclusive up to end of day
    endDate.setHours(23, 59, 59, 999);
    filters.push(
      and(
        sql`${logisticsIo.createdAt} >= ${startDate.toISOString()}`,
        sql`${logisticsIo.createdAt} <= ${endDate.toISOString()}`
      )
    );
  }

  const rawData = await db
    .select()
    .from(logisticsIo)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(logisticsIo.createdAt));

  return rawData.map((r) => ({
    id: r.id,
    zone: r.zone ?? '',
    district: r.district ?? '',
    destination: r.destination ?? '',
    purpose: r.purpose ?? null,
    typeOfMaterials: r.typeOfMaterials ?? null,
    vehicleNumber: r.vehicleNumber ?? null,
    noOfInvoice: r.noOfInvoice ?? null,
    sourceName: r.partyName ?? null,
    invoiceNos: Array.isArray(r.invoiceNos) ? r.invoiceNos : [],
    billNos: Array.isArray(r.billNos) ? r.billNos : [],
    storeDate: formatDateIST(r.storeDate),
    storeTime: r.storeTime ?? null,

    doOrderDate: formatDateIST(r.doOrderDate),
    doOrderTime: r.doOrderTime ?? null,
    gateInDate: formatDateIST(r.gateInDate),
    gateInTime: r.gateInTime ?? null,
    processingTime: r.processingTime ?? null,
    wbInDate: formatDateIST(r.wbInDate),
    wbInTime: r.wbInTime ?? null,
    diffGateInTareWt: r.diffGateInTareWt ?? null,
    wbOutDate: formatDateIST(r.wbOutDate),
    wbOutTime: r.wbOutTime ?? null,
    diffTareWtGrossWt: r.diffTareWtGrossWt ?? null,
    gateOutDate: formatDateIST(r.gateOutDate),
    gateOutTime: r.gateOutTime ?? null,
    gateOutNoOfInvoice: r.gateOutNoOfInvoice ?? null,
    gateOutInvoiceNos: Array.isArray(r.gateOutInvoiceNos) ? r.gateOutInvoiceNos : [],
    gateOutBillNos: Array.isArray(r.gateOutBillNos) ? r.gateOutBillNos : [],
    diffGrossWtGateOut: r.diffGrossWtGateOut ?? null,
    diffGrossWtInvoiceDT: r.diffGrossWtInvoiceDt ?? null,
    diffInvoiceDTGateOut: r.diffInvoiceDtGateOut ?? null,
    diffGateInGateOut: r.diffGateInGateOut ?? null,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
  }));
}

export const transformerMap = {
  // Core Report Models
  users: getFlattenedUsers,
  dealers: getFlattenedDealers,
  dailyVisitReports: getFlattenedDailyVisitReports,
  technicalVisitReports: getFlattenedTechnicalVisitReports,
  technicalSites: getFlattenedTechnicalSites,
  salesOrders: getFlattenedSalesOrders,
  competitionReports: getFlattenedCompetitionReports,

  // Planning & Task Models
  permanentJourneyPlans: getFlattenedPermanentJourneyPlans,
  dailyTasks: getFlattenedDailyTasks,

  salesmanAttendance: getFlattenedSalesmanAttendance,
  salesmanLeaveApplications: getFlattenedSalesmanLeaveApplication,
  geoTracking: getFlattenedGeoTracking,

  dealerReportsAndScores: getFlattenedDealerReportsAndScores,
  salesmanRating: getFlattenedRatings,
  dealerBrandCapacities: getFlattenedDealerBrandCapacities,

  tsoMeetings: getFlattenedTSOMeeetings,
  flattendRewards: getFlattenedRewards,
  giftAllocationLogs: getFlattenedGiftAllocationLogs,
  masonPCSide: getFlattenedMasonPCSide,
  schemesOffers: getFlattenedSchemesOffers,
  masonsOnSchemes: getFlattenedMasonsOnSchemes,
  masonsOnMeetings: getFlattenedMasonsOnMeetings,
  rewardCategories: getFlattenedRewardCategories,
  kycSubmissions: getFlattenedKYCSubmissions,
  tsoAssignments: getFlattenedTSOAssignments,
  bagLifts: getFlattenedBagLifts,
  rewardRedemptions: getFlattenedRewardRedemptions,
  pointsLedger: getFlattenedPointsLedger,

  logisticsIO: getFlattenedLogisticsIO,
};
