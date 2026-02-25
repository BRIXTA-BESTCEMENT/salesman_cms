import { relations } from "drizzle-orm/relations";
import { dealers, dealerReportsAndScores, users, technicalVisitReports, permanentJourneyPlans, technicalSites, 
    companies, ratings, dealerBrandMapping, brands, verifiedDealers, dailyVisitReports, 
    salesmanLeaveApplications, salesmanAttendance, competitionReports, geoTracking, journeys, 
    giftAllocationLogs, rewards, dailyTasks, salesOrders, masonPcSide, otpVerifications, 
    authSessions, rewardRedemptions, pointsLedger, kycSubmissions, rewardCategories, 
    schemesOffers, schemeSlabs, masonSlabAchievements, dealerAssociatedMasons, bagLifts, 
    siteAssociatedDealers, siteAssociatedMasons, siteAssociatedUsers, tsoAssignments,
    outstandingReports,masonsOnMeetings, masonOnScheme, notifications, 
    schemeToRewards, journeyOps, tsoMeetings, journeyBreadcrumbs, 
    projectionVsActualReports, collectionReports, emailReports, projectionReports, 
} from "./schema";

export const dealerReportsAndScoresRelations = relations(dealerReportsAndScores, ({one}) => ({
	dealer: one(dealers, {
		fields: [dealerReportsAndScores.dealerId],
		references: [dealers.id]
	}),
}));

export const dealersRelations = relations(dealers, ({one, many}) => ({
	dealerReportsAndScores: many(dealerReportsAndScores),
	dealerBrandMappings: many(dealerBrandMapping),
	dailyVisitReports_dealerId: many(dailyVisitReports, {
		relationName: "dailyVisitReports_dealerId_dealers_id"
	}),
	dailyVisitReports_subDealerId: many(dailyVisitReports, {
		relationName: "dailyVisitReports_subDealerId_dealers_id"
	}),
	permanentJourneyPlans: many(permanentJourneyPlans),
	geoTrackings: many(geoTracking),
	dailyTasks: many(dailyTasks),
	user: one(users, {
		fields: [dealers.userId],
		references: [users.id]
	}),
	dealer: one(dealers, {
		fields: [dealers.parentDealerId],
		references: [dealers.id],
		relationName: "dealers_parentDealerId_dealers_id"
	}),
	dealers: many(dealers, {
		relationName: "dealers_parentDealerId_dealers_id"
	}),
	salesOrders: many(salesOrders),
	masonPcSides: many(masonPcSide),
	dealerAssociatedMasons: many(dealerAssociatedMasons),
	bagLifts: many(bagLifts),
	siteAssociatedDealers: many(siteAssociatedDealers),
	verifiedDealers: many(verifiedDealers),
}));

export const technicalVisitReportsRelations = relations(technicalVisitReports, ({one}) => ({
	user: one(users, {
		fields: [technicalVisitReports.userId],
		references: [users.id]
	}),
	permanentJourneyPlan: one(permanentJourneyPlans, {
		fields: [technicalVisitReports.pjpId],
		references: [permanentJourneyPlans.id]
	}),
	technicalSite: one(technicalSites, {
		fields: [technicalVisitReports.siteId],
		references: [technicalSites.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	technicalVisitReports: many(technicalVisitReports),
	company: one(companies, {
		fields: [users.companyId],
		references: [companies.id]
	}),
	user: one(users, {
		fields: [users.reportsToId],
		references: [users.id],
		relationName: "users_reportsToId_users_id"
	}),
	users: many(users, {
		relationName: "users_reportsToId_users_id"
	}),
	ratings: many(ratings),
	dealerBrandMappings: many(dealerBrandMapping),
	dailyVisitReports: many(dailyVisitReports),
	permanentJourneyPlans_userId: many(permanentJourneyPlans, {
		relationName: "permanentJourneyPlans_userId_users_id"
	}),
	permanentJourneyPlans_createdById: many(permanentJourneyPlans, {
		relationName: "permanentJourneyPlans_createdById_users_id"
	}),
	salesmanLeaveApplications: many(salesmanLeaveApplications),
	salesmanAttendances: many(salesmanAttendance),
	competitionReports: many(competitionReports),
	geoTrackings: many(geoTracking),
	giftAllocationLogs_userId: many(giftAllocationLogs, {
		relationName: "giftAllocationLogs_userId_users_id"
	}),
	giftAllocationLogs_sourceUserId: many(giftAllocationLogs, {
		relationName: "giftAllocationLogs_sourceUserId_users_id"
	}),
	giftAllocationLogs_destinationUserId: many(giftAllocationLogs, {
		relationName: "giftAllocationLogs_destinationUserId_users_id"
	}),
	dailyTasks_userId: many(dailyTasks, {
		relationName: "dailyTasks_userId_users_id"
	}),
	dailyTasks_assignedByUserId: many(dailyTasks, {
		relationName: "dailyTasks_assignedByUserId_users_id"
	}),
	dealers: many(dealers),
	salesOrders: many(salesOrders),
	masonPcSides: many(masonPcSide),
	bagLifts: many(bagLifts),
	siteAssociatedUsers: many(siteAssociatedUsers),
	notifications: many(notifications),
	journeyOps: many(journeyOps),
	tsoMeetings: many(tsoMeetings),
	journeys: many(journeys),
	projectionVsActualReports: many(projectionVsActualReports),
	collectionReports_salesPromoterUserId: many(collectionReports, {
		relationName: "collectionReports_salesPromoterUserId_users_id"
	}),
	collectionReports_userId: many(collectionReports, {
		relationName: "collectionReports_userId_users_id"
	}),
	projectionReports: many(projectionReports),
	verifiedDealers: many(verifiedDealers),
}));

export const permanentJourneyPlansRelations = relations(permanentJourneyPlans, ({one, many}) => ({
	technicalVisitReports: many(technicalVisitReports),
	dailyVisitReports: many(dailyVisitReports),
	dealer: one(dealers, {
		fields: [permanentJourneyPlans.dealerId],
		references: [dealers.id]
	}),
	user_userId: one(users, {
		fields: [permanentJourneyPlans.userId],
		references: [users.id],
		relationName: "permanentJourneyPlans_userId_users_id"
	}),
	user_createdById: one(users, {
		fields: [permanentJourneyPlans.createdById],
		references: [users.id],
		relationName: "permanentJourneyPlans_createdById_users_id"
	}),
	technicalSite: one(technicalSites, {
		fields: [permanentJourneyPlans.siteId],
		references: [technicalSites.id]
	}),
	dailyTasks: many(dailyTasks),
	salesOrders: many(salesOrders),
}));

export const technicalSitesRelations = relations(technicalSites, ({many}) => ({
	technicalVisitReports: many(technicalVisitReports),
	permanentJourneyPlans: many(permanentJourneyPlans),
	geoTrackings: many(geoTracking),
	dailyTasks: many(dailyTasks),
	bagLifts: many(bagLifts),
	siteAssociatedDealers: many(siteAssociatedDealers),
	siteAssociatedMasons: many(siteAssociatedMasons),
	siteAssociatedUsers: many(siteAssociatedUsers),
	tsoMeetings: many(tsoMeetings),
	masonOnSchemes: many(masonOnScheme),
}));

export const companiesRelations = relations(companies, ({many}) => ({
	users: many(users),
}));

export const ratingsRelations = relations(ratings, ({one}) => ({
	user: one(users, {
		fields: [ratings.userId],
		references: [users.id]
	}),
}));

export const dealerBrandMappingRelations = relations(dealerBrandMapping, ({one}) => ({
	user: one(users, {
		fields: [dealerBrandMapping.userId],
		references: [users.id]
	}),
	dealer: one(dealers, {
		fields: [dealerBrandMapping.dealerId],
		references: [dealers.id]
	}),
	brand: one(brands, {
		fields: [dealerBrandMapping.brandId],
		references: [brands.id]
	}),
	verifiedDealer: one(verifiedDealers, {
		fields: [dealerBrandMapping.verifiedDealerId],
		references: [verifiedDealers.id]
	}),
}));

export const brandsRelations = relations(brands, ({many}) => ({
	dealerBrandMappings: many(dealerBrandMapping),
}));

export const verifiedDealersRelations = relations(verifiedDealers, ({one, many}) => ({
	dealerBrandMappings: many(dealerBrandMapping),
	dailyTasks: many(dailyTasks),
	projectionVsActualReports: many(projectionVsActualReports),
	collectionReports: many(collectionReports),
	projectionReports: many(projectionReports),
	outstandingReports: many(outstandingReports),
}));

export const dailyVisitReportsRelations = relations(dailyVisitReports, ({one, many}) => ({
	dealer_dealerId: one(dealers, {
		fields: [dailyVisitReports.dealerId],
		references: [dealers.id],
		relationName: "dailyVisitReports_dealerId_dealers_id"
	}),
	dealer_subDealerId: one(dealers, {
		fields: [dailyVisitReports.subDealerId],
		references: [dealers.id],
		relationName: "dailyVisitReports_subDealerId_dealers_id"
	}),
	user: one(users, {
		fields: [dailyVisitReports.userId],
		references: [users.id]
	}),
	permanentJourneyPlan: one(permanentJourneyPlans, {
		fields: [dailyVisitReports.pjpId],
		references: [permanentJourneyPlans.id]
	}),
	salesOrders: many(salesOrders),
	outstandingReports: many(outstandingReports),
}));

export const salesmanLeaveApplicationsRelations = relations(salesmanLeaveApplications, ({one}) => ({
	user: one(users, {
		fields: [salesmanLeaveApplications.userId],
		references: [users.id]
	}),
}));

export const salesmanAttendanceRelations = relations(salesmanAttendance, ({one}) => ({
	user: one(users, {
		fields: [salesmanAttendance.userId],
		references: [users.id]
	}),
}));

export const competitionReportsRelations = relations(competitionReports, ({one}) => ({
	user: one(users, {
		fields: [competitionReports.userId],
		references: [users.id]
	}),
}));

export const geoTrackingRelations = relations(geoTracking, ({one}) => ({
	user: one(users, {
		fields: [geoTracking.userId],
		references: [users.id]
	}),
	technicalSite: one(technicalSites, {
		fields: [geoTracking.siteId],
		references: [technicalSites.id]
	}),
	dealer: one(dealers, {
		fields: [geoTracking.dealerId],
		references: [dealers.id]
	}),
	journey: one(journeys, {
		fields: [geoTracking.linkedJourneyId],
		references: [journeys.id]
	}),
}));

export const journeysRelations = relations(journeys, ({one, many}) => ({
	geoTrackings: many(geoTracking),
	journeyBreadcrumbs: many(journeyBreadcrumbs),
	user: one(users, {
		fields: [journeys.userId],
		references: [users.id]
	}),
}));

export const giftAllocationLogsRelations = relations(giftAllocationLogs, ({one}) => ({
	user_userId: one(users, {
		fields: [giftAllocationLogs.userId],
		references: [users.id],
		relationName: "giftAllocationLogs_userId_users_id"
	}),
	user_sourceUserId: one(users, {
		fields: [giftAllocationLogs.sourceUserId],
		references: [users.id],
		relationName: "giftAllocationLogs_sourceUserId_users_id"
	}),
	user_destinationUserId: one(users, {
		fields: [giftAllocationLogs.destinationUserId],
		references: [users.id],
		relationName: "giftAllocationLogs_destinationUserId_users_id"
	}),
	reward: one(rewards, {
		fields: [giftAllocationLogs.rewardId],
		references: [rewards.id]
	}),
}));

export const rewardsRelations = relations(rewards, ({one, many}) => ({
	giftAllocationLogs: many(giftAllocationLogs),
	rewardRedemptions: many(rewardRedemptions),
	rewardCategory: one(rewardCategories, {
		fields: [rewards.categoryId],
		references: [rewardCategories.id]
	}),
	schemeSlabs: many(schemeSlabs),
	schemeToRewards: many(schemeToRewards),
}));

export const dailyTasksRelations = relations(dailyTasks, ({one}) => ({
	user_userId: one(users, {
		fields: [dailyTasks.userId],
		references: [users.id],
		relationName: "dailyTasks_userId_users_id"
	}),
	dealer: one(dealers, {
		fields: [dailyTasks.dealerId],
		references: [dealers.id]
	}),
}));

export const salesOrdersRelations = relations(salesOrders, ({one}) => ({
	user: one(users, {
		fields: [salesOrders.userId],
		references: [users.id]
	}),
	dealer: one(dealers, {
		fields: [salesOrders.dealerId],
		references: [dealers.id]
	}),
	dailyVisitReport: one(dailyVisitReports, {
		fields: [salesOrders.dvrId],
		references: [dailyVisitReports.id]
	}),
	permanentJourneyPlan: one(permanentJourneyPlans, {
		fields: [salesOrders.pjpId],
		references: [permanentJourneyPlans.id]
	}),
}));

export const otpVerificationsRelations = relations(otpVerifications, ({one}) => ({
	masonPcSide: one(masonPcSide, {
		fields: [otpVerifications.masonId],
		references: [masonPcSide.id]
	}),
}));

export const masonPcSideRelations = relations(masonPcSide, ({one, many}) => ({
	otpVerifications: many(otpVerifications),
	dealer: one(dealers, {
		fields: [masonPcSide.dealerId],
		references: [dealers.id]
	}),
	user: one(users, {
		fields: [masonPcSide.userId],
		references: [users.id]
	}),
	authSessions: many(authSessions),
	rewardRedemptions: many(rewardRedemptions),
	pointsLedgers: many(pointsLedger),
	kycSubmissions: many(kycSubmissions),
	masonSlabAchievements: many(masonSlabAchievements),
	dealerAssociatedMasons: many(dealerAssociatedMasons),
	bagLifts: many(bagLifts),
	siteAssociatedMasons: many(siteAssociatedMasons),
	masonsOnMeetings: many(masonsOnMeetings),
	masonOnSchemes: many(masonOnScheme),
}));

export const authSessionsRelations = relations(authSessions, ({one}) => ({
	masonPcSide: one(masonPcSide, {
		fields: [authSessions.masonId],
		references: [masonPcSide.id]
	}),
}));

export const rewardRedemptionsRelations = relations(rewardRedemptions, ({one}) => ({
	masonPcSide: one(masonPcSide, {
		fields: [rewardRedemptions.masonId],
		references: [masonPcSide.id]
	}),
	reward: one(rewards, {
		fields: [rewardRedemptions.rewardId],
		references: [rewards.id]
	}),
}));

export const pointsLedgerRelations = relations(pointsLedger, ({one}) => ({
	masonPcSide: one(masonPcSide, {
		fields: [pointsLedger.masonId],
		references: [masonPcSide.id]
	}),
}));

export const kycSubmissionsRelations = relations(kycSubmissions, ({one}) => ({
	masonPcSide: one(masonPcSide, {
		fields: [kycSubmissions.masonId],
		references: [masonPcSide.id]
	}),
}));

export const rewardCategoriesRelations = relations(rewardCategories, ({many}) => ({
	rewards: many(rewards),
}));

export const schemeSlabsRelations = relations(schemeSlabs, ({one, many}) => ({
	schemesOffer: one(schemesOffers, {
		fields: [schemeSlabs.schemeId],
		references: [schemesOffers.id]
	}),
	reward: one(rewards, {
		fields: [schemeSlabs.rewardId],
		references: [rewards.id]
	}),
	masonSlabAchievements: many(masonSlabAchievements),
}));

export const schemesOffersRelations = relations(schemesOffers, ({many}) => ({
	schemeSlabs: many(schemeSlabs),
	schemeToRewards: many(schemeToRewards),
	masonOnSchemes: many(masonOnScheme),
}));

export const masonSlabAchievementsRelations = relations(masonSlabAchievements, ({one}) => ({
	masonPcSide: one(masonPcSide, {
		fields: [masonSlabAchievements.masonId],
		references: [masonPcSide.id]
	}),
	schemeSlab: one(schemeSlabs, {
		fields: [masonSlabAchievements.schemeSlabId],
		references: [schemeSlabs.id]
	}),
}));

export const dealerAssociatedMasonsRelations = relations(dealerAssociatedMasons, ({one}) => ({
	dealer: one(dealers, {
		fields: [dealerAssociatedMasons.a],
		references: [dealers.id]
	}),
	masonPcSide: one(masonPcSide, {
		fields: [dealerAssociatedMasons.b],
		references: [masonPcSide.id]
	}),
}));

export const tsoAssignmentsRelations = relations(tsoAssignments, ({ one }) => ({
  tso: one(users, {
    fields: [tsoAssignments.tsoId],
    references: [users.id],
  }),
  mason: one(masonPcSide, {
    fields: [tsoAssignments.masonId],
    references: [masonPcSide.id],
  }),
}));

export const bagLiftsRelations = relations(bagLifts, ({one}) => ({
	masonPcSide: one(masonPcSide, {
		fields: [bagLifts.masonId],
		references: [masonPcSide.id]
	}),
	dealer: one(dealers, {
		fields: [bagLifts.dealerId],
		references: [dealers.id]
	}),
	user: one(users, {
		fields: [bagLifts.approvedBy],
		references: [users.id]
	}),
	technicalSite: one(technicalSites, {
		fields: [bagLifts.siteId],
		references: [technicalSites.id]
	}),
}));

export const siteAssociatedDealersRelations = relations(siteAssociatedDealers, ({one}) => ({
	dealer: one(dealers, {
		fields: [siteAssociatedDealers.a],
		references: [dealers.id]
	}),
	technicalSite: one(technicalSites, {
		fields: [siteAssociatedDealers.b],
		references: [technicalSites.id]
	}),
}));

export const siteAssociatedMasonsRelations = relations(siteAssociatedMasons, ({one}) => ({
	masonPcSide: one(masonPcSide, {
		fields: [siteAssociatedMasons.a],
		references: [masonPcSide.id]
	}),
	technicalSite: one(technicalSites, {
		fields: [siteAssociatedMasons.b],
		references: [technicalSites.id]
	}),
}));

export const siteAssociatedUsersRelations = relations(siteAssociatedUsers, ({one}) => ({
	technicalSite: one(technicalSites, {
		fields: [siteAssociatedUsers.a],
		references: [technicalSites.id]
	}),
	user: one(users, {
		fields: [siteAssociatedUsers.b],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.recipientUserId],
		references: [users.id]
	}),
}));

export const schemeToRewardsRelations = relations(schemeToRewards, ({one}) => ({
	reward: one(rewards, {
		fields: [schemeToRewards.a],
		references: [rewards.id]
	}),
	schemesOffer: one(schemesOffers, {
		fields: [schemeToRewards.b],
		references: [schemesOffers.id]
	}),
}));

export const journeyOpsRelations = relations(journeyOps, ({one}) => ({
	user: one(users, {
		fields: [journeyOps.userId],
		references: [users.id]
	}),
}));

export const tsoMeetingsRelations = relations(tsoMeetings, ({one, many}) => ({
	user: one(users, {
		fields: [tsoMeetings.createdByUserId],
		references: [users.id]
	}),
	technicalSite: one(technicalSites, {
		fields: [tsoMeetings.siteId],
		references: [technicalSites.id]
	}),
	masonsOnMeetings: many(masonsOnMeetings),
}));

export const journeyBreadcrumbsRelations = relations(journeyBreadcrumbs, ({one}) => ({
	journey: one(journeys, {
		fields: [journeyBreadcrumbs.journeyId],
		references: [journeys.id]
	}),
}));

export const projectionVsActualReportsRelations = relations(projectionVsActualReports, ({one}) => ({
	verifiedDealer: one(verifiedDealers, {
		fields: [projectionVsActualReports.verifiedDealerId],
		references: [verifiedDealers.id]
	}),
	user: one(users, {
		fields: [projectionVsActualReports.userId],
		references: [users.id]
	}),
}));

export const collectionReportsRelations = relations(collectionReports, ({one, many}) => ({
	user_salesPromoterUserId: one(users, {
		fields: [collectionReports.salesPromoterUserId],
		references: [users.id],
		relationName: "collectionReports_salesPromoterUserId_users_id"
	}),
	verifiedDealer: one(verifiedDealers, {
		fields: [collectionReports.verifiedDealerId],
		references: [verifiedDealers.id]
	}),
	user_userId: one(users, {
		fields: [collectionReports.userId],
		references: [users.id],
		relationName: "collectionReports_userId_users_id"
	}),
	emailReport: one(emailReports, {
		fields: [collectionReports.emailReportId],
		references: [emailReports.id]
	}),
	outstandingReports: many(outstandingReports),
}));

export const emailReportsRelations = relations(emailReports, ({many}) => ({
	collectionReports: many(collectionReports),
	projectionReports: many(projectionReports),
	outstandingReports: many(outstandingReports),
}));

export const projectionReportsRelations = relations(projectionReports, ({one}) => ({
	verifiedDealer: one(verifiedDealers, {
		fields: [projectionReports.verifiedDealerId],
		references: [verifiedDealers.id]
	}),
	user: one(users, {
		fields: [projectionReports.userId],
		references: [users.id]
	}),
	emailReport: one(emailReports, {
		fields: [projectionReports.emailReportId],
		references: [emailReports.id]
	}),
}));

export const outstandingReportsRelations = relations(outstandingReports, ({one}) => ({
	verifiedDealer: one(verifiedDealers, {
		fields: [outstandingReports.verifiedDealerId],
		references: [verifiedDealers.id]
	}),
	collectionReport: one(collectionReports, {
		fields: [outstandingReports.collectionReportId],
		references: [collectionReports.id]
	}),
	dailyVisitReport: one(dailyVisitReports, {
		fields: [outstandingReports.dvrId],
		references: [dailyVisitReports.id]
	}),
	emailReport: one(emailReports, {
		fields: [outstandingReports.emailReportId],
		references: [emailReports.id]
	}),
}));

export const masonsOnMeetingsRelations = relations(masonsOnMeetings, ({one}) => ({
	masonPcSide: one(masonPcSide, {
		fields: [masonsOnMeetings.masonId],
		references: [masonPcSide.id]
	}),
	tsoMeeting: one(tsoMeetings, {
		fields: [masonsOnMeetings.meetingId],
		references: [tsoMeetings.id]
	}),
}));

export const masonOnSchemeRelations = relations(masonOnScheme, ({one}) => ({
	masonPcSide: one(masonPcSide, {
		fields: [masonOnScheme.masonId],
		references: [masonPcSide.id]
	}),
	schemesOffer: one(schemesOffers, {
		fields: [masonOnScheme.schemeId],
		references: [schemesOffers.id]
	}),
	technicalSite: one(technicalSites, {
		fields: [masonOnScheme.siteId],
		references: [technicalSites.id]
	}),
}));