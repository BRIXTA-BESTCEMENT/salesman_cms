// drizzle/zodSchema.ts
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { dealers, dealerReportsAndScores, users, technicalVisitReports, permanentJourneyPlans, technicalSites, 
    companies, ratings, dealerBrandMapping, brands, verifiedDealers, dailyVisitReports, 
    salesmanLeaveApplications, salesmanAttendance, competitionReports, geoTracking, journeys, 
    giftAllocationLogs, rewards, dailyTasks, salesOrders, masonPcSide, otpVerifications, 
    authSessions, rewardRedemptions, pointsLedger, kycSubmissions, rewardCategories, 
    schemesOffers, schemeSlabs, masonSlabAchievements, dealerAssociatedMasons, bagLifts, 
    siteAssociatedDealers, siteAssociatedMasons, siteAssociatedUsers, tsoAssignments,
    outstandingReports,masonsOnMeetings,logisticsIO, logisticsUsers, masonOnScheme, notifications, syncState, 
    schemeToRewards, journeyOps, tsoMeetings, journeyBreadcrumbs, salesPromoters,
    projectionVsActualReports, collectionReports, emailReports, projectionReports, 
} from "../drizzle/index";

/* ================================= XXXXXXXXXXX ================================ */
/* ========================= drizzle-zod insert schemas ========================= */
/* ================================= XXXXXXXXXXX ================================ */

export const insertCompanySchema = createInsertSchema(companies);
export const insertUserSchema = createInsertSchema(users);
export const insertDailyVisitReportSchema = createInsertSchema(dailyVisitReports);
export const insertTechnicalVisitReportSchema = createInsertSchema(technicalVisitReports);
export const insertPermanentJourneyPlanSchema = createInsertSchema(permanentJourneyPlans);
export const insertDealerSchema = createInsertSchema(dealers);
export const insertSalesPromoterSchema = createInsertSchema(salesPromoters);
export const insertSalesmanAttendanceSchema = createInsertSchema(salesmanAttendance);
export const insertSalesmanLeaveApplicationSchema = createInsertSchema(salesmanLeaveApplications);
export const insertCompetitionReportSchema = createInsertSchema(competitionReports);
export const insertDailyTaskSchema = createInsertSchema(dailyTasks);
export const insertDealerReportsAndScoresSchema = createInsertSchema(dealerReportsAndScores);
export const insertRatingSchema = createInsertSchema(ratings);
export const insertSalesOrderSchema = createInsertSchema(salesOrders);
export const insertBrandSchema = createInsertSchema(brands);
export const insertDealerBrandMappingSchema = createInsertSchema(dealerBrandMapping);
export const insertTsoMeetingSchema = createInsertSchema(tsoMeetings);
export const insertauthSessionsSchema = createInsertSchema(authSessions);

// journey + geotracking
export const insertGeoTrackingSchema = createInsertSchema(geoTracking);
export const insertJourneyOpsSchema = createInsertSchema(journeyOps);
export const insertJourneysSchema = createInsertSchema(journeys);
export const insertJourneyBreadcrumbsSchema = createInsertSchema(journeyBreadcrumbs);
export const insertSyncStateSchema = createInsertSchema(syncState);

// Changed giftInventory to rewards
export const insertRewardsSchema = createInsertSchema(rewards);
export const insertGiftAllocationLogSchema = createInsertSchema(giftAllocationLogs);

// Modified masonPcSide schema
export const insertMasonPcSideSchema = createInsertSchema(masonPcSide);
export const insertOtpVerificationSchema = createInsertSchema(otpVerifications);
export const insertSchemesOffersSchema = createInsertSchema(schemesOffers);
export const insertMasonOnSchemeSchema = createInsertSchema(masonOnScheme);
export const insertMasonsOnMeetingsSchema = createInsertSchema(masonsOnMeetings);

export const insertRewardCategorySchema = createInsertSchema(rewardCategories);
export const insertKycSubmissionSchema = createInsertSchema(kycSubmissions);
export const insertTsoAssignmentSchema = createInsertSchema(tsoAssignments);
export const insertBagLiftSchema = createInsertSchema(bagLifts);
export const insertPointsLedgerSchema = createInsertSchema(pointsLedger);
export const insertRewardRedemptionSchema = createInsertSchema(rewardRedemptions);
export const insertTechnicalSiteSchema = createInsertSchema(technicalSites);
export const insertSchemeSlabsSchema = createInsertSchema(schemeSlabs);
export const insertMasonSlabAchievementSchema = createInsertSchema(masonSlabAchievements);
export const insertNotificationSchema = createInsertSchema(notifications);

// Joins
export const insertDealerAssociatedMasonsSchema = createInsertSchema(dealerAssociatedMasons);
export const insertSiteAssociatedDealersSchema = createInsertSchema(siteAssociatedDealers);
export const insertSiteAssociatedMasonsSchema = createInsertSchema(siteAssociatedMasons);
export const insertSiteAssociatedUsersSchema = createInsertSchema(siteAssociatedUsers);
export const insertSchemeToRewardsSchema = createInsertSchema(schemeToRewards);

// logistics
export const insertLogisticsUsersSchema = createInsertSchema(logisticsUsers);
export const insertLogisticsIOSchema = createInsertSchema(logisticsIO);

//emailStuff
export const insertEmailReportSchema = createInsertSchema(emailReports);
export const insertCollectionReportsSchema = createInsertSchema(collectionReports);
export const insertOutstandingReportsSchema = createInsertSchema(outstandingReports);
export const insertVerifiedDealersSchema = createInsertSchema(verifiedDealers);
export const insertProjectionVsActualReportsSchema = createInsertSchema(projectionVsActualReports);
export const insertProjectionReportsSchema = createInsertSchema(projectionReports);

/* ================================= XXXXXXXXXXX ================================ */
/* ========================= drizzle-zod select schemas ========================= */
/* ================================= XXXXXXXXXXX ================================ */

export const selectCompanySchema = createSelectSchema(companies);
export const selectUserSchema = createSelectSchema(users);
export const selectDailyVisitReportSchema = createSelectSchema(dailyVisitReports);
export const selectTechnicalVisitReportSchema = createSelectSchema(technicalVisitReports);
export const selectPermanentJourneyPlanSchema = createSelectSchema(permanentJourneyPlans);
export const selectDealerSchema = createSelectSchema(dealers);
export const selectSalesPromoterSchema = createSelectSchema(salesPromoters);
export const selectSalesmanAttendanceSchema = createSelectSchema(salesmanAttendance);
export const selectSalesmanLeaveApplicationSchema = createSelectSchema(salesmanLeaveApplications);
export const selectCompetitionReportSchema = createSelectSchema(competitionReports);
export const selectDailyTaskSchema = createSelectSchema(dailyTasks);
export const selectDealerReportsAndScoresSchema = createSelectSchema(dealerReportsAndScores);
export const selectRatingSchema = createSelectSchema(ratings);
export const selectSalesOrderSchema = createSelectSchema(salesOrders);
export const selectBrandSchema = createSelectSchema(brands);
export const selectDealerBrandMappingSchema = createSelectSchema(dealerBrandMapping);
export const selectTsoMeetingSchema = createSelectSchema(tsoMeetings);
export const selectAuthSessionsSchema = createSelectSchema(authSessions);

// journey + geotracking
export const selectGeoTrackingSchema = createSelectSchema(geoTracking);
export const selectJourneyOpsSchema = createSelectSchema(journeyOps);
export const selectJourneysSchema = createSelectSchema(journeys);
export const selectJourneyBreadcrumbsSchema = createSelectSchema(journeyBreadcrumbs);
export const selectSyncStateSchema = createSelectSchema(syncState);

// Changed giftInventory to rewards
export const selectRewardsSchema = createSelectSchema(rewards);
export const selectGiftAllocationLogSchema = createSelectSchema(giftAllocationLogs);

// Modified masonPcSide schema
export const selectMasonPcSideSchema = createSelectSchema(masonPcSide);
export const selectOtpVerificationSchema = createSelectSchema(otpVerifications);
export const selectSchemesOffersSchema = createSelectSchema(schemesOffers);
export const selectMasonOnSchemeSchema = createSelectSchema(masonOnScheme);
export const selectMasonsOnMeetingsSchema = createSelectSchema(masonsOnMeetings);

export const selectRewardCategorySchema = createSelectSchema(rewardCategories);
export const selectKycSubmissionSchema = createSelectSchema(kycSubmissions);
export const selectTsoAssignmentSchema = createSelectSchema(tsoAssignments);
export const selectBagLiftSchema = createSelectSchema(bagLifts);
export const selectPointsLedgerSchema = createSelectSchema(pointsLedger);
export const selectRewardRedemptionSchema = createSelectSchema(rewardRedemptions);
export const selectTechnicalSiteSchema = createSelectSchema(technicalSites);
export const selectSchemeSlabsSchema = createSelectSchema(schemeSlabs);
export const selectMasonSlabAchievementSchema = createSelectSchema(masonSlabAchievements);
export const selectNotificationSchema = createSelectSchema(notifications);

// Joins
export const selectDealerAssociatedMasonsSchema = createSelectSchema(dealerAssociatedMasons);
export const selectSiteAssociatedDealersSchema = createSelectSchema(siteAssociatedDealers);
export const selectSiteAssociatedMasonsSchema = createSelectSchema(siteAssociatedMasons);
export const selectSiteAssociatedUsersSchema = createSelectSchema(siteAssociatedUsers);
export const selectSchemeToRewardsSchema = createSelectSchema(schemeToRewards);

// logistics
export const selectLogisticsUsersSchema = createSelectSchema(logisticsUsers);
export const selectLogisticsIOSchema = createSelectSchema(logisticsIO);

//emailStuff
export const selectEmailReportSchema = createSelectSchema(emailReports);
export const selectCollectionReportsSchema = createSelectSchema(collectionReports);
export const selectOutstandingReportsSchema = createSelectSchema(outstandingReports);
export const selectVerifiedDealersSchema = createSelectSchema(verifiedDealers);
export const selectProjectionVsActualReportsSchema = createSelectSchema(projectionVsActualReports);
export const selectProjectionReportsSchema = createSelectSchema(projectionReports);