// src/lib/reports-transformer.ts
import prisma from '@/lib/prisma';

// 1. Helper to format User Names safely
export const formatUserName = (user: { firstName?: string | null, lastName?: string | null, email?: string | null } | null): string => {
  if (!user) return '';
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || user.email || '';
};

// 2. Helper to format Date objects to YYYY-MM-DD in IST
export const formatDateIST = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // Output: "YYYY-MM-DD"
};

// 3. Helper to format Date objects to readable 12-hour IST DateTime
export const formatDateTimeIST = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  // Formats as "14 Feb 2026 02:30 PM"
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).replace(/,/g, '').toUpperCase();
};

// 4. Helper to convert raw time strings (e.g., "14:30") to 12-hour AM/PM format
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

// Users
export type FlattenedUser = {
  id: number;
  email: string;
  firstName: string,
  lastName: string,
  role: string;
  phoneNumber: string | null;
  status: string;
  region: string | null;
  area: string | null;
  isTechnicalRole?: boolean | null;
  reportsToManagerName: string | null; // Flattened relation name
  createdAt: string;
};

export async function getFlattenedUsers(companyId: number): Promise<FlattenedUser[]> {
  const rawUsers = await prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      phoneNumber: true,
      status: true,
      region: true,
      area: true,
      isTechnicalRole: true,
      createdAt: true,
      // Relations for flattening:
      reportsTo: {
        select: { firstName: true, lastName: true }
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rawUsers.map((u: any) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    phoneNumber: u.phoneNumber ?? null,
    status: u.status,
    region: u.region ?? null,
    area: u.area ?? null,
    isTechnicalRole: u.isTechnicalRole ?? null,
    reportsToManagerName: formatUserName(u.reportsTo) || null,
    createdAt: u.createdAt?.toISOString() ?? '',
  }));
}

// Dealers
export type FlattenedDealer = {
  // Scalar fields that need no special handling (String, Int)
  id: string;
  type: string;
  name: string;
  region: string;
  area: string;
  phoneNo: string;
  address: string;
  pinCode: string | null;
  feedbacks: string;
  remarks: string | null;
  dealerDevelopmentStatus: string | null;
  dealerDevelopmentObstacle: string | null;
  verificationStatus: string;
  nameOfFirm: string | null;
  underSalesPromoterName: string | null;
  whatsappNo: string | null;
  emailId: string | null;
  businessType: string | null;
  gstinNo: string | null;
  panNo: string | null;
  tradeLicNo: string | null;
  aadharNo: string | null;
  godownSizeSqFt: number | null; // Int
  godownCapacityMTBags: string | null;
  godownAddressLine: string | null;
  godownLandMark: string | null;
  godownDistrict: string | null;
  godownArea: string | null;
  godownRegion: string | null;
  godownPinCode: string | null;
  residentialAddressLine: string | null;
  residentialLandMark: string | null;
  residentialDistrict: string | null;
  residentialArea: string | null;
  residentialRegion: string | null;
  residentialPinCode: string | null;
  bankAccountName: string | null;
  bankName: string | null;
  bankBranchAddress: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  brandName: string | null;
  noOfDealers: number | null; // Int
  areaCovered: string | null;
  noOfEmployeesInSales: number | null; // Int
  declarationName: string | null;
  declarationPlace: string | null;
  tradeLicencePicUrl: string | null;
  shopPicUrl: string | null;
  dealerPicUrl: string | null;
  blankChequePicUrl: string | null;
  partnershipDeedPicUrl: string | null;

  // Fields that require Type Conversion (Decimal, DateTime, Array)
  latitude: number | null; // Decimal -> number
  longitude: number | null; // Decimal -> number
  dateOfBirth: string | null; // DateTime -> string
  anniversaryDate: string | null; // DateTime -> string
  totalPotential: number; // Decimal -> number
  bestPotential: number; // Decimal -> number
  monthlySaleMT: number | null; // Decimal -> number
  projectedMonthlySalesBestCementMT: number | null; // Decimal -> number
  brandSelling: string; // String[] -> string (joined)
  declarationDate: string | null; // DateTime -> string

  // Auto-generated fields (for full report)
  createdAt: string;
  updatedAt: string;

  // Flattened relation field
  associatedSalesmanName: string | null;
};

export async function getFlattenedDealers(companyId: number): Promise<FlattenedDealer[]> {
  // 1. SELECT all fields and the necessary relation
  const rawDealers = await prisma.dealer.findMany({
    where: { user: { companyId: companyId } },
    select: {
      // Include all scalar fields by explicitly listing them:
      id: true, userId: true, type: true, parentDealerId: true, name: true, region: true, area: true,
      phoneNo: true, address: true, pinCode: true, latitude: true, longitude: true,
      dateOfBirth: true, anniversaryDate: true, totalPotential: true, bestPotential: true,
      brandSelling: true, feedbacks: true, remarks: true, dealerDevelopmentStatus: true,
      dealerDevelopmentObstacle: true, verificationStatus: true, whatsappNo: true, emailId: true, nameOfFirm: true, underSalesPromoterName: true,
      businessType: true, gstinNo: true, panNo: true, tradeLicNo: true, aadharNo: true,
      godownSizeSqFt: true, godownCapacityMTBags: true, godownAddressLine: true, godownLandMark: true,
      godownDistrict: true, godownArea: true, godownRegion: true, godownPinCode: true,
      residentialAddressLine: true, residentialLandMark: true, residentialDistrict: true,
      residentialArea: true, residentialRegion: true, residentialPinCode: true, bankAccountName: true,
      bankName: true, bankBranchAddress: true, bankAccountNumber: true, bankIfscCode: true,
      brandName: true, monthlySaleMT: true, noOfDealers: true, areaCovered: true,
      projectedMonthlySalesBestCementMT: true, noOfEmployeesInSales: true, declarationName: true,
      declarationPlace: true, declarationDate: true, tradeLicencePicUrl: true, shopPicUrl: true,
      dealerPicUrl: true, blankChequePicUrl: true, partnershipDeedPicUrl: true,
      createdAt: true, updatedAt: true,

      // Relations for flattening:
      user: {
        select: { firstName: true, lastName: true }
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Transformation/Flattening Logic
  return rawDealers.map((d: any) => ({
    // Scalar Fields (Default Mapping)
    id: d.id, type: d.type, name: d.name, region: d.region, area: d.area, phoneNo: d.phoneNo,
    address: d.address, pinCode: d.pinCode ?? null, feedbacks: d.feedbacks, remarks: d.remarks ?? null,
    dealerDevelopmentStatus: d.dealerDevelopmentStatus ?? null, dealerDevelopmentObstacle: d.dealerDevelopmentObstacle ?? null,
    verificationStatus: d.verificationStatus, whatsappNo: d.whatsappNo ?? null, emailId: d.emailId ?? null, nameOfFirm: d.nameOfFirm ?? null, underSalesPromoterName: d.underSalesPromoterName ?? null,
    businessType: d.businessType ?? null, gstinNo: d.gstinNo ?? null, panNo: d.panNo ?? null, tradeLicNo: d.tradeLicNo ?? null,
    aadharNo: d.aadharNo ?? null, godownSizeSqFt: d.godownSizeSqFt ?? null, godownCapacityMTBags: d.godownCapacityMTBags ?? null,
    godownAddressLine: d.godownAddressLine ?? null, godownLandMark: d.godownLandMark ?? null, godownDistrict: d.godownDistrict ?? null,
    godownArea: d.godownArea ?? null, godownRegion: d.godownRegion ?? null, godownPinCode: d.godownPinCode ?? null,
    residentialAddressLine: d.residentialAddressLine ?? null, residentialLandMark: d.residentialLandMark ?? null,
    residentialDistrict: d.residentialDistrict ?? null, residentialArea: d.residentialArea ?? null, residentialRegion: d.residentialRegion ?? null,
    residentialPinCode: d.residentialPinCode ?? null, bankAccountName: d.bankAccountName ?? null, bankName: d.bankName ?? null,
    bankBranchAddress: d.bankBranchAddress ?? null, bankAccountNumber: d.bankAccountNumber ?? null, bankIfscCode: d.bankIfscCode ?? null,
    brandName: d.brandName ?? null, noOfDealers: d.noOfDealers ?? null, areaCovered: d.areaCovered ?? null,
    noOfEmployeesInSales: d.noOfEmployeesInSales ?? null, declarationName: d.declarationName ?? null,
    declarationPlace: d.declarationPlace ?? null, tradeLicencePicUrl: d.tradeLicencePicUrl ?? null, shopPicUrl: d.shopPicUrl ?? null,
    dealerPicUrl: d.dealerPicUrl ?? null, blankChequePicUrl: d.blankChequePicUrl ?? null, partnershipDeedPicUrl: d.partnershipDeedPicUrl ?? null,

    // DateTime Fields (Conversion to Date string)
    dateOfBirth: formatDateIST(d.dateOfBirth) ?? null,
    anniversaryDate: formatDateIST(d.anniversaryDate) ?? null,
    declarationDate: formatDateIST(d.declarationDate) ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),

    // Decimal Fields (Conversion to number)
    latitude: d.latitude?.toNumber() ?? null,
    longitude: d.longitude?.toNumber() ?? null,
    totalPotential: d.totalPotential.toNumber(),
    bestPotential: d.bestPotential.toNumber(),
    monthlySaleMT: d.monthlySaleMT?.toNumber() ?? null,
    projectedMonthlySalesBestCementMT: d.projectedMonthlySalesBestCementMT?.toNumber() ?? null,

    // Array Field (Conversion to comma-separated string)
    brandSelling: d.brandSelling.join(', '),

    // Flattened Relation Field
    associatedSalesmanName: formatUserName(d.user) || null,
  }));
}

// DVR
export type FlattenedDailyVisitReport = {
  id: string;
  reportDate: string;
  dealerType: string;
  dealerName: string | null;      // hydrated from relation
  subDealerName: string | null;   // hydrated from relation
  location: string;
  latitude: number;
  longitude: number;
  visitType: string;
  dealerTotalPotential: number;
  dealerBestPotential: number;
  brandSelling: string;
  contactPerson: string | null;
  contactPersonPhoneNo: string | null;
  todayOrderMt: number;
  todayCollectionRupees: number;
  overdueAmount: number | null;
  feedbacks: string;
  solutionBySalesperson: string | null;
  anyRemarks: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  timeSpentinLoc: string | null;
  inTimeImageUrl: string | null;
  outTimeImageUrl: string | null;
  createdAt: string;
  updatedAt: string;

  salesmanName: string;
  salesmanEmail: string;
};

// getFlattenedDailyVisitReports — FIXED to pull names via FKs
export async function getFlattenedDailyVisitReports(companyId: number): Promise<FlattenedDailyVisitReport[]> {
  // getFlattenedDailyVisitReports(companyId)
  const raw = await prisma.dailyVisitReport.findMany({
    where: { user: { companyId } },
    select: {
      id: true, reportDate: true, dealerType: true,
      location: true, latitude: true, longitude: true, visitType: true,
      dealerTotalPotential: true, dealerBestPotential: true,
      brandSelling: true, contactPerson: true, contactPersonPhoneNo: true,
      todayOrderMt: true, todayCollectionRupees: true, overdueAmount: true,
      feedbacks: true, solutionBySalesperson: true, anyRemarks: true,
      checkInTime: true, checkOutTime: true, timeSpentinLoc: true,
      inTimeImageUrl: true, outTimeImageUrl: true,
      createdAt: true, updatedAt: true,

      user: { select: { firstName: true, lastName: true, email: true } },

      // REQUIRED for names
      dealer: { select: { name: true } },
      subDealer: { select: { name: true } },
    },
    orderBy: { reportDate: 'desc' },
  });

  return raw.map((r: any) => ({
    id: r.id,
    reportDate: formatDateIST(r.reportDate) || '',
    dealerType: r.dealerType,
    dealerName: r.dealer?.name ?? null,
    subDealerName: r.subDealer?.name ?? null,
    location: r.location,
    latitude: r.latitude.toNumber(),
    longitude: r.longitude.toNumber(),
    visitType: r.visitType,
    dealerTotalPotential: r.dealerTotalPotential.toNumber(),
    dealerBestPotential: r.dealerBestPotential.toNumber(),
    brandSelling: r.brandSelling.join(', '),
    contactPerson: r.contactPerson ?? null,
    contactPersonPhoneNo: r.contactPersonPhoneNo ?? null,
    todayOrderMt: r.todayOrderMt.toNumber(),
    todayCollectionRupees: r.todayCollectionRupees.toNumber(),
    overdueAmount: r.overdueAmount?.toNumber() ?? null,
    feedbacks: r.feedbacks,
    solutionBySalesperson: r.solutionBySalesperson ?? null,
    anyRemarks: r.anyRemarks ?? null,
    checkInTime: formatDateTimeIST(r.checkInTime),
    checkOutTime: r.checkOutTime ? formatDateTimeIST(r.checkOutTime) : null,
    timeSpentinLoc: r.timeSpentinLoc ?? null,
    inTimeImageUrl: r.inTimeImageUrl ?? null,
    outTimeImageUrl: r.outTimeImageUrl ?? null,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
    salesmanName: formatUserName(r.user),
    salesmanEmail: r.user.email,
  }));
}

// TVR

export type FlattenedTechnicalVisitReport = {
  // All scalar fields from TechnicalVisitReport
  id: string;
  reportDate: string; // Converted from Date
  visitType: string;
  siteNameConcernedPerson: string;
  phoneNo: string;
  emailId: string | null;
  clientsRemarks: string;
  salespersonRemarks: string;
  checkInTime: string; // Converted from DateTime (Timestamp)
  checkOutTime: string | null; // Converted from DateTime (Timestamp)
  timeSpentinLoc: string | null;
  inTimeImageUrl: string | null;
  outTimeImageUrl: string | null;
  siteVisitBrandInUse: string; // Converted from String[]
  siteVisitStage: string | null;
  conversionFromBrand: string | null;
  conversionQuantityValue: number | null; // Converted from Decimal
  conversionQuantityUnit: string | null;
  associatedPartyName: string | null;
  influencerType: string; // Converted from String[]
  serviceType: string | null;
  qualityComplaint: string | null;
  promotionalActivity: string | null;
  channelPartnerVisit: string | null;
  siteVisitType: string | null;
  dhalaiVerificationCode: string | null;
  isVerificationStatus: string | null;
  meetingId: string | null;
  createdAt: string; // Converted from DateTime (Timestamp)
  updatedAt: string; // Converted from DateTime (Timestamp)
  purposeOfVisit: string | null;
  sitePhotoUrl: string | null;
  firstVisitTime: string | null;
  lastVisitTime: string | null;
  firstVisitDay: string | null;
  lastVisitDay: string | null;
  siteVisitsCount: number | null;
  otherVisitsCount: number | null;
  totalVisitsCount: number | null;
  region: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  pjpId: string | null;
  masonId: string | null;
  siteId: string | null;
  marketName: string | null;
  siteAddress: string | null;
  whatsappNo: string | null;
  visitCategory: string | null;
  customerType: string | null;
  constAreaSqFt: number | null;
  currentBrandPrice: number | null; // Decimal -> number
  siteStock: number | null; // Decimal -> number
  estRequirement: number | null; // Decimal -> number
  supplyingDealerName: string | null;
  nearbyDealerName: string | null;
  isConverted: boolean | null;
  conversionType: string | null;
  isTechService: boolean | null;
  serviceDesc: string | null;
  influencerName: string | null;
  influencerPhone: string | null;
  isSchemeEnrolled: boolean | null;
  influencerProductivity: string | null;
  salesmanName: string;
  salesmanEmail: string;
};

export async function getFlattenedTechnicalVisitReports(companyId: number): Promise<FlattenedTechnicalVisitReport[]> {
  const rawReports = await prisma.technicalVisitReport.findMany({
    where: { user: { companyId } },
    select: {
      // All scalar fields included explicitly
      id: true, userId: true, reportDate: true, visitType: true, siteNameConcernedPerson: true, phoneNo: true,
      emailId: true, clientsRemarks: true, salespersonRemarks: true, checkInTime: true, checkOutTime: true,
      timeSpentinLoc: true,
      inTimeImageUrl: true, outTimeImageUrl: true, createdAt: true, updatedAt: true,
      siteVisitBrandInUse: true, siteVisitStage: true, conversionFromBrand: true, conversionQuantityValue: true,
      conversionQuantityUnit: true, associatedPartyName: true, influencerType: true, serviceType: true,
      qualityComplaint: true, promotionalActivity: true, channelPartnerVisit: true, siteVisitType: true,
      dhalaiVerificationCode: true, isVerificationStatus: true, meetingId: true,
      purposeOfVisit: true,
      sitePhotoUrl: true,
      firstVisitTime: true,
      lastVisitTime: true,
      firstVisitDay: true,
      lastVisitDay: true,
      siteVisitsCount: true,
      otherVisitsCount: true,
      totalVisitsCount: true,
      region: true,
      area: true,
      latitude: true,
      longitude: true,
      pjpId: true,
      masonId: true,
      siteId: true,
      marketName: true,
      siteAddress: true,
      whatsappNo: true,
      visitCategory: true,
      customerType: true,
      constAreaSqFt: true,
      currentBrandPrice: true,
      siteStock: true,
      estRequirement: true,
      supplyingDealerName: true,
      nearbyDealerName: true,
      isConverted: true,
      conversionType: true,
      isTechService: true,
      serviceDesc: true,
      influencerName: true,
      influencerPhone: true,
      isSchemeEnrolled: true,
      influencerProductivity: true,
      user: {
        select: { firstName: true, lastName: true, email: true }
      },
    },
    orderBy: { reportDate: 'desc' },
  });

  return rawReports.map((r: any) => ({
    // Map scalar fields
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
    timeSpentinLoc: r.timeSpentinLoc ?? null,
    inTimeImageUrl: r.inTimeImageUrl ?? null,
    outTimeImageUrl: r.outTimeImageUrl ?? null,
    reportDate: formatDateIST(r.reportDate) || '',
    checkInTime: formatDateIST(r.reportDate) || '',
    checkOutTime: formatDateIST(r.reportDate),
    createdAt: formatDateIST(r.reportDate) || '',
    updatedAt: formatDateIST(r.reportDate) || '',
    firstVisitTime: formatDateIST(r.reportDate),
    lastVisitTime: formatDateIST(r.reportDate),
    conversionQuantityValue: r.conversionQuantityValue?.toNumber() ?? null,
    siteVisitBrandInUse: r.siteVisitBrandInUse.join(', '),
    influencerType: r.influencerType.join(', '),
    purposeOfVisit: r.purposeOfVisit ?? null,
    sitePhotoUrl: r.sitePhotoUrl ?? null,
    firstVisitDay: r.firstVisitDay ?? null,
    lastVisitDay: r.lastVisitDay ?? null,
    siteVisitsCount: r.siteVisitsCount ?? null,
    otherVisitsCount: r.otherVisitsCount ?? null,
    totalVisitsCount: r.totalVisitsCount ?? null,
    region: r.region ?? null,
    area: r.area ?? null,
    latitude: r.latitude?.toNumber() ?? null,
    longitude: r.longitude?.toNumber() ?? null,
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
    currentBrandPrice: r.currentBrandPrice?.toNumber() ?? null,
    siteStock: r.siteStock?.toNumber() ?? null,
    estRequirement: r.estRequirement?.toNumber() ?? null,
    salesmanName: formatUserName(r.user),
    salesmanEmail: r.user.email,
  }));
}

// Technical Sites
export type FlattenedTechnicalSite = {
  id: string;
  siteName: string;
  concernedPerson: string;
  phoneNo: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  siteType: string | null;
  area: string | null;
  region: string | null;
  keyPersonName: string | null;
  keyPersonPhoneNum: string | null;
  stageOfConstruction: string | null;
  constructionStartDate: string | null;
  constructionEndDate: string | null;
  convertedSite: boolean | null;
  firstVistDate: string | null;
  lastVisitDate: string | null;
  needFollowUp: boolean | null;

  createdAt: string;
  updatedAt: string;

  associatedSalesmen: string;
  associatedDealers: string;
  associatedMasons: string;
};

export async function getFlattenedTechnicalSites(companyId: number): Promise<FlattenedTechnicalSite[]> {
  const raw = await prisma.technicalSite.findMany({
    // where: {
    //   // Find sites linked to any user within the requested company
    //   associatedUsers: {
    //     some: {
    //       companyId: companyId
    //     }
    //   }
    // },
    select: {
      id: true, siteName: true, concernedPerson: true, phoneNo: true, address: true,
      latitude: true, longitude: true, siteType: true, area: true, region: true,
      keyPersonName: true, keyPersonPhoneNum: true, stageOfConstruction: true,
      constructionStartDate: true, constructionEndDate: true, convertedSite: true,
      firstVistDate: true, lastVisitDate: true, needFollowUp: true,
      createdAt: true, updatedAt: true,

      // Relations for flattening
      associatedUsers: {
        select: { firstName: true, lastName: true, email: true }
      },
      associatedDealers: {
        select: { name: true, region: true }
      },
      associatedMasons: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  return raw.map((s: any) => ({
    id: s.id,
    siteName: s.siteName,
    concernedPerson: s.concernedPerson,
    phoneNo: s.phoneNo,
    address: s.address ?? null,

    latitude: s.latitude?.toNumber() ?? null,
    longitude: s.longitude?.toNumber() ?? null,

    siteType: s.siteType ?? null,
    area: s.area ?? null,
    region: s.region ?? null,

    keyPersonName: s.keyPersonName ?? null,
    keyPersonPhoneNum: s.keyPersonPhoneNum ?? null,

    stageOfConstruction: s.stageOfConstruction ?? null,

    // Dates -> String (YYYY-MM-DD)
    constructionStartDate: formatDateIST(s.constructionStartDate) ?? null,
    constructionEndDate: formatDateIST(s.constructionEndDate) ?? null,
    firstVistDate: formatDateIST(s.firstVistDate) ?? null,
    lastVisitDate: formatDateIST(s.lastVisitDate) ?? null,

    convertedSite: s.convertedSite ?? false,
    needFollowUp: s.needFollowUp ?? false,

    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),

    // Flatten Arrays to Strings
    associatedSalesmen: s.associatedUsers
      .map((u: any) => formatUserName(u)).join(', '),

    associatedDealers: s.associatedDealers
      .map((d: any) => d.name)
      .join(', '),

    associatedMasons: s.associatedMasons
      .map((m: any) => m.name)
      .join(', '),
  }));
}

// PJP
export type FlattenedPermanentJourneyPlan = {
  id: string;
  planDate: string;
  areaToBeVisited: string;
  route: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;

  // Visit Metrics & Specifics
  plannedNewSiteVisits: number;
  plannedFollowUpSiteVisits: number;
  plannedNewDealerVisits: number;
  plannedInfluencerVisits: number;
  influencerName: string | null;
  influencerPhone: string | null;
  activityType: string | null;
  noOfConvertedBags: number;
  noOfMasonPcSchemes: number;
  diversionReason: string | null;

  // New Fields from GET route
  verificationStatus: string;
  additionalVisitRemarks: string | null;
  userId: string;
  dealerId: string | null;
  siteId: string | null;
  visitDealerName: string | null; // Combined Dealer/Site name
  taskIds: string[];

  // User/Creator Info
  assignedSalesmanName: string;
  assignedSalesmanEmail: string;
  creatorName: string;
  creatorEmail: string;
  createdByRole: string;

  dealerName: string | null; // Explicit dealer relation name
};

export async function getFlattenedPermanentJourneyPlans(companyId: number): Promise<FlattenedPermanentJourneyPlan[]> {
  const rawReports = await prisma.permanentJourneyPlan.findMany({
    where: { user: { companyId } },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      createdBy: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: true
        }
      },
      dealer: { select: { name: true } },
      site: { select: { siteName: true } },
      dailyTasks: { select: { id: true } },
    },
    orderBy: { planDate: 'desc' },
  });

  return rawReports.map((r: any) => {
    const visitTargetName = r.dealer?.name ?? r.site?.siteName ?? null;

    return {
      id: r.id,
      areaToBeVisited: r.areaToBeVisited,
      route: r.route ?? null,
      description: r.description ?? null,
      status: r.status,
      verificationStatus: r.verificationStatus,
      additionalVisitRemarks: r.additionalVisitRemarks ?? null,

      plannedNewSiteVisits: r.plannedNewSiteVisits ?? 0,
      plannedFollowUpSiteVisits: r.plannedFollowUpSiteVisits ?? 0,
      plannedNewDealerVisits: r.plannedNewDealerVisits ?? 0,
      plannedInfluencerVisits: r.plannedInfluencerVisits ?? 0,
      influencerName: r.influencerName ?? null,
      influencerPhone: r.influencerPhone ?? null,
      activityType: r.activityType ?? null,
      noOfConvertedBags: r.noOfConvertedBags ?? 0,
      noOfMasonPcSchemes: r.noOfMasonPcSchemes ?? 0,
      diversionReason: r.diversionReason ?? null,

      planDate: formatDateIST(r.planDate) || '',
      createdAt: formatDateTimeIST(r.createdAt),
      updatedAt: formatDateTimeIST(r.updatedAt),

      userId: r.userId,
      dealerId: r.dealerId,
      siteId: r.siteId,
      visitDealerName: visitTargetName,
      taskIds: r.dailyTasks.map((task: any) => task.id),

      assignedSalesmanName: formatUserName(r.user),
      assignedSalesmanEmail: r.user.email,

      creatorName: formatUserName(r.createdBy),
      creatorEmail: r.createdBy.email,
      createdByRole: r.createdBy.role,

      dealerName: r.dealer?.name ?? null,
    };
  });
}

// Competition Report
export type FlattenedCompetitionReport = {
  id: string;
  reportDate: string; // Converted from DateTime (Date)
  brandName: string;
  billing: string;
  nod: string;
  retail: string;
  schemesYesNo: string;
  avgSchemeCost: number; // Converted from Decimal
  remarks: string | null;
  createdAt: string; // Converted from DateTime (Timestamp)
  updatedAt: string; // Converted from DateTime (Timestamp)

  // Flattened Salesman
  salesmanName: string;
  salesmanEmail: string;
};

export async function getFlattenedCompetitionReports(companyId: number): Promise<FlattenedCompetitionReport[]> {
  const rawReports = await prisma.competitionReport.findMany({
    where: { user: { companyId } },
    select: {
      // All scalar fields
      id: true, reportDate: true, brandName: true, billing: true, nod: true, retail: true,
      schemesYesNo: true, avgSchemeCost: true, remarks: true, createdAt: true, updatedAt: true,
      // Relation
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { reportDate: 'desc' },
  });

  return rawReports.map((r: any) => ({
    id: r.id,
    brandName: r.brandName,
    billing: r.billing,
    nod: r.nod,
    retail: r.retail,
    schemesYesNo: r.schemesYesNo,
    remarks: r.remarks ?? null,

    // Conversions
    reportDate: formatDateIST(r.reportDate) || '',
    avgSchemeCost: r.avgSchemeCost.toNumber(),
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),

    // Flattened Relations
    salesmanName: `${r.user.firstName} ${r.user.lastName}`,
    salesmanEmail: r.user.email,
  }));
}

// Daily Tasks
export type FlattenedDailyTask = {
  id: string;
  taskDate: string; // Converted from DateTime (Date)
  visitType: string;
  relatedDealerId: string | null;
  siteName: string | null;
  description: string | null;
  status: string;
  pjpId: string | null;
  createdAt: string; // Converted from DateTime (Timestamp)
  updatedAt: string; // Converted from DateTime (Timestamp)

  // Flattened Relations
  assignedSalesmanName: string;
  assignedSalesmanEmail: string;
  creatorName: string;
  creatorEmail: string;
  relatedDealerName: string | null;
};

export async function getFlattenedDailyTasks(companyId: number): Promise<FlattenedDailyTask[]> {
  const rawReports = await prisma.dailyTask.findMany({
    where: { user: { companyId } },
    select: {
      // All scalar fields
      id: true, taskDate: true, visitType: true, relatedDealerId: true, siteName: true, description: true, status: true,
      pjpId: true, createdAt: true, updatedAt: true,

      // Relations
      user: { select: { firstName: true, lastName: true, email: true } }, // Assigned Salesman
      assignedBy: { select: { firstName: true, lastName: true, email: true } }, // Creator/Manager
      relatedDealer: { select: { name: true } }, // Dealer Name
    },
    orderBy: { taskDate: 'desc' },
  });

  return rawReports.map((r: any) => ({
    id: r.id,
    visitType: r.visitType,
    relatedDealerId: r.relatedDealerId ?? null,
    siteName: r.siteName ?? null,
    description: r.description ?? null,
    status: r.status,
    pjpId: r.pjpId ?? null,

    // DateTime Conversions
    taskDate: r.taskDate.toISOString().slice(0, 10),
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),

    // Flattened Relations
    assignedSalesmanName: formatUserName(r.user),
    assignedSalesmanEmail: r.user.email,
    creatorName: formatUserName(r.createdBy),
    creatorEmail: r.assignedBy.email,
    relatedDealerName: r.relatedDealer?.name ?? null,
  }));
}

// Salesman Attendance
export type FlattenedSalesmanAttendance = {
  // All scalar fields from SalesmanAttendance
  id: string;
  attendanceDate: string; // Converted from Date
  locationName: string;
  role: string;
  inTimeTimestamp: string; // Converted from Timestamp
  outTimeTimestamp: string | null; // Converted from Timestamp
  inTimeImageCaptured: boolean;
  outTimeImageCaptured: boolean;
  inTimeImageUrl: string | null;
  outTimeImageUrl: string | null;
  inTimeLatitude: number; // Converted from Decimal
  inTimeLongitude: number; // Converted from Decimal
  inTimeAccuracy: number | null; // Converted from Decimal
  inTimeSpeed: number | null; // Converted from Decimal
  inTimeHeading: number | null; // Converted from Decimal
  inTimeAltitude: number | null; // Converted from Decimal
  outTimeLatitude: number | null; // Converted from Decimal
  outTimeLongitude: number | null; // Converted from Decimal
  outTimeAccuracy: number | null; // Converted from Decimal
  outTimeSpeed: number | null; // Converted from Decimal
  outTimeHeading: number | null; // Converted from Decimal
  outTimeAltitude: number | null; // Converted from Decimal
  createdAt: string; // Converted from Timestamp
  updatedAt: string; // Converted from Timestamp

  // Flattened Salesman
  salesmanName: string;
  salesmanEmail: string;
};

export async function getFlattenedSalesmanAttendance(companyId: number): Promise<FlattenedSalesmanAttendance[]> {
  const rawReports = await prisma.salesmanAttendance.findMany({
    where: { user: { companyId } },
    select: {
      // All scalar fields
      id: true, attendanceDate: true, locationName: true, role: true, inTimeTimestamp: true, outTimeTimestamp: true,
      inTimeImageCaptured: true, outTimeImageCaptured: true, inTimeImageUrl: true, outTimeImageUrl: true,
      inTimeLatitude: true, inTimeLongitude: true, inTimeAccuracy: true, inTimeSpeed: true,
      inTimeHeading: true, inTimeAltitude: true, outTimeLatitude: true, outTimeLongitude: true,
      outTimeAccuracy: true, outTimeSpeed: true, outTimeHeading: true, outTimeAltitude: true,
      createdAt: true, updatedAt: true,

      // Relation
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { attendanceDate: 'desc' },
  });

  return rawReports.map((r: any) => ({
    // Map scalar fields (String, Boolean)
    id: r.id,
    locationName: r.locationName,
    role: r.role,
    inTimeImageCaptured: r.inTimeImageCaptured,
    outTimeImageCaptured: r.outTimeImageCaptured,
    inTimeImageUrl: r.inTimeImageUrl ?? null,
    outTimeImageUrl: r.outTimeImageUrl ?? null,

    // DateTime Fields (Conversion to string)
    attendanceDate: formatDateIST(r.attendanceDate) || '', // Date only
    inTimeTimestamp: formatDateIST(r.inTimeTimestamp) || '-',
    outTimeTimestamp: formatDateIST(r.outTimeTimestamp) ?? null,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),

    // Decimal Fields (Conversion to number)
    inTimeLatitude: r.inTimeLatitude.toNumber(),
    inTimeLongitude: r.inTimeLongitude.toNumber(),
    inTimeAccuracy: r.inTimeAccuracy?.toNumber() ?? null,
    inTimeSpeed: r.inTimeSpeed?.toNumber() ?? null,
    inTimeHeading: r.inTimeHeading?.toNumber() ?? null,
    inTimeAltitude: r.inTimeAltitude?.toNumber() ?? null,
    outTimeLatitude: r.outTimeLatitude?.toNumber() ?? null,
    outTimeLongitude: r.outTimeLongitude?.toNumber() ?? null,
    outTimeAccuracy: r.outTimeAccuracy?.toNumber() ?? null,
    outTimeSpeed: r.outTimeSpeed?.toNumber() ?? null,
    outTimeHeading: r.outTimeHeading?.toNumber() ?? null,
    outTimeAltitude: r.outTimeAltitude?.toNumber() ?? null,

    // Flattened Relation
    salesmanName: formatUserName(r.user),
    salesmanEmail: r.user.email,
  }));
}

// Salesman Leaves
export type FlattenedSalesmanLeaveApplication = {
  id: string;
  leaveType: string;
  startDate: string; // Converted from Date
  endDate: string; // Converted from Date
  reason: string;
  status: string;
  adminRemarks: string | null;
  createdAt: string; // Converted from Timestamp
  updatedAt: string; // Converted from Timestamp

  // Flattened Salesman
  salesmanName: string;
  salesmanEmail: string;
};

export async function getFlattenedSalesmanLeaveApplication(companyId: number): Promise<FlattenedSalesmanLeaveApplication[]> {
  const rawReports = await prisma.salesmanLeaveApplication.findMany({
    where: { user: { companyId } },
    select: {
      // All scalar fields
      id: true, leaveType: true, startDate: true, endDate: true, reason: true, status: true,
      adminRemarks: true, createdAt: true, updatedAt: true,
      // Relation
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  return rawReports.map((r: any) => ({
    // Map scalar fields (String)
    id: r.id,
    leaveType: r.leaveType,
    reason: r.reason,
    status: r.status,
    adminRemarks: r.adminRemarks ?? null,

    // DateTime Conversions
    startDate: r.startDate.toISOString().slice(0, 10),
    endDate: r.endDate.toISOString().slice(0, 10),
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),

    // Flattened Relations
    salesmanName: formatUserName(r.user),
    salesmanEmail: r.user.email,
  }));
}

// Sales Order
export type FlattenedSalesOrder = {
  // IDs
  id: string;
  userId: number | null;
  dealerId: string | null;
  dvrId: string | null;
  pjpId: string | null;

  // Denormalized display
  salesmanName: string | null;
  salesmanEmail: string | null;
  salesmanRole: string | null;
  dealerName: string | null;
  dealerRegion: string | null;
  dealerArea: string | null;
  dealerPhone: string | null;
  dealerAddress: string | null;

  // Business fields (raw)
  orderDate: string;                 // YYYY-MM-DD
  orderPartyName: string;

  partyPhoneNo: string | null;
  partyArea: string | null;
  partyRegion: string | null;
  partyAddress: string | null;

  deliveryDate: string | null;       // YYYY-MM-DD
  deliveryArea: string | null;
  deliveryRegion: string | null;
  deliveryAddress: string | null;
  deliveryLocPincode: string | null;

  paymentMode: string | null;
  paymentTerms: string | null;
  paymentAmount: number | null;
  receivedPayment: number | null;
  receivedPaymentDate: string | null; // YYYY-MM-DD
  pendingPayment: number | null;

  orderQty: number | null;
  orderUnit: string | null;

  itemPrice: number | null;
  discountPercentage: number | null;
  itemPriceAfterDiscount: number | null;

  itemType: string | null;
  itemGrade: string | null;

  // Convenience/computed
  orderTotal: number;                // qty * effective price
  estimatedDelivery: string | null;  // alias of deliveryDate
  remarks: string | null;            // you don't have this column; stays null

  // Timestamps
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export async function getFlattenedSalesOrders(companyId: number): Promise<FlattenedSalesOrder[]> {
  const orders = await prisma.salesOrder.findMany({
    where: { user: { companyId } },           // link via SalesOrder.user
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      dealer: {
        select: {
          id: true, name: true, region: true, area: true, phoneNo: true, address: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const toNum = (v: any): number | null => (v == null ? null : Number(v));
  const toDate = (d: any): string | null => (d ? new Date(d).toISOString().slice(0, 10) : null);

  return orders.map((o: any) => {
    const qty = toNum(o.orderQty) ?? 0;
    // Prefer price after discount; fall back to base price; else 0
    const unitPrice = (toNum(o.itemPriceAfterDiscount) ?? toNum(o.itemPrice) ?? 0);
    const orderTotal = Number((qty * unitPrice).toFixed(2));

    const receivedPayment = toNum(o.receivedPayment);
    const pendingPayment =
      o.pendingPayment != null ? toNum(o.pendingPayment) : Number((orderTotal - (receivedPayment ?? 0)).toFixed(2));

    const salesmanName =
      formatUserName(o.user) || o.user?.email || null;

    return {
      // IDs
      id: o.id,
      userId: o.userId ?? null,
      dealerId: o.dealerId ?? null,
      dvrId: o.dvrId ?? null,
      pjpId: o.pjpId ?? null,

      // Denormalized
      salesmanName,
      salesmanEmail: o.user?.email ?? null,
      salesmanRole: o.user?.role ?? null,
      dealerName: o.dealer?.name ?? null,
      dealerRegion: o.dealer?.region ?? null,
      dealerArea: o.dealer?.area ?? null,
      dealerPhone: o.dealer?.phoneNo ?? null,
      dealerAddress: o.dealer?.address ?? null,

      // Business (raw)
      orderDate: formatDateIST(o.orderDate)!, // not null by schema
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

      // Convenience/computed
      orderTotal,
      estimatedDelivery: formatDateIST(o.deliveryDate),
      remarks: null,

      // Timestamps
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    };
  });
}

// Geo-tracking
export type FlattenedGeoTracking = {
  id: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  locationType: string | null;
  activityType: string | null;
  appState: string | null;
  batteryLevel: number | null;
  isCharging: boolean | null;
  networkStatus: string | null;
  ipAddress: string | null;
  siteName: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalDistanceTravelled: number | null;
  journeyId: string | null;
  isActive: boolean;
  destLat: number | null;
  destLng: number | null;
  createdAt: string;
  updatedAt: string;

  // Flattened User
  salesmanName: string;
  salesmanEmail: string;
};

export async function getFlattenedGeoTracking(companyId: number): Promise<FlattenedGeoTracking[]> {
  const rawReports = await prisma.journeyOp.findMany({
    where: {
      user: { companyId }
    },
    select: {
      opId: true,
      journeyId: true,
      createdAt: true,
      payload: true,   // Contains all the tracking data
      user: {
        select: { firstName: true, lastName: true, email: true }
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Map and Extract JSON fields
  return rawReports.map((op: any) => {
    const p = (op.payload && typeof op.payload === 'object') ? op.payload : {};

    return {
      id: op.opId,
      journeyId: op.journeyId,
      salesmanName: `${op.user.firstName || ''} ${op.user.lastName || ''}`.trim(),
      salesmanEmail: op.user.email,

      // JSON Payload Extractions (Manual Casting)
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

      createdAt: op.createdAt.toISOString(),
      updatedAt: op.createdAt.toISOString(),
    };
  });
}

// Dealer Scores
export type FlattenedDealerReportsAndScores = {
  id: string;
  dealerScore: number; // Converted from Decimal
  trustWorthinessScore: number; // Converted from Decimal
  creditWorthinessScore: number; // Converted from Decimal
  orderHistoryScore: number; // Converted from Decimal
  visitFrequencyScore: number; // Converted from Decimal
  lastUpdatedDate: string; // Converted from Timestamp
  createdAt: string; // Converted from Timestamp
  updatedAt: string; // Converted from Timestamp

  // Flattened Dealer
  dealerName: string;
  dealerRegion: string;
  dealerArea: string;
};

export async function getFlattenedDealerReportsAndScores(companyId: number): Promise<FlattenedDealerReportsAndScores[]> {
  const rawReports = await prisma.dealerReportsAndScores.findMany({
    where: {
      dealer: {
        user: {
          companyId: companyId
        }
      }
    },
    select: {
      // All scalar fields
      id: true, dealerScore: true, trustWorthinessScore: true, creditWorthinessScore: true,
      orderHistoryScore: true, visitFrequencyScore: true, lastUpdatedDate: true,
      createdAt: true, updatedAt: true,

      // Relation: Fetching key dealer fields
      dealer: { select: { name: true, region: true, area: true } },
    },
    orderBy: { lastUpdatedDate: 'desc' },
  });

  return rawReports.map((r: any) => ({
    id: r.id,

    // DateTime Conversions
    lastUpdatedDate: r.lastUpdatedDate.toISOString(),
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),

    // Decimal Conversions
    dealerScore: r.dealerScore.toNumber(),
    trustWorthinessScore: r.trustWorthinessScore.toNumber(),
    creditWorthinessScore: r.creditWorthinessScore.toNumber(),
    orderHistoryScore: r.orderHistoryScore.toNumber(),
    visitFrequencyScore: r.visitFrequencyScore.toNumber(),

    // Flattened Dealer
    dealerName: r.dealer.name,
    dealerRegion: r.dealer.region,
    dealerArea: r.dealer.area,
  }));
}

// Salesman Rating
export type FlattenedRating = {
  id: number;
  area: string;
  region: string;
  rating: number;

  // Flattened Salesman
  salesmanName: string;
  salesmanEmail: string;
};

export async function getFlattenedRatings(companyId: number): Promise<FlattenedRating[]> {
  const rawReports = await prisma.rating.findMany({
    // Filter by the user's company ID
    where: { user: { companyId } },
    select: {
      id: true, area: true, region: true, rating: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { id: 'desc' },
  });

  return rawReports.map((r: any) => ({
    id: r.id,
    area: r.area,
    region: r.region,
    rating: r.rating,

    // Flattened User
    salesmanName: `${r.user.firstName} ${r.user.lastName}`,
    salesmanEmail: r.user.email,
  }));
}

// Brands && Dealer Brand Mapping
export type FlattenedDealerBrandMapping = {
  id: string;

  // Capacities
  capacityMT: number;                 // required
  bestCapacityMT: number | null;      // optional
  brandGrowthCapacityPercent: number | null; // optional

  // Who recorded/owns this mapping (optional in schema)
  userId: number | null;

  // Flattened Brand
  brandName: string;

  // Flattened Dealer
  dealerId: string;
  dealerName: string;
  dealerRegion: string;
  dealerArea: string;
};

export async function getFlattenedDealerBrandCapacities(
  companyId: number
): Promise<FlattenedDealerBrandMapping[]> {
  const rows = await prisma.dealerBrandMapping.findMany({
    where: {
      dealer: {
        user: { companyId }
      }
    },
    select: {
      id: true,
      dealerId: true,
      userId: true,
      capacityMT: true,
      bestCapacityMT: true,
      brandGrowthCapacityPercent: true,
      brand: { select: { name: true } },
      dealer: { select: { name: true, region: true, area: true } },
    },
    orderBy: { dealerId: 'asc' },
  });

  return rows.map((r: any) => ({
    id: r.id,
    dealerId: r.dealerId,

    // Decimal conversions
    capacityMT: r.capacityMT.toNumber(),
    bestCapacityMT: r.bestCapacityMT?.toNumber() ?? null,
    brandGrowthCapacityPercent: r.brandGrowthCapacityPercent?.toNumber() ?? null,

    // Optional owner
    userId: r.userId ?? null,

    // Flattened relations
    brandName: r.brand.name,
    dealerName: r.dealer.name,
    dealerRegion: r.dealer.region,
    dealerArea: r.dealer.area,
  }));
}

export type FlattenedTSOMeeting = {
  id: string;
  type: string | null;
  date: string | null;
  totalExpenses: number | null;
  participantsCount: number | null;
  market: string | null;
  zone: string | null;
  dealerName: string | null;
  dealerAddress: string | null;
  conductedBy: string | null;
  giftType: string | null;
  accountJsbJud: string | null;
  billSubmitted: boolean;
  createdByUserName: string;
  createdByUserEmail: string;
  creatorRole: string;
  createdAt: string;
  updatedAt: string;
};

export async function getFlattenedTSOMeeetings(companyId: number): Promise<FlattenedTSOMeeting[]> {
  const raw = await prisma.tSOMeeting.findMany({
    where: { createdBy: { companyId } },
    select: {
      id: true,
      type: true,
      date: true,
      participantsCount: true,
      market: true,
      zone: true,
      dealerName: true,
      dealerAddress: true,
      conductedBy: true,
      giftType: true,
      accountJsbJud: true,
      totalExpenses: true,
      billSubmitted: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: true
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  return raw.map((r: any) => ({
    id: r.id,
    type: r.type,
    date: r.date ? r.date.toISOString().slice(0, 10) : null,
    totalExpenses: r.totalExpenses ? Number(r.totalExpenses) : null,
    participantsCount: r.participantsCount ?? null,
    market: r.market,
    zone: r.zone,
    dealerName: r.dealerName,
    dealerAddress: r.dealerAddress,
    conductedBy: r.conductedBy,
    giftType: r.giftType,
    accountJsbJud: r.accountJsbJud,
    billSubmitted: r.billSubmitted ?? false,
    createdByUserName: formatUserName(r.createdBy) || r.createdBy.email,
    createdByUserEmail: r.createdBy.email,
    creatorRole: r.createdBy.role ?? '',

    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
  }));
}

// Rewards (UPDATED: Formerly Gift Inventory)
export type FlattenedReward = {
  id: number;
  itemName: string; // Mapped from Rewards.name (@map("item_name"))
  pointCost: number; // Mapped from Rewards.pointCost (@map("point_cost"))
  totalAvailableQuantity: number;
  stock: number; // New field added to the schema
  isActive: boolean; // New field added to the schema
  createdAt: string;
  updatedAt: string;
};

export async function getFlattenedRewards(): Promise<FlattenedReward[]> {
  const raw = await prisma.rewards.findMany({ // CORRECTED: Model name is 'rewards'
    select: {
      id: true,
      name: true, // CORRECTED: Renamed from 'itemName'
      pointCost: true, // CORRECTED: Renamed from 'unitPrice'
      totalAvailableQuantity: true,
      stock: true, // NEW FIELD
      isActive: true, // NEW FIELD
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' }, // CORRECTED: Order by 'name'
  });

  return raw.map((r: any) => ({
    id: r.id,
    itemName: r.name, // Mapping 'name' to the desired output key 'itemName'
    pointCost: r.pointCost, // Type is Int, no need for .toNumber()
    totalAvailableQuantity: r.totalAvailableQuantity,
    stock: r.stock,
    isActive: r.isActive,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
  }));
}

// Gift Allocation Log (UPDATED)
export type FlattenedGiftAllocationLog = {
  id: string;
  itemName: string; // from giftId
  salesmanName: string; // from userId
  salesmanEmail: string; // from userId
  transactionType: string;
  quantity: number;
  sourceUserName: string | null;
  destinationUserName: string | null;
  technicalVisitReportId: string | null;
  dealerVisitReportId: string | null;
  createdAt: string;
};


const giftLogSelect = ({
  id: true,
  transactionType: true,
  quantity: true,
  technicalVisitReportId: true,
  dealerVisitReportId: true,
  createdAt: true,
  // Rewards model uses 'name' which maps to 'item_name'
  giftItem: {
    select: { name: true }, // Use 'name' from the Rewards model 
  },
  user: {
    select: { firstName: true, lastName: true, email: true }, // User model has firstName, lastName, email
  },
  sourceUser: {
    select: { firstName: true, lastName: true, email: true }, // User model
  },
  destinationUser: {
    select: { firstName: true, lastName: true, email: true }, // User model
  },
});

export async function getFlattenedGiftAllocationLogs(companyId: number): Promise<FlattenedGiftAllocationLog[]> {
  const raw = await prisma.giftAllocationLog.findMany({
    where: { user: { companyId } },
    select: giftLogSelect,
    orderBy: { createdAt: 'desc' },
  });

  return raw.map((r: any) => {
    // Helper function to format user name or default to email
    const formatUserName = (user: { firstName: string | null, lastName: string | null, email: string } | null) => {
      if (!user) return null;
      const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      return name || user.email;
    };

    return {
      id: r.id,
      itemName: r.giftItem.name, // Corrected: Use 'name' from the nested relation
      salesmanName: formatUserName(r.user)!, // Primary user is guaranteed to exist
      salesmanEmail: r.user.email,
      transactionType: r.transactionType,
      quantity: r.quantity,
      sourceUserName: formatUserName(r.sourceUser),
      destinationUserName: formatUserName(r.destinationUser),
      technicalVisitReportId: r.technicalVisitReportId ?? null,
      dealerVisitReportId: r.dealerVisitReportId ?? null,
      createdAt: formatDateTimeIST(r.createdAt),
    }
  });
}

// Mason PC Side (UPDATED)
export type FlattenedMasonPCSide = {
  id: string;
  name: string;
  phoneNumber: string;
  firebaseUid: string | null;
  kycDocumentName: string | null;
  kycDocumentIdNum: string | null;
  kycStatus: string | null;
  bagsLifted: number | null;
  pointsBalance: number | null;
  isReferred: boolean | null;
  referredByUser: string | null;
  referredToUser: string | null;
  dealerName: string | null; // from dealerId
  associatedSalesman: string | null; // from userId
  kycSubmittedAt: string | null;
};

export async function getFlattenedMasonPCSide(companyId: number): Promise<FlattenedMasonPCSide[]> {
  const raw = await prisma.mason_PC_Side.findMany({
    // Finds Masons associated with a User (salesman) from the company
    where: {
      OR: [
        { user: { companyId } }, // Case 1: Assigned to a salesman in this company
        { userId: null }         // Case 2: Not assigned to anyone (Unassigned)
      ]
    },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      firebaseUid: true,
      kycDocumentName: true,
      kycDocumentIdNum: true,
      kycStatus: true, // Renamed field in Prisma
      bagsLifted: true,
      pointsBalance: true, // Renamed field in Prisma
      isReferred: true,
      referredByUser: true,
      referredToUser: true,
      dealer: {
        select: { name: true },
      },
      user: {
        select: { firstName: true, lastName: true, email: true },
      },
      kycSubmissions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          aadhaarNumber: true,
          panNumber: true,
          voterIdNumber: true,
          documents: true, // jsonb
          remark: true,
          createdAt: true,
        },
      }
    },
    orderBy: { name: 'asc' },
  });

  return raw.map((r: any) => {
    const latestKyc = r.kycSubmissions?.[0];

    return {
      id: r.id,
      name: r.name,
      phoneNumber: r.phoneNumber,
      firebaseUid: r.firebaseUid ?? null,
      kycDocumentName: r.kycDocumentName ?? null,
      kycDocumentIdNum: r.kycDocumentIdNum ?? null,
      kycStatus: r.kycStatus ?? null,
      bagsLifted: r.bagsLifted ?? null,
      pointsBalance: r.pointsBalance ?? null,
      isReferred: r.isReferred ?? null,
      referredByUser: r.referredByUser ?? null,
      referredToUser: r.referredToUser ?? null,
      dealerName: r.dealer?.name ?? null,
      associatedSalesman: formatUserName(r.user) || null,
      kycSubmittedAt: latestKyc?.createdAt ? formatDateTimeIST(latestKyc.createdAt) : null,
    };
  });
}

// Schemes & Offers (Master List)
export type FlattenedSchemesOffers = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
};

export async function getFlattenedSchemesOffers(): Promise<FlattenedSchemesOffers[]> {
  const raw = await prisma.schemesOffers.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { name: 'asc' },
  });

  return raw.map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    startDate: r.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: r.endDate?.toISOString().slice(0, 10) ?? null,
  }));
}

// Mason on Scheme (Join Table)
export type FlattenedMasonOnScheme = {
  masonId: string;
  masonName: string;
  schemeId: string;
  schemeName: string;
  enrolledAt: string | null;
  status: string | null;
};

export async function getFlattenedMasonsOnSchemes(companyId: number): Promise<FlattenedMasonOnScheme[]> {
  const raw = await prisma.masonOnScheme.findMany({
    // Finds enrollments for Masons associated with a User from the company
    where: { mason: { user: { companyId } } },
    select: {
      masonId: true,
      schemeId: true,
      enrolledAt: true,
      status: true,
      mason: {
        select: { name: true },
      },
      scheme: {
        select: { name: true },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  return raw.map((r: any) => ({
    masonId: r.masonId,
    masonName: r.mason.name,
    schemeId: r.schemeId,
    schemeName: r.scheme.name,
    enrolledAt: r.enrolledAt?.toISOString() ?? null,
    status: r.status ?? null,
  }));
}

// Masons on Meetings (Join Table)
export type FlattenedMasonsOnMeetings = {
  masonId: string;
  masonName: string;
  meetingId: string;
  meetingType: string;
  meetingDate: string;
  attendedAt: string;
};

export async function getFlattenedMasonsOnMeetings(companyId: number): Promise<FlattenedMasonsOnMeetings[]> {
  const raw = await prisma.masonsOnMeetings.findMany({
    // Finds participants of Meetings created by a User from the company
    where: { meeting: { createdBy: { companyId } } },
    select: {
      masonId: true,
      meetingId: true,
      attendedAt: true,
      mason: {
        select: { name: true },
      },
      meeting: {
        select: { type: true, date: true },
      },
    },
    orderBy: { attendedAt: 'desc' },
  });

  return raw.map((r: any) => ({
    masonId: r.masonId,
    masonName: r.mason.name,
    meetingId: r.meetingId,
    meetingType: r.meeting.type,
    meetingDate: r.meeting.date.toISOString().slice(0, 10),
    attendedAt: r.attendedAt.toISOString(),
  }));
}

// RewardCategory (Master List - No company filter needed)
export type FlattenedRewardCategory = {
  id: number;
  name: string;
};

export async function getFlattenedRewardCategories(): Promise<FlattenedRewardCategory[]> {
  const raw = await prisma.rewardCategory.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  return raw.map((r: any) => ({
    id: r.id,
    name: r.name,
  }));
}

// KYCSubmissions
export type FlattenedKYCSubmission = {
  id: string;
  masonId: string;
  masonName: string;
  aadhaarNumber: string | null;
  panNumber: string | null;
  voterIdNumber: string | null;
  status: string;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getFlattenedKYCSubmissions(companyId: number): Promise<FlattenedKYCSubmission[]> {
  const raw = await prisma.kYCSubmission.findMany({
    // Filter by Masons whose associated user belongs to the company
    where: { mason: { user: { companyId } } },
    select: {
      id: true,
      masonId: true,
      aadhaarNumber: true,
      panNumber: true,
      voterIdNumber: true,
      status: true,
      remark: true,
      createdAt: true,
      updatedAt: true,
      mason: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return raw.map((r: any) => ({
    id: r.id,
    masonId: r.masonId,
    masonName: r.mason.name,
    aadhaarNumber: r.aadhaarNumber ?? null,
    panNumber: r.panNumber ?? null,
    voterIdNumber: r.voterIdNumber ?? null,
    status: r.status,
    remark: r.remark ?? null,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
  }));
}

// TSOAssignment (Join Table)
export type FlattenedTSOAssignment = {
  masonId: string;
  masonName: string;
  tsoId: number;
  tsoName: string;
  tsoEmail: string;
  createdAt: string;
};

export async function getFlattenedTSOAssignments(companyId: number): Promise<FlattenedTSOAssignment[]> {
  const raw = await prisma.tSOAssignment.findMany({
    // Filter by TSO (User) belonging to the company
    where: { tso: { companyId } },
    select: {
      masonId: true,
      tsoId: true,
      createdAt: true,
      mason: { select: { name: true } },
      tso: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return raw.map((r: any) => ({
    masonId: r.masonId,
    masonName: r.mason.name,
    tsoId: r.tsoId,
    tsoName: formatUserName(r.tso)!,
    tsoEmail: r.tso.email,
    createdAt: formatDateTimeIST(r.createdAt),
  }));
}

// BagLifts
export type FlattenedBagLift = {
  id: string;
  masonId: string;
  masonName: string;
  phoneNumber: string | null;
  dealerId: string | null;
  dealerName: string | null;
  siteId: string | null;
  siteName: string | null;
  siteAddress: string | null;
  siteKeyPersonName: string | null;
  siteKeyPersonPhone: string | null;
  imageUrl: string | null;
  verificationSiteImageUrl: string | null;
  verificationProofImageUrl: string | null;
  purchaseDate: string;
  bagCount: number;
  pointsCredited: number;
  status: string;
  approvedByUserId: number | null;
  approverName: string | null;
  associatedSalesmanName: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export async function getFlattenedBagLifts(companyId: number): Promise<FlattenedBagLift[]> {
  const raw = await prisma.bagLift.findMany({
    // Filter by Masons whose associated user belongs to the company
    where: {
      OR: [
        { mason: { user: { companyId } } },
        { mason: { userId: null } }
      ]
    },
    select: {
      id: true,
      masonId: true,
      dealerId: true,
      purchaseDate: true,
      bagCount: true,
      pointsCredited: true,
      status: true,
      approvedBy: true,
      approvedAt: true,
      createdAt: true,

      imageUrl: true,
      siteId: true,
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
      dealer: { select: { name: true } },
      site: { select: { siteName: true, address: true } },
      approver: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return raw.map((r: any) => ({
    id: r.id,
    masonId: r.masonId,
    masonName: r.mason.name,
    phoneNumber: r.mason.phoneNumber,
    dealerId: r.dealerId ?? null,
    dealerName: r.dealer?.name ?? null,

    siteId: r.siteId ?? null,
    siteName: r.site?.siteName ?? null,
    siteAddress: r.site?.address ?? null,
    siteKeyPersonName: r.siteKeyPersonName ?? null,
    siteKeyPersonPhone: r.siteKeyPersonPhone ?? null,
    imageUrl: r.imageUrl ?? null,
    verificationSiteImageUrl: r.verificationSiteImageUrl ?? null,
    verificationProofImageUrl: r.verificationProofImageUrl ?? null,

    purchaseDate: r.purchaseDate.toISOString().slice(0, 10),
    bagCount: r.bagCount,
    pointsCredited: r.pointsCredited,
    status: r.status,
    approvedByUserId: r.approvedBy ?? null,
    // Actual Approver
    approverName: formatUserName(r.approver),
    // Fallback: Associated Salesman
    associatedSalesmanName: formatUserName(r.mason.user),

    approvedAt: r.approvedAt?.toISOString() ?? null,
    createdAt: formatDateTimeIST(r.createdAt),
  }));
}

// RewardRedemptions
export type FlattenedRewardRedemption = {
  id: string;
  masonId: string;
  masonName: string;
  rewardId: number;
  rewardName: string;
  quantity: number;
  status: string;
  pointsDebited: number;
  deliveryName: string | null;
  deliveryPhone: string | null;
  deliveryAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getFlattenedRewardRedemptions(companyId: number): Promise<FlattenedRewardRedemption[]> {
  const raw = await prisma.rewardRedemption.findMany({
    // Filter by Masons whose associated user belongs to the company
    where: { mason: { user: { companyId } } },
    select: {
      id: true,
      masonId: true,
      rewardId: true,
      quantity: true,
      status: true,
      pointsDebited: true,
      deliveryName: true,
      deliveryPhone: true,
      deliveryAddress: true,
      createdAt: true,
      updatedAt: true,
      mason: { select: { name: true } },
      reward: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return raw.map((r: any) => ({
    id: r.id,
    masonId: r.masonId,
    masonName: r.mason.name,
    rewardId: r.rewardId,
    rewardName: r.reward.name,
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

// PointsLedger
export type FlattenedPointsLedger = {
  id: string;
  masonId: string;
  masonName: string;
  sourceType: string;
  points: number;
  memo: string | null;
  createdAt: string; // ISO String
  sourceDescription: string | null;
};

export async function getFlattenedPointsLedger(companyId: number): Promise<FlattenedPointsLedger[]> {
  const raw = await prisma.pointsLedger.findMany({
    // Filter by Masons whose associated user belongs to the company
    where: { mason: { user: { companyId } } },
    select: {
      id: true,
      masonId: true,
      sourceType: true,
      points: true,
      memo: true,
      createdAt: true,

      mason: { select: { name: true } },
      bagLift: {
        select: {
          bagCount: true,
          dealer: { select: { name: true } }
        }
      },
      rewardRedemption: {
        select: {
          reward: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  return raw.map((r: any) => {
    let description = r.memo;

    if (r.bagLift) {
      const dealerInfo = r.bagLift.dealer?.name ? ` @ ${r.bagLift.dealer.name}` : '';
      description = `Lifted ${r.bagLift.bagCount} bags${dealerInfo}`;
    } else if (r.rewardRedemption) {
      const rewardName = r.rewardRedemption.reward?.name ?? 'Unknown Item';
      description = `Redeemed: ${rewardName}`;
    }

    return {
      id: r.id,
      masonId: r.masonId,
      masonName: r.mason.name,
      sourceType: r.sourceType,
      points: r.points,
      memo: r.memo ?? null,
      createdAt: formatDateTimeIST(r.createdAt),
      sourceDescription: description ?? null,
    };
  });
}

export type FlattenedLogisticsIO = {
  id: string;
  zone: string;
  district: string;
  destination: string;
  purpose: string | null;
  typeOfMaterials: string | null;
  vehicleNumber: string | null;
  noOfInvoice: number | null;
  sourceName: string | null; // sourceName is the partyName in actual schema
  invoiceNos: string[];
  billNos: string[];
  storeDate: string | null;
  storeTime: string | null;
  doOrderDate: string | null;
  doOrderTime: string | null;
  gateInDate: string | null;
  gateInTime: string | null;
  processingTime: string | null;
  wbInDate: string | null;
  wbInTime: string | null;
  diffGateInTareWt: string | null;
  wbOutDate: string | null;
  wbOutTime: string | null;
  diffTareWtGrossWt: string | null;
  gateOutDate: string | null;
  gateOutTime: string | null;
  gateOutNoOfInvoice: number | null;
  gateOutInvoiceNos: string[];
  gateOutBillNos: string[];
  diffGrossWtGateOut: string | null;
  diffGrossWtInvoiceDT: string | null;
  diffInvoiceDTGateOut: string | null;
  diffGateInGateOut: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getFlattenedLogisticsIO(
  // Optional: Add filters here if needed (e.g., date range)
  startDate?: Date,
  endDate?: Date
): Promise<FlattenedLogisticsIO[]> {

  // Build dynamic where clause
  const where: any = {};
  if (startDate && endDate) {
    where.createdAt = {
      gte: startDate,
      lte: endDate,
    };
  }

  const rawData = await prisma.logisticsIO.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return rawData.map((r) => ({
    id: r.id,
    zone: r.zone ?? '',
    district: r.district ?? '',
    destination: r.destination ?? '',
    purpose: r.purpose ?? null,
    typeOfMaterials: r.typeOfMaterials ?? null,
    vehicleNumber: r.vehicleNumber ?? null,
    noOfInvoice: r.noOfInvoice ?? null,
    sourceName: r.partyName ?? null, // sourceName is the partyName in actual schema
    invoiceNos: Array.isArray(r.invoiceNos) ? (r.invoiceNos as string[]) : [],
    billNos: Array.isArray(r.billNos) ? (r.billNos as string[]) : [],
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
    gateOutInvoiceNos: Array.isArray(r.gateOutInvoiceNos) ? (r.gateOutInvoiceNos as string[]) : [],
    gateOutBillNos: Array.isArray(r.gateOutBillNos) ? (r.gateOutBillNos as string[]) : [],
    diffGrossWtGateOut: r.diffGrossWtGateOut ?? null,
    diffGrossWtInvoiceDT: r.diffGrossWtInvoiceDT ?? null,
    diffInvoiceDTGateOut: r.diffInvoiceDTGateOut ?? null,
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