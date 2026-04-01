// src/app/dashboard/slmAttendance/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

// Import your Shadcn UI components
import { Button } from '@/components/ui/button';
import { IconCheck, IconX } from '@tabler/icons-react';
import { ExternalLink, Users, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";

// Import standard components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';
import SyncLocationBtn from '@/app/home/customReportGenerator/syncLocationBtn';

import { selectSalesmanAttendanceSchema } from '../../../../drizzle/zodSchemas';

const extendedSalesmanAttendanceSchema = selectSalesmanAttendanceSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  area: z.string().nullable().optional().catch("N/A"),
  region: z.string().nullable().optional().catch("N/A"),
  date: z.string().optional(),
  location: z.string().optional(),
  inTime: z.string().nullable().optional(),
  outTime: z.string().nullable().optional(),

  inTimeLatitude: z.coerce.number().nullable().optional().catch(null),
  inTimeLongitude: z.coerce.number().nullable().optional().catch(null),
  inTimeAccuracy: z.coerce.number().nullable().optional().catch(null),
  inTimeSpeed: z.coerce.number().nullable().optional().catch(null),
  inTimeHeading: z.coerce.number().nullable().optional().catch(null),
  inTimeAltitude: z.coerce.number().nullable().optional().catch(null),

  outTimeLatitude: z.coerce.number().nullable().optional().catch(null),
  outTimeLongitude: z.coerce.number().nullable().optional().catch(null),
  outTimeAccuracy: z.coerce.number().nullable().optional().catch(null),
  outTimeSpeed: z.coerce.number().nullable().optional().catch(null),
  outTimeHeading: z.coerce.number().nullable().optional().catch(null),
  outTimeAltitude: z.coerce.number().nullable().optional().catch(null),
});

type SalesmanAttendanceReport = z.infer<typeof extendedSalesmanAttendanceSchema>;

const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}

export default function SlmAttendancePage() {
  const router = useRouter();
  const [attendanceReports, setAttendanceReports] = useState<SalesmanAttendanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  
  const [companyCategoryFilter, setCompanyCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);

  // --- Backend Filter Options ---
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SalesmanAttendanceReport | null>(null);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, companyCategoryFilter, areaFilters, zoneFilters, dateRange]);

  const fetchAttendanceReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/dashboardPagesAPI/slm-attendance`, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (companyCategoryFilter !== 'all') url.searchParams.append('companyRole', companyCategoryFilter);
      
      // Multi-select arrays joined by comma
      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
      if (zoneFilters.length > 0) url.searchParams.append('region', zoneFilters.join(','));

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
          const validated = extendedSalesmanAttendanceSchema.parse(item);
          return { ...validated, id: validated.id.toString() };
        } catch (e) {
          console.error("Validation error for item:", item, e);
          return null;
        }
      }).filter(Boolean) as SalesmanAttendanceReport[];

      setAttendanceReports(validatedData);
    } catch (e: any) {
      console.error("Failed to fetch salesman attendance reports:", e);
      setError(e.message || "Failed to fetch reports.");
      toast.error(e.message || "Failed to load salesman attendance reports.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearchQuery, companyCategoryFilter, areaFilters, zoneFilters, dateRange, router]);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data: LocationsResponse = await response.json();

      const safeAreas = Array.isArray(data.areas) ? data.areas.filter(Boolean) : [];
      const safeRegions = Array.isArray(data.regions) ? data.regions.filter(Boolean) : [];

      setAvailableAreas(safeAreas.sort());
      setAvailableRegions(safeRegions.sort());

    } catch (err: any) {
      console.error('Failed to fetch filter locations:', err);
      setLocationError('Failed to load Area/Region filters.');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendanceReports();
  }, [fetchAttendanceReports]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const zoneOptions = useMemo(() => availableRegions.map(r => ({ label: r, value: r })), [availableRegions]);
  const areaOptions = useMemo(() => availableAreas.map(a => ({ label: a, value: a })), [availableAreas]);
  const roleOptions = useMemo(() => [
    { label: 'All Company Roles', value: 'all' },
    { label: 'Sales', value: 'SALES' },
    { label: 'Technical', value: 'TECHNICAL' }
  ], []);

  const todayStats = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const reportsForToday = attendanceReports.filter(report => {
      const rawDate = report.date || report.attendanceDate;
      if (!rawDate) return false;
      const reportDate = format(new Date(rawDate), 'yyyy-MM-dd');
      return reportDate === todayStr;
    });

    return {
      present: reportsForToday.filter(r => r.inTime).length,
      completed: reportsForToday.filter(r => r.inTime && r.outTime).length
    };
  }, [attendanceReports]);

  const handleViewReport = (report: SalesmanAttendanceReport) => {
    setSelectedReport(report);
    setIsViewModalOpen(true);
  };

  const LocationCell = ({ locationName, lat, lng }: { locationName: string, lat?: number, lng?: number }) => {
    const [address, setAddress] = useState(locationName);
    const [isFetching, setIsFetching] = useState(false);

    const fetchAddress = useCallback(async () => {
      if (!lat || !lng) return;

      setIsFetching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
          }
        });

        if (!res.ok) throw new Error("Rate Limit or Network Error");

        const data = await res.json();
        if (data && data.display_name) {
          setAddress(data.display_name);
        }
      } catch (error) {
        console.warn("Geocoding failed for:", lat, lng);
      } finally {
        setIsFetching(false);
      }
    }, [lat, lng]);

    useEffect(() => {
      if ((locationName === 'Live Location' || locationName === 'Live Location (GPS Only)') && lat && lng) {
        const delay = Math.random() * 3000;
        const timer = setTimeout(() => {
          fetchAddress();
        }, delay);
        return () => clearTimeout(timer);
      } else {
        setAddress(locationName);
      }
    }, [locationName, lat, lng, fetchAddress]);

    const isGenericAddress = address.includes('Live Location');

    return (
      <div className="flex items-center gap-2 max-w-[300px]">
        <span className="truncate block text-xs sm:text-sm" title={address}>
          {address}
        </span>
        {isFetching && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
        )}
        {!isFetching && isGenericAddress && lat && lng && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
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

  const formatTimeIST = (isoString: string | null | undefined) => {
    if (!isoString) return 'N/A';
    try {
      return new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }).format(new Date(isoString));
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const salesmanAttendanceColumns: ColumnDef<SalesmanAttendanceReport>[] = [
    { accessorKey: "salesmanName", header: "Salesman" },
    {
      id: 'date',
      header: 'Report Date',
      cell: ({ row }) => {
        const rawDate = row.original.date || row.original.attendanceDate;
        if (!rawDate) return <div>N/A</div>;
        const date = new Date(rawDate);
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
      id: "location",
      header: "Location",
      cell: ({ row }) => {
        const locationStr = row.original.location || row.original.locationName || 'Unknown';
        return (
          <LocationCell
            locationName={locationStr}
            lat={row.original.inTimeLatitude || 0.0}
            lng={row.original.inTimeLongitude || 0.0}
          />
        )
      },
    },
    {
      accessorKey: 'inTime',
      header: 'In Time',
      cell: ({ row }) => (
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
      cell: ({ row }) => (
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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight">Salesman Attendance</h2>
            <Badge variant="outline" className="text-base px-4 py-1">
              Total Records: {totalCount}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <SyncLocationBtn
              data={attendanceReports}
              onSyncComplete={() => {
                toast.info("Refetching reports with updated addresses...");
                fetchAttendanceReports();
              }}
            />

            <RefreshDataButton
              cachePrefix="salesman-attendance"
              onRefresh={fetchAttendanceReports}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today Present (This Page)</CardTitle>
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

        {/* --- Unified Global Filter Bar --- */}
        <div className="w-full">
          <GlobalFilterBar 
            showSearch={true}
            showDateRange={true}
            showZone={true}
            showArea={true}
            showRole={true} // Enabled to filter by SALES/TECHNICAL
            showStatus={false}

            searchVal={searchQuery}
            dateRangeVal={dateRange}
            zoneVals={zoneFilters}
            areaVals={areaFilters}
            roleVal={companyCategoryFilter}

            zoneOptions={zoneOptions}
            areaOptions={areaOptions}
            roleOptions={roleOptions}

            onSearchChange={setSearchQuery}
            onDateRangeChange={setDateRange}
            onZoneChange={setZoneFilters}
            onAreaChange={setAreaFilters}
            onRoleChange={setCompanyCategoryFilter}
          />
        </div>
        
        {(locationError) && <p className="text-xs text-red-500 mt-2 italic">Failed to load some locations.</p>}

        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {loading && attendanceReports.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <p className="text-muted-foreground">Loading salesman attendance...</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-12 flex flex-col items-center">
              <p>Error: {error}</p>
              <Button onClick={fetchAttendanceReports} variant="outline" className="mt-4">Retry</Button>
            </div>
          ) : attendanceReports.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No salesman attendance reports found matching the filters.</div>
          ) : (
            <DataTableReusable
              columns={salesmanAttendanceColumns}
              data={attendanceReports}
              enableRowDragging={false}
              onRowOrderChange={() => {}}
            />
          )}
        </div>
      </div>

      {selectedReport && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          {/* Keep your existing detailed modal exactly as it is! */}
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-background">
            <DialogHeader>
              <DialogTitle>Salesman Attendance Details</DialogTitle>
              <DialogDescription>
                Detailed information for {selectedReport.salesmanName} on {selectedReport.date}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div>
                <Label htmlFor="salesmanName">Salesman Name</Label>
                <Input id="salesmanName" value={selectedReport.salesmanName} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input id="date" value={selectedReport.date} readOnly className="bg-muted/50" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="location">Location</Label>
                <Textarea id="location" value={selectedReport.location} readOnly className="h-auto bg-muted/50" />
              </div>

              <div className="md:col-span-2 text-lg font-semibold border-t pt-4 mt-4">In-Time Details</div>
              <div>
                <Label htmlFor="inTime">In Time</Label>
                <Input id="inTime" value={formatTimeIST(selectedReport.inTime) || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="inTimeImage">Image Captured</Label>
                <Input id="inTimeImage" value={selectedReport.inTimeImageCaptured ? 'Yes' : 'No'} readOnly className="bg-muted/50" />
              </div>
              {selectedReport.inTimeImageUrl && (
                <div className="md:col-span-2">
                  <Label htmlFor="inTimeImageUrl">Image URL</Label>
                  <div id="inTimeImageUrl" className="mt-2 border p-2 rounded-md bg-muted/30">
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
                <Input id="inTimeLatitude" value={selectedReport.inTimeLatitude?.toFixed(7) || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="inTimeLongitude">Longitude</Label>
                <Input id="inTimeLongitude" value={selectedReport.inTimeLongitude?.toFixed(7) || 'N/A'} readOnly className="bg-muted/50" />
              </div>

              <div className="md:col-span-2 text-lg font-semibold border-t pt-4 mt-4">Out-Time Details</div>
              <div>
                <Label htmlFor="outTime">Out Time</Label>
                <Input id="outTime" value={formatTimeIST(selectedReport.outTime) || 'N/A (Still In)'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="outTimeImage">Image Captured</Label>
                <Input id="outTimeImage" value={selectedReport.outTimeImageCaptured ? 'Yes' : 'No'} readOnly className="bg-muted/50" />
              </div>
              {selectedReport.outTimeImageUrl && (
                <div className="md:col-span-2">
                  <Label htmlFor="outTimeImageUrl">Image URL</Label>
                  <div id="outTimeImageUrl" className="mt-2 border p-2 rounded-md bg-muted/30">
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
                <Input id="outTimeLatitude" value={selectedReport.outTimeLatitude?.toFixed(7) || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="outTimeLongitude">Longitude</Label>
                <Input id="outTimeLongitude" value={selectedReport.outTimeLongitude?.toFixed(7) || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="outTimeAccuracy">Accuracy (m)</Label>
                <Input id="outTimeAccuracy" value={selectedReport.outTimeAccuracy?.toFixed(2) || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="outTimeSpeed">Speed (m/s)</Label>
                <Input id="outTimeSpeed" value={selectedReport.outTimeSpeed?.toFixed(2) || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="outTimeHeading">Heading (°)</Label>
                <Input id="outTimeHeading" value={selectedReport.outTimeHeading?.toFixed(2) || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="outTimeAltitude">Altitude (m)</Label>
                <Input id="outTimeAltitude" value={selectedReport.outTimeAltitude?.toFixed(2) || 'N/A'} readOnly className="bg-muted/50" />
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