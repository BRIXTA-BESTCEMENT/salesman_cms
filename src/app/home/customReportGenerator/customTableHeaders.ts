// src/app/home/customReportGenerator/customTableHeaders.ts

import {
    LucideIcon, User, Car, BadgeIndianRupeeIcon, ListTodo, ClipboardCheck, BandageIcon,
    CalendarCheck, PencilRuler, ChartNoAxesCombined, MapPin, Award, Star, Boxes,
    Construction, UsersRound, Gift, HandCoins, ScrollText, UserCheck, Users,
    Building2, ShoppingBag,
    Truck
} from 'lucide-react';

export interface TableColumn {
    table: string;
    column: string;
}

export interface TableMeta {
    id: string;
    title: string;
    icon: LucideIcon;
    columns: string[];
}

export const tablesMetadata: TableMeta[] = [
    {
        id: 'users',
        title: 'User (Salesman)',
        icon: User,
        columns: ['id', 'email', 'firstName', 'lastName', 'role', 'phoneNo', 'address', 'region', 'area', 'isTechnicalRole', 'isActive', 'createdAt']
    },
    {
        id: 'dealers',
        title: 'Dealers',
        icon: Building2,
        columns: [
            'id', 'type', 'name', 'region', 'area', 'phoneNo', 'address', 'pinCode',
            'feedbacks', 'remarks', 'dealerDevelopmentStatus', 'dealerDevelopmentObstacle',
            'verificationStatus', 'whatsappNo', 'emailId', 'businessType', 'gstinNo', 'nameOfFirm', 'underSalesPromoterName',
            'panNo', 'tradeLicNo', 'aadharNo', 'godownSizeSqFt', 'godownCapacityMTBags',
            'godownAddressLine', 'godownLandMark', 'godownDistrict', 'godownArea',
            'godownRegion', 'godownPinCode', 'residentialAddressLine', 'residentialLandMark',
            'residentialDistrict', 'residentialArea', 'residentialRegion', 'residentialPinCode',
            'bankAccountName', 'bankName', 'bankBranchAddress', 'bankAccountNumber',
            'bankIfscCode', 'brandName', 'noOfDealers', 'areaCovered', 'noOfEmployeesInSales',
            'declarationName', 'declarationPlace', 'tradeLicencePicUrl', 'shopPicUrl',
            'dealerPicUrl', 'blankChequePicUrl', 'partnershipDeedPicUrl', 'latitude',
            'longitude', 'dateOfBirth', 'anniversaryDate', 'totalPotential', 'bestPotential',
            'monthlySaleMT', 'projectedMonthlySalesBestCementMT', 'brandSelling',
            'declarationDate', 'createdAt', 'updatedAt', 'associatedSalesmanName'
        ],
    },
    {
        id: 'dailyVisitReports',
        title: 'Daily Visit Reports',
        icon: CalendarCheck,
        columns: [
            'id', 'reportDate', 'dealerType', 'dealerName', 'subDealerName', 'location',
            'latitude', 'longitude', 'visitType', 'dealerTotalPotential', 'dealerBestPotential',
            'brandSelling', 'contactPerson', 'contactPersonPhoneNo', 'todayOrderMt',
            'todayCollectionRupees', 'overdueAmount', 'feedbacks', 'solutionBySalesperson',
            'anyRemarks', 'checkInTime', 'timeSpentinLoc', 'checkOutTime', 'inTimeImageUrl', 'outTimeImageUrl',
            'createdAt', 'updatedAt'
        ],
    },
    {
        id: 'technicalVisitReports',
        title: 'Technical Visit Reports',
        icon: PencilRuler,
        columns: [
            'id', 'reportDate', 'visitType', 'salesmanName', 'salesmanEmail','siteNameConcernedPerson', 'phoneNo',
            'marketName', 'siteAddress', 'region', 'area', 'latitude',
            'longitude', 'visitCategory', 'customerType', 'purposeOfVisit', 'siteVisitStage',
            'constAreaSqFt', 'siteVisitBrandInUse', 'currentBrandPrice', 'siteStock', 'estRequirement',
            'supplyingDealerName', 'nearbyDealerName', 'associatedPartyName', 'isConverted',
            'conversionType', 'conversionFromBrand', 'conversionQuantityValue', 'conversionQuantityUnit', 'isTechService',
            'serviceDesc', 'qualityComplaint',
            'influencerName', 'influencerPhone', 'isSchemeEnrolled', 'influencerProductivity', 'influencerType',
            'masonId', 'clientsRemarks', 'salespersonRemarks', 'promotionalActivity', 'siteVisitType',
            'sitePhotoUrl', 'inTimeImageUrl', 'outTimeImageUrl', 'checkInTime', 'checkOutTime',
            'timeSpentinLoc', 'createdAt', 'updatedAt', 'firstVisitTime', 'lastVisitTime',
            'firstVisitDay', 'lastVisitDay', 'siteVisitsCount', 'otherVisitsCount', 'totalVisitsCount',
            'pjpId', 'meetingId', 'siteId'
        ],
    },
    {
        id: 'technicalSites',
        title: 'Technical Sites',
        icon: MapPin,
        columns: [
            'id', 'siteName', 'concernedPerson', 'phoneNo', 'address',
            'latitude', 'longitude', 'siteType', 'area', 'region',
            'keyPersonName', 'keyPersonPhoneNum',
            'stageOfConstruction', 'constructionStartDate', 'constructionEndDate',
            'convertedSite', 'firstVistDate', 'lastVisitDate', 'needFollowUp',
            'associatedSalesmen', 'associatedDealers', 'associatedMasons',
            'createdAt', 'updatedAt'
        ],
    },
    {
        id: 'permanentJourneyPlans',
        title: 'Permanent Journey Plans (PJP)',
        icon: Car,
        columns: [
            'id', 'planDate', 'assignedSalesmanName', 'areaToBeVisited', 'route', 'status', 'plannedNewSiteVisits',
            'plannedFollowUpSiteVisits', 'plannedNewDealerVisits', 'plannedInfluencerVisits', 'influencerName', 'influencerPhone',
            'activityType', 'noOfConvertedBags', 'noOfMasonPcSchemes', 'diversionReason',
            'dealerName', 'description', 'creatorName', 'createdAt', 'updatedAt'
        ]
    },
    {
        id: 'salesOrders',
        title: 'Sales Orders',
        icon: BadgeIndianRupeeIcon,
        columns: [
            'id', 'userId', 'dealerId', 'dvrId', 'pjpId',
            'salesmanName', 'salesmanRole',
            'dealerName', 'dealerType', 'dealerPhone', 'dealerAddress', 'area', 'region',
            'orderDate', 'orderPartyName',
            'partyPhoneNo', 'partyArea', 'partyRegion', 'partyAddress',
            'deliveryDate', 'deliveryArea', 'deliveryRegion', 'deliveryAddress', 'deliveryLocPincode',
            'paymentMode', 'paymentTerms', 'paymentAmount', 'receivedPayment', 'receivedPaymentDate', 'pendingPayment',
            'orderQty', 'orderUnit',
            'itemPrice', 'discountPercentage', 'itemPriceAfterDiscount',
            'itemType', 'itemGrade',
            'orderTotal', 'estimatedDelivery', 'remarks',
            'createdAt', 'updatedAt',
        ],
    },
    {
        id: 'dailyTasks',
        title: 'Daily Tasks',
        icon: ListTodo,
        columns: ['id', 'taskDate', 'visitType', 'siteName', 'description', 'status', 'pjpId', 'assignedToName', 'assignedByName', 'relatedDealerName', 'createdAt'],
    },
    {
        id: 'competitionReports',
        title: 'Competition Reports',
        icon: ChartNoAxesCombined,
        columns: ['id', 'reportDate', 'area', 'region', 'competitorName', 'productName', 'price', 'salesmanName', 'dealerName', 'createdAt'],
    },
    // {
    //     id: 'dealerReportsAndScores',
    //     title: 'Dealer Scores',
    //     icon: Award,
    //     columns: ['id', 'dealerScore', 'trustWorthinessScore', 'creditWorthinessScore', 'orderHistoryScore', 'visitFrequencyScore', 'lastUpdatedDate', 'dealerName', 'dealerRegion', 'dealerArea', 'createdAt'],
    // },
    // {
    //     id: 'dealerBrandCapacities',
    //     title: 'Dealer Brand Capacities',
    //     icon: Boxes,
    //     columns: ['id', 'capacityMT', 'bestCapacityMT', 'brandGrowthCapacityPercent', 'userId', 'brandName', 'dealerName', 'dealerRegion', 'dealerArea']
    // },
    {
        id: 'salesmanAttendance',
        title: 'Salesman Attendance',
        icon: ClipboardCheck,
        columns: ['id', 'attendanceDate', 'locationName', 'role', 'inTimeTimestamp', 'outTimeTimestamp', 'inTimeLatitude', 'inTimeLongitude', 'salesmanName', 'salesmanEmail', 'createdAt'],
    },
    {
        id: 'salesmanLeaveApplications',
        title: 'Leave Applications',
        icon: BandageIcon,
        columns: ['id', 'leaveType', 'startDate', 'endDate', 'reason', 'status', 'salesmanName', 'salesmanEmail', 'approverName', 'createdAt'],
    },
    {
        id: 'geoTracking',
        title: 'Salesman GeoTracking',
        icon: MapPin,
        columns: ['id', 'latitude', 'longitude', 'recordedAt', 'accuracy', 'speed', 'activityType', 'appState', 'batteryLevel', 'salesmanName', 'salesmanEmail', 'journeyId', 'createdAt'],
    },
    // {
    //     id: 'salesmanRating',
    //     title: 'Salesman Rating',
    //     icon: Star,
    //     columns: ['id', 'area', 'region', 'rating', 'salesmanName', 'salesmanEmail'],
    // },
    // {
    //     id: 'tsoMeetings',
    //     title: 'TSO Meetings',
    //     icon: UsersRound,
    //     columns: [
    //         'id', 'type', 'date', 'location', 'budgetAllocated', 'participantsCount',
    //         'createdByUserName', 'createdByUserEmail', 'createdAt', 'updatedAt'
    //     ],
    // },
    {
        id: 'rewards',
        title: 'Rewards Inventory',
        icon: Gift,
        columns: [
            'id', 'itemName', 'pointCost', 'totalAvailableQuantity', 'stock', 'isActive', 'createdAt', 'updatedAt'
        ],
    },
    {
        id: 'giftAllocationLogs',
        title: 'Gift Allocation Logs',
        icon: HandCoins,
        columns: [
            'id', 'itemName', 'salesmanName', 'salesmanEmail', 'transactionType',
            'quantity', 'sourceUserName', 'destinationUserName', 'technicalVisitReportId',
            'dealerVisitReportId', 'createdAt'
        ],
    },
    {
        id: 'masonPCSide',
        title: 'Masons & Contractors',
        icon: Construction,
        columns: [
            'id', 'name', 'phoneNumber', 'kycDocumentName', 'kycDocumentIdNum', 'kycStatus',  'kycSubmittedAt',
            'bagsLifted', 'pointsBalance', 'isReferred',
            'referredByUser', 'referredToUser', 'dealerName', 'associatedSalesman'
        ],
    },
    {
        id: 'bagLifts',
        title: 'Bag Lifts',
        icon: ShoppingBag,
        columns: [
            'id', 'masonId', 'masonName', 'phoneNumber', 'dealerId', 'dealerName',
            'siteId', 'siteName', 'siteAddress', 'siteKeyPersonName', 'siteKeyPersonPhone',
            'purchaseDate', 'bagCount', 'pointsCredited', 'status',
            'imageUrl', 'verificationSiteImageUrl', 'verificationProofImageUrl', 'approvedByUserId', 'approverName', 'associatedSalesmanName','approvedAt', 'createdAt',
        ],
    },
    {
        id: 'pointsLedger',
        title: 'Points Ledger',
        icon: ScrollText,
        columns: [
            'id', 'masonId', 'masonName', 'sourceType', 'points',
            'memo', 'sourceDescription', 'createdAt'
        ],
    },
    // {
    //     id: 'logisticsGateIO',
    //     title: 'Logistics Gate In/Out',
    //     icon: Truck,
    //     columns: [
    //         'id', 'zone', 'district', 'destination', 'doOrderDate', 'doOrderTime', 'gateInDate', 'gateInTime', 'processingTime',
    //         'wbInDate', 'wbInTime', 'diffGateInTareWt', 'wbOutDate', 'wbOutTime', 
    //         'diffTareWtGrossWt', 'gateOutDate', 'gateOutTime', 'diffGrossWtGateOut',
    //         'diffGrossWtInvoiceDT', 'diffInvoiceDTGateOut', 'diffGateInGateOut', 'createdAt', 'updatedAt'
    //     ],
    // },
    // {
    //   id: 'schemesOffers',
    //   title: 'Schemes & Offers',
    //   icon: ScrollText,
    //   columns: [
    //     'id', 'name', 'description', 'startDate', 'endDate'
    //   ],
    // },
    // {
    //   id: 'masonsOnSchemes',
    //   title: 'Masons on Schemes',
    //   icon: UserCheck,
    //   columns: [
    //     'masonId', 'masonName', 'schemeId', 'schemeName', 'enrolledAt', 'status'
    //   ],
    // },
    // {
    //   id: 'masonsOnMeetings',
    //   title: 'Masons on Meetings',
    //   icon: Users,
    //   columns: [
    //     'masonId', 'masonName', 'meetingId', 'meetingType', 'meetingDate', 'attendedAt'
    //   ],
    // },

];
export type ReportFormat = 'csv' | 'xlsx';