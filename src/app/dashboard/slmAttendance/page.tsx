// src/app/dashboard/slmAttendance/page.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { format, addDays } from "date-fns";
import { DateRange } from "react-day-picker";

// Import your Shadcn UI components
import { Button } from '@/components/ui/button';
import { IconCheck, IconX, IconCalendar } from '@tabler/icons-react';
import { ExternalLink, Users, CheckCircle2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Import the reusable DataTable
import { DataTableReusable } from '@/components/data-table-reusable';
import { cn } from '@/lib/utils';
import { salesmanAttendanceSchema } from '@/lib/shared-zod-schema';
import SyncLocationBtn from '@/app/home/customReportGenerator/syncLocationBtn';
//import { BASE_URL } from '@/lib/Reusable-constants';

type SalesmanAttendanceReport = z.infer<typeof salesmanAttendanceSchema>;

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

// Helper function to render the Select filter component (KEPT)
const renderSelectFilter = (
  label: string,
  value: string,
  onValueChange: (v: string) => void,
  options: string[],
  isLoading: boolean = false
) => (
  <div className="flex flex-col space-y-1.5 w-full">
    <label className="text-sm font-medium text-muted-foreground">{label}</label>
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger className="h-10 w-full bg-background border-border shadow-sm">
        {isLoading ? (
          <div className="flex flex-row items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <SelectValue placeholder={`Select ${label}`} />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label}s</SelectItem>
        {options.map(option => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default function SlmAttendancePage() {
  const router = useRouter();
  const [attendanceReports, setAttendanceReports] = React.useState<SalesmanAttendanceReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = React.useState("");

  const [jobTitleFilter, setJobTitleFilter] = React.useState('all'); // e.g., executive, manager
  const [companyCategoryFilter, setCompanyCategoryFilter] = React.useState('all'); // SALES, TECHNICAL

  const [areaFilter, setAreaFilter] = React.useState('all');
  const [regionFilter, setRegionFilter] = React.useState('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);

  // --- Filter Options States (KEPT) ---
  const [availableJobTitles, setAvailableJobTitles] = React.useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = React.useState<string[]>([]); // user's company role
  const [availableAreas, setAvailableAreas] = React.useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = React.useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = React.useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = React.useState(true);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [roleError, setRoleError] = React.useState<string | null>(null);

  // Modal states (KEPT)
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false);
  const [selectedReport, setSelectedReport] = React.useState<SalesmanAttendanceReport | null>(null);

  // --- Data Fetching Logic (KEPT) ---
  const fetchAttendanceReports = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/dashboardPagesAPI/slm-attendance`, window.location.origin);
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
      const data: SalesmanAttendanceReport[] = await response.json();
      const validatedData = data.map((item) => {
        try {
          // Add ID property needed by DataTableReusable (assuming ID is available in schema)
          const validated = salesmanAttendanceSchema.parse(item);
          return { ...validated, id: validated.id.toString() };
        } catch (e) {
          console.error("Validation error for item:", item, e);
          return null;
        }
      }).filter(Boolean) as SalesmanAttendanceReport[];

      setAttendanceReports(validatedData);
      toast.success("Salesman attendance reports loaded successfully!");
    } catch (e: any) {
      console.error("Failed to fetch salesman attendance reports:", e);
      setError(e.message || "Failed to fetch reports.");
      toast.error(e.message || "Failed to load salesman attendance reports.");
    } finally {
      setLoading(false);
    }
  }, [dateRange, router]);

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

      const rolesList = data.roles && Array.isArray(data.roles) ? data.roles.filter(Boolean) : [];
      setAvailableJobTitles(rolesList);

    } catch (err: any) {
      console.error('Failed to fetch filter roles:', err);
      setRoleError('Failed to load Role filters.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);


  React.useEffect(() => {
    fetchAttendanceReports();
  }, [fetchAttendanceReports]);

  React.useEffect(() => {
    fetchLocations();
    fetchRoles();
  }, [fetchLocations, fetchRoles]);

  // --- Summary Card Calculations ---
  const todayStats = React.useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd'); // Matches standard DB date format

    const reportsForToday = attendanceReports.filter(report => {
      // If report.date is ISO or YYYY-MM-DD, we ensure it matches today
      const reportDate = format(new Date(report.date), 'yyyy-MM-dd');
      return reportDate === todayStr;
    });

    return {
      // Checked in today
      present: reportsForToday.filter(r => r.inTime).length,
      // Checked in AND Checked out today
      completed: reportsForToday.filter(r => r.inTime && r.outTime).length
    };
  }, [attendanceReports]);

  // --- Filtering Logic ---
  const filteredReports = React.useMemo(() => {
    const lowerCaseSearch = (searchQuery || '').toLowerCase();

    return attendanceReports.filter((report) => {
      // 1. Search Filter
      const matchesSearch =
        !lowerCaseSearch ||
        (report.salesmanName && report.salesmanName.toLowerCase().includes(lowerCaseSearch)) ||
        (report.date && report.date.toLowerCase().includes(lowerCaseSearch)) ||
        (report.location && report.location.toLowerCase().includes(lowerCaseSearch));

      // 2. User Role (Designation: Executive, Manager, etc.)
      // Based on your columns: salesmanRole contains the designation
      const reportDesignation = report.salesmanRole || '';
      const matchesJobTitle = jobTitleFilter === 'all' ||
        reportDesignation.toLowerCase() === jobTitleFilter.toLowerCase();

      // 3. Company Role (Category: SALES, TECHNICAL)
      // Based on your columns: role contains the category
      const reportCategory = report.role || '';
      const matchesCategory = companyCategoryFilter === 'all' ||
        reportCategory.toUpperCase() === companyCategoryFilter.toUpperCase();

      // 4. Area & Region Filter (Safety added)
      // If the record doesn't have 'area' or 'region' properties, we only filter if the user selected 'all'
      const reportArea = (report as any).area || '';
      const areaMatch = areaFilter === 'all' ||
        (reportArea && reportArea.toLowerCase() === areaFilter.toLowerCase());

      const reportRegion = (report as any).region || '';
      const regionMatch = regionFilter === 'all' ||
        (reportRegion && reportRegion.toLowerCase() === regionFilter.toLowerCase());

      return matchesSearch && matchesJobTitle && matchesCategory && areaMatch && regionMatch;
    });
  }, [attendanceReports, searchQuery, jobTitleFilter, companyCategoryFilter, areaFilter, regionFilter]);
  const handleViewReport = (report: SalesmanAttendanceReport) => {
    setSelectedReport(report);
    setIsViewModalOpen(true);
  };

  // Helper Component for Reverse Geocoding
  const LocationCell = ({ locationName, lat, lng }: { locationName: string, lat?: number, lng?: number }) => {
    const [address, setAddress] = React.useState(locationName);
    const [isFetching, setIsFetching] = React.useState(false);

    // We define the fetch logic as a reusable function
    const fetchAddress = React.useCallback(async () => {
      if (!lat || !lng) return;

      setIsFetching(true);
      try {
        // Nominatim requires a User-Agent, though browsers send one automatically.
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9', // Request English results
          }
        });

        if (!res.ok) throw new Error("Rate Limit or Network Error");

        const data = await res.json();
        if (data && data.display_name) {
          setAddress(data.display_name);
        }
      } catch (error) {
        console.warn("Geocoding failed for:", lat, lng);
        // We keep the address as "Live Location" so the user can try again
      } finally {
        setIsFetching(false);
      }
    }, [lat, lng]);

    React.useEffect(() => {
      // Only attempt auto-fetch if it's a raw "Live Location"
      if ((locationName === 'Live Location' || locationName === 'Live Location (GPS Only)') && lat && lng) {

        // 🟢 STAGGER LOGIC: Random delay between 0ms and 3000ms
        // This prevents hitting the API rate limit when loading 50 rows at once
        const delay = Math.random() * 3000;

        const timer = setTimeout(() => {
          fetchAddress();
        }, delay);

        return () => clearTimeout(timer);
      } else {
        setAddress(locationName);
      }
    }, [locationName, lat, lng, fetchAddress]);

    // Check if we are still showing the placeholder text
    const isGenericAddress = address.includes('Live Location');

    return (
      <div className="flex items-center gap-2 max-w-[300px]">
        <span className="truncate block text-xs sm:text-sm" title={address}>
          {address}
        </span>

        {/* Show Loader while fetching */}
        {isFetching && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
        )}

        {/* Show Refresh Button ONLY if we aren't fetching AND it's still a generic address */}
        {!isFetching && isGenericAddress && lat && lng && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click
              fetchAddress();
            }}
            title="Retry fetching address"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  // --- NEW: Helper function to format time in IST (KEPT) ---
  const formatTimeIST = (isoString: string | null | undefined) => {
    if (!isoString) return 'N/A';
    try {
      return new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZone: 'Asia/Kolkata', // Forcibly format in Indian Standard Time
      }).format(new Date(isoString));
    } catch (e) {
      return 'Invalid Date'; // Fallback for any error
    }
  };

  // --- Columns Definition (FIXED CELL RETURNS) ---
  const salesmanAttendanceColumns: ColumnDef<SalesmanAttendanceReport>[] = [
    { accessorKey: "salesmanName", header: "Salesman" },
    { accessorKey: "role", header: "User Company Role" },
    { accessorKey: "salesmanRole", header: "User Role" },
    {
      accessorKey: 'date',
      header: 'Report Date',
      cell: ({ row }) => {
        const date = new Date(row.original.date);
        const formattedDate = new Intl.DateTimeFormat('en-IN', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          timeZone: 'Asia/Kolkata'
        }).format(date);
        return <div>{formattedDate}</div>;
      },
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => (
        <LocationCell
          locationName={row.original.location}
          lat={row.original.inTimeLatitude}
          lng={row.original.inTimeLongitude}
        />
      ),
    },
    {
      accessorKey: 'inTime',
      header: 'In Time',
      cell: ({ row }) => ( // ADDED PARENTHESES TO IMPLICITLY RETURN SPAN
        <span>
          {row.original.inTime
            ? formatTimeIST(row.original.inTime)
            : 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: 'outTime',
      header: 'Out Time',
      cell: ({ row }) => ( // ADDED PARENTHESES TO IMPLICITLY RETURN SPAN
        <span>
          {row.original.outTime
            ? formatTimeIST(row.original.outTime)
            : 'N/A (Still In)'}
        </span>
      ),
    },
    {
      id: "inTimeImage",
      header: "In Image",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.inTimeImageCaptured ? (
            row.original.inTimeImageUrl ? (
              <a href={row.original.inTimeImageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                <IconCheck className="h-4 w-4 text-green-500" /> View <ExternalLink size={14} />
              </a>
            ) : (
              <span className="flex items-center gap-1"><IconCheck className="h-4 w-4 text-green-500" /> Yes</span>
            )
          ) : (
            <span className="flex items-center gap-1"><IconX className="h-4 w-4 text-red-500" /> No</span>
          )}
        </div>
      ),
    },
    {
      id: "outTimeImage",
      header: "Out Image",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.outTimeImageCaptured ? (
            row.original.outTimeImageUrl ? (
              <a href={row.original.outTimeImageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                <IconCheck className="h-4 w-4 text-green-500" /> View <ExternalLink size={14} />
              </a>
            ) : (
              <span className="flex items-center gap-1"><IconCheck className="h-4 w-4 text-green-500" /> Yes</span>
            )
          ) : (
            <span className="flex items-center gap-1"><IconX className="h-4 w-4 text-red-500" /> No</span>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "View Details",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleViewReport(row.original)}
        >
          View
        </Button>
      ),
    },
  ];

  const handleSalesmanAttendanceOrderChange = (newOrder: SalesmanAttendanceReport[]) => {
    console.log("New salesman attendance report order:", newOrder.map(r => r.id));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <p>Loading salesman attendance reports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 min-h-screen pt-10">
        Error: {error}
        <Button onClick={fetchAttendanceReports} className="ml-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        {/* Header Section */}
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Salesman Attendance Reports</h2>
          {/* SYNC BUTTON ADDED HERE */}
          <SyncLocationBtn
            data={attendanceReports}
            onSyncComplete={() => {
              toast.info("Refetching reports with updated addresses...");
              fetchAttendanceReports();
            }}
          />
        </div>

        {/* --- Summary Cards Section --- */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today Present</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{todayStats.present}</div>
              <p className="text-xs text-muted-foreground">
                Total check-ins for {format(new Date(), 'dd MMM, yyyy')}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today Total (In & Out)</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{todayStats.completed}</div>
              <p className="text-xs text-muted-foreground">
                Employees who completed their shift
              </p>
            </CardContent>
          </Card>
        </div>

        {/* --- Filters Section --- */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

            {/* Row 1: Primary Controls */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Report Duration</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start h-10 border-border", !dateRange && "text-muted-foreground")}>
                      <IconCalendar className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "dd MMM")} - ${format(dateRange.to, "dd MMM, y")}` : format(dateRange.from, "dd MMM, y")) : "Select Range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent>
                </Popover>
                {dateRange && <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)} className="h-10 text-xs">Clear</Button>}
              </div>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Search Records</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Salesman name or location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-10 border-border bg-background" />
              </div>
            </div>

            {/* Corrected Row 2: Roles */}
            {/* User Role = executive/manager etc */}
            {renderSelectFilter(
              'User Role',
              jobTitleFilter,
              setJobTitleFilter,
              availableJobTitles, // Now correctly populated
              isLoadingRoles
            )}

            {/* Company Role = SALES / TECHNICAL */}
            {renderSelectFilter(
              'Company Role',
              companyCategoryFilter,
              setCompanyCategoryFilter,
              ['SALES', 'TECHNICAL'],
              false
            )}

            {/* Row 3: Geography */}
            {renderSelectFilter('Area', areaFilter, setAreaFilter, availableAreas, isLoadingLocations)}
            {renderSelectFilter('Region (Zone)', regionFilter, setRegionFilter, availableRegions, isLoadingLocations)}

          </div>
          {(locationError || roleError) && <p className="text-xs text-red-500 mt-4 italic">⚠️ Failed to load some filter options.</p>}
        </div>
        {/* --- End Filters Section --- */}

        {/* Data Table Section */}
        <div className="bg-card p-6 rounded-lg border border-border">
          {filteredReports.length === 0 && !loading && !error ? (
            <div className="text-center text-gray-500 py-8">No salesman attendance reports found matching the filters.</div>
          ) : (
            <>
              <DataTableReusable
                columns={salesmanAttendanceColumns}
                data={filteredReports}
                enableRowDragging={false}
                onRowOrderChange={handleSalesmanAttendanceOrderChange}
              />
            </>
          )}
        </div>
      </div>

      {/* --- Modal Logic (Unchanged) --- */}
      {selectedReport && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Salesman Attendance Details</DialogTitle>
              <DialogDescription>
                Detailed information for {selectedReport.salesmanName} on {selectedReport.date}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div>
                <Label htmlFor="salesmanName">Salesman Name</Label>
                <Input id="salesmanName" value={selectedReport.salesmanName} readOnly />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input id="date" value={selectedReport.date} readOnly />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="location">Location</Label>
                <Textarea id="location" value={selectedReport.location} readOnly className="h-auto" />
              </div>

              {/* In-Time Details */}
              <div className="md:col-span-2 text-lg font-semibold border-t pt-4 mt-4">In-Time Details</div>
              <div>
                <Label htmlFor="inTime">In Time</Label>
                <Input id="inTime" value={formatTimeIST(selectedReport.inTime) || 'N/A'} readOnly />
              </div>
              <div>
                <Label htmlFor="inTimeImage">Image Captured</Label>
                <Input id="inTimeImage" value={selectedReport.inTimeImageCaptured ? 'Yes' : 'No'} readOnly />
              </div>
              {selectedReport.inTimeImageUrl && (
                <div className="md:col-span-2">
                  <Label htmlFor="inTimeImageUrl">Image URL</Label>
                  <div id="inTimeImageUrl" className="mt-2 border p-2 rounded-md bg-muted/50">
                    {/* Link to open original image */}
                    <a
                      href={selectedReport.inTimeImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center text-sm font-medium mb-2"
                    >
                      View Original Image <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                    <img
                      src={selectedReport.inTimeImageUrl}
                      alt="In Time"
                      className="w-full h-auto rounded-md border"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="inTimeLatitude">Latitude</Label>
                <Input id="inTimeLatitude" value={selectedReport.inTimeLatitude?.toFixed(7) || 'N/A'} readOnly />
              </div>
              <div>
                <Label htmlFor="inTimeLongitude">Longitude</Label>
                <Input id="inTimeLongitude" value={selectedReport.inTimeLongitude?.toFixed(7) || 'N/A'} readOnly />
              </div>

              {/* Out-Time Details */}
              <div className="md:col-span-2 text-lg font-semibold border-t pt-4 mt-4">Out-Time Details</div>
              <div>
                <Label htmlFor="outTime">Out Time</Label>
                <Input id="outTime" value={formatTimeIST(selectedReport.outTime) || 'N/A (Still In)'} readOnly />
              </div>
              <div>
                <Label htmlFor="outTimeImage">Image Captured</Label>
                <Input id="outTimeImage" value={selectedReport.outTimeImageCaptured ? 'Yes' : 'No'} readOnly />
              </div>
              {selectedReport.outTimeImageUrl && (
                <div className="md:col-span-2">
                  <Label htmlFor="outTimeImageUrl">Image URL</Label>
                  <div id="outTimeImageUrl" className="mt-2 border p-2 rounded-md bg-muted/50">
                    <a
                      href={selectedReport.outTimeImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center text-sm font-medium mb-2"
                    >
                      View Original Image <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                    <img
                      src={selectedReport.outTimeImageUrl}
                      alt="Out Time"
                      className="w-full h-auto rounded-md border"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="outTimeLatitude">Latitude</Label>
                <Input id="outTimeLatitude" value={selectedReport.outTimeLatitude?.toFixed(7) || 'N/A'} readOnly />
              </div>
              <div>
                <Label htmlFor="outTimeLongitude">Longitude</Label>
                <Input id="outTimeLongitude" value={selectedReport.outTimeLongitude?.toFixed(7) || 'N/A'} readOnly />
              </div>
              <div>
                <Label htmlFor="outTimeAccuracy">Accuracy (m)</Label>
                <Input id="outTimeAccuracy" value={selectedReport.outTimeAccuracy?.toFixed(2) || 'N/A'} readOnly />
              </div>
              <div>
                <Label htmlFor="outTimeSpeed">Speed (m/s)</Label>
                <Input id="outTimeSpeed" value={selectedReport.outTimeSpeed?.toFixed(2) || 'N/A'} readOnly />
              </div>
              <div>
                <Label htmlFor="outTimeHeading">Heading (°)</Label>
                <Input id="outTimeHeading" value={selectedReport.outTimeHeading?.toFixed(2) || 'N/A'} readOnly />
              </div>
              <div>
                <Label htmlFor="outTimeAltitude">Altitude (m)</Label>
                <Input id="outTimeAltitude" value={selectedReport.outTimeAltitude?.toFixed(2) || 'N/A'} readOnly />
              </div>
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