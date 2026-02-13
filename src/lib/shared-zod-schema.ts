// src/lib/shared-zod-schema.ts
import { z } from 'zod';

// assign tasks - daily tasks
// Zod schema for validating the POST request body when assigning tasks
export const assignTaskSchema = z.object({
  salesmanUserIds: z.array(z.number().int()).min(1, "At least one salesman must be selected."),
  taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Task date must be in YYYY-MM-DD format."),
  visitType: z.string(),
  relatedDealerIds: z.array(z.string()).optional().nullable(), // ✅ accept multiple dealers
  siteName: z.string().min(1, "Site name is required for Technical Visit.").optional().nullable(),
  description: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
});

// Zod schema for the GET response for daily tasks - DEFINED HERE
export const dailyTaskSchema = z.object({
  id: z.string(),
  salesmanName: z.string(),
  assignedByUserName: z.string(),
  taskDate: z.string(), // YYYY-MM-DD
  visitType: z.string(),
  relatedDealerName: z.string().nullable().optional(), // For Client Visit
  siteName: z.string().nullable().optional(), // For Technical Visit
  description: z.string().nullable().optional(),
  status: z.string(),
  createdAt: z.string(),
  siteId: z.string().optional().nullable(),
});

// dealer brand mapping + brands 
export const baseDealerBrandMappingSchema = z.object({
  id: z.string(), // Dealer ID
  userId: z.number().nullable().optional(),
  dealerName: z.string(),
  area: z.string(),
  totalPotential: z.number(),
  bestCapacityMT: z.number().nullable().optional(),
  brandGrowthCapacityPercent: z.number().nullable().optional(),
});

// dealer - verification
export const dealerVerificationSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  phoneNo: z.string().min(1),
  area: z.string().min(1),
  region: z.string().min(1),
  type: z.string().min(1), // Used as a primary identifier/zone category
  verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  nameOfFirm: z.string().nullable().optional(),
  underSalesPromoterName: z.string().nullable().optional(),

  // Statutory IDs
  gstinNo: z.string().nullable().optional(),
  panNo: z.string().nullable().optional(),
  aadharNo: z.string().nullable().optional(),
  tradeLicNo: z.string().nullable().optional(),

  // Image URLs (nullable/optional)
  tradeLicencePicUrl: z.string().nullable().optional(),
  shopPicUrl: z.string().nullable().optional(),
  dealerPicUrl: z.string().nullable().optional(),
  blankChequePicUrl: z.string().nullable().optional(),
  partnershipDeedPicUrl: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
});

export const verificationUpdateSchema = z.object({
  verificationStatus: z.enum(["VERIFIED", "REJECTED"]),
});

// dealer 
export const optionalNumberSchema = z.number().nullable().optional();
export const optionalIntSchema = z.number().int().nullable().optional();
export const optionalStringSchema = z.string().nullable().optional();

export const getDealersSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Dealer name is required."),
  type: z.string().min(1, "Dealer type is required."),
  parentDealerId: z.string().nullable().optional(),
  parentDealerName: optionalStringSchema, // Custom field from parentDealer relation
  region: z.string().min(1, "Region is required."),
  area: z.string().min(1, "Area is required."),
  phoneNo: z.string().min(1, "Phone number is required.").max(20, "Phone number is too long."),
  address: z.string().min(1, "Address is required.").max(500, "Address is too long."),
  pinCode: optionalStringSchema,
  latitude: optionalNumberSchema,
  longitude: optionalNumberSchema,
  dateOfBirth: optionalStringSchema,       // ISO string
  anniversaryDate: optionalStringSchema,   // ISO string
  totalPotential: z.number().nonnegative("Total potential must be 0 or positive."),
  bestPotential: z.number().nonnegative("Best potential must be 0 or positive."),
  brandSelling: z.array(z.string()).min(1, "At least one brand must be selected."),
  feedbacks: z.string().min(1, "Feedbacks are required.").max(500, "Feedbacks are too long."),
  remarks: optionalStringSchema,
  verificationStatus: z.string().optional(),
  noOfPJP: z.number().nullable().optional(),

  // --- New Fields (Contact, KYC, Development) ---
  dealerDevelopmentStatus: optionalStringSchema,
  dealerDevelopmentObstacle: optionalStringSchema,
  whatsappNo: optionalStringSchema,
  emailId: optionalStringSchema,
  businessType: optionalStringSchema,
  nameOfFirm: optionalStringSchema,
  underSalesPromoterName: optionalStringSchema,
  gstinNo: optionalStringSchema,
  panNo: optionalStringSchema,
  tradeLicNo: optionalStringSchema,
  aadharNo: optionalStringSchema,

  // --- Godown Details ---
  godownSizeSqFt: optionalNumberSchema,
  godownCapacityMTBags: optionalStringSchema,
  godownAddressLine: optionalStringSchema,
  godownLandMark: optionalStringSchema,
  godownDistrict: optionalStringSchema,
  godownArea: optionalStringSchema,
  godownRegion: optionalStringSchema,
  godownPinCode: optionalStringSchema,

  // --- Residential Address Details ---
  residentialAddressLine: optionalStringSchema,
  residentialLandMark: optionalStringSchema,
  residentialDistrict: optionalStringSchema,
  residentialArea: optionalStringSchema,
  residentialRegion: optionalStringSchema,
  residentialPinCode: optionalStringSchema,

  // --- Bank Details ---
  bankAccountName: optionalStringSchema,
  bankName: optionalStringSchema,
  bankBranchAddress: optionalStringSchema,
  bankAccountNumber: optionalStringSchema,
  bankIfscCode: optionalStringSchema,

  // --- Sales & Promoter Details ---
  brandName: optionalStringSchema,
  monthlySaleMT: optionalNumberSchema,
  noOfDealers: optionalNumberSchema,
  areaCovered: optionalStringSchema,
  projectedMonthlySalesBestCementMT: optionalNumberSchema,
  noOfEmployeesInSales: optionalNumberSchema,

  // --- Declaration ---
  declarationName: optionalStringSchema,
  declarationPlace: optionalStringSchema,
  declarationDate: optionalStringSchema,

  // --- Document/Image URLs ---
  tradeLicencePicUrl: optionalStringSchema,
  shopPicUrl: optionalStringSchema,
  dealerPicUrl: optionalStringSchema,
  blankChequePicUrl: optionalStringSchema,
  partnershipDeedPicUrl: optionalStringSchema,

  createdAt: z.string(), // Expecting ISO string
  updatedAt: z.string(), // Expecting ISO string
});

// Schema for the POST request body (data sent from frontend to create a new dealer)
export const postDealersSchema = z.object({
  name: z.string().min(1, "Dealer name is required."),
  type: z.string(),
  parentDealerId: z.string().nullable().optional(),
  region: z.string(),
  area: z.string(),
  phoneNo: z.string().min(1, "Phone number is required.").max(20, "Phone number is too long."),
  address: z.string().min(1, "Address is required.").max(500, "Address is too long."),
  pinCode: optionalStringSchema,
  latitude: optionalNumberSchema,
  longitude: optionalNumberSchema,
  dateOfBirth: optionalStringSchema,       // ISO string
  anniversaryDate: optionalStringSchema,   // ISO string
  totalPotential: z.number().nonnegative("Total potential must be 0 or positive."),
  bestPotential: z.number().nonnegative("Best potential must be 0 or positive."),
  brandSelling: z.array(z.string()).min(1, "At least one brand must be selected."),
  feedbacks: z.string().min(1, "Feedbacks are required.").max(500, "Feedbacks are too long."),
  remarks: optionalStringSchema,

  // --- New Fields (Contact, KYC, Development) ---
  dealerDevelopmentStatus: optionalStringSchema,
  dealerDevelopmentObstacle: optionalStringSchema,
  whatsappNo: optionalStringSchema,
  emailId: optionalStringSchema,
  businessType: optionalStringSchema,
  gstinNo: optionalStringSchema,
  panNo: optionalStringSchema,
  tradeLicNo: optionalStringSchema,
  aadharNo: optionalStringSchema,

  // --- Godown Details ---
  godownSizeSqFt: optionalIntSchema, // Specific integer validation
  godownCapacityMTBags: optionalStringSchema,
  godownAddressLine: optionalStringSchema,
  godownLandMark: optionalStringSchema,
  godownDistrict: optionalStringSchema,
  godownArea: optionalStringSchema,
  godownRegion: optionalStringSchema,
  godownPinCode: optionalStringSchema,

  // --- Residential Address Details ---
  residentialAddressLine: optionalStringSchema,
  residentialLandMark: optionalStringSchema,
  residentialDistrict: optionalStringSchema,
  residentialArea: optionalStringSchema,
  residentialRegion: optionalStringSchema,
  residentialPinCode: optionalStringSchema,

  // --- Bank Details ---
  bankAccountName: optionalStringSchema,
  bankName: optionalStringSchema,
  bankBranchAddress: optionalStringSchema,
  bankAccountNumber: optionalStringSchema,
  bankIfscCode: optionalStringSchema,

  // --- Sales & Promoter Details ---
  brandName: optionalStringSchema,
  monthlySaleMT: optionalNumberSchema,
  noOfDealers: optionalIntSchema, // Specific integer validation
  areaCovered: optionalStringSchema,
  projectedMonthlySalesBestCementMT: optionalNumberSchema,
  noOfEmployeesInSales: optionalIntSchema, // Specific integer validation

  // --- Declaration ---
  declarationName: optionalStringSchema,
  declarationPlace: optionalStringSchema,
  declarationDate: optionalStringSchema,

  // --- Document/Image URLs ---
  tradeLicencePicUrl: optionalStringSchema,
  shopPicUrl: optionalStringSchema,
  dealerPicUrl: optionalStringSchema,
  blankChequePicUrl: optionalStringSchema,
  partnershipDeedPicUrl: optionalStringSchema,

});

// pjp 
export const permanentJourneyPlanSchema = z.object({
  id: z.string(),
  salesmanName: z.string(),
  userId: z.number().int(),
  createdByName: z.string(),
  createdByRole: z.string(),
  areaToBeVisited: z.string(),
  route: z.string().nullable().optional(),

  planDate: z.string(), // Mapped to YYYY-MM-DD
  description: z.string().nullable().optional(), // Mapped to String? in schema
  status: z.string(),
  plannedNewSiteVisits: z.number().int(),
  plannedFollowUpSiteVisits: z.number().int(),
  plannedNewDealerVisits: z.number().int(),
  plannedInfluencerVisits: z.number().int(),
  noOfConvertedBags: z.number().int(),
  noOfMasonPcSchemes: z.number().int(),
  diversionReason: z.string().nullable().optional(),
  influencerName: z.string().optional().nullable(),
  influencerPhone: z.string().optional().nullable(),
  activityType: z.string().optional().nullable(),

  taskIds: z.array(z.string()), // Array of DailyTask IDs
  dealerId: z.string().nullable().optional(),
  visitDealerName: z.string().nullable().optional(),
  verificationStatus: z.string(),
  additionalVisitRemarks: z.string().nullable(),
  siteId: z.string().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// pjp verifcation
export const permanentJourneyPlanVerificationSchema = z.object({
  id: z.string(),
  salesmanName: z.string(),
  userId: z.number(),
  createdByName: z.string(),
  createdByRole: z.string(),
  areaToBeVisited: z.string(),
  route: z.string().nullable().optional(),

  planDate: z.string(), // YYYY-MM-DD
  description: z.string().nullable(),
  status: z.string(),
  plannedNewSiteVisits: z.number().int(),
  plannedFollowUpSiteVisits: z.number().int(),
  plannedNewDealerVisits: z.number().int(),
  plannedInfluencerVisits: z.number().int(),
  noOfConvertedBags: z.number().int(),
  noOfMasonPcSchemes: z.number().int(),
  influencerName: z.string().optional().nullable(),
  influencerPhone: z.string().optional().nullable(),
  activityType: z.string().optional().nullable(),

  dealerId: z.string().nullable().optional(),
  visitDealerName: z.string().nullable().optional(),
  verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
  additionalVisitRemarks: z.string().nullable(),
  salesmanRegion: z.string().nullable(),
  salesmanArea: z.string().nullable(),
  siteId: z.string().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const pjpVerificationUpdateSchema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'REJECTED']),
  additionalVisitRemarks: z.string().max(500).optional().nullable(),
});

export const pjpModificationSchema = z.object({
  planDate: z.string().optional(),
  areaToBeVisited: z.string().max(500).optional(),
  route: z.string().max(500).optional().nullable(), // Added
  description: z.string().max(500).optional().nullable(),
  
  // Allow editing numerical counts
  plannedNewSiteVisits: z.number().int().optional(),
  plannedFollowUpSiteVisits: z.number().int().optional(),
  plannedNewDealerVisits: z.number().int().optional(),
  plannedInfluencerVisits: z.number().int().optional(),
  
  // Influencer details
  influencerName: z.string().optional().nullable(),
  influencerPhone: z.string().optional().nullable(),
  activityType: z.string().optional().nullable(),
  noOfConvertedBags: z.number().int().optional(),
  noOfMasonPcSchemes: z.number().int().optional(),

  dealerId: z.string().nullable().optional(),
  visitDealerName: z.string().nullable().optional(),
  additionalVisitRemarks: z.string().max(500).optional().nullable(),
  siteId: z.string().optional().nullable(),
  diversionReason: z.string().max(500).optional().nullable(), // Added
});

// competition report
export const competitionReportSchema = z.object({
  id: z.string(),
  salesmanName: z.string(),
  brandName: z.string(),
  date: z.string(), // Mapped to YYYY-MM-DD
  billing: z.string(),
  nod: z.string(),
  retail: z.string(),
  schemesYesNo: z.string(),
  avgSchemeCost: z.number(), // Mapped from Decimal to Number
  remarks: z.string(), // Mapped from String? to non-nullable string
  createdAt: z.string(), // ISO String
  updatedAt: z.string(), // ISO String
});

// daily visit report
export const dailyVisitReportSchema = z.object({
  id: z.string(),
  salesmanName: z.string(),
  role: z.string(),
  reportDate: z.string(), // YYYY-MM-DD string
  dealerType: z.string(),
  dealerId: z.string().nullable().optional(),
  subDealerId: z.string().nullable().optional(),
  dealerName: z.string().nullable(),
  subDealerName: z.string().nullable(),
  location: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  visitType: z.string(),
  dealerTotalPotential: z.number(),
  dealerBestPotential: z.number(),
  brandSelling: z.array(z.string()),
  contactPerson: z.string().nullable(),
  contactPersonPhoneNo: z.string().nullable(),
  todayOrderMt: z.number(),
  todayCollectionRupees: z.number(),
  overdueAmount: z.number().nullable(),
  feedbacks: z.string(),
  solutionBySalesperson: z.string().nullable(),
  anyRemarks: z.string().nullable(),
  checkInTime: z.string(), // ISO string
  checkOutTime: z.string().nullable(), // ISO string or null
  timeSpentinLoc: z.string().optional().nullable(),
  inTimeImageUrl: z.string().nullable(),
  outTimeImageUrl: z.string().nullable(),
});

// sales orders
export const salesOrderSchema = z.object({
  // Primary & FKs
  id: z.string(),
  userId: z.number().nullable(),
  dealerId: z.string().nullable(),
  dvrId: z.string().nullable(),
  pjpId: z.string().nullable(),

  // Denormalized display fields (nice for UI)
  salesmanName: z.string(),
  salesmanRole: z.string(),
  dealerName: z.string(),
  dealerType: z.string(),
  dealerPhone: z.string(),
  dealerAddress: z.string(),
  area: z.string(),
  region: z.string(),

  // Business fields (raw)
  orderDate: z.string(),                      // YYYY-MM-DD
  orderPartyName: z.string(),

  partyPhoneNo: z.string().nullable(),
  partyArea: z.string().nullable(),
  partyRegion: z.string().nullable(),
  partyAddress: z.string().nullable(),

  deliveryDate: z.string().nullable(),        // YYYY-MM-DD or null
  deliveryArea: z.string().nullable(),
  deliveryRegion: z.string().nullable(),
  deliveryAddress: z.string().nullable(),
  deliveryLocPincode: z.string().nullable(),

  paymentMode: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  paymentAmount: z.number().nullable(),
  receivedPayment: z.number().nullable(),
  receivedPaymentDate: z.string().nullable(), // YYYY-MM-DD or null
  pendingPayment: z.number().nullable(),

  orderQty: z.number().nullable(),
  orderUnit: z.string().nullable(),

  itemPrice: z.number().nullable(),
  discountPercentage: z.number().nullable(),
  itemPriceAfterDiscount: z.number().nullable(),

  itemType: z.string().nullable(),
  itemGrade: z.string().nullable(),

  // Convenience/computed
  orderTotal: z.number(),                      // qty * effective price
  estimatedDelivery: z.string().nullable(),    // alias of deliveryDate for your UI
  remarks: z.string().nullable(),              // not in DB, stays null for compat

  // Timestamps
  createdAt: z.string(),
  updatedAt: z.string(),
});

// technical visit report 
export const technicalVisitReportSchema = z.object({
  // --- Core Identity ---
  id: z.string(),
  salesmanName: z.string(),
  role: z.string(),

  // --- Contact & Location ---
  siteNameConcernedPerson: z.string(),
  phoneNo: z.string(),
  emailId: z.string(), 
  whatsappNo: z.string().nullable(), 

  region: z.string().nullable(),
  area: z.string().nullable(),
  marketName: z.string().nullable(), 
  siteAddress: z.string().nullable(),

  latitude: z.number().nullable(),
  longitude: z.number().nullable(),

  // --- Visit Details ---
  date: z.string(), // Mapped to YYYY-MM-DD
  visitType: z.string(),
  visitCategory: z.string().nullable(), 
  customerType: z.string().nullable(), 
  purposeOfVisit: z.string().nullable(),

  // --- Construction & Site Status ---
  constAreaSqFt: z.number().int().nullable(), 
  siteVisitStage: z.string(), 
  siteVisitBrandInUse: z.array(z.string()),
  currentBrandPrice: z.number().nullable(),
  siteStock: z.number().nullable(), 
  estRequirement: z.number().nullable(), 
  supplyingDealerName: z.string().nullable(), 
  nearbyDealerName: z.string().nullable(), 

  // --- Conversion Section ---
  isConverted: z.boolean().nullable(), 
  conversionType: z.string().nullable(), 
  conversionFromBrand: z.string(), 
  conversionQuantityValue: z.number().nullable(),
  conversionQuantityUnit: z.string(), 

  // --- Technical Services ---
  isTechService: z.boolean().nullable(), 
  serviceDesc: z.string().nullable(), 
  serviceType: z.string(), 
  dhalaiVerificationCode: z.string().nullable(),
  isVerificationStatus: z.string().nullable(),
  qualityComplaint: z.string(), 

  // --- Influencer / Mason / Engineer ---
  influencerName: z.string().nullable(), 
  influencerPhone: z.string().nullable(), 
  isSchemeEnrolled: z.boolean().nullable(),
  influencerProductivity: z.string().nullable(), 
  influencerType: z.array(z.string()),

  // --- Remarks & Legacy ---
  clientsRemarks: z.string(),
  salespersonRemarks: z.string(),
  associatedPartyName: z.string(), 
  promotionalActivity: z.string(), 
  channelPartnerVisit: z.string(), 
  siteVisitType: z.string().nullable(), 

  // --- Time & Images ---
  checkInTime: z.string(), // ISO String
  checkOutTime: z.string(), // ISO String or ''
  timeSpentinLoc: z.string().optional().nullable(),
  inTimeImageUrl: z.string().nullable(),
  outTimeImageUrl: z.string().nullable(),
  sitePhotoUrl: z.string().nullable(),

  createdAt: z.string(), // ISO String
  updatedAt: z.string(), // ISO String
  firstVisitTime: z.string().nullable(),
  lastVisitTime: z.string().nullable(),
  firstVisitDay: z.string().nullable(),
  lastVisitDay: z.string().nullable(),
  siteVisitsCount: z.number().int().nullable(),
  otherVisitsCount: z.number().int().nullable(),
  totalVisitsCount: z.number().int().nullable(),

  // --- Foreign Keys ---
  meetingId: z.string().nullable(),
  pjpId: z.string().nullable(),
  masonId: z.string().nullable(),
  siteId: z.string().optional().nullable(),
});

// salesman & dealer rating-scores
// Salesperson Ratings
export const salesmanRatingSchema = z.object({
  id: z.number(),
  salesPersonName: z.string(),
  area: z.string(),
  region: z.string(),
  rating: z.number().int(),
});

// Dealer Scores (now includes area/region/type; fixed date field)
export const dealerScoreSchema = z.object({
  id: z.string(),
  dealerName: z.string(),
  dealerScore: z.number(),
  trustWorthinessScore: z.number(),
  creditWorthinessScore: z.number(),
  orderHistoryScore: z.number(),
  visitFrequencyScore: z.number(),
  lastUpdatedDate: z.string(),     // YYYY-MM-DD string we format below
  area: z.string().optional(),     // from Dealer.area
  region: z.string().optional(),   // from Dealer.region
  type: z.string().optional(),     // from Dealer.type
});

// salesman attendance 
export const salesmanAttendanceSchema = z.object({
  id: z.string(),
  salesmanName: z.string(),
  role: z.string().default("SALES"),
  date: z.string(), // YYYY-MM-DD
  location: z.string(),
  inTime: z.string().nullable(), // Formatted time string or null
  outTime: z.string().nullable(), // Formatted time string or null
  inTimeImageCaptured: z.boolean(),
  outTimeImageCaptured: z.boolean(),
  inTimeImageUrl: z.string().nullable(),
  outTimeImageUrl: z.string().nullable(),

  // Latitude/Longitude are required fields in the DB schema, so they should be numbers.
  inTimeLatitude: z.number(),
  inTimeLongitude: z.number(),

  // The rest are optional in the DB schema, so they are nullable numbers in the output.
  inTimeAccuracy: z.number().nullable(),
  inTimeSpeed: z.number().nullable(),
  inTimeHeading: z.number().nullable(),
  inTimeAltitude: z.number().nullable(),
  outTimeLatitude: z.number().nullable(),
  outTimeLongitude: z.number().nullable(),
  outTimeAccuracy: z.number().nullable(),
  outTimeSpeed: z.number().nullable(),
  outTimeHeading: z.number().nullable(),
  outTimeAltitude: z.number().nullable(),

  // Added timestamps for a complete report
  createdAt: z.string(),
  updatedAt: z.string(),

  salesmanRole: z.string().optional(),
  area: z.string().optional(),
  region: z.string().optional(),
});

// geotracking
export const geoTrackingSchema = z.object({
  id: z.string(),
  // User / company info
  salesmanName: z.string().nullable().optional(),
  employeeId: z.string().nullable().optional(),
  workosOrganizationId: z.string().nullable().optional(),
  // Required coords
  latitude: z.number(),
  longitude: z.number(),
  recordedAt: z.string(), // ISO string
  // Nullable numeric fields
  totalDistanceTravelled: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  altitude: z.number().nullable().optional(),
  // Nullable strings
  locationType: z.string().nullable().optional(),
  activityType: z.string().nullable().optional(),
  appState: z.string().nullable().optional(),
  networkStatus: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  siteName: z.string().nullable().optional(),
  // Battery / charging
  batteryLevel: z.number().nullable().optional(),
  isCharging: z.boolean().nullable().optional(),
  // Check-in/out
  checkInTime: z.string().nullable().optional(),
  checkOutTime: z.string().nullable().optional(),
  // Extra fields you added in formatting
  journeyId: z.string().nullable().optional(),
  isActive: z.boolean(),
  destLat: z.number().nullable().optional(),
  destLng: z.number().nullable().optional(),
  // Timestamps
  createdAt: z.string(),
  updatedAt: z.string(),

  salesmanRole: z.string().optional(),
  area: z.string().optional(),
  region: z.string().optional(),
  siteId: z.string().optional().nullable(),
  dealerId: z.string().optional().nullable(),
});

export const journeyOpTrackingSchema = z.object({
  id: z.string(),
  journeyId: z.string().nullable().optional(),
  salesmanName: z.string().nullable().optional(),
  employeeId: z.string().nullable().optional(),
  workosOrganizationId: z.string().nullable().optional(),
  salesmanRole: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  region: z.string().nullable().optional(),

  // Core Tracking Data
  latitude: z.union([z.number(), z.string()]).transform(val => Number(val)).optional(),
  longitude: z.union([z.number(), z.string()]).transform(val => Number(val)).optional(),
  recordedAt: z.string(), 
  totalDistanceTravelled: z.number().nullable().optional(), 
  locationType: z.string().nullable().optional(),
  activityType: z.string().nullable().optional(),
  appState: z.string().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  altitude: z.number().nullable().optional(),
  batteryLevel: z.number().nullable().optional(),
  isCharging: z.boolean().nullable().optional(),
  networkStatus: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  siteName: z.string().nullable().optional(),
  checkInTime: z.string().nullable().optional(),
  checkOutTime: z.string().nullable().optional(),
  
  isActive: z.boolean().nullable().optional(),
  destLat: z.number().nullable().optional(),
  destLng: z.number().nullable().optional(),

  // Timestamps
  createdAt: z.string(),
  updatedAt: z.string(),
});

// leave application
export const salesmanLeaveApplicationSchema = z.object({
  id: z.string(),
  salesmanName: z.string(),
  leaveType: z.string(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),   // YYYY-MM-DD
  reason: z.string(),
  status: z.string(), // "Pending", "Approved", "Rejected"
  adminRemarks: z.string().nullable(),
  createdAt: z.string(), // ISO string
  updatedAt: z.string(), // ISO string

  salesmanRole: z.string().optional(),
  area: z.string().optional(),
  region: z.string().optional(),
});

// Zod schema for validating PATCH request body
export const updateLeaveApplicationSchema = z.object({
  id: z.string(),
  status: z.enum(["Approved", "Rejected"]), // Status must be one of these two
  adminRemarks: z.string().nullable().optional(), // Can be string, null, or undefined (if not sent)
});

export const tsoMeetingSchema = z.object({
  id: z.string(),
  createdByUserId: z.number().int(),
  createdAt: z.string(), // ISO String
  updatedAt: z.string(), // ISO String
  type: z.string().optional().nullable(),
  date: z.string().optional().nullable(), // ISO String
  participantsCount: z.number().int().optional().nullable(),
  zone: z.string().optional().nullable(),
  market: z.string().optional().nullable(),
  dealerName: z.string().optional().nullable(),
  dealerAddress: z.string().optional().nullable(),
  conductedBy: z.string().optional().nullable(),
  giftType: z.string().optional().nullable(),
  accountJsbJud: z.string().optional().nullable(),
  totalExpenses: z.number().optional().nullable(), 
  billSubmitted: z.boolean().optional().nullable().default(false),

  siteId: z.string().optional().nullable(),
});

// technical sites - flattened and linked back 
const associatedUserSchema = z.object({
  id: z.number().int(), // User IDs are Integers
  name: z.string(),     // Combined First + Last
  role: z.string(),
  phoneNumber: z.string().nullable(),
});

const associatedDealerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phoneNo: z.string(),
  type: z.string(),
  area: z.string(),
});

const associatedMasonSchema = z.object({
  id: z.string(),
  name: z.string(),
  phoneNumber: z.string(),
  kycStatus: z.string().nullable(),
});

const siteBagLiftSchema = z.object({
  id: z.string(),
  bagCount: z.number().int(),
  pointsCredited: z.number().int(),
  status: z.string(),
  purchaseDate: z.string(), // ISO String
  masonName: z.string().nullable(),
});

export const technicalSiteSchema = z.object({
  id: z.string(),
  siteName: z.string(),
  concernedPerson: z.string(),
  phoneNo: z.string(),
  address: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  siteType: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  keyPersonName: z.string().nullable().optional(),
  keyPersonPhoneNum: z.string().nullable().optional(),
  stageOfConstruction: z.string().nullable().optional(),
  constructionStartDate: z.string().nullable().optional(), // ISO Date String
  constructionEndDate: z.string().nullable().optional(),   // ISO Date String
  convertedSite: z.boolean().nullable().optional(),
  firstVistDate: z.string().nullable().optional(), // ISO Date String
  lastVisitDate: z.string().nullable().optional(),  // ISO Date String
  needFollowUp: z.boolean().nullable().optional(),
  imageUrl: z.string().nullable(),

  createdAt: z.string(), // ISO String
  updatedAt: z.string(), // ISO String

  associatedUsers: z.array(associatedUserSchema),
  associatedDealers: z.array(associatedDealerSchema),
  associatedMasons: z.array(associatedMasonSchema),
  bagLifts: z.array(siteBagLiftSchema),
});

export const rewardSchema = z.object({
  id: z.number().int(),
  name: z.string(), // Renamed from itemName
  pointCost: z.number().int(), // Renamed from unitPrice, changed to Int
  categoryId: z.number().int().nullable(),
  stock: z.number().int(),
  totalAvailableQuantity: z.number().int(),
  isActive: z.boolean(),
  meta: z.any().optional().nullable(),
  createdAt: z.string(), // ISO String
  updatedAt: z.string(), // ISO String
});
export const giftAllocationLogSchema = z.object({
  id: z.string(),
  giftId: z.number().int(),
  userId: z.number().int(),
  transactionType: z.string().max(50),
  quantity: z.number().int(),
  sourceUserId: z.number().int().nullable(),
  destinationUserId: z.number().int().nullable(),
  technicalVisitReportId: z.string().nullable(),
  dealerVisitReportId: z.string().nullable(),
  createdAt: z.string(), // ISO Date String
});

export const masonPCSideSchema = z.object({
  id: z.string(),
  name: z.string(),
  phoneNumber: z.string(),
  firebaseUid: z.string().nullable(),
  kycDocumentName: z.string().nullable(),
  kycDocumentIdNum: z.string().nullable(),
  kycStatus: z.string().nullable(),
  bagsLifted: z.number().int().nullable(),
  pointsBalance: z.number().int().nullable(),
  isReferred: z.boolean().nullable(),
  referredByUser: z.string().nullable(),
  referredToUser: z.string().nullable(),
  dealerId: z.string().nullable(),
  userId: z.number().int().nullable(),
  deviceId: z.string().nullable().optional(),
});

export const otpVerificationSchema = z.object({
  id: z.string(),
  otpCode: z.string(),
  expiresAt: z.string(), // ISO String
  masonId: z.string(),
});

export const schemesOffersSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(), // ISO String
  endDate: z.string().nullable(), // ISO String
});

export const masonOnSchemeSchema = z.object({
  masonId: z.string(),
  schemeId: z.string(),
  enrolledAt: z.string().nullable(), // ISO String
  status: z.string().nullable(),
  siteId: z.string().optional().nullable(),
});

export const masonsOnMeetingsSchema = z.object({
  masonId: z.string(),
  meetingId: z.string(),
  attendedAt: z.string(), // ISO String
});

export const rewardCategorySchema = z.object({
  id: z.number().int(),
  name: z.string().max(120),
});

export const kycSubmissionSchema = z.object({
  id: z.string(),
  masonId: z.string(),
  aadhaarNumber: z.string().nullable(),
  panNumber: z.string().nullable(),
  voterIdNumber: z.string().nullable(),
  documents: z.any().optional().nullable(), // Json field
  status: z.string(), // "pending", "approved", "rejected"
  remark: z.string().nullable(),
  createdAt: z.string(), // ISO String
  updatedAt: z.string(), // ISO String
});

export const tsoAssignmentSchema = z.object({
  tsoId: z.number().int(),
  masonId: z.string(),
  createdAt: z.string(), // ISO String
});

export const bagLiftSchema = z.object({
  id: z.string(),
  masonId: z.string(),
  masonName: z.string(),
  phoneNumber: z.string().nullable().optional(),
  dealerId: z.string().nullable(),
  purchaseDate: z.string(), // ISO String
  bagCount: z.number().int(),
  pointsCredited: z.number().int(),
  imageUrl: z.string().nullable(),
  status: z.string(), // "pending", "approved", etc.

  siteId: z.string().nullable(),
  siteKeyPersonName: z.string().nullable(),
  siteKeyPersonPhone: z.string().nullable(),
  verificationSiteImageUrl: z.string().nullable(),
  verificationProofImageUrl: z.string().nullable(),

  approvedBy: z.number().int().nullable(),
  approvedAt: z.string().nullable(), // ISO String
  createdAt: z.string(), // ISO String
});

export const rewardRedemptionSchema = z.object({
  id: z.string(),
  masonId: z.string(),
  rewardId: z.number().int(),
  quantity: z.number().int(),
  status: z.string(), // "placed", "approved", "shipped", etc.
  fulfillmentNotes: z.string().nullable().optional(),
  pointsDebited: z.number().int(),
  deliveryName: z.string().nullable(),
  deliveryPhone: z.string().nullable(),
  deliveryAddress: z.string().nullable(),
  createdAt: z.string(), // ISO String
  updatedAt: z.string(), // ISO String
});

export const pointsLedgerSchema = z.object({
  id: z.string(),
  masonId: z.string(),
  sourceType: z.string().max(32),
  sourceId: z.string().nullable(),
  points: z.number().int(),
  memo: z.string().nullable(),
  createdAt: z.string(), // ISO String
});

export const authSessionSchema = z.object({
  sessionId: z.string(),
  masonId: z.string(),
  sessionToken: z.string(),
  createdAt: z.string(), // ISO String
  expiresAt: z.string().nullable(), // ISO String
});

export const schemeSlabsSchema = z.object({
  id: z.string(),
  schemeId: z.string(),
  minBagsBest: z.number().int().nullable(),
  minBagsOthers: z.number().int().nullable(),
  pointsEarned: z.number().int(),
  slabDescription: z.string().nullable(),
  rewardId: z.number().int().nullable(),
  createdAt: z.string(), // ISO String
  updatedAt: z.string().nullable(), // ISO String
});

export const masonSlabAchievementSchema = z.object({
  id: z.string(),
  masonId: z.string(),
  schemeSlabId: z.string(),
  achievedAt: z.string(), // ISO String
  pointsAwarded: z.number().int(),
});

export const logisticsIOSchema = z.object({
  id: z.string(),
  zone: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  destination: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  typeOfMaterials: z.string().nullable().optional(),
  vehicleNumber: z.string().nullable().optional(),
  noOfInvoice: z.number().nullable().optional(),
  partyName: z.string().nullable().optional(),
  invoiceNos: z.array(z.string()).nullable().optional(),
  billNos: z.array(z.string()).nullable().optional(),
  storeDate: z.string().nullable().optional(),
  storeTime: z.string().nullable().optional(),
  doOrderDate: z.string().nullable().optional(),
  doOrderTime: z.string().nullable().optional(),
  gateInDate: z.string().nullable().optional(),
  gateInTime: z.string().nullable().optional(),
  processingTime: z.string().nullable().optional(),
  wbInDate: z.string().nullable().optional(),
  wbInTime: z.string().nullable().optional(),
  diffGateInTareWt: z.string().nullable().optional(),
  wbOutDate: z.string().nullable().optional(),
  wbOutTime: z.string().nullable().optional(),
  diffTareWtGrossWt: z.string().nullable().optional(),
  gateOutDate: z.string().nullable().optional(),
  gateOutTime: z.string().nullable().optional(),
  diffGrossWtGateOut: z.string().nullable().optional(),
  diffGrossWtInvoiceDT: z.string().nullable().optional(),
  diffInvoiceDTGateOut: z.string().nullable().optional(),
  diffGateInGateOut: z.string().nullable().optional(),
  
  createdAt: z.string(), // ISO String
  updatedAt: z.string(), // ISO String
});

export type AssignTaskSchema = z.infer<typeof assignTaskSchema>;
export type DailyTaskSchema = z.infer<typeof dailyTaskSchema>;
export type BaseDealerBrandMappingSchema = z.infer<typeof baseDealerBrandMappingSchema>;
export type VerificationUpdateSchema = z.infer<typeof verificationUpdateSchema>;
export type DealerVerificationSchema = z.infer<typeof dealerVerificationSchema>;
export type GetDealersSchema = z.infer<typeof getDealersSchema>;
export type PostDealersSchema = z.infer<typeof postDealersSchema>;
export type PermanentJourneyPlanSchema = z.infer<typeof permanentJourneyPlanSchema>;
export type PermanentJourneyPlanVerificationSchema = z.infer<typeof permanentJourneyPlanVerificationSchema>;
export type PjpVerificationUpdateSchema = z.infer<typeof pjpVerificationUpdateSchema>;
export type PjpModificationSchema = z.infer<typeof pjpModificationSchema>;
export type CompetitionReportSchema = z.infer<typeof competitionReportSchema>;
export type DailyVisitReportSchema = z.infer<typeof dailyVisitReportSchema>;
export type TechnicalVisitReportSchema = z.infer<typeof technicalVisitReportSchema>;
export type SalesOrderSchema = z.infer<typeof salesOrderSchema>;
export type SalesmanAttendanceSchema = z.infer<typeof salesmanAttendanceSchema>;
export type GeoTrackingSchema = z.infer<typeof geoTrackingSchema>;
export type JourneyOpTracking = z.infer<typeof journeyOpTrackingSchema>;
export type SalesmanLeaveApplicationSchema = z.infer<typeof salesmanLeaveApplicationSchema>;
export type UpdateLeaveApplicationSchema = z.infer<typeof updateLeaveApplicationSchema>;

export type TsoMeetingSchema = z.infer<typeof tsoMeetingSchema>;
export type TechnicalSiteSchema = z.infer<typeof technicalSiteSchema>;
export type RewardSchema = z.infer<typeof rewardSchema>;
export type GiftAllocationLogSchema = z.infer<typeof giftAllocationLogSchema>;
export type MasonPCSideSchema = z.infer<typeof masonPCSideSchema>;
export type OtpVerificationSchema = z.infer<typeof otpVerificationSchema>;
export type SchemesOffersSchema = z.infer<typeof schemesOffersSchema>;
export type MasonOnSchemeSchema = z.infer<typeof masonOnSchemeSchema>;
export type MasonsOnMeetingsSchema = z.infer<typeof masonsOnMeetingsSchema>;
export type RewardCategorySchema = z.infer<typeof rewardCategorySchema>;
export type KYCSubmissionSchema = z.infer<typeof kycSubmissionSchema>;
export type TSOAssignmentSchema = z.infer<typeof tsoAssignmentSchema>;
export type BagLiftSchema = z.infer<typeof bagLiftSchema>;
export type RewardRedemptionSchema = z.infer<typeof rewardRedemptionSchema>;
export type PointsLedgerSchema = z.infer<typeof pointsLedgerSchema>;
export type AuthSessionSchema = z.infer<typeof authSessionSchema>;
export type SchemeSlabsSchema = z.infer<typeof schemeSlabsSchema>;
export type MasonSlabAchievementSchema = z.infer<typeof masonSlabAchievementSchema>;

export type LogisticsIOSchema = z.infer<typeof logisticsIOSchema>;