// src/app/dashboard/data-format.ts
import { z } from 'zod';

import { 
  selectJourneyOpsSchema, 
  selectDailyVisitReportSchema,
  selectTechnicalVisitReportSchema, 
  selectSalesOrderSchema, 
  selectCompetitionReportSchema
} from '../../../drizzle/zodSchemas';

// ---------------------------------------------------------------------
// 1. Exporting Extended Schemas (Adding Joins & Coercing Strings to Numbers)
// ---------------------------------------------------------------------

export const rawGeoTrackingSchema = selectJourneyOpsSchema.partial().extend({
  id: z.string().optional(),
  serverSeq: z.coerce.bigint().optional(),
  salesmanName: z.string().optional().catch("Unknown"),
  totalDistanceTravelled: z.coerce.number().optional().catch(0),
  employeeId: z.string().nullable().optional(),
  locationType: z.string().nullable().optional(),
  recordedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const rawDailyVisitReportSchema = selectDailyVisitReportSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  role: z.string().optional().catch("N/A"),
  dealerName: z.string().nullable().optional(),
  todayCollectionRupees: z.coerce.number().optional().catch(0),
  latitude: z.coerce.number().optional().catch(0),
  longitude: z.coerce.number().optional().catch(0),
  dealerTotalPotential: z.coerce.number().optional().catch(0),
  dealerBestPotential: z.coerce.number().optional().catch(0),
  todayOrderMt: z.coerce.number().optional().catch(0),
  overdueAmount: z.coerce.number().nullable().optional().catch(0),
});

export const rawSalesOrderSchema = selectSalesOrderSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  dealerName: z.string().nullable().optional(),
  orderQty: z.coerce.number().nullable().optional().catch(null),
  orderTotal: z.coerce.number().optional().catch(0),
  receivedPayment: z.coerce.number().nullable().optional().catch(null),
  pendingPayment: z.coerce.number().nullable().optional().catch(null),
  itemPrice: z.coerce.number().nullable().optional().catch(null),
  discountPercentage: z.coerce.number().nullable().optional().catch(null),
  itemPriceAfterDiscount: z.coerce.number().nullable().optional().catch(null),
  orderUnit: z.string().nullable().optional(),
});

export const rawTechnicalVisitReportSchema = selectTechnicalVisitReportSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
});

export const rawCompetitionReportSchema = selectCompetitionReportSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
});


// ---------------------------------------------------------------------
// 2. Exporting Inferred Types (Ensuring 'id' is strictly a string for Tables)
// ---------------------------------------------------------------------
export type RawGeoTrackingRecord = Omit<z.infer<typeof rawGeoTrackingSchema>, 'id'> & { id: string };
export type RawDailyVisitReportRecord = Omit<z.infer<typeof rawDailyVisitReportSchema>, 'id'> & { id: string };
export type RawTechnicalVisitReportRecord = Omit<z.infer<typeof rawTechnicalVisitReportSchema>, 'id'> & { id: string };
export type RawSalesOrderReportRecord = Omit<z.infer<typeof rawSalesOrderSchema>, 'id'> & { id: string };
export type RawCompetitionReportRecord = Omit<z.infer<typeof rawCompetitionReportSchema>, 'id'> & { id: string };

// ---------------------------------------------------------------------
// 3. Types for Aggregated Graph Data
// ---------------------------------------------------------------------
export type DailyVisitsData = {
  name: string; // Date
  visits: number;
};

export type GeoTrackingData = {
  name: string; // Date
  distance: number;
};

export type DailyCollectionData = {
  name: string; // Date
  collection: number;
};

export type SalesOrderQuantityData = {
  name: string;   // Date
  quantity: number; // Sum of orderQty (MT/Bags units handled in UI)
};

export type TechnicalConversionData = {
  name: string; // Date or Day
  conversionQuantity: number; // Sum of conversionQuantityValue
};

export type CompetitionBrandCount = {
  name: string; // Brand Name
  count: number;
};