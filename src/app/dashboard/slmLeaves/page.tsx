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
import { Badge } from '@/components/ui/badge'; // For status badges
import { Input } from '@/components/ui/input'; // For search input
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
import { selectSalesmanLeaveApplicationSchema } from '../../../../drizzle/zodSchemas';

// --- EXTEND THE DRIZZLE SCHEMA ---
// Add the relational joined fields and ensure dates don't break validation
const extendedSalesmanLeaveApplicationSchema = selectSalesmanLeaveApplicationSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  salesmanRole: z.string().optional().catch("N/A"),
  role: z.string().optional().catch("N/A"), // Fallback if API uses 'role' instead
  area: z.string().nullable().optional().catch("N/A"),
  region: z.string().nullable().optional().catch("N/A"),
  // Handle cases where dates might come through as stringified Timestamps
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type SalesmanLeaveApplication = Omit<z.infer<typeof extendedSalesmanLeaveApplicationSchema>, 'id'> & { 
  id: string 
};

// --- API Endpoints and Types for Filters ---
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;
const ROLES_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-roles`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}
interface RolesResponse {
  roles: string[];
}

// Helper function to render the Select filter component - KEPT FOR REFERENCE, but not used in final JSX
// const renderSelectFilter = (
//   label: string,
//   value: string,
//   onValueChange: (v: string) => void,
//   options: string[],
//   isLoading: boolean = false
// ) => (
//   <div className="flex flex-col space-y-1 w-full sm:w-[150px] min-w-[120px]">
//     <label className="text-sm font-medium text-muted-foreground">{label}</label>
//     <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
//       <SelectTrigger className="h-9">
//         {isLoading ? (
//           <div className="flex flex-row items-center space-x-2">
//             <Loader2 className="h-4 w-4 animate-spin" />
//             <span className="text-muted-foreground">Loading...</span>
//           </div>
//         ) : (
//           <SelectValue placeholder={`Select ${label}`} />
//         )}
//       </SelectTrigger>
//       <SelectContent>
//         <SelectItem value="all">All {label}s</SelectItem>
//         {options.map(option => (
//           <SelectItem key={option} value={option}>
//             {option}
//           </SelectItem>
//         ))}
//       </SelectContent>
//     </Select>
//   </div>
// );


export default function SlmLeavesPage() {
  const router = useRouter();
  const [leaveApplications, setLeaveApplications] = React.useState<SalesmanLeaveApplication[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = React.useState("");
  // currentPage state REMOVED as DataTableReusable manages it.
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [areaFilter, setAreaFilter] = React.useState('all');
  const [regionFilter, setRegionFilter] = React.useState('all');

  // --- Filter Options States ---
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

  // --- Filter Options Fetching ---
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


  // --- Data Fetching Logic ---
  const apiURI = `/api/dashboardPagesAPI/slm-leaves`
  const fetchLeaveApplications = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(apiURI, window.location.origin);
      // Append date range to API call
      if (dateRange?.from) {
        url.searchParams.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        url.searchParams.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));
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
      const data: SalesmanLeaveApplication[] = await response.json();
      const validatedData = data.map((item) => {
        try {
          // Use id as UniqueIdentifier for DataTableReusable
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
  }, [dateRange, router]);

  React.useEffect(() => {
    fetchLeaveApplications();
  }, [fetchLeaveApplications]);

  React.useEffect(() => {
    fetchLocations();
    fetchRoles();
  }, [fetchLocations, fetchRoles]);

  // --- Handle Leave Approval/Rejection ---
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
      toast.success(`Leave for ${updatedApplication.salesmanName} ${newStatus.toLowerCase()}!`);
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
    setActionRemarks(""); // Reset remarks
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

  // --- Filtering Logic
  const filteredData = React.useMemo(() => {
    const lowerCaseSearch = (searchQuery || '').toLowerCase();

    return leaveApplications.filter((app) => {
      // 1. Search Filter (Salesman, Leave Type, Reason, Status, Admin Remarks, Start/End dates)
      const matchesSearch =
        !lowerCaseSearch ||
        (app.salesmanName || '').toLowerCase().includes(lowerCaseSearch) ||
        (app.leaveType || '').toLowerCase().includes(lowerCaseSearch) ||
        (app.reason || '').toLowerCase().includes(lowerCaseSearch) ||
        (app.status || '').toLowerCase().includes(lowerCaseSearch) ||
        (app.adminRemarks || '').toLowerCase().includes(lowerCaseSearch) ||
        (app.startDate || '').toLowerCase().includes(lowerCaseSearch) ||
        (app.endDate || '').toLowerCase().includes(lowerCaseSearch);

      // 2. Role Filter: backend might not provide role on leave object.
      // Use safe runtime checks via (app as any).salesmanRole or (app as any).role
      const reportRole = ((app as any).salesmanRole || (app as any).role || '').toString();
      const roleMatch = roleFilter === 'all' || reportRole.toLowerCase() === roleFilter.toLowerCase();

      // 3. Area Filter: backend might not have area on leave object
      const reportArea = ((app as any).area || '').toString();
      const areaMatch = areaFilter === 'all' || reportArea.toLowerCase() === areaFilter.toLowerCase();

      // 4. Region Filter
      const reportRegion = ((app as any).region || '').toString();
      const regionMatch = regionFilter === 'all' || reportRegion.toLowerCase() === regionFilter.toLowerCase();

      return matchesSearch && roleMatch && areaMatch && regionMatch;
    });
  }, [leaveApplications, searchQuery, roleFilter, areaFilter, regionFilter]);

  // --- Define Columns for Salesman Leave Applications DataTable ---
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
            className = "bg-green-600 hover:bg-green-700 text-white";
            break;
          case "Rejected":
            className = "bg-red-600 hover:bg-red-700 text-white";
            break;
          case "Pending":
            className = "bg-yellow-500 hover:bg-yellow-600 text-black";
            break;
          default:
            className = "bg-gray-500 hover:bg-gray-600 text-white";
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

  const handleSalesmanLeaveOrderChange = (newOrder: SalesmanLeaveApplication[]) => {
    console.log("New salesman leave report order (for draggable table):", newOrder.map(r => (r as any).id));
  };

  // --- Loading and Error States ---
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <p>Loading salesman leave applications...</p>
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
        {/* Header Section */}
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Salesman Leave Applications</h2>
        </div>

        {/* --- Filters Section --- */}
        <div
          className="rounded-lg border border-border mb-6 bg-card p-6">
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
                      className="w-full h-9 justify-start text-left font-normal"
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
              <label className="text-sm font-medium text-muted-foreground">Search All Fields</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Salesman, Reason, Status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>

            {/* 3) Role */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <Select value={roleFilter} onValueChange={setRoleFilter} disabled={isLoadingRoles}>
                <SelectTrigger className="h-9">
                  {isLoadingRoles ? <span className="text-muted-foreground">Loading…</span> : <SelectValue placeholder="All Roles" />}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {availableRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 4) Area */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Area</label>
              <Select value={areaFilter} onValueChange={setAreaFilter} disabled={isLoadingLocations}>
                <SelectTrigger className="h-9">
                  {isLoadingLocations ? <span className="text-muted-foreground">Loading…</span> : <SelectValue placeholder="All Areas" />}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {availableAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 5) Region */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Region(Zone)</label>
              <Select value={regionFilter} onValueChange={setRegionFilter} disabled={isLoadingLocations}>
                <SelectTrigger className="h-9">
                  {isLoadingLocations ? <span className="text-muted-foreground">Loading…</span> : <SelectValue placeholder="All Regions" />}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {availableRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Errors across full width */}
            {(locationError || roleError) && (
              <div className="sm:col-span-2 lg:col-span-4">
                {locationError && <p className="text-xs text-red-500">Location Filter Error: {locationError}</p>}
                {roleError && <p className="text-xs text-red-500">Role Filter Error: {roleError}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Data Table Section */}
        <div className="bg-card p-6 rounded-lg border border-border">
          {filteredData.length === 0 && !loading && !error ? (
            <div className="text-center text-gray-500 py-8">No salesman leave applications found matching the selected filters.</div>
          ) : (
            <>
              <DataTableReusable
                columns={salesmanLeaveColumns}
                data={filteredData}
                enableRowDragging={false}
                onRowOrderChange={handleSalesmanLeaveOrderChange}
              />
            </>
          )}
        </div>
      </div>
  
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
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