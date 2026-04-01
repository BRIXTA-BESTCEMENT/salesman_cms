// src/app/dashboard/reports/dailyVisitReports.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Loader2,
  Eye,
  MapPin,
  User,
  Calendar,
  Camera,
  LogIn,
  LogOut,
} from 'lucide-react';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar'; 
import { useDebounce } from '@/hooks/use-debounce-search'; 

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { selectDailyVisitReportSchema } from '../../../../drizzle/zodSchemas';

const extendedDailyVisitReportSchema = selectDailyVisitReportSchema.extend({
  reportDate: z.string().nullable().optional(),
  checkInTime: z.string().nullable().optional(),
  checkOutTime: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  expectedActivationDate: z.string().nullable().optional(),
  salesmanName: z.string().optional().catch("Unknown"),
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

const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}

const CUSTOMER_TYPE_OPTIONS = [
  'Dealer',
  'Sub-Dealer',
  'Non-Trade',
  'Other'
];

const PJP_STATUS_OPTIONS = [
  'Completed',
  'Assigned',
  'Approved',
  'Verified',
  'Failed',
];

const InfoField = ({
  label,
  value,
  icon: Icon,
  fullWidth = false,
}: {
  label: string;
  value: React.ReactNode;
  icon?: any;
  fullWidth?: boolean;
}) => (
  <div className={`flex flex-col space-y-1.5 ${fullWidth ? 'col-span-2' : ''}`}>
    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </Label>
    <div className="text-sm font-medium p-2 bg-secondary/20 rounded-md border border-border/50 min-h-9 flex items-center">
      {value || <span className="italic text-xs text-muted-foreground">N/A</span>}
    </div>
  </div>
);

export default function DailyVisitReportsPage() {
  const router = useRouter();

  const [reports, setReports] = useState<DailyVisitReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedReport, setSelectedReport] = useState<DailyVisitReport | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');
  const [pjpStatusFilter, setPjpStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  
  // --- Backend Filter Options ---
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, areaFilters, zoneFilters, customerTypeFilter, pjpStatusFilter, dateRange]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`/api/dashboardPagesAPI/reports/daily-visit-reports`, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      
      // Join arrays for multi-select
      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
      if (zoneFilters.length > 0) url.searchParams.append('region', zoneFilters.join(','));
      
      if (customerTypeFilter !== 'all') url.searchParams.append('customerType', customerTypeFilter);
      if (pjpStatusFilter !== 'all') url.searchParams.append('pjpStatus', pjpStatusFilter);

      if (dateRange?.from) url.searchParams.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange?.to) {
        url.searchParams.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));
      } else if (dateRange?.from) {
        url.searchParams.append('endDate', format(dateRange.from, 'yyyy-MM-dd'));
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        if (response.status === 401) return router.push('/login');
        if (response.status === 403) return router.push('/dashboard');
        throw new Error(`HTTP error! ${response.status}`);
      }

      const result = await response.json();
      setTotalCount(result.totalCount || 0);

      const validated = result.data.map((item: any) =>
        extendedDailyVisitReportSchema.parse(item)
      );

      setReports(validated);
      toast.success("Daily Visit Reports loaded successfully!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [router, page, pageSize, debouncedSearchQuery, areaFilters, zoneFilters, customerTypeFilter, pjpStatusFilter, dateRange]);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
      if (response.ok) {
        const data: LocationsResponse = await response.json();
        setAvailableAreas(data.areas || []);
        setAvailableRegions(data.regions || []);
      }
    } finally { setIsLoadingLocations(false); }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const zoneOptions = useMemo(() => availableRegions.sort().map(r => ({ label: r, value: r })), [availableRegions]);
  const areaOptions = useMemo(() => availableAreas.sort().map(a => ({ label: a, value: a })), [availableAreas]);
  const customerTypeOptions = useMemo(() => [
    { label: 'All Types', value: 'all' },
    ...CUSTOMER_TYPE_OPTIONS.map(c => ({ label: c, value: c }))
  ], []);
  const pjpStatusOptions = useMemo(() => [
    { label: 'All Statuses', value: 'all' },
    ...PJP_STATUS_OPTIONS.map(s => ({ label: s, value: s }))
  ], []);

  const isDealerVisit = (r: DailyVisitReport) => !!r.dealerType;

  const columns = useMemo<ColumnDef<DailyVisitReport>[]>(() => [
    {
      accessorKey: "customerType",
      header: "Form Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="whitespace-nowrap">
          {row.original.customerType || 'N/A'}
        </Badge>
      ),
    },
    {
      accessorKey: "salesmanName",
      header: "Salesman",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.original.salesmanName}</span>
        </div>
      ),
    },
    {
      accessorKey: "dealerName",
      header: "Dealer / Party Name",
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.dealerName || row.original.nameOfParty || '-'}
        </span>
      ),
    },
    {
      accessorKey: "subDealerName",
      header: "Sub Dealer Name",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.subDealerName || '-'}
        </span>
      ),
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => {
        const { region, area, latitude, longitude } = row.original;

        const getGoogleMapsLink = (lat?: number | null, lng?: number | null) => {
          if (!lat || !lng) return null;
          return `http://maps.google.com/?q=${lat},${lng}`; 
        };

        const mapLink = getGoogleMapsLink(latitude, longitude);

        return (
          <div className="flex flex-col min-w-[140px]">
            <span className="text-sm">{region || '-'} / {area || '-'}</span>
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
              <span className="text-xs text-muted-foreground mt-1">No GPS</span>
            )}
          </div>
        );
      }
    },
    {
      id: "dateAndTime",
      header: "Date & Time",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.original.reportDate || '-'}</span>
        </div>
      )
    },
    {
      accessorKey: 'pjpStatus',
      header: 'PJP Status',
      cell: ({ row }) => {

        const status: any = row.original.pjpStatus || "-";
        const upperStatus = status.toUpperCase();

        if (upperStatus === 'UNPLANNED') {
          return <span className="text-muted-foreground text-xs">-</span>;
        }

        if (upperStatus === 'COMPLETED') {
          return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shadow-none tracking-wide">{status}</Badge>;
        }
        if (upperStatus === 'APPROVED' || upperStatus === 'VERIFIED') {
          return <Badge className="bg-green-100 text-green-800 border-green-200 shadow-none tracking-wide">{status}</Badge>;
        }
        if (upperStatus === 'ASSIGNED') {
          return <Badge className="bg-blue-100 text-blue-800 border-blue-200 shadow-none tracking-wide">{status}</Badge>;
        }

        return <Badge variant="secondary" className="shadow-none tracking-wide">{status}</Badge>;
      }
    },
    {
      id: "unplannedVisits",
      header: "Unplanned Visit",
      cell: ({ row }) => {
        const status = row.original.pjpStatus || "Unplanned";
        const isUnplanned = status.toUpperCase() === 'UNPLANNED';
        
        return isUnplanned ? (
          <Badge variant="destructive" className="shadow-none tracking-wide">Unplanned</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 px-2 shadow-sm"
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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight">Daily Visit Reports</h2>
            <Badge variant="outline" className="text-base px-4 py-1">
              Total Reports: {totalCount}
            </Badge>
          </div>
          <RefreshDataButton
            cachePrefix="daily-visit-reports"
            onRefresh={fetchReports}
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
            showStatus={true} // PJP Status mapped to Status

            searchVal={searchQuery}
            roleVal={customerTypeFilter}
            zoneVals={zoneFilters}
            areaVals={areaFilters}
            statusVal={pjpStatusFilter}
            dateRangeVal={dateRange}

            roleOptions={customerTypeOptions}
            zoneOptions={zoneOptions}
            areaOptions={areaOptions}
            statusOptions={pjpStatusOptions}

            onSearchChange={setSearchQuery}
            onRoleChange={setCustomerTypeFilter}
            onZoneChange={setZoneFilters}
            onAreaChange={setAreaFilters}
            onStatusChange={setPjpStatusFilter}
            onDateRangeChange={setDateRange}
          />
        </div>

        <div className="bg-card p-1 rounded-lg border shadow-sm">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <DataTableReusable
              columns={columns}
              data={reports}
              enableRowDragging={false}
            />
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ---------------------------- MODAL -------------------------------- */}
      {/* ------------------------------------------------------------------ */}

      {selectedReport && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">

            <div className={`px-6 py-4 border-b bg-muted/20 ${isDealerVisit(selectedReport) ? 'border-l-[6px] border-l-amber-600' : 'border-l-[6px] border-l-blue-500'}`}>
              <DialogTitle className="text-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span>Visit Details</span>
                  <Badge variant="outline" className="text-sm px-3">
                    {selectedReport.customerType}
                  </Badge>
                  <Badge variant={selectedReport.pjpStatus?.toUpperCase() === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs uppercase">
                    {selectedReport.pjpStatus || 'UNPLANNED'}
                  </Badge>
                </div>
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {selectedReport.salesmanName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {selectedReport.reportDate}
                </span>
              </DialogDescription>
            </div>

            <div className="p-6 space-y-6">

              {/* Location & Contact */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Location & Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 pt-2">
                  <InfoField label="Region" value={selectedReport.region} />
                  <InfoField label="Area" value={selectedReport.area} />
                  <InfoField label="Location" value={selectedReport.location} fullWidth />
                </CardContent>
              </Card>

              {/* Dealer or Non Trade Split */}
              {isDealerVisit(selectedReport) ? (
                <Card className="border-l-4 border-l-amber-600">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">
                      Dealer Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 pt-2">
                    <InfoField label="Dealer Type" value={selectedReport.dealerType} />
                    <InfoField label="Dealer Name" value={selectedReport.dealerName} />
                    <InfoField label="Sub Dealer" value={selectedReport.subDealerName} />
                    <InfoField label="Brand Selling" value={selectedReport.brandSelling?.join(', ')} fullWidth />
                    <Separator className="col-span-2 my-2" />
                    <InfoField label="Total Potential" value={`${selectedReport.dealerTotalPotential} MT`} />
                    <InfoField label="Best Potential" value={`${selectedReport.dealerBestPotential} MT`} />
                    <InfoField label="Today's Order" value={`${selectedReport.todayOrderMt} MT`} />
                    <InfoField label="Today's Collection" value={`₹${selectedReport.todayCollectionRupees}`} />
                    <InfoField label="Overdue Amount" value={`₹${selectedReport.overdueAmount}`} />
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">
                      Non-Trade Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 pt-2">
                    <InfoField label="Party Type" value={selectedReport.partyType} />
                    <InfoField label="Name of Party" value={selectedReport.nameOfParty} />
                    <InfoField label="Contact No." value={selectedReport.contactNoOfParty} />
                    <InfoField label="Expected Activation Date" value={selectedReport.expectedActivationDate} />
                    <InfoField label="Brand in Use" value={selectedReport.brandSelling?.join(', ')} fullWidth />
                    <Separator className="col-span-2 my-2" />
                    <InfoField label="Total Potential" value={`${selectedReport.dealerTotalPotential} MT`} />
                    <InfoField label="Best Potential" value={`${selectedReport.dealerBestPotential} MT`} />
                  </CardContent>
                </Card>
              )}

              {/* Photo Evidence */}
              <div>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Photo Evidence
                </h4>

                <div className="flex flex-col gap-6">

                  {selectedReport.inTimeImageUrl && (
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <div className="bg-emerald-50 px-4 py-2 text-sm font-semibold border-b flex items-center gap-2 text-emerald-800">
                        <LogIn className="w-4 h-4" /> Check-In Selfie
                      </div>
                      <a href={selectedReport.inTimeImageUrl} target="_blank" rel="noreferrer">
                        <img
                          src={selectedReport.inTimeImageUrl}
                          className="w-full h-auto max-h-[400px] object-contain bg-black/5"
                          alt="Check In"
                        />
                      </a>
                    </div>
                  )}

                  {selectedReport.outTimeImageUrl && (
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <div className="bg-orange-50 px-4 py-2 text-sm font-semibold border-b flex items-center gap-2 text-orange-800">
                        <LogOut className="w-4 h-4" /> Check-Out Selfie
                      </div>
                      <a href={selectedReport.outTimeImageUrl} target="_blank" rel="noreferrer">
                        <img
                          src={selectedReport.outTimeImageUrl}
                          className="w-full h-auto max-h-[400px] object-contain bg-black/5"
                          alt="Check Out"
                        />
                      </a>
                    </div>
                  )}

                </div>
              </div>

            </div>

            <DialogFooter className="p-4 bg-background border-t">
              <Button onClick={() => setIsViewModalOpen(false)}>
                Close Report
              </Button>
            </DialogFooter>

          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}