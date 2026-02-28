// src/app/dashboard/slmLeaves/page.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { UniqueIdentifier } from '@dnd-kit/core';
import { format, addDays } from "date-fns";
import { DateRange } from "react-day-picker";

// Import your Shadcn UI components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge'; 
import { Input } from '@/components/ui/input'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Search, Loader2 } from 'lucide-react';
import { IconCalendar } from '@tabler/icons-react';

// Import the reusable DataTable
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { cn } from '@/lib/utils';
import { selectSalesmanLeaveApplicationSchema } from '../../../../drizzle/zodSchemas';

const extendedSalesmanLeaveApplicationSchema = selectSalesmanLeaveApplicationSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  salesmanRole: z.string().optional().catch("N/A"),
  role: z.string().optional().catch("N/A"), 
  area: z.string().nullable().optional().catch("N/A"),
  region: z.string().nullable().optional().catch("N/A"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type SalesmanLeaveApplication = Omit<z.infer<typeof extendedSalesmanLeaveApplicationSchema>, 'id'> & { 
  id: string 
};

const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;
const ROLES_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-roles`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}
interface RolesResponse {
  roles: string[];
}

export default function SlmLeavesPage() {
  const router = useRouter();
  const [leaveApplications, setLeaveApplications] = React.useState<SalesmanLeaveApplication[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // --- Pagination & Filters ---
  const [page, setPage] = React.useState(0);
  const [pageSize] = React.useState(500);
  const [totalCount, setTotalCount] = React.useState(0);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [areaFilter, setAreaFilter] = React.useState('all');
  const [regionFilter, setRegionFilter] = React.useState('all');

  const [availableRoles, setAvailableRoles] = React.useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = React.useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = React.useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = React.useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = React.useState(true);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [roleError, setRoleError] = React.useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [currentAction, setCurrentAction] = React.useState<{
    id: UniqueIdentifier;
    type: "Approved" | "Rejected";
    salesmanName: string;
  } | null>(null);
  const [actionRemarks, setActionRemarks] = React.useState("");
  const [isSubmittingAction, setIsSubmittingAction] = React.useState(false);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, roleFilter, areaFilter, regionFilter, dateRange]);

  const fetchLocations = React.useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
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

  const fetchRoles = React.useCallback(async () => {
    setIsLoadingRoles(true);
    setRoleError(null);
    try {
      const response = await fetch(ROLES_API_ENDPOINT);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data: RolesResponse = await response.json();
      setAvailableRoles(data.roles && Array.isArray(data.roles) ? data.roles.filter(Boolean) : []);
    } catch (err: any) {
      console.error('Failed to fetch filter roles:', err);
      setRoleError('Failed to load Role filters.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  const apiURI = `/api/dashboardPagesAPI/slm-leaves`
  const fetchLeaveApplications = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(apiURI, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (roleFilter !== 'all') url.searchParams.append('role', roleFilter);
      if (areaFilter !== 'all') url.searchParams.append('area', areaFilter);
      if (regionFilter !== 'all') url.searchParams.append('region', regionFilter);

      if (dateRange?.from) url.searchParams.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange?.to) {
        url.searchParams.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));
      } else if (dateRange?.from) {
        url.searchParams.append('endDate', format(dateRange.from, 'yyyy-MM-dd'));
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('You are not authenticated. Redirecting to login.');
          router.push('/login');
          return;
        }
        if (response.status === 403) {
          toast.error('You do not have permission to access this page. Redirecting.');
          router.push('/dashboard');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
  }, [page, pageSize, debouncedSearchQuery, roleFilter, areaFilter, regionFilter, dateRange, router]);

  React.useEffect(() => {
    fetchLeaveApplications();
  }, [fetchLeaveApplications]);

  React.useEffect(() => {
    fetchLocations();
    fetchRoles();
  }, [fetchLocations, fetchRoles]);

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

  const salesmanLeaveColumns: ColumnDef<SalesmanLeaveApplication>[] = [
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
  ];

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

        {/* --- Filters Section --- */}
        <div className="rounded-lg border border-border mb-6 bg-card p-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* 1) Date Range */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Filter by Leave Date Range</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant="outline"
                      className="w-full h-9 justify-start text-left font-normal bg-background"
                    >
                      <IconCalendar className="mr-2 h-4 w-4" />
                      {dateRange?.from
                        ? (dateRange.to
                          ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`
                          : `${format(dateRange.from, "LLL dd, y")}`)
                        : "Select range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      defaultMonth={dateRange?.from || addDays(new Date(), -7)}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>

                {dateRange && (
                  <Button variant="ghost" onClick={() => setDateRange(undefined)} className="h-9">
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* 2) Search */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Search Fields</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Salesman, Reason, Status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 border-border bg-background"
                />
              </div>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <Select value={roleFilter} onValueChange={setRoleFilter} disabled={isLoadingRoles}>
                <SelectTrigger className="h-9 bg-background">
                  {isLoadingRoles ? <span className="text-muted-foreground">Loading…</span> : <SelectValue placeholder="All Roles" />}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {availableRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Area</label>
              <Select value={areaFilter} onValueChange={setAreaFilter} disabled={isLoadingLocations}>
                <SelectTrigger className="h-9 bg-background">
                  {isLoadingLocations ? <span className="text-muted-foreground">Loading…</span> : <SelectValue placeholder="All Areas" />}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {availableAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Region(Zone)</label>
              <Select value={regionFilter} onValueChange={setRegionFilter} disabled={isLoadingLocations}>
                <SelectTrigger className="h-9 bg-background">
                  {isLoadingLocations ? <span className="text-muted-foreground">Loading…</span> : <SelectValue placeholder="All Regions" />}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {availableRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {(locationError || roleError) && (
              <div className="sm:col-span-2 lg:col-span-4">
                {locationError && <p className="text-xs text-red-500">Location Filter Error: {locationError}</p>}
                {roleError && <p className="text-xs text-red-500">Role Filter Error: {roleError}</p>}
              </div>
            )}
          </div>
        </div>

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