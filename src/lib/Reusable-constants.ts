// src/lib/Reusable-constants.ts

export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL;
export const RESEND_API_KEY = process.env.RESEND_MAIL_API;

export const brands = [
  "Star", "Amrit", "Dalmia", 
  "Topcem", "Black Tiger", "Surya Gold", 
  "Max", "Taj", 
  "Specify in remarks"
];

export const dealerTypes = ["Dealer-Best", "Sub Dealer-Best", "Dealer-Non Best", "Sub Dealer-Non Best"];

export const units = ["MT", "KG", "Bags"];

export const Zone = ["All Zone", "Kamrup", "Upper Assam", "Lower Assam", "Central Assam", 
  "Barak Valley", "North Bank", "Meghalaya", "Mizoram", "Nagaland", "Tripura", 
];

export const TSO_AOP_TARGETS = {
  siteVisitNew: 70,
  siteVisitOld: 80,
  dealerRetailer: 50,
  siteConversion: 20,
  volumeConvertedMT: 100,
  influencerVisits: 10,
  enrollmentLifting: 100,
  siteServiceSlab: 5,
  technicalMeet: 5,
};