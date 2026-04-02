// src/app/dashboard/slmLeaves/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { UniqueIdentifier } from '@dnd-kit/core';
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Loader2 } from 'lucide-react';

// Import your Shadcn UI components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge'; 
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Import standard components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';

import { selectSalesmanLeaveApplicationSchema } from '../../../../drizzle/zodSchemas';

const extendedSalesmanLeaveApplicationSchema = selectSalesmanLeaveApplicationSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  area: z.string().nullable().optional().catch("N/A"),
  region: z.string().nullable().optional().catch("N/A"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  appRole: z.string().nullable().optional(),
});

type SalesmanLeaveApplication = Omit<z.infer<typeof extendedSalesmanLeaveApplicationSchema>, 'id'> & { 
  id: string 
};

const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}

export default function SlmLeavesPage() {
  const router = useRouter();
  const [leaveApplications, setLeaveApplications] = useState<SalesmanLeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Pagination & Filters ---
  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);

  // --- Backend Filter Options ---
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  // --- Dialog State ---
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<{
    id: UniqueIdentifier;
    type: "Approved" | "Rejected";
    salesmanName: string;
  } | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, areaFilters, zoneFilters, dateRange]);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
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
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data: LocationsResponse = await response.json();

      const safeAreas = Array.isArray(data.areas) ? data.areas.filter(Boolean) : [];
      const safeRegions = Array.isArray(data.regions) ? data.regions.filter(Boolean) : [];

      setAvailableAreas(safeAreas);
      setAvailableRegions(safeRegions);
    } catch (err: any) {
      console.error('Failed to fetch filter locations:', err);
      setLocationError('Failed to load Area/Region filters.');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  const apiURI = `/api/dashboardPagesAPI/slm-leaves`
  const fetchLeaveApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(apiURI, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      
      // Multi-select arrays joined by comma
      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
      if (zoneFilters.length > 0) url.searchParams.append('region', zoneFilters.join(','));

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
      const data = result.data || result;
      setTotalCount(result.totalCount || 0);

      const validatedData = data.map((item: any) => {
        try {
          const validated = extendedSalesmanLeaveApplicationSchema.parse(item);
          return { ...validated, id: validated.id.toString() } as SalesmanLeaveApplication;
        } catch (e) {
          console.error("Validation error for item:", item, e);
          return null;
        }
      }).filter(Boolean) as SalesmanLeaveApplication[];

      setLeaveApplications(validatedData);
      toast.success("Salesman leave applications loaded successfully!");
    } catch (e: any) {
      console.error("Failed to fetch salesman leave applications:", e);
      setError(e.message || "Failed to fetch leave applications.");
      toast.error(e.message || "Failed to load salesman leave applications.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearchQuery, areaFilters, zoneFilters, dateRange, router]);

  useEffect(() => {
    fetchLeaveApplications();
  }, [fetchLeaveApplications]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const zoneOptions = useMemo(() => availableRegions.map(r => ({ label: r, value: r })), [availableRegions]);
  const areaOptions = useMemo(() => availableAreas.map(a => ({ label: a, value: a })), [availableAreas]);

  // --- Action Handlers ---
  const handleLeaveAction = async (id: UniqueIdentifier, newStatus: "Approved" | "Rejected", remarks: string | null = null) => {
    try {
      const response = await fetch(apiURI, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status: newStatus, adminRemarks: remarks }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const updatedApplication: SalesmanLeaveApplication = await response.json();

      setLeaveApplications((prevApplications) =>
        prevApplications.map((app) =>
          app.id === id
            ? { ...app, status: updatedApplication.status, adminRemarks: updatedApplication.adminRemarks }
            : app
        )
      );
      toast.success(`Leave ${newStatus.toLowerCase()}!`);
    } catch (e: any) {
      console.error("Failed to update leave application:", e);
      toast.error(e.message || "Failed to update leave application.");
    }
  };

  const openActionDialog = (app: SalesmanLeaveApplication, type: "Approved" | "Rejected") => {
    setCurrentAction({
      id: app.id,
      type: type,
      salesmanName: app.salesmanName || "Unknown"
    });
    setActionRemarks(""); 
    setIsDialogOpen(true);
  };

  const submitActionDialog = async () => {
    if (!currentAction) return;

    setIsSubmittingAction(true);
    await handleLeaveAction(currentAction.id, currentAction.type, actionRemarks);
    setIsSubmittingAction(false);
    setIsDialogOpen(false);
    setCurrentAction(null);
  };

  // --- Table Columns ---
  const salesmanLeaveColumns: ColumnDef<SalesmanLeaveApplication>[] = useMemo(() => [
    { accessorKey: "salesmanName", header: "Salesman" },
    { accessorKey: "leaveType", header: "Leave Type" },
    { accessorKey: "startDate", header: "Start Date" },
    { accessorKey: "endDate", header: "End Date" },
    {
      accessorKey: "reason", header: "Reason",
      cell: ({ row }) => <span className="max-w-[250px]">{row.original.reason}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        let className = "";
        switch (status) {
          case "Approved":
            className = "bg-green-600 hover:bg-green-700 text-white shadow-none";
            break;
          case "Rejected":
            className = "bg-red-600 hover:bg-red-700 text-white shadow-none";
            break;
          case "Pending":
            className = "bg-yellow-500 hover:bg-yellow-600 text-black shadow-none";
            break;
          default:
            className = "bg-gray-500 hover:bg-gray-600 text-white shadow-none";
        }
        return (
          <Badge className={className}>
            {status}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const app = row.original;
        const isPending = app.status === 'Pending';

        if (!isPending) {
          return <span className="text-sm text-muted-foreground">{app.adminRemarks ? `Remark: ${app.adminRemarks}` : '—'}</span>;
        }

        return (
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={() => openActionDialog(app, 'Approved')} 
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Accept
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => openActionDialog(app, 'Rejected')} 
              className="border-red-500 text-red-600 hover:bg-red-50"
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ], []);

  if (loading && leaveApplications.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <p className="text-muted-foreground">Loading salesman leave applications...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 min-h-screen pt-10">
        Error: {error}
        <Button onClick={fetchLeaveApplications} className="ml-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        
        <div className="flex items-center justify-between space-y-2">
          <div className="flex items-center gap-4">
              <h2 className="text-3xl font-bold tracking-tight">Leave Applications</h2>
              <Badge variant="outline" className="text-base px-4 py-1">
                 Total Records: {totalCount}
              </Badge>
          </div>
          <RefreshDataButton
            cachePrefix="salesman-leaves"
            onRefresh={fetchLeaveApplications}
          />
        </div>

        {/* --- Unified Global Filter Bar --- */}
        <GlobalFilterBar 
          showSearch={true}
          showDateRange={true}
          showZone={true}
          showArea={true}
          showRole={false}
          showStatus={false}

          searchVal={searchQuery}
          dateRangeVal={dateRange}
          zoneVals={zoneFilters}
          areaVals={areaFilters}

          zoneOptions={zoneOptions}
          areaOptions={areaOptions}

          onSearchChange={setSearchQuery}
          onDateRangeChange={setDateRange}
          onZoneChange={setZoneFilters}
          onAreaChange={setAreaFilters}
        />

        {(locationError) && (
          <div className="mb-4">
            <p className="text-xs text-red-500">Location Filter Error: {locationError}</p>
          </div>
        )}

        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {leaveApplications.length === 0 && !loading && !error ? (
            <div className="text-center text-muted-foreground py-8">No salesman leave applications found matching the selected filters.</div>
          ) : (
            <DataTableReusable
              columns={salesmanLeaveColumns}
              data={leaveApplications}
              enableRowDragging={false}
              onRowOrderChange={() => {}}
            />
          )}
        </div>
      </div>
  
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-background">
          <DialogHeader>
            <DialogTitle>{currentAction?.type === 'Approved' ? 'Approve Leave' : 'Reject Leave'}</DialogTitle>
            <DialogDescription>
              Add optional remarks for {currentAction?.salesmanName}'s leave application.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="remarks">Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                placeholder="Enter remarks here..."
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                className="bg-muted/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmittingAction}>
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={submitActionDialog}
              disabled={isSubmittingAction}
              className={currentAction?.type === 'Approved' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {isSubmittingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm {currentAction?.type === 'Approved' ? 'Approval' : 'Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}