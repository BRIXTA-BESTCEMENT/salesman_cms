// src/app/dashboard/masonpcSide/bagsLift.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { format } from 'date-fns';
import { DateRange } from "react-day-picker";
import {
 MapPin, Loader2, Check, X, Eye, ExternalLink
} from 'lucide-react';

// Import standard components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';

import { selectBagLiftSchema } from '../../../../drizzle/zodSchemas'; 

// UI Components
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BAG_LIFT_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/bags-lift`;
const BAG_LIFT_ACTION_API_BASE = `/api/dashboardPagesAPI/masonpc-side/bags-lift`;
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}

const extendedSchema = selectBagLiftSchema.loose().extend({
  masonName: z.string(),
  dealerName: z.string().nullable().optional(),
  approverName: z.string().nullable().optional(),
  associatedSalesmanName: z.string().nullable().optional(),
  siteKeyPersonName: z.string().nullable().optional(),
  siteKeyPersonPhone: z.string().nullable().optional(),
  siteName: z.string().nullable().optional(),
  siteAddress: z.string().nullable().optional(),
  verificationSiteImageUrl: z.string().nullable().optional(),
  verificationProofImageUrl: z.string().nullable().optional(),
  area: z.string().optional().catch("N/A"),
  region: z.string().optional().catch("N/A"),
  purchaseDate: z.string(),
  createdAt: z.string(),
  approvedAt: z.string().nullable().optional(),
});

type BagLiftRecord = z.infer<typeof extendedSchema>;

const formatIndianNumber = (num: number) => {
  return new Intl.NumberFormat('en-IN').format(num);
};

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateString));
  } catch {
    return 'Invalid Date';
  }
};

const getStatusBadgeVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'approved':
    case 'verified':
      return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200';
  }
};

export default function BagsLiftPage() {
  const [bagLiftRecords, setBagLiftRecords] = useState<BagLiftRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  // --- Backend Filter Options ---
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BagLiftRecord | null>(null);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, statusFilter, areaFilters, zoneFilters, dateRange]);


  const fetchBagLiftRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(BAG_LIFT_API_ENDPOINT, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (statusFilter !== 'all') url.searchParams.append('status', statusFilter);
      
      // Join arrays for multi-select
      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
      if (zoneFilters.length > 0) url.searchParams.append('region', zoneFilters.join(','));

      if (dateRange?.from) url.searchParams.append('fromDate', format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange?.to) {
        url.searchParams.append('toDate', format(dateRange.to, "yyyy-MM-dd"));
      } else if (dateRange?.from) {
        url.searchParams.append('toDate', format(dateRange.from, "yyyy-MM-dd"));
      }

      const response = await fetch(url.toString());
      const result = await response.json();
      const data: any[] = result.data || result;
      
      setTotalCount(result.totalCount || 0);

      const validatedData = data.map(item => {
          const v = extendedSchema.parse(item);
          return { ...v, id: v.id.toString() } as BagLiftRecord;
      });

      setBagLiftRecords(validatedData);
      toast.success("Bag Lift records loaded successfully!");
    } catch (error: any) {
      console.error("Failed to fetch Bag Lift records:", error);
      toast.error(`Failed to fetch Bag Lift records: ${error.message}`);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearchQuery, statusFilter, areaFilters, zoneFilters, dateRange]);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data: LocationsResponse = await response.json();
      setAvailableAreas(Array.isArray(data.areas) ? data.areas.filter(Boolean).sort() : []);
      setAvailableRegions(Array.isArray(data.regions) ? data.regions.filter(Boolean).sort() : []);
    } catch (err: any) {
      console.error('Failed to fetch filter locations:', err);
      setLocationError('Failed to load Area/Region filters.');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    fetchBagLiftRecords();
  }, [fetchBagLiftRecords]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const zoneOptions = useMemo(() => availableRegions.sort().map(r => ({ label: r, value: r })), [availableRegions]);
  const areaOptions = useMemo(() => availableAreas.sort().map(a => ({ label: a, value: a })), [availableAreas]);
  const statusOptions = useMemo(() => [
    { label: 'All Statuses', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' }
  ], []);

  const openViewModal = (record: BagLiftRecord) => {
    setSelectedRecord(record);
    setIsViewModalOpen(true);
  };

  const handleStatusUpdate = async (id: string, newStatus: 'approved' | 'rejected') => {
    setIsUpdatingId(id);
    const toastId = `baglift-${id}-${newStatus}`;
    toast.loading(`${newStatus === 'approved' ? 'Approving' : 'Rejecting'} bag lift...`, { id: toastId });

    try {
      const response = await fetch(`${BAG_LIFT_ACTION_API_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Update failed.');
      }

      toast.success(`Bag Lift successfully ${newStatus}.`, { id: toastId });
      await fetchBagLiftRecords();
    } catch (err: any) {
      toast.error(err.message || 'An unknown error occurred.', { id: toastId });
    } finally {
      setIsUpdatingId(null);
    }
  };

  // --- Counter Calculations (Reflecting current page payload for dynamic updates) ---
  const stats = useMemo(() => {
    const totalBags = bagLiftRecords.reduce((acc, curr) => acc + (Number(curr.bagCount) || 0), 0);
    const pointsPending = bagLiftRecords
      .filter(r => r.status.toLowerCase() === 'pending')
      .reduce((acc, curr) => acc + (Number(curr.pointsCredited) || 0), 0);
    const pointsApproved = bagLiftRecords
      .filter(r => r.status.toLowerCase() === 'approved')
      .reduce((acc, curr) => acc + (Number(curr.pointsCredited) || 0), 0);

    return { totalBags, pointsPending, pointsApproved };
  }, [bagLiftRecords]);

  const bagLiftColumns: ColumnDef<BagLiftRecord>[] = [
    { accessorKey: "masonName", header: "Mason Name" },
    { accessorKey: "phoneNumber", header: "Mason Phone" },
    { accessorKey: "dealerName", header: "Associated Dealer", cell: info => info.getValue() || '-' },
    {
      accessorKey: "purchaseDate",
      header: "Purchase Date",
      cell: ({ row }) => formatDate(row.original.purchaseDate)
    },
    { accessorKey: "bagCount", header: "Bags" },
    {
      accessorKey: "pointsCredited",
      header: "Points",
      cell: ({ row }) => <span className="font-medium">{row.original.pointsCredited}</span>
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={cn("capitalize shadow-none", getStatusBadgeVariant(row.original.status))}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "approverName",
      header: "Approved By",
      cell: ({ row }) => {
        const actualApprover = row.original.approverName;
        const associatedSalesman = row.original.associatedSalesmanName;

        const displayName = actualApprover || associatedSalesman;
        const isAssociated = !actualApprover && associatedSalesman;

        if (!displayName) return <span className="text-muted-foreground">-</span>;

        return (
          <div className="flex flex-col">
            <span className={cn("font-medium", isAssociated && "text-foreground")}>
              {displayName}
            </span>
            {isAssociated && <span className="text-[10px] text-foreground italic">(Associated)</span>}
          </div>
        );
      }
    },
    {
      accessorKey: "approvedAt",
      header: "Approved On",
      cell: ({ row }) => formatDate(row.original.approvedAt)
    },
    { accessorKey: "area", header: "Area", cell: info => info.getValue() || '-' },
    { accessorKey: "region", header: "Region(Zone)", cell: info => info.getValue() || '-' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const record = row.original;
        const isPending = record.status.toLowerCase() === 'pending';
        const isUpdating = isUpdatingId === record.id;

        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openViewModal(record)}
              className="text-blue-500 border-blue-500 hover:bg-blue-50 h-8 px-2"
            >
              <Eye className="h-3.5 w-3.5 mr-1" /> View
            </Button>

            {isPending && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 h-8 px-2"
                  onClick={() => handleStatusUpdate(record.id, 'approved')}
                  disabled={isUpdating}
                >
                  {isUpdating && isUpdatingId === record.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    : <Check className="h-3.5 w-3.5 mr-1" />}
                  Approve
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => handleStatusUpdate(record.id, 'rejected')}
                  disabled={isUpdating}
                >
                  {isUpdating && isUpdatingId === record.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    : <X className="h-3.5 w-3.5 mr-1" />}
                  Reject
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold tracking-tight">Bag Lift Records</h2>
                <Badge variant="outline" className="text-base px-4 py-1">
                    Total Records: {totalCount}
                </Badge>
            </div>
            <RefreshDataButton
               cachePrefix="bags-lift"
               onRefresh={fetchBagLiftRecords}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bags Lifted (This Page)</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-muted-foreground"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" /></svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatIndianNumber(stats.totalBags)}</div>
                <p className="text-xs text-muted-foreground">Sum of current results</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Points Pending</CardTitle>
                <Loader2 className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{formatIndianNumber(stats.pointsPending)}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Points Approved</CardTitle>
                <Check className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatIndianNumber(stats.pointsApproved)}</div>
                <p className="text-xs text-muted-foreground">Successfully credited</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* --- Unified Global Filter Bar --- */}
        <div className="w-full">
          <GlobalFilterBar 
            showSearch={true}
            showRole={false}
            showZone={true}
            showArea={true}
            showDateRange={true}
            showStatus={true}

            searchVal={searchQuery}
            dateRangeVal={dateRange}
            zoneVals={zoneFilters}
            areaVals={areaFilters}
            statusVal={statusFilter}

            zoneOptions={zoneOptions}
            areaOptions={areaOptions}
            statusOptions={statusOptions}

            onSearchChange={setSearchQuery}
            onDateRangeChange={setDateRange}
            onZoneChange={setZoneFilters}
            onAreaChange={setAreaFilters}
            onStatusChange={setStatusFilter}
          />
        </div>

        {locationError && <p className="text-xs text-red-500 w-full mt-2 italic">Location Filter Error: {locationError}</p>}

        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {isLoading && bagLiftRecords.length === 0 ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading Bag Lift records...</span>
            </div>
          ) : bagLiftRecords.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No Bag Lift records found matching the selected filters.</div>
          ) : (
            <DataTableReusable
              columns={bagLiftColumns}
              data={bagLiftRecords}
              enableRowDragging={false}
              onRowOrderChange={() => {}}
            />
          )}
        </div>
      </div>

      {selectedRecord && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-background">
            <DialogHeader>
              <DialogTitle>Bag Lift Details</DialogTitle>
              <DialogDescription>
                Review the full Bag Lift information for this Mason.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="md:col-span-2 text-lg font-semibold border-b pb-2">
                Mason & Dealer Info
              </div>

              <div>
                <Label>Mason Name</Label>
                <Input value={selectedRecord.masonName} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label>Associated Dealer</Label>
                <Input value={selectedRecord.dealerName || 'N/A'} readOnly className="bg-muted/50" />
              </div>

              <div>
                <Label>Site Key Person Name</Label>
                <Input value={selectedRecord.siteKeyPersonName || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label>Site Key Person Phone</Label>
                <Input value={selectedRecord.siteKeyPersonPhone || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div className="md:col-span-2">
                <Label>Site Name & Address</Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8 bg-muted/50"
                    value={
                      selectedRecord.siteName
                        ? `${selectedRecord.siteName} — ${selectedRecord.siteAddress || 'No Address'}`
                        : 'N/A'
                    }
                    readOnly
                  />
                </div>
              </div>

              <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">
                Bag Lift Details
              </div>

              <div>
                <Label>Purchase Date</Label>
                <Input value={formatDate(selectedRecord.purchaseDate)} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label>Bag Count</Label>
                <Input value={selectedRecord.bagCount} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label>Points Credited</Label>
                <Input value={selectedRecord.pointsCredited} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label>Status</Label>
                <Input value={selectedRecord.status} readOnly className="bg-muted/50" />
              </div>

              <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">
                Approval Info
              </div>

              <div>
                <Label>Approved By</Label>
                <Input value={selectedRecord.approverName || selectedRecord.associatedSalesmanName || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label>Approved At</Label>
                <Input value={formatDate(selectedRecord.approvedAt)} readOnly className="bg-muted/50" />
              </div>

              {selectedRecord.imageUrl && (
                <div className="md:col-span-2">
                  <Label htmlFor="bagLiftImage">Mason Bag Lift Image</Label>
                  <div id="bagLiftImage" className="mt-2 border p-2 rounded-md bg-muted/30">
                    <a
                      href={selectedRecord.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center text-sm font-medium mb-2"
                    >
                      View Original Image <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                    <img
                      src={selectedRecord.imageUrl}
                      alt="Bag Lift"
                      className="w-full h-auto rounded-md border"
                    />
                  </div>
                </div>
              )}

              {(selectedRecord.verificationSiteImageUrl || selectedRecord.verificationProofImageUrl) && (
                <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">
                  TSO Verification Image
                </div>
              )}

              {selectedRecord.verificationSiteImageUrl && (
                <div className="md:col-span-2">
                  <Label>Site Verification Image</Label>
                  <div className="mt-2 border p-2 rounded-md bg-muted/30">
                    <a
                      href={selectedRecord.verificationSiteImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center text-xs font-medium mb-2"
                    >
                      View Original <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                    <img
                      src={selectedRecord.verificationSiteImageUrl}
                      alt="Site Proof"
                      className="w-full h-auto rounded-md border"
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setIsViewModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}