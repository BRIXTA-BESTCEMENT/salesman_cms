// src/app/home/customReportGenerator/customTableHeaders.ts

import {
    LucideIcon, User, ListTodo, ClipboardCheck, BandageIcon,
    CalendarCheck, PencilRuler, MapPin,
    Construction, UsersRound, Gift, HandCoins, ScrollText, ClipboardPen,
    Building2, ShoppingBag,
    ListChecks,
    ClipboardPenLine,
    Activity,
    Store
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
        title: 'Users',
        icon: User,
        columns: ['id', 'orgRole', 'jobRoles', 'email', 'firstName', 'lastName', 'phoneNo', 'address', 'region', 'area']
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
            'monthlySaleMT', 'projectedMonthlySalesBestCementMT', 'brandSell', 'associatedSalesmanName'
        ],
    },
    {
        id: 'dailyVisitReports',
        title: 'Daily Visit Reports',
        icon: CalendarCheck,
        columns: [
            'id', 'reportDate', 'salesmanName', 'salesmanEmail', 'dealerType', 'dealerName', 'subDealerName', 'pjpStatus', 'unplannedVisit',
            'location', 'latitude', 'longitude', 'visitType', 'dealerTotalPotential', 'dealerBestPotential',
            'brandSelling', 'contactPerson', 'contactPersonPhoneNo', 'todayOrderMt',
            'todayCollectionRupees', 'overdueAmount', 'feedbacks',
            'customerType', 'partyType', 'nameOfParty', 'contactNoOfParty', 'expectedActivationDate',
            'checkInTime', 'checkOutTime', 'checkInDate', 'checkOutDate',
            'timeSpentinLoc',
        ],
    },
    {
        id: 'kamrupTsoDvrs',
        title: 'Kamrup-TSO DVRs',
        icon: ClipboardPen,
        columns: [
            'sourceReport', 'id', 'reportDate', 'pjpStatus', 'salesmanName', 'salesmanEmail',
            'customerType', 'dealerType', 'dealerName', 'subDealerName', 'partyType',
            'nameOfParty', 'contactNoOfParty', 'expectedActivationDate', 'location',
            'latitude', 'longitude', 'visitType', 'dealerTotalPotential', 'dealerBestPotential',
            'brandSelling', 'contactPerson', 'contactPersonPhoneNo', 'todayOrderMt',
            'todayCollectionRupees', 'overdueAmount', 'feedbacks',
            'checkInTime', 'checkOutTime', 'checkInDate', 'checkOutDate',
            'timeSpentinLoc',
        ],
    },
    {
        id: 'kamrupTsoTvrs',
        title: 'Kamrup-TSO TVRs',
        icon: ClipboardPenLine,
        columns: [
            'sourceReport', 'id', 'reportDate', 'salesmanName', 'salesmanEmail',
            'customerType', 'visitCategory', 'visitType', 'purposeOfVisit',
            'siteNameConcernedPerson', 'associatedPartyName', 'phoneNo', 'emailId',
            'region', 'area', 'location', 'latitude', 'longitude', 'marketName', 'siteAddress',
            'whatsappNo', 'constAreaSqFt', 'siteVisitStage', 'siteVisitBrandInUse',
            'currentBrandPrice', 'siteStock', 'estRequirement', 'supplyingDealerName',
            'nearbyDealerName', 'isConverted', 'conversionType', 'conversionFromBrand',
            'conversionQuantityValue', 'conversionQuantityUnit', 'isTechService',
            'serviceType', 'serviceDesc', 'influencerName', 'influencerType',
            'influencerPhone', 'isSchemeEnrolled', 'influencerProductivity',
            'qualityComplaint', 'promotionalActivity', 'channelPartnerVisit',
            'salespersonRemarks', 'siteVisitsCount', 'otherVisitsCount',
            'checkInTime', 'checkOutTime', 'checkInDate', 'checkOutDate',
            'timeSpentinLoc', 'siteVisitType',
        ],
    },
    {
        id: 'technicalVisitReports',
        title: 'Technical Visit Reports',
        icon: PencilRuler,
        columns: [
            'id', 'reportDate', 'salesmanName', 'salesmanEmail', 'customerType',
            'siteNameConcernedPerson', 'phoneNo', 'visitType', 'siteVisitType', 'visitCategory',
            'marketName', 'siteAddress', 'region', 'area', 'latitude', 'longitude',
            'siteVisitStage', 'constAreaSqFt', 'siteVisitBrandInUse', 'currentBrandPrice',
            'siteStock', 'estRequirement',
            'supplyingDealerName', 'nearbyDealerName', 'associatedPartyName', 'isConverted',
            'conversionType', 'conversionFromBrand', 'conversionQuantityValue', 'conversionQuantityUnit',
            'isTechService', 'serviceType', 'serviceDesc', 'qualityComplaint',
            'influencerName', 'influencerPhone', 'isSchemeEnrolled', 'influencerProductivity', 'influencerType',
            'masonId', 'salespersonRemarks', 'promotionalActivity', 'timeSpentinLoc',
            'checkInTime', 'checkOutTime', 'checkInDate', 'checkOutDate',
            'pjpId', 'siteId'
        ],
    },
    {
        id: 'tsoPerformanceMetrics',
        title: 'TSO Metrics (Current Month|1st -> today)',
        icon: Activity,
        columns: [
            'userId', 'salesmanName', 'region', 'area',
            'totalVisits', 'siteVisitsNew', 'siteVisitsOld',
            'dealerVisits', 'influencerVisits', 'siteConversion',
            'volumeConvertedMT(Bags)', 'enrollmentLifting', 'siteServiceSlab', 'technicalMeet'
        ]
    },
    // {
    //     id: 'soPerformanceMetrics',
    //     title: 'SO Metrics (Current Month|1st -> today)',
    //     icon: Store, 
    //     columns: [
    //         'userId', 'salesmanName', 'region', 'area',
    //         'totalVisits', 'dealerVisits', 'subDealerVisits'
    //     ]
    // },
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
        ],
    },
    {
        id: 'dailyTasks',
        title: 'PJPs (Sales Side)',
        icon: ListTodo,
        columns: [
            'id', 'pjpBatchId', 'assignedSalesmanName', 'assignedSalesmanEmail', 'dealerVisitingName', 'dealerMobile',
            'zone', 'area', 'route', 'objective', 'visitType', 'requiredVisitCount', 'week',
        ],
    },
    {
        id: 'permanentJourneyPlans',
        title: 'PJPs (Technical Side)',
        icon: ListChecks,
        columns: [
            'id', 'planDate', 'assignedSalesmanName', 'areaToBeVisited', 'route', 'status', 'plannedNewSiteVisits',
            'plannedFollowUpSiteVisits', 'plannedNewDealerVisits', 'plannedInfluencerVisits', 'influencerName', 'influencerPhone',
            'activityType', 'noOfConvertedBags', 'noOfMasonPcSchemes', 'diversionReason',
            'dealerName'
        ]
    },
    // {
    //     id: 'salesOrders',
    //     title: 'Sales Orders',
    //     icon: BadgeIndianRupeeIcon,
    //     columns: [
    //         'id', 'userId', 'dealerId', 'dvrId', 'pjpId',
    //         'salesmanName',
    //         'dealerName', 'dealerType', 'dealerPhone', 'dealerAddress', 'area', 'region',
    //         'orderDate', 'orderPartyName',
    //         'partyPhoneNo', 'partyArea', 'partyRegion', 'partyAddress',
    //         'deliveryDate', 'deliveryArea', 'deliveryRegion', 'deliveryAddress', 'deliveryLocPincode',
    //         'paymentMode', 'paymentTerms', 'paymentAmount', 'receivedPayment', 'receivedPaymentDate', 'pendingPayment',
    //         'orderQty', 'orderUnit',
    //         'itemPrice', 'discountPercentage', 'itemPriceAfterDiscount',
    //         'itemType', 'itemGrade',
    //         'orderTotal', 'estimatedDelivery,
    //     ],
    // },
    // {
    //     id: 'competitionReports',
    //     title: 'Competition Reports',
    //     icon: ChartNoAxesCombined,
    //     columns: ['id', 'reportDate', 'area', 'region', 'competitorName', 'productName', 'price'],
    // },
    // {
    //     id: 'dealerReportsAndScores',
    //     title: 'Dealer Scores',
    //     icon: Award,
    //     columns: ['id', 'dealerScore', 'trustWorthinessScore', 'creditWorthinessScore', 'orderHistoryScore', 'visitFrequencyScore', 'lastUpdatedDate', 'dealerName'],
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
        columns: [
            'id', 'salesmanName', 'salesmanEmail', 'attendanceDate', 'locationName',
            'inTimeDate', 'outTimeDate', 'inTimeTime', 'outTimeTime', 'inTimeLatitude', 'inTimeLongitude'
        ],
    },
    {
        id: 'salesmanLeaveApplications',
        title: 'Leave Applications',
        icon: BandageIcon,
        columns: [
            'id', 'salesmanName', 'leaveType',
            'startDate', 'endDate', 'reason', 'status',
        ],
    },
    {
        id: 'geoTracking',
        title: 'Salesman GeoTracking',
        icon: MapPin,
        columns: [
            'id', 'salesmanName', 'salesmanEmail',
            'latitude', 'longitude', 'totalDistanceTravelled',
            'siteName', 'checkInTime', 'checkOutTime', 'isActive', 'destLat', 'destLng'
        ],
    },
    // {
    //     id: 'salesmanRating',
    //     title: 'Salesman Rating',
    //     icon: Star,
    //     columns: ['id', 'area', 'region', 'rating', 'salesmanName', 'salesmanEmail'],
    // },
    {
        id: 'tsoMeetings',
        title: 'TSO Meetings',
        icon: UsersRound,
        columns: [
            'id', 'creatorName', 'type', 'date', 'market', 'zone', 'dealerName', 'conductedBy',
            'participantsCount', 'giftType', 'accountJsbJud'
        ],
    },
    {
        id: 'rewards',
        title: 'Rewards Inventory',
        icon: Gift,
        columns: [
            'id', 'itemName', 'pointCost', 'totalAvailableQuantity'
        ],
    },
    {
        id: 'rewardRedemptions',
        title: 'Reward Redemptions',
        icon: HandCoins,
        columns: [
            'id', 'masonId',
            'associatedUserName', 'associatedUserEmail', 'masonName',
            'rewardId', 'rewardName', 'quantity', 'status', 'pointsDebited',
            'deliveryName', 'deliveryPhone',
        ],
    },
    // {
    //     id: 'giftAllocationLogs',
    //     title: 'Gift Allocation Logs',
    //     icon: HandCoins,
    //     columns: [
    //         'id', 'itemName', 'salesmanName', 'salesmanEmail', 'transactionType',
    //         'quantity', 'sourceUserName', 'destinationUserName', 'technicalVisitReportId
    //     ],
    // },
    {
        id: 'masonPCSide',
        title: 'Masons & Contractors',
        icon: Construction,
        columns: [
            'id', 'name', 'phoneNumber', 'kycDocumentName', 'kycDocumentIdNum', 'kycStatus', 'kycSubmittedAt',
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
            'imageUrl', 'verificationSiteImageUrl', 'verificationProofImageUrl', 'approvedByUserId', 'approverName',
        ],
    },
    {
        id: 'pointsLedger',
        title: 'Points Ledger',
        icon: ScrollText,
        columns: [
            'id', 'masonId', 'masonName', 'sourceType', 'points',

        ],
    },
    // {
    //     id: 'logisticsIO',
    //     title: 'Logistics Operations (Gate/WB/Store)',
    //     icon: Truck,
    //     columns: [
    //         'id', 'sourceName', 'zone', 'district', 'destination', 'purpose', 'typeOfMaterials', 'vehicleNumber', 'noOfInvoice',
    //         'invoiceNos', 'billNos', 'storeDate', 'storeTime',
    //         'doOrderDate', 'doOrderTime', 'gateInDate', 'gateInTime',
    //         'wbInDate', 'wbInTime', 'wbOutDate', 'wbOutTime',
    //         'gateOutDate', 'gateOutTime', 'gateOutNoOfInvoice', 'gateOutInvoiceNos
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