'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  Loader2, Search, Eye, ExternalLink, MapPin, User, Calendar, Camera,
  Image as ImageIcon, LogIn, LogOut, Briefcase, Store, HardHat, RefreshCw, Wrench, Users
} from 'lucide-react';

import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- SCHEMAS ---
import { selectDailyVisitReportSchema, selectTechnicalVisitReportSchema } from '../../../../drizzle/zodSchemas';

const extendedDailyVisitReportSchema = selectDailyVisitReportSchema.extend({
  reportDate: z.string().nullable().optional(),
  checkInTime: z.string().nullable().optional(),
  checkOutTime: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  expectedActivationDate: z.string().nullable().optional(),
  salesmanName: z.string().optional().catch("Unknown"),
  role: z.string().optional().catch("N/A"),
  area: z.string().optional().catch("N/A"),
  region: z.string().optional().catch("N/A"),
  dealerName: z.string().nullable().optional(),
  subDealerName: z.string().nullable().optional(),
  latitude: z.coerce.number().nullable().optional().catch(null),
  longitude: z.coerce.number().nullable().optional().catch(null),
  dealerTotalPotential: z.coerce.number().nullable().optional().catch(0),
  dealerBestPotential: z.coerce.number().nullable().optional().catch(0),
  todayOrderMt: z.coerce.number().nullable().optional().catch(0),
  todayCollectionRupees: z.coerce.number().nullable().optional().catch(0),
  overdueAmount: z.coerce.number().nullable().optional().catch(0),
  brandSelling: z.array(z.string()).nullable().optional().transform(v => v || []),
  pjpStatus: z.string().nullable().optional(),
});
type DailyVisitReport = z.infer<typeof extendedDailyVisitReportSchema>;

const extendedTechnicalVisitReportSchema = selectTechnicalVisitReportSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  role: z.string().optional().catch("N/A"),
  date: z.string().optional(),
  timeSpentinLoc: z.string().nullable().optional(),
  latitude: z.coerce.number().nullable().optional().catch(null),
  longitude: z.coerce.number().nullable().optional().catch(null),
  constAreaSqFt: z.coerce.number().nullable().optional().catch(null),
  currentBrandPrice: z.coerce.number().nullable().optional().catch(null),
  siteStock: z.coerce.number().nullable().optional().catch(null),
  estRequirement: z.coerce.number().nullable().optional().catch(null),
  conversionQuantityValue: z.coerce.number().nullable().optional().catch(null),
  siteVisitBrandInUse: z.array(z.string()).nullable().optional().transform(v => v || []),
  influencerType: z.array(z.string()).nullable().optional().transform(v => v || []),
  isConverted: z.boolean().nullable().optional(),
  isTechService: z.boolean().nullable().optional(),
  isSchemeEnrolled: z.boolean().nullable().optional(),
});
type TechnicalVisitReport = z.infer<typeof extendedTechnicalVisitReportSchema>;

type LocationsResponse = any;
type RolesResponse = any;

// --- CONSTANTS & HELPERS ---
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;
const ROLES_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-roles`;

const DVR_CUSTOMER_TYPES = ['Dealer', 'Sub-Dealer', 'Non-Trade', 'Other'];
const TVR_CUSTOMER_TYPES = ['IHB/Site', 'Engineer/Architect', 'Contractor/Head Mason', 'Channel Partner(Dealer/Sub-Dealer)', 'Competitor Channel Partner (Dealer/Sub-Dealer)'];

const formatTimeIST = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleTimeString('en-IN', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  } catch (e) { return 'N/A'; }
};

const getGoogleMapsLink = (lat?: number | null, lng?: number | null) => {
  if (!lat || !lng) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
};

const getTvrCustomerTypeBadgeColor = (type: string | null) => {
  if (!type) return 'secondary';
  if (type === 'IHB/Site') return 'default'; 
  if (type.includes('Dealer')) return 'destructive'; 
  return 'outline'; 
};

// --- REUSABLE UI COMPONENTS ---
const renderSelectFilter = (
  label: string, value: string, onValueChange: (v: string) => void,
  options: string[], isLoading: boolean = false
) => (
  <div className="flex flex-col space-y-1 w-full sm:w-[150px] min-w-[120px]">
    <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger className="h-9 w-full bg-background border-input">
        {isLoading ? (
          <div className="flex flex-row items-center space-x-2"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-muted-foreground">Loading...</span></div>
        ) : (<SelectValue placeholder={`Select ${label}`} />)}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        {options.map(option => (<SelectItem key={option} value={option}>{option}</SelectItem>))}
      </SelectContent>
    </Select>
  </div>
);

const InfoField = ({ label, value, icon: Icon, fullWidth = false }: { label: string, value: React.ReactNode, icon?: any, fullWidth?: boolean }) => (
  <div className={`flex flex-col space-y-1.5 ${fullWidth ? 'col-span-2' : ''}`}>
    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">{Icon && <Icon className="w-3 h-3" />}{label}</Label>
    <div className="text-sm font-medium p-2 bg-secondary/20 rounded-md border border-border/50 min-h-9 flex items-center">
      {value || <span className="italic text-xs text-muted-foreground">N/A</span>}
    </div>
  </div>
);

// --- MAIN COMPONENT ---
export default function HybridReportsPage() {
  const router = useRouter();

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<string>('dvr');

  const [dvrs, setDvrs] = useState<DailyVisitReport[]>([]);
  const [tvrs, setTvrs] = useState<TechnicalVisitReport[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [totalDvrCount, setTotalDvrCount] = useState(0);
  const [totalTvrCount, setTotalTvrCount] = useState(0);

  // Modal States
  const [selectedDvr, setSelectedDvr] = useState<DailyVisitReport | null>(null);
  const [isDvrModalOpen, setIsDvrModalOpen] = useState(false);
  const [selectedTvr, setSelectedTvr] = useState<TechnicalVisitReport | null>(null);
  const [isTvrModalOpen, setIsTvrModalOpen] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');

  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);

  // --- DEBOUNCE & EFFECTS ---
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, roleFilter, areaFilter, regionFilter, customerTypeFilter, activeTab]);

  useEffect(() => {
    // Reset customer type filter specifically when switching tabs, as the options change completely
    setCustomerTypeFilter('all');
  }, [activeTab]);

  // --- DATA FETCHING ---
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`/api/dashboardPagesAPI/reports/dvr-and-tvr`, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (roleFilter !== 'all') url.searchParams.append('role', roleFilter);
      if (areaFilter !== 'all') url.searchParams.append('area', areaFilter);
      if (regionFilter !== 'all') url.searchParams.append('region', regionFilter);
      if (customerTypeFilter !== 'all') url.searchParams.append('customerType', customerTypeFilter);
      // PJP Status filter excluded here for simplicity on TVR side, can add back to URL if needed

      const response = await fetch(url.toString());

      if (!response.ok) {
        if (response.status === 401) return router.push('/login');
        if (response.status === 403) return router.push('/dashboard');
        throw new Error(`HTTP error! ${response.status}`);
      }

      const result = await response.json();
      
      setTotalDvrCount(result.dvrs.totalCount || 0);
      setTotalTvrCount(result.tvrs.totalCount || 0);

      const validatedDvrs = (result.dvrs.data || []).map((item: any) => {
        try { return extendedDailyVisitReportSchema.parse(item); } catch (e) { return null; }
      }).filter(Boolean) as DailyVisitReport[];

      const validatedTvrs = (result.tvrs.data || []).map((item: any) => {
        try { 
          const v = extendedTechnicalVisitReportSchema.parse(item);
          return { ...v, id: (v as any).id?.toString() || `${Math.random()}` } as TechnicalVisitReport;
        } catch (e) { return null; }
      }).filter(Boolean) as TechnicalVisitReport[];

      setDvrs(validatedDvrs);
      setTvrs(validatedTvrs);
      toast.success("Kamrup-TSO Reports loaded successfully!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [router, page, pageSize, debouncedSearchQuery, roleFilter, areaFilter, regionFilter, customerTypeFilter]);

  const fetchLocationsAndRoles = useCallback(async () => {
    try {
      const [locRes, roleRes] = await Promise.all([
        fetch(LOCATION_API_ENDPOINT), fetch(ROLES_API_ENDPOINT)
      ]);
      if (locRes.ok) {
        const data: LocationsResponse = await locRes.json();
        setAvailableAreas(data.areas || []);
        setAvailableRegions(data.regions || []);
      }
      if (roleRes.ok) {
        const data: RolesResponse = await roleRes.json();
        setAvailableRoles(data.roles || []);
      }
    } finally {
      setIsLoadingLocations(false);
      setIsLoadingRoles(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { fetchLocationsAndRoles(); }, [fetchLocationsAndRoles]);

  // --- DVR SPECIFIC LOGIC & COLUMNS ---
  const isDealerVisit = (r: DailyVisitReport) => !!r.dealerType;
  
  const dvrColumns = useMemo<ColumnDef<DailyVisitReport>[]>(() => [
    {
      accessorKey: "customerType", header: "Form Type",
      cell: ({ row }) => <Badge variant="outline" className="whitespace-nowrap">{row.original.customerType || 'N/A'}</Badge>,
    },
    {
      accessorKey: "salesmanName", header: "Salesman",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.original.salesmanName}</span>
          <span className="text-xs text-muted-foreground">{row.original.role}</span>
        </div>
      ),
    },
    {
      accessorKey: "dealerName", header: "Dealer / Party",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.original.dealerName || row.original.nameOfParty || row.original.subDealerName}</span>
        </div>
      ),
    },
    { accessorKey: "region", header: "Region" },
    { accessorKey: "area", header: "Area" },
    { accessorKey: "reportDate", header: "Date" },
    { 
      accessorKey: 'pjpStatus', header: 'PJP Status', 
      cell: ({ row }) => { 
        const status = row.original.pjpStatus || "Unplanned"; 
        const upperStatus = status.toUpperCase();
        if (upperStatus === 'COMPLETED') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shadow-none tracking-wide">{status}</Badge>; 
        if (upperStatus === 'APPROVED' || upperStatus === 'VERIFIED') return <Badge className="bg-green-100 text-green-800 border-green-200 shadow-none tracking-wide">{status}</Badge>; 
        if (upperStatus === 'ASSIGNED') return <Badge className="bg-blue-100 text-blue-800 border-blue-200 shadow-none tracking-wide">{status}</Badge>; 
        return <Badge variant="secondary" className="shadow-none tracking-wide">{status}</Badge>; 
      } 
    },
    {
      id: "actions", header: "Actions",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 px-2 shadow-sm" onClick={() => { setSelectedDvr(row.original); setIsDvrModalOpen(true); }}>
          <Eye className="h-3.5 w-3.5 mr-1" /> View
        </Button>
      ),
    },
  ], []);

  // --- TVR SPECIFIC LOGIC & COLUMNS ---
  const isTvrDealerVisit = (r: TechnicalVisitReport) => r.customerType?.includes('Dealer');
  const isIHBVisit = (r: TechnicalVisitReport) => r.customerType === 'IHB' || r.customerType === 'IHB/Site';
  const isInfluencerVisit = (r: TechnicalVisitReport) => !isIHBVisit(r) && !isTvrDealerVisit(r);

  const tvrColumns = useMemo<ColumnDef<TechnicalVisitReport>[]>(() => [
    {
      accessorKey: "customerType", header: "Customer Type",
      cell: ({ row }) => {
        const type = row.original.customerType;
        return <Badge variant={getTvrCustomerTypeBadgeColor(type)} className="whitespace-nowrap">{type || 'Unknown'}</Badge>;
      }
    },
    {
      accessorKey: "salesmanName", header: "Salesman",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.original.salesmanName}</span>
          <span className="text-xs text-muted-foreground">{row.original.role}</span>
        </div>
      )
    },
    {
      accessorKey: "siteNameConcernedPerson", header: "Site / Party Name",
      cell: ({ row }) => (
        <div className="flex flex-col max-w-[180px]">
          <span className="font-semibold text-sm truncate" title={row.original.siteNameConcernedPerson || row.original.associatedPartyName || ''}>
            {row.original.siteNameConcernedPerson || row.original.associatedPartyName}
          </span>
          <span className="text-xs text-muted-foreground">{row.original.phoneNo}</span>
        </div>
      )
    },
    {
      accessorKey: "region", header: "Location",
      cell: ({ row }) => {
        const { region, area, latitude, longitude } = row.original;
        const mapLink = getGoogleMapsLink(latitude, longitude);
        return (
          <div className="flex flex-col min-w-[140px]">
            <span className="text-sm">{region} / {area}</span>
            {mapLink ? (
              <a href={mapLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1" onClick={(e) => e.stopPropagation()}>
                <MapPin className="h-3 w-3" /> View Map
              </a>
            ) : (<span className="text-xs text-muted-foreground">No GPS</span>)}
          </div>
        )
      }
    },
    { accessorKey: "visitType", header: "Purpose", cell: ({ row }) => <span className="text-sm font-medium">{row.getValue("visitType")}</span> },
    { accessorKey: "date", header: "Date & Time", cell: ({ row }) => (<div className="flex flex-col"><span className="text-sm">{row.original.date}</span></div>) },
    {
      id: "actions", header: "Actions",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 px-2 shadow-sm" onClick={() => { setSelectedTvr(row.original); setIsTvrModalOpen(true); }}>
          <Eye className="h-3.5 w-3.5 mr-1" /> View
        </Button>
      ),
    },
  ], []);

  // --- TVR MODAL RENDER HELPERS ---
  const renderIHBDetails = (r: TechnicalVisitReport) => (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2"><HardHat className="w-4 h-4" />Construction Site Analysis</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 pt-2">
          <InfoField label="Stage" value={r.siteVisitStage} />
          <InfoField label="Area (SqFt)" value={r.constAreaSqFt?.toString()} />
          <InfoField label="Site Stock" value={r.siteStock ? `${r.siteStock} Bags` : '0'} />
          <InfoField label="Est. Requirement" value={r.estRequirement ? `${r.estRequirement} Bags` : '0'} />
          <InfoField label="Brands In Use" value={r.siteVisitBrandInUse?.join(', ')} fullWidth />
          <InfoField label="Current Price" value={r.currentBrandPrice ? `₹${r.currentBrandPrice}` : 'N/A'} />
          <InfoField label="Market Name" value={r.marketName} />
          <InfoField label="Supplying Dealer" value={r.supplyingDealerName} fullWidth />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={`border-l-4 ${r.isConverted ? 'border-l-green-500' : 'border-l-muted'}`}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4" />Conversion Status</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 pt-2">
            <InfoField label="Is Converted?" value={r.isConverted ? "YES" : "NO"} />
            {r.isConverted && (
              <><InfoField label="Conversion Type" value={r.conversionType} /><InfoField label="From Brand" value={r.conversionFromBrand} /><InfoField label="Quantity" value={`${r.conversionQuantityValue || 0} ${r.conversionQuantityUnit || ''}`} /><InfoField label="Converted Dealer" value={r.nearbyDealerName} /></>
            )}
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${r.isTechService ? 'border-l-purple-400' : 'border-l-muted'}`}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Wrench className="w-4 h-4" />Technical Services</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 pt-2">
            <InfoField label="Service Given?" value={r.isTechService ? "YES" : "NO"} />
            {r.isTechService && (<><InfoField label="Type of Tech Service" value={r.serviceType} /><InfoField label="Description" value={r.serviceDesc} /></>)}
          </CardContent>
        </Card>
      </div>

      {(r.influencerName || r.influencerPhone) && (
        <Card className="border-l-4 border-l-orange-400">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Users className="w-4 h-4" />Linked Influencer / Mason</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 pt-2">
            <InfoField label="Name" value={r.influencerName} />
            <InfoField label="Type" value={r.influencerType?.join(', ')} />
            <InfoField label="Phone" value={r.influencerPhone} />
            <InfoField label="Productivity" value={r.influencerProductivity} />
            <InfoField label="Scheme Enrolled?" value={r.isSchemeEnrolled ? "YES" : "NO"} />
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderDealerDetails = (r: TechnicalVisitReport) => (
    <Card className="border-l-4 border-l-amber-700">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Store className="w-4 h-4" />Dealer & Sales Logic</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 pt-2">
        <InfoField label="Associated Party" value={r.associatedPartyName || r.siteNameConcernedPerson} fullWidth />
        <InfoField label="Dealer Type" value={r.influencerType?.join(', ')} />
        <InfoField label="Productivity" value={r.influencerProductivity} />
        <InfoField label="Brands Selling" value={r.siteVisitBrandInUse?.join(', ')} fullWidth />
        <Separator className="col-span-2 my-2" />
        <div className="col-span-2 grid grid-cols-2 gap-4 p-2 rounded-lg">
          <InfoField label="Bag Picked (Converted)" value={r.isConverted ? "YES" : "NO"} />
          {r.isConverted && (<><InfoField label="Quantity" value={`${r.conversionQuantityValue || 0} ${r.conversionQuantityUnit || ''}`} /><InfoField label="Rate per Bag" value={r.currentBrandPrice ? `₹${r.currentBrandPrice}` : 'N/A'} /><InfoField label="Date of Supply" value={r.date ? new Date(r.date).toLocaleDateString() : 'N/A'} /></>)}
        </div>
      </CardContent>
    </Card>
  );

  const renderInfluencerDetails = (r: TechnicalVisitReport) => (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Briefcase className="w-4 h-4" />Influencer / Professional Info</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 pt-2">
        <InfoField label="Influencer Name" value={r.influencerName} />
        <InfoField label="Type" value={r.influencerType?.join(', ')} />
        <InfoField label="Phone" value={r.influencerPhone} />
        <InfoField label="Scheme Enrolled?" value={r.isSchemeEnrolled ? "YES" : "NO"} />
        <Separator className="col-span-2 my-1" />
        <InfoField label="Productivity Score" value={r.influencerProductivity} />
        <InfoField label="Preferred Brands" value={r.siteVisitBrandInUse?.join(', ')} fullWidth />
        <InfoField label="Visit Category" value={r.visitCategory} />
        <InfoField label="Purpose" value={r.purposeOfVisit} />
      </CardContent>
    </Card>
  );

  // --- RENDER PAGE ---
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-6 p-8 pt-6">

        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Kamrup-TSO Hybrid Reports</h2>
          <Badge variant="outline" className="text-base px-4 py-1">
            Total Combined: {totalDvrCount + totalTvrCount}
          </Badge>
          <RefreshDataButton cachePrefix="hybrid-reports" onRefresh={fetchReports} />
        </div>

        {/* -------------------- FILTERS BLOCK -------------------- */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border shadow-sm">
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Search</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, Dealer, or Party..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 bg-background border-input"
              />
            </div>
          </div>
          
          {/* Dynamic Customer Type Filter based on Active Tab */}
          {renderSelectFilter('Report Type', customerTypeFilter, setCustomerTypeFilter, activeTab === 'dvr' ? DVR_CUSTOMER_TYPES : TVR_CUSTOMER_TYPES)}
          
          {renderSelectFilter('Role', roleFilter, setRoleFilter, availableRoles, isLoadingRoles)}
          {renderSelectFilter('Area', areaFilter, setAreaFilter, availableAreas, isLoadingLocations)}
          {renderSelectFilter('Region', regionFilter, setRegionFilter, availableRegions, isLoadingLocations)}

          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setCustomerTypeFilter('all');
              setRoleFilter('all');
              setAreaFilter('all');
              setRegionFilter('all');
            }}
            className="mb-0.5 text-muted-foreground hover:text-destructive"
          >
            Clear Filters
          </Button>
        </div>

        {/* -------------------- TABS -------------------- */}
        <Tabs defaultValue="dvr" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="dvr" className="text-sm font-semibold">
              Daily Visit Reports <Badge variant="secondary" className="ml-2">{totalDvrCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="tvr" className="text-sm font-semibold">
              Technical Visit Reports <Badge variant="secondary" className="ml-2">{totalTvrCount}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dvr">
            <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
              {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <DataTableReusable columns={dvrColumns} data={dvrs} enableRowDragging={false} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="tvr">
            <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
              {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <DataTableReusable columns={tvrColumns} data={tvrs} enableRowDragging={false} />
              )}
            </div>
          </TabsContent>
        </Tabs>

      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ---------------------------- MODALS -------------------------------- */}
      {/* ------------------------------------------------------------------ */}

      {/* 1. DVR MODAL */}
      {selectedDvr && (
        <Dialog open={isDvrModalOpen} onOpenChange={setIsDvrModalOpen}>
          <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">
            <div className={`px-6 py-4 border-b bg-muted/20 ${isDealerVisit(selectedDvr) ? 'border-l-[6px] border-l-amber-600' : 'border-l-[6px] border-l-blue-500'}`}>
              <DialogTitle className="text-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span>Visit Details</span>
                  <Badge variant="outline" className="text-sm px-3">{selectedDvr.customerType}</Badge>
                  <Badge variant={selectedDvr.pjpStatus?.toUpperCase() === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs uppercase">{selectedDvr.pjpStatus || 'UNPLANNED'}</Badge>
                </div>
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedDvr.salesmanName} ({selectedDvr.role})</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {selectedDvr.reportDate}</span>
              </DialogDescription>
            </div>

            <div className="p-6 space-y-6">
              {/* Location & Contact */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><MapPin className="w-4 h-4" /> Location & Contact</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 pt-2">
                  <InfoField label="Region" value={selectedDvr.region} />
                  <InfoField label="Area" value={selectedDvr.area} />
                  <InfoField label="Location" value={selectedDvr.location} fullWidth />
                </CardContent>
              </Card>

              {/* Dealer or Non Trade Split */}
              {isDealerVisit(selectedDvr) ? (
                <Card className="border-l-4 border-l-amber-600">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Dealer Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 pt-2">
                    <InfoField label="Dealer Type" value={selectedDvr.dealerType} />
                    <InfoField label="Dealer Name" value={selectedDvr.dealerName} />
                    <InfoField label="Sub Dealer" value={selectedDvr.subDealerName} />
                    <InfoField label="Brand Selling" value={selectedDvr.brandSelling?.join(', ')} fullWidth />
                    <Separator className="col-span-2 my-2" />
                    <InfoField label="Total Potential" value={`${selectedDvr.dealerTotalPotential} MT`} />
                    <InfoField label="Best Potential" value={`${selectedDvr.dealerBestPotential} MT`} />
                    <InfoField label="Today's Order" value={`${selectedDvr.todayOrderMt} MT`} />
                    <InfoField label="Today's Collection" value={`₹${selectedDvr.todayCollectionRupees}`} />
                    <InfoField label="Overdue Amount" value={`₹${selectedDvr.overdueAmount}`} />
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Non-Trade Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 pt-2">
                    <InfoField label="Party Type" value={selectedDvr.partyType} />
                    <InfoField label="Name of Party" value={selectedDvr.nameOfParty} />
                    <InfoField label="Contact No." value={selectedDvr.contactNoOfParty} />
                    <InfoField label="Expected Activation Date" value={selectedDvr.expectedActivationDate} />
                    <InfoField label="Brand in Use" value={selectedDvr.brandSelling?.join(', ')} fullWidth />
                    <Separator className="col-span-2 my-2" />
                    <InfoField label="Total Potential" value={`${selectedDvr.dealerTotalPotential} MT`} />
                    <InfoField label="Best Potential" value={`${selectedDvr.dealerBestPotential} MT`} />
                  </CardContent>
                </Card>
              )}

              {/* Photo Evidence */}
              <div>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><Camera className="w-4 h-4" /> Photo Evidence</h4>
                <div className="flex flex-col gap-6">
                  {selectedDvr.inTimeImageUrl && (
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <div className="bg-emerald-50 px-4 py-2 text-sm font-semibold border-b flex items-center gap-2 text-emerald-800"><LogIn className="w-4 h-4" /> Check-In Selfie</div>
                      <a href={selectedDvr.inTimeImageUrl} target="_blank" rel="noreferrer"><img src={selectedDvr.inTimeImageUrl} className="w-full h-auto max-h-[400px] object-contain bg-black/5" alt="Check In"/></a>
                    </div>
                  )}
                  {selectedDvr.outTimeImageUrl && (
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <div className="bg-orange-50 px-4 py-2 text-sm font-semibold border-b flex items-center gap-2 text-orange-800"><LogOut className="w-4 h-4" /> Check-Out Selfie</div>
                      <a href={selectedDvr.outTimeImageUrl} target="_blank" rel="noreferrer"><img src={selectedDvr.outTimeImageUrl} className="w-full h-auto max-h-[400px] object-contain bg-black/5" alt="Check Out"/></a>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="p-4 bg-background border-t"><Button onClick={() => setIsDvrModalOpen(false)}>Close Report</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 2. TVR MODAL */}
      {selectedTvr && (
        <Dialog open={isTvrModalOpen} onOpenChange={setIsTvrModalOpen}>
          <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">
            <div className={`px-6 py-4 border-b bg-muted/20 ${isTvrDealerVisit(selectedTvr) ? 'border-l-[6px] border-l-red-500' : isIHBVisit(selectedTvr) ? 'border-l-[6px] border-l-primary' : 'border-l-[6px] border-l-blue-500'}`}>
              <DialogTitle className="text-xl flex items-center justify-between">
                <span>Visit Details</span>
                <Badge variant={getTvrCustomerTypeBadgeColor(selectedTvr.customerType)} className="text-sm px-3">{selectedTvr.customerType}</Badge>
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedTvr.salesmanName} ({selectedTvr.role})</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {selectedTvr.date}</span>
              </DialogDescription>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="h-full">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><MapPin className="w-4 h-4" /> Location & Contact</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 pt-2">
                    <InfoField label="Region" value={selectedTvr.region} />
                    <InfoField label="Area" value={selectedTvr.area} />
                    <InfoField label="Site Address" value={selectedTvr.siteAddress} fullWidth />
                    <InfoField label="Contact Person" value={selectedTvr.siteNameConcernedPerson || selectedTvr.associatedPartyName || selectedTvr.influencerName} />
                    <InfoField label="Phone" value={selectedTvr.phoneNo || selectedTvr.influencerPhone} />
                  </CardContent>
                </Card>

                <Card className="h-full">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Briefcase className="w-4 h-4" /> Visit Summary</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 pt-2">
                    <InfoField label="Visit Type" value={selectedTvr.visitType} />
                    <InfoField label="Visit Category" value={selectedTvr.visitCategory} />
                    <InfoField label="Check In" value={formatTimeIST(selectedTvr.checkInTime)} />
                    <InfoField label="Check Out" value={formatTimeIST(selectedTvr.checkOutTime)} />
                    <InfoField label="Time Spent" value={selectedTvr.timeSpentinLoc} fullWidth />
                  </CardContent>
                </Card>
              </div>

              {isIHBVisit(selectedTvr) && renderIHBDetails(selectedTvr)}
              {isTvrDealerVisit(selectedTvr) && renderDealerDetails(selectedTvr)}
              {isInfluencerVisit(selectedTvr) && renderInfluencerDetails(selectedTvr)}

              <Card>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoField label="Remarks" value={selectedTvr.salespersonRemarks} />
                </CardContent>
              </Card>

              <div>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><Camera className="w-4 h-4" /> Photo Evidence</h4>
                <div className="flex flex-col gap-6">
                  {selectedTvr.sitePhotoUrl && (
                    <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
                      <div className="bg-muted px-4 py-2 text-sm font-semibold border-b flex justify-between items-center"><span className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Site / Shop Overview</span></div>
                      <a href={selectedTvr.sitePhotoUrl} target="_blank" rel="noreferrer" className="block relative group">
                        <img src={selectedTvr.sitePhotoUrl} className="w-full h-auto max-h-[500px] object-contain bg-black/5" alt="Site Evidence"/>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"><ExternalLink className="text-white w-5 h-5" /><span className="text-white font-medium text-sm">View Full Image</span></div>
                      </a>
                    </div>
                  )}
                  {selectedTvr.inTimeImageUrl ? (
                    <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
                      <div className="bg-emerald-50 px-4 py-2 text-sm font-semibold border-b flex justify-between items-center text-emerald-800"><span className="flex items-center gap-2"><LogIn className="w-4 h-4" /> Check-In Selfie</span></div>
                      <a href={selectedTvr.inTimeImageUrl} target="_blank" rel="noreferrer" className="block relative group">
                        <img src={selectedTvr.inTimeImageUrl} className="w-full h-auto max-h-[400px] object-contain bg-black/5" alt="Check In"/>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"><ExternalLink className="text-white w-5 h-5" /><span className="text-white font-medium text-sm">View Full Image</span></div>
                      </a>
                    </div>
                  ) : (<div className="border rounded-lg h-24 flex items-center justify-center bg-muted/10 text-muted-foreground text-sm italic border-dashed">No Check-In Photo Available</div>)}
                  {selectedTvr.outTimeImageUrl ? (
                    <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
                      <div className="bg-orange-50 px-4 py-2 text-sm font-semibold border-b flex justify-between items-center text-orange-800"><span className="flex items-center gap-2"><LogOut className="w-4 h-4" /> Check-Out Selfie</span></div>
                      <a href={selectedTvr.outTimeImageUrl} target="_blank" rel="noreferrer" className="block relative group">
                        <img src={selectedTvr.outTimeImageUrl} className="w-full h-auto max-h-[400px] object-contain bg-black/5" alt="Check Out"/>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"><ExternalLink className="text-white w-5 h-5" /><span className="text-white font-medium text-sm">View Full Image</span></div>
                      </a>
                    </div>
                  ) : (<div className="border rounded-lg h-24 flex items-center justify-center bg-muted/10 text-muted-foreground text-sm italic border-dashed">No Check-Out Photo Available</div>)}
                </div>
              </div>

            </div>
            <DialogFooter className="p-4 bg-background border-t"><Button onClick={() => setIsTvrModalOpen(false)}>Close Report</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}