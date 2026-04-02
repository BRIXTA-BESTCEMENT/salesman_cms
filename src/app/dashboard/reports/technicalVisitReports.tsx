// src/app/dashboard/reports/technicalVisitReports.tsx
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Loader2, Eye, ExternalLink, MapPin,
  User, Calendar, Briefcase, Store, HardHat, Camera,
  Image as ImageIcon, LogIn, LogOut,
  RefreshCw, Wrench, Users,
} from 'lucide-react';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { selectTechnicalVisitReportSchema } from '../../../../drizzle/zodSchemas';

const extendedTechnicalVisitReportSchema = selectTechnicalVisitReportSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
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

const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}

const CUSTOMER_TYPE_OPTIONS = [
  'IHB/Site',
  'Engineer/Architect',
  'Contractor/Head Mason',
  'Channel Partner(Dealer/Sub-Dealer)',
  'Competitor Channel Partner (Dealer/Sub-Dealer)',
];

const formatTimeIST = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
  } catch (e) {
    return 'N/A';
  }
};

const getGoogleMapsLink = (lat?: number | null, lng?: number | null) => {
  if (!lat || !lng) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
};

const getCustomerTypeBadgeColor = (type: string | null) => {
  if (!type) return 'secondary';
  if (type === 'IHB/Site') return 'default';
  if (type.includes('Dealer')) return 'destructive';
  return 'outline';
};

const InfoField = ({ label, value, icon: Icon, fullWidth = false }: { label: string, value: React.ReactNode, icon?: any, fullWidth?: boolean }) => (
  <div className={`flex flex-col space-y-1.5 ${fullWidth ? 'col-span-2' : ''}`}>
    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </Label>
    <div className="text-sm font-medium p-2 bg-secondary/20 rounded-md border border-border/50 min-h-9 flex items-center">
      {value || <span className="text-muted-foreground italic text-xs">N/A</span>}
    </div>
  </div>
);

export default function TechnicalVisitReportsPage() {
  const router = useRouter();
  const [technicalReports, setTechnicalReports] = useState<TechnicalVisitReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] = useState<TechnicalVisitReport | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // --- Backend Filter Options ---
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, areaFilters, zoneFilters, customerTypeFilter, dateRange]);

  const fetchTechnicalReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/dashboardPagesAPI/reports/technical-visit-reports`, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);

      // Join arrays for multi-select
      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
      if (zoneFilters.length > 0) url.searchParams.append('region', zoneFilters.join(','));

      if (customerTypeFilter !== 'all') url.searchParams.append('customerType', customerTypeFilter);

      if (dateRange?.from) url.searchParams.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange?.to) {
        url.searchParams.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));
      } else if (dateRange?.from) {
        url.searchParams.append('endDate', format(dateRange.from, 'yyyy-MM-dd'));
      }

      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const result = await response.json();
      const rawData: TechnicalVisitReport[] = result.data || [];
      setTotalCount(result.totalCount || 0);

      const validatedData = rawData.map((item) => {
        try {
          const validated = extendedTechnicalVisitReportSchema.parse(item);
          return { ...validated, id: (validated as any).id?.toString() || `${Math.random()}` } as TechnicalVisitReport;
        } catch (e) {
          console.error("Validation error:", item, e);
          return null;
        }
      }).filter(Boolean) as TechnicalVisitReport[];

      setTechnicalReports(validatedData);
      toast.success("Reports loaded successfully!");
    } catch (error: any) {
      toast.error(`Failed to load: ${error.message}`);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [router, page, pageSize, debouncedSearchQuery, areaFilters, zoneFilters, customerTypeFilter, dateRange]);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    try {
      const url = new URL(LOCATION_API_ENDPOINT, window.location.origin);
      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (response.ok) {
        const data: LocationsResponse = await response.json();
        setAvailableAreas(data.areas || []);
        setAvailableRegions(data.regions || []);
      }
    } finally { setIsLoadingLocations(false); }
  }, []);

  useEffect(() => {
    fetchTechnicalReports();
  }, [fetchTechnicalReports]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const zoneOptions = useMemo(() => availableRegions.sort().map(r => ({ label: r, value: r })), [availableRegions]);
  const areaOptions = useMemo(() => availableAreas.sort().map(a => ({ label: a, value: a })), [availableAreas]);
  const customerTypeOptions = useMemo(() => [
    { label: 'All Customer Types', value: 'all' },
    ...CUSTOMER_TYPE_OPTIONS.map(c => ({ label: c, value: c }))
  ], []);

  const isDealerVisit = (r: TechnicalVisitReport) => r.customerType?.includes('Dealer');
  const isIHBVisit = (r: TechnicalVisitReport) => r.customerType === 'IHB' || r.customerType === 'IHB/Site';
  const isInfluencerVisit = (r: TechnicalVisitReport) => !isIHBVisit(r) && !isDealerVisit(r);

  const columns = useMemo<ColumnDef<TechnicalVisitReport>[]>(() => [
    {
      accessorKey: "customerType",
      header: "Customer Type",
      cell: ({ row }) => {
        const type = row.original.customerType;
        return <Badge variant={getCustomerTypeBadgeColor(type)} className="whitespace-nowrap">{type || 'Unknown'}</Badge>;
      }
    },
    {
      accessorKey: "salesmanName",
      header: "Salesman",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.original.salesmanName}</span>
        </div>
      )
    },
    {
      accessorKey: "siteNameConcernedPerson",
      header: "Site / Party Name",
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
      accessorKey: "region",
      header: "Location",
      cell: ({ row }) => {
        const { region, area, latitude, longitude } = row.original;
        const mapLink = getGoogleMapsLink(latitude, longitude);

        return (
          <div className="flex flex-col min-w-[140px]">
            <span className="text-sm">{region} / {area}</span>
            {mapLink ? (
              <a
                href={mapLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin className="h-3 w-3" /> View Map
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">No GPS</span>
            )}
          </div>
        )
      }
    },
    {
      accessorKey: "visitType",
      header: "Purpose",
      cell: ({ row }) => <span className="text-sm font-medium">{row.getValue("visitType")}</span>
    },
    {
      accessorKey: "date",
      header: "Date & Time",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.original.date}</span>
        </div>
      )
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 h-8 px-2 shadow-sm"
          onClick={() => {
            setSelectedReport(row.original);
            setIsViewModalOpen(true);
          }}
        >
          <Eye className="h-3.5 w-3.5 mr-1" /> View
        </Button>
      ),
    },
  ], []);

  const renderIHBDetails = (r: TechnicalVisitReport) => (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <HardHat className="w-4 h-4" />
            Construction Site Analysis
          </CardTitle>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Conversion Status
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 pt-2">
            <InfoField label="Is Converted?" value={r.isConverted ? "YES" : "NO"} />
            {r.isConverted && (
              <>
                <InfoField label="Conversion Type" value={r.conversionType} />
                <InfoField label="From Brand" value={r.conversionFromBrand} />
                <InfoField label="Quantity" value={`${r.conversionQuantityValue || 0} ${r.conversionQuantityUnit || ''}`} />
                <InfoField label="Converted Dealer" value={r.nearbyDealerName} />
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${r.isTechService ? 'border-l-purple-400' : 'border-l-muted'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Technical Services
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 pt-2">
            <InfoField label="Service Given?" value={r.isTechService ? "YES" : "NO"} />
            {r.isTechService && (
              <>
                <InfoField label="Type of Tech Service" value={r.serviceType} />
                <InfoField label="Description" value={r.serviceDesc} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {(r.influencerName || r.influencerPhone) && (
        <Card className="border-l-4 border-l-orange-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Linked Influencer / Mason
            </CardTitle>
          </CardHeader>
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Store className="w-4 h-4" />
          Dealer & Sales Logic
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 pt-2">
        <InfoField label="Associated Party" value={r.associatedPartyName || r.siteNameConcernedPerson} fullWidth />
        <InfoField label="Dealer Type" value={r.influencerType?.join(', ')} />
        <InfoField label="Productivity" value={r.influencerProductivity} />
        <InfoField label="Brands Selling" value={r.siteVisitBrandInUse?.join(', ')} fullWidth />

        <Separator className="col-span-2 my-2" />

        <div className="col-span-2 grid grid-cols-2 gap-4 p-2 rounded-lg">
          <InfoField label="Bag Picked (Converted)" value={r.isConverted ? "YES" : "NO"} />
          {r.isConverted && (
            <>
              <InfoField label="Quantity" value={`${r.conversionQuantityValue || 0} ${r.conversionQuantityUnit || ''}`} />
              <InfoField label="Rate per Bag" value={r.currentBrandPrice ? `₹${r.currentBrandPrice}` : 'N/A'} />
              <InfoField label="Date of Supply" value={r.date ? new Date(r.date).toLocaleDateString() : 'N/A'} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderInfluencerDetails = (r: TechnicalVisitReport) => (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Briefcase className="w-4 h-4" />
          Influencer / Professional Info
        </CardTitle>
      </CardHeader>
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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight">Technical Visit Reports</h2>
            <Badge variant="outline" className="text-base px-4 py-1">
              Total Reports: {totalCount}
            </Badge>
          </div>
          <RefreshDataButton
            cachePrefix="technical-visit-reports"
            onRefresh={fetchTechnicalReports}
          />
        </div>

        {/* --- Unified Global Filter Bar --- */}
        <div className="w-full">
          <GlobalFilterBar
            showSearch={true}
            showRole={true} // Using Role slot for Customer Type!
            showZone={true}
            showArea={true}
            showDateRange={true}
            showStatus={false}

            searchVal={searchQuery}
            roleVal={customerTypeFilter}
            zoneVals={zoneFilters}
            areaVals={areaFilters}
            dateRangeVal={dateRange}

            roleOptions={customerTypeOptions}
            zoneOptions={zoneOptions}
            areaOptions={areaOptions}

            onSearchChange={setSearchQuery}
            onRoleChange={setCustomerTypeFilter}
            onZoneChange={setZoneFilters}
            onAreaChange={setAreaFilters}
            onDateRangeChange={setDateRange}
          />
        </div>

        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <DataTableReusable
              columns={columns}
              data={technicalReports}
              enableRowDragging={false}
            />
          )}
        </div>
      </div>

      {selectedReport && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">
            <div className={`px-6 py-4 border-b bg-muted/20 ${isDealerVisit(selectedReport) ? 'border-l-[6px] border-l-red-500' : isIHBVisit(selectedReport) ? 'border-l-[6px] border-l-primary' : 'border-l-[6px] border-l-blue-500'}`}>
              <DialogTitle className="text-xl flex items-center justify-between">
                <span>Visit Details</span>
                <Badge variant={getCustomerTypeBadgeColor(selectedReport.customerType)} className="text-sm px-3">
                  {selectedReport.customerType}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedReport.salesmanName}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {selectedReport.date}</span>
              </DialogDescription>
            </div>

            <div className="p-6 space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Location & Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 pt-2">
                    <InfoField label="Region" value={selectedReport.region} />
                    <InfoField label="Area" value={selectedReport.area} />
                    <InfoField label="Site Address" value={selectedReport.siteAddress} fullWidth />
                    <InfoField label="Contact Person" value={selectedReport.siteNameConcernedPerson || selectedReport.associatedPartyName || selectedReport.influencerName} />
                    <InfoField label="Phone" value={selectedReport.phoneNo || selectedReport.influencerPhone} />
                  </CardContent>
                </Card>

                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Briefcase className="w-4 h-4" /> Visit Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 pt-2">
                    <InfoField label="Visit Type" value={selectedReport.visitType} />
                    <InfoField label="Visit Category" value={selectedReport.visitCategory} />
                    <InfoField label="Check In" value={formatTimeIST(selectedReport.checkInTime)} />
                    <InfoField label="Check Out" value={formatTimeIST(selectedReport.checkOutTime)} />
                    <InfoField label="Time Spent" value={selectedReport.timeSpentinLoc} fullWidth />
                  </CardContent>
                </Card>
              </div>

              {isIHBVisit(selectedReport) && renderIHBDetails(selectedReport)}
              {isDealerVisit(selectedReport) && renderDealerDetails(selectedReport)}
              {isInfluencerVisit(selectedReport) && renderInfluencerDetails(selectedReport)}

              <Card>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoField label="Remarks" value={selectedReport.salespersonRemarks} />
                </CardContent>
              </Card>

              <div>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Photo Evidence
                </h4>

                <div className="flex flex-col gap-6">
                  {selectedReport.sitePhotoUrl && (
                    <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
                      <div className="bg-muted px-4 py-2 text-sm font-semibold border-b flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" /> Site / Shop Overview
                        </span>
                      </div>
                      <a href={selectedReport.sitePhotoUrl} target="_blank" rel="noreferrer" className="block relative group">
                        <img
                          src={selectedReport.sitePhotoUrl}
                          className="w-full h-auto max-h-[500px] object-contain bg-black/5"
                          alt="Site Evidence"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <ExternalLink className="text-white w-5 h-5" />
                          <span className="text-white font-medium text-sm">View Full Image</span>
                        </div>
                      </a>
                    </div>
                  )}

                  {selectedReport.inTimeImageUrl ? (
                    <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
                      <div className="bg-emerald-50 px-4 py-2 text-sm font-semibold border-b flex justify-between items-center text-emerald-800">
                        <span className="flex items-center gap-2">
                          <LogIn className="w-4 h-4" /> Check-In Selfie
                        </span>
                      </div>
                      <a href={selectedReport.inTimeImageUrl} target="_blank" rel="noreferrer" className="block relative group">
                        <img
                          src={selectedReport.inTimeImageUrl}
                          className="w-full h-auto max-h-[400px] object-contain bg-black/5"
                          alt="Check In"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <ExternalLink className="text-white w-5 h-5" />
                          <span className="text-white font-medium text-sm">View Full Image</span>
                        </div>
                      </a>
                    </div>
                  ) : (
                    <div className="border rounded-lg h-24 flex items-center justify-center bg-muted/10 text-muted-foreground text-sm italic border-dashed">
                      No Check-In Photo Available
                    </div>
                  )}

                  {selectedReport.outTimeImageUrl ? (
                    <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
                      <div className="bg-orange-50 px-4 py-2 text-sm font-semibold border-b flex justify-between items-center text-orange-800">
                        <span className="flex items-center gap-2">
                          <LogOut className="w-4 h-4" /> Check-Out Selfie
                        </span>
                      </div>
                      <a href={selectedReport.outTimeImageUrl} target="_blank" rel="noreferrer" className="block relative group">
                        <img
                          src={selectedReport.outTimeImageUrl}
                          className="w-full h-auto max-h-[400px] object-contain bg-black/5"
                          alt="Check Out"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <ExternalLink className="text-white w-5 h-5" />
                          <span className="text-white font-medium text-sm">View Full Image</span>
                        </div>
                      </a>
                    </div>
                  ) : (
                    <div className="border rounded-lg h-24 flex items-center justify-center bg-muted/10 text-muted-foreground text-sm italic border-dashed">
                      No Check-Out Photo Available
                    </div>
                  )}

                </div>
              </div>

            </div>

            <DialogFooter className="p-4 bg-background border-t">
              <Button onClick={() => setIsViewModalOpen(false)}>Close Report</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}