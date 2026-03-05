// app/dashboard/reports/dailyVisitReports.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  Loader2,
  Search,
  Eye,
  ExternalLink,
  MapPin,
  User,
  Calendar,
  Camera,
  Image as ImageIcon,
  LogIn,
  LogOut,
} from 'lucide-react';

import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
});

type DailyVisitReport = z.infer<typeof extendedDailyVisitReportSchema>;

const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;
const ROLES_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-roles`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}
interface RolesResponse {
  roles: string[];
}

const CUSTOMER_TYPE_OPTIONS = [
  'Dealer',
  'Sub-Dealer',
  'Non-Trade',
  'Other'
];

const renderSelectFilter = (
  label: string,
  value: string,
  onValueChange: (v: string) => void,
  options: string[],
  isLoading: boolean = false
) => (
  <div className="flex flex-col space-y-1 w-full sm:w-[150px] min-w-[120px]">
    <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger className="h-9 w-full bg-background border-input">
        {isLoading ? (
          <div className="flex flex-row items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <SelectValue placeholder={`Select ${label}`} />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        {options.map(option => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

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

const formatTimeIST = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase();
  } catch {
    return 'N/A';
  }
};

const getGoogleMapsLink = (lat?: number | null, lng?: number | null) => {
  if (!lat || !lng) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
};

export default function DailyVisitReportsPage() {
  const router = useRouter();

  const [reports, setReports] = useState<DailyVisitReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedReport, setSelectedReport] = useState<DailyVisitReport | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  // Filters state
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

  /* -------------------- DEBOUNCE & RESET -------------------- */

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, roleFilter, areaFilter, regionFilter, customerTypeFilter]);

  /* -------------------- FETCH -------------------- */

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`/api/dashboardPagesAPI/reports/daily-visit-reports`, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());
      
      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (roleFilter !== 'all') url.searchParams.append('role', roleFilter);
      if (areaFilter !== 'all') url.searchParams.append('area', areaFilter);
      if (regionFilter !== 'all') url.searchParams.append('region', regionFilter);
      if (customerTypeFilter !== 'all') url.searchParams.append('customerType', customerTypeFilter);

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
  }, [router, page, pageSize, debouncedSearchQuery, roleFilter, areaFilter, regionFilter, customerTypeFilter]);

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

  const fetchRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    try {
      const response = await fetch(ROLES_API_ENDPOINT);
      if (response.ok) {
        const data: RolesResponse = await response.json();
        setAvailableRoles(data.roles || []);
      }
    } finally { setIsLoadingRoles(false); }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    fetchLocations();
    fetchRoles();
  }, [fetchLocations, fetchRoles]);

  /* -------------------- TYPE SPLIT -------------------- */

  const isDealerVisit = (r: DailyVisitReport) => !!r.dealerType;

  const columns = useMemo<ColumnDef<DailyVisitReport>[]>(() => [
    {
      accessorKey: "customerType",
      header: "Form Type/Name",
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
          <span className="text-xs text-muted-foreground">{row.original.role}</span>
        </div>
      ),
    },
    {
      accessorKey: "dealerName",
      header: "Dealer / Party",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">
            {row.original.dealerName || row.original.nameOfParty || row.original.subDealerName}
          </span>
        </div>
      ),
    },
    { accessorKey: "region", header: "Region" },
    { accessorKey: "area", header: "Area" },
    { accessorKey: "reportDate", header: "Date" },
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
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-6 p-8 pt-6">

        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">
            Daily Visit Reports
          </h2>
          <Badge variant="outline" className="text-base px-4 py-1">
            Total Reports: {totalCount}
          </Badge>
          <RefreshDataButton
            cachePrefix="daily-visit-reports"
            onRefresh={fetchReports}
          />
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
          {renderSelectFilter('Customer Type', customerTypeFilter, setCustomerTypeFilter, CUSTOMER_TYPE_OPTIONS)}
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
                <span>Visit Details</span>
                <Badge variant="outline" className="text-sm px-3">
                  {selectedReport.customerType}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {selectedReport.salesmanName} ({selectedReport.role})
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