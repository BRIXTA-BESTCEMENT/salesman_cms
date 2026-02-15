// src/lib/permissions.ts
export type WorkOSRole =
  | 'president'
  | 'senior-general-manager'
  | 'general-manager'
  | 'regional-sales-manager'
  | 'area-sales-manager'
  | 'senior-manager'
  | 'manager'
  | 'assistant-manager'
  | 'senior-executive'
  | 'executive'
  | 'junior-executive';

export interface DashboardPermissions {
  // Home section
  home: boolean;
  cemtemChat: boolean;
  customReportGenerator: boolean;

  // Business Dashboard section
  dashboard: boolean;
  usersAndTeam: {
    userManagement: boolean;
    teamOverview: boolean;
  };
  assignTasks: boolean;
  dealerManagement: {
    addAndListDealers: boolean,
    listDealers: boolean;
    listVerifiedDealers: boolean;
    verifyDealers: boolean;
    dealerBrandMapping: boolean;
  };
  technicalSites: {
    listSites: boolean;
  };
  reports: {
    dailyVisitReports: boolean;
    technicalVisitReports: boolean;
    competitionReports: boolean;
    salesOrders: boolean;
    dvrVpjp: boolean;
    tvrVpjp: boolean;
    salesVdvr: boolean;
  };
  permanentJourneyPlan: {
    pjpList: boolean;
    pjpVerify: boolean;
  };
  salesmanAttendance: boolean;
  salesmanLeaves: boolean;
  salesmanGeotracking: {
    slmGeotracking: boolean;
    salesmanLiveLocation: boolean;
  };
  masonpcSide: {
    masonpc: boolean;
    tsoMeetings: boolean;
    schemesOffers: boolean;
    masonOnSchemes: boolean;
    masonOnMeetings: boolean;
    bagsLift: boolean;
    pointsLedger: boolean;
    rewardsRedemption: boolean;
  };
  scoresAndRatings: {
    dealerScores: boolean;
    salesmanRatings: boolean;
  };
  logisticsIO: {
    records: boolean;
  };

  // Account section
  account: boolean;
  raiseAQuery: boolean;
}

export const WORKOS_ROLE_PERMISSIONS: Record<WorkOSRole, DashboardPermissions> = {
  // Executive Roles
  president: {
    home: true,
    cemtemChat: true,
    customReportGenerator: true,
    dashboard: true,
    usersAndTeam: {
      userManagement: true,
      teamOverview: true,
    },
    assignTasks: true,
    dealerManagement: {
      addAndListDealers: false,
      listDealers: true,
      listVerifiedDealers: true,
      verifyDealers: true,
      dealerBrandMapping: true,
    },
    technicalSites: {
      listSites: true,
    },
    reports: {
      dailyVisitReports: true,
      technicalVisitReports: true,
      competitionReports: true,
      salesOrders: true,
      dvrVpjp: true,
      tvrVpjp: true,
      salesVdvr: true,
    },
    permanentJourneyPlan: {
      pjpList: true,
      pjpVerify: true,
    },
    salesmanAttendance: true,
    salesmanLeaves: true,
    salesmanGeotracking: {
      slmGeotracking: true,
      salesmanLiveLocation: true,
    },
    masonpcSide: {
      masonpc: true,
      tsoMeetings: true,
      schemesOffers: true,
      masonOnSchemes: true,
      masonOnMeetings: true,
      bagsLift: true,
      pointsLedger: true,
      rewardsRedemption: true,
    },
    scoresAndRatings: {
      dealerScores: true,
      salesmanRatings: true,
    },
    logisticsIO: {
      records: true,
    },
    account: true,
    raiseAQuery: true,
  },
  'senior-general-manager': {
    home: true,
    cemtemChat: true,
    customReportGenerator: true,
    dashboard: true,
    usersAndTeam: {
      userManagement: true,
      teamOverview: true,
    },
    assignTasks: true,
    dealerManagement: {
      addAndListDealers: false,
      listDealers: true,
      listVerifiedDealers: true,
      verifyDealers: true,
      dealerBrandMapping: true,
    },
    technicalSites: {
      listSites: true,
    },
    reports: {
      dailyVisitReports: true,
      technicalVisitReports: true,
      competitionReports: true,
      salesOrders: true,
      dvrVpjp: true,
      tvrVpjp: true,
      salesVdvr: true,
    },
    permanentJourneyPlan: {
      pjpList: true,
      pjpVerify: true,
    },
    salesmanAttendance: true,
    salesmanLeaves: true,
    salesmanGeotracking: {
      slmGeotracking: true,
      salesmanLiveLocation: true,
    },
    masonpcSide: {
      masonpc: true,
      tsoMeetings: true,
      schemesOffers: true,
      masonOnSchemes: true,
      masonOnMeetings: true,
      bagsLift: true,
      pointsLedger: true,
      rewardsRedemption: true,
    },
    scoresAndRatings: {
      dealerScores: true,
      salesmanRatings: true,
    },
    logisticsIO: {
      records: true,
    },
    account: true,
    raiseAQuery: true,
  },
  'general-manager': {
    home: true,
    cemtemChat: true,
    customReportGenerator: true,
    dashboard: true,
    usersAndTeam: {
      userManagement: true,
      teamOverview: true,
    },
    assignTasks: true,
    dealerManagement: {
      addAndListDealers: false,
      listDealers: true,
      listVerifiedDealers: true,
      verifyDealers: true,
      dealerBrandMapping: true,
    },
    technicalSites: {
      listSites: true,
    },
    reports: {
      dailyVisitReports: true,
      technicalVisitReports: true,
      competitionReports: true,
      salesOrders: true,
      dvrVpjp: true,
      tvrVpjp: true,
      salesVdvr: true,
    },
    permanentJourneyPlan: {
      pjpList: true,
      pjpVerify: true,
    },
    salesmanAttendance: true,
    salesmanLeaves: true,
    salesmanGeotracking: {
      slmGeotracking: true,
      salesmanLiveLocation: true,
    },
    masonpcSide: {
      masonpc: true,
      tsoMeetings: true,
      schemesOffers: true,
      masonOnSchemes: true,
      masonOnMeetings: true,
      bagsLift: true,
      pointsLedger: true,
      rewardsRedemption: true,
    },
    scoresAndRatings: {
      dealerScores: true,
      salesmanRatings: true,
    },
    logisticsIO: {
      records: true,
    },
    account: true,
    raiseAQuery: true,
  },

  // Managerial Roles
  'regional-sales-manager': {
    home: true,
    cemtemChat: true,
    customReportGenerator: true,
    dashboard: true,
    usersAndTeam: {
      userManagement: true,
      teamOverview: true,
    },
    assignTasks: true,
    dealerManagement: {
      addAndListDealers: false,
      listDealers: true,
      listVerifiedDealers: true,
      verifyDealers: true,
      dealerBrandMapping: true,
    },
    technicalSites: {
      listSites: true,
    },
    reports: {
      dailyVisitReports: true,
      technicalVisitReports: true,
      competitionReports: true,
      salesOrders: true,
      dvrVpjp: true,
      tvrVpjp: true,
      salesVdvr: true,
    },
    permanentJourneyPlan: {
      pjpList: true,
      pjpVerify: true,
    },
    salesmanAttendance: true,
    salesmanLeaves: true,
    salesmanGeotracking: {
      slmGeotracking: true,
      salesmanLiveLocation: true,
    },
    masonpcSide: {
      masonpc: true,
      tsoMeetings: true,
      schemesOffers: true,
      masonOnSchemes: true,
      masonOnMeetings: true,
      bagsLift: true,
      pointsLedger: true,
      rewardsRedemption: true,
    },
    scoresAndRatings: {
      dealerScores: true,
      salesmanRatings: true,
    },
    logisticsIO: {
      records: true,
    },
    account: true,
    raiseAQuery: true,
  },
  'area-sales-manager': {
    home: true,
    cemtemChat: true,
    customReportGenerator: true,
    dashboard: true,
    usersAndTeam: {
      userManagement: true,
      teamOverview: true,
    },
    assignTasks: true,
    dealerManagement: {
      addAndListDealers: false,
      listDealers: true,
      listVerifiedDealers: true,
      verifyDealers: true,
      dealerBrandMapping: true,
    },
    technicalSites: {
      listSites: true,
    },
    reports: {
      dailyVisitReports: true,
      technicalVisitReports: true,
      competitionReports: true,
      salesOrders: true,
      dvrVpjp: true,
      tvrVpjp: true,
      salesVdvr: true,
    },
    permanentJourneyPlan: {
      pjpList: true,
      pjpVerify: true,
    },
    salesmanAttendance: true,
    salesmanLeaves: true,
    salesmanGeotracking: {
      slmGeotracking: true,
      salesmanLiveLocation: true,
    },
    masonpcSide: {
      masonpc: true,
      tsoMeetings: true,
      schemesOffers: true,
      masonOnSchemes: true,
      masonOnMeetings: true,
      bagsLift: true,
      pointsLedger: true,
      rewardsRedemption: true,
    },
    scoresAndRatings: {
      dealerScores: true,
      salesmanRatings: true,
    },
    logisticsIO: {
      records: true,
    },
    account: true,
    raiseAQuery: true,
  },
  'senior-manager': {     //Default role assigned when company is created(has all permissions)
    home: true,
    cemtemChat: true,
    customReportGenerator: true,
    dashboard: true,
    usersAndTeam: {
      userManagement: true,
      teamOverview: true,
    },
    assignTasks: true,
    dealerManagement: {
      addAndListDealers: false,
      listDealers: true,
      listVerifiedDealers: true,
      verifyDealers: true,
      dealerBrandMapping: true,
    },
    technicalSites: {
      listSites: true,
    },
    reports: {
      dailyVisitReports: true,
      technicalVisitReports: true,
      competitionReports: true,
      salesOrders: true,
      dvrVpjp: true,
      tvrVpjp: true,
      salesVdvr: true,
    },
    permanentJourneyPlan: {
      pjpList: true,
      pjpVerify: true,
    },
    salesmanAttendance: true,
    salesmanLeaves: true,
    salesmanGeotracking: {
      slmGeotracking: true,
      salesmanLiveLocation: true,
    },
    masonpcSide: {
      masonpc: true,
      tsoMeetings: true,
      schemesOffers: true,
      masonOnSchemes: true,
      masonOnMeetings: true,
      bagsLift: true,
      pointsLedger: true,
      rewardsRedemption: true,
    },
    scoresAndRatings: {
      dealerScores: true,
      salesmanRatings: true,
    },
    logisticsIO: {
      records: true,
    },
    account: true,
    raiseAQuery: true,
  },
  manager: {
    home: true,
    cemtemChat: true,
    customReportGenerator: true,
    dashboard: true,
    usersAndTeam: {
      userManagement: true,
      teamOverview: true,
    },
    assignTasks: true,
    dealerManagement: {
      addAndListDealers: false,
      listDealers: true,
      listVerifiedDealers: true,
      verifyDealers: true,
      dealerBrandMapping: true,
    },
    technicalSites: {
      listSites: true,
    },
    reports: {
      dailyVisitReports: true,
      technicalVisitReports: true,
      competitionReports: true,
      salesOrders: true,
      dvrVpjp: true,
      tvrVpjp: true,
      salesVdvr: true,
    },
    permanentJourneyPlan: {
      pjpList: true,
      pjpVerify: true,
    },
    salesmanAttendance: true,
    salesmanLeaves: true,
    salesmanGeotracking: {
      slmGeotracking: true,
      salesmanLiveLocation: true,
    },
    masonpcSide: {
      masonpc: true,
      tsoMeetings: true,
      schemesOffers: true,
      masonOnSchemes: true,
      masonOnMeetings: true,
      bagsLift: true,
      pointsLedger: true,
      rewardsRedemption: true,
    },
    scoresAndRatings: {
      dealerScores: true,
      salesmanRatings: true,
    },
    logisticsIO: {
      records: true,
    },
    account: true,
    raiseAQuery: true,
  },
  'assistant-manager': {
    home: true,
    cemtemChat: true,
    customReportGenerator: true,
    dashboard: true,
    usersAndTeam: {
      userManagement: true,
      teamOverview: true,
    },
    assignTasks: true,
    dealerManagement: {
      addAndListDealers: false,
      listDealers: true,
      listVerifiedDealers: true,
      verifyDealers: true,
      dealerBrandMapping: true,
    },
    technicalSites: {
      listSites: true,
    },
    reports: {
      dailyVisitReports: true,
      technicalVisitReports: true,
      competitionReports: true,
      salesOrders: true,
      dvrVpjp: true,
      tvrVpjp: true,
      salesVdvr: true,
    },
    permanentJourneyPlan: {
      pjpList: true,
      pjpVerify: true,
    },
    salesmanAttendance: true,
    salesmanLeaves: true,
    salesmanGeotracking: {
      slmGeotracking: true,
      salesmanLiveLocation: true,
    },
    masonpcSide: {
      masonpc: true,
      tsoMeetings: true,
      schemesOffers: true,
      masonOnSchemes: true,
      masonOnMeetings: true,
      bagsLift: true,
      pointsLedger: true,
      rewardsRedemption: true,
    },
    scoresAndRatings: {
      dealerScores: true,
      salesmanRatings: true,
    },
    logisticsIO: {
      records: true,
    },
    account: true,
    raiseAQuery: true,
  },

  // Executive Staff Roles
  'senior-executive': {
    home: true,
    cemtemChat: false,
    customReportGenerator: true,
    dashboard: true,
    usersAndTeam: {
      userManagement: false,
      teamOverview: false,
    },
    assignTasks: false,
    dealerManagement: {
      addAndListDealers: false,
      listDealers: false,
      listVerifiedDealers: false,
      verifyDealers: false,
      dealerBrandMapping: false,
    },
    technicalSites: {
      listSites: true,
    },
    reports: {
      dailyVisitReports: true,
      technicalVisitReports: true,
      competitionReports: true,
      salesOrders: true,
      dvrVpjp: true,
      tvrVpjp: true,
      salesVdvr: true,
    },
    permanentJourneyPlan: {
      pjpList: false,
      pjpVerify: false,
    },
    salesmanAttendance: false,
    salesmanLeaves: false,
    salesmanGeotracking: {
      slmGeotracking: false,
      salesmanLiveLocation: false,
    },
    masonpcSide: {
      masonpc: false,
      tsoMeetings: false,
      schemesOffers: false,
      masonOnSchemes: false,
      masonOnMeetings: false,
      bagsLift: false,
      pointsLedger: false,
      rewardsRedemption: false,
    },
    scoresAndRatings: {
      dealerScores: false,
      salesmanRatings: false,
    },
    logisticsIO: {
      records: false,
    },
    account: true,
    raiseAQuery: true,
  },
  executive: {
    home: true,
    cemtemChat: false,
    customReportGenerator: false,
    dashboard: true,
    usersAndTeam: {
      userManagement: false,
      teamOverview: false,
    },
    assignTasks: false,
    dealerManagement: {
      addAndListDealers: false,
      listDealers: false,
      listVerifiedDealers: false,
      dealerBrandMapping: false,
      verifyDealers: false,
    },
    technicalSites: {
      listSites: false,
    },
    reports: {
      dailyVisitReports: false,
      technicalVisitReports: false,
      competitionReports: false,
      salesOrders: false,
      dvrVpjp: false,
      tvrVpjp: false,
      salesVdvr: false,
    },
    permanentJourneyPlan: {
      pjpList: false,
      pjpVerify: false,
    },
    salesmanAttendance: false,
    salesmanLeaves: false,
    salesmanGeotracking: {
      slmGeotracking: false,
      salesmanLiveLocation: false,
    },
    masonpcSide: {
      masonpc: false,
      tsoMeetings: false,
      schemesOffers: false,
      masonOnSchemes: false,
      masonOnMeetings: false,
      bagsLift: false,
      pointsLedger: false,
      rewardsRedemption: false,
    },
    scoresAndRatings: {
      dealerScores: false,
      salesmanRatings: false,
    },
    logisticsIO: {
      records: false,
    },
    account: true,
    raiseAQuery: true,
  },
  'junior-executive': {
    home: true,
    cemtemChat: false,
    customReportGenerator: false,
    dashboard: true,
    usersAndTeam: {
      userManagement: false,
      teamOverview: false,
    },
    assignTasks: false,
    dealerManagement: {
      addAndListDealers: false,
      listDealers: false,
      listVerifiedDealers: false,
      verifyDealers: false,
      dealerBrandMapping: false,
    },
    technicalSites: {
      listSites: false,
    },
    reports: {
      dailyVisitReports: false,
      technicalVisitReports: false,
      competitionReports: true,
      salesOrders: false,
      dvrVpjp: false,
      tvrVpjp: false,
      salesVdvr: false,
    },
    permanentJourneyPlan: {
      pjpList: false,
      pjpVerify: false,
    },
    salesmanAttendance: true,
    salesmanLeaves: false,
    salesmanGeotracking: {
      slmGeotracking: false,
      salesmanLiveLocation: false,
    },
    masonpcSide: {
      masonpc: false,
      tsoMeetings: false,
      schemesOffers: false,
      masonOnSchemes: false,
      masonOnMeetings: false,
      bagsLift: false,
      pointsLedger: false,
      rewardsRedemption: false,
    },
    scoresAndRatings: {
      dealerScores: false,
      salesmanRatings: false,
    },
    logisticsIO: {
      records: false,
    },
    account: true,
    raiseAQuery: true,
  },
};

// Build a type of all leaf boolean paths like "reports.dailyVisitReports"
type LeafPaths<T, P extends string = ''> =
  T extends boolean
  ? P
  : { [K in keyof T & string]:
    LeafPaths<T[K], P extends '' ? K : `${P}.${K}`>
  }[keyof T & string];

export type PermPath = LeafPaths<DashboardPermissions>;

function getByPath(obj: any, path: string) {
  return path.split('.').reduce((acc, k) => acc?.[k], obj);
}

export function hasPermission(role: WorkOSRole, feature: PermPath): boolean {
  const perms = WORKOS_ROLE_PERMISSIONS[role] ?? WORKOS_ROLE_PERMISSIONS['junior-executive'];
  return getByPath(perms, feature) === true;
}

export function getUserPermissions(role: WorkOSRole): DashboardPermissions {
  return WORKOS_ROLE_PERMISSIONS[role] ?? WORKOS_ROLE_PERMISSIONS['junior-executive'];
}
