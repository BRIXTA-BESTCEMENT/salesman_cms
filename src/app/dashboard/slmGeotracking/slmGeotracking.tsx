// src/app/dashboard/slmGeotracking/slmGeotracking.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

// Utilities & Components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar'; 
import { useDebounce } from '@/hooks/use-debounce-search';
import { DateRange } from "react-day-picker";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { Button } from '@/components/ui/button';

import { selectJourneyOpsSchema } from '../../../../drizzle/zodSchemas';

const extendedJourneyOpsSchema = selectJourneyOpsSchema.partial().extend({
  id: z.string().optional(),
  serverSeq: z.coerce.bigint().optional(),
  salesmanName: z.string().nullable().optional().catch("Unknown"),
  area: z.string().nullable().optional().catch("N/A"),
  region: z.string().nullable().optional().catch("N/A"),
  employeeId: z.string().nullable().optional(),

  latitude: z.coerce.number().nullable().optional().catch(null),
  longitude: z.coerce.number().nullable().optional().catch(null),
  recordedAt: z.string().nullable().optional(),
  totalDistanceTravelled: z.coerce.number().nullable().optional().catch(0),
  locationType: z.string().nullable().optional(),
  activityType: z.string().nullable().optional(),
  appState: z.string().nullable().optional(),
  accuracy: z.coerce.number().nullable().optional().catch(null),
  speed: z.coerce.number().nullable().optional().catch(null),
  heading: z.coerce.number().nullable().optional().catch(null),
  altitude: z.coerce.number().nullable().optional().catch(null),
  batteryLevel: z.coerce.number().nullable().optional().catch(null),
  isCharging: z.boolean().nullable().optional(),
  networkStatus: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  siteName: z.string().nullable().optional(),
  checkInTime: z.string().nullable().optional(),
  checkOutTime: z.string().nullable().optional(),
  isActive: z.boolean().nullable().optional(),
  destLat: z.coerce.number().nullable().optional().catch(null),
  destLng: z.coerce.number().nullable().optional().catch(null),
});

type GeoTrack = z.infer<typeof extendedJourneyOpsSchema>;
type DisplayGeoTrack = Omit<GeoTrack, 'id'> & 
{ 
  id: string;
  displayDate: string; 
  displayCheckInTime: string; 
  displayCheckOutTime: string 
};

const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}

export default function SalesmanGeoTrackingPage() {
  const [tracks, setTracks] = useState<DisplayGeoTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);

  // --- Backend Filter Options ---
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    });
  };

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    });
  };

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

      setAvailableAreas(safeAreas.sort());
      setAvailableRegions(safeRegions.sort());

    } catch (err: any) {
      console.error('Failed to fetch filter locations:', err);
      setLocationError('Failed to load Area/Region filters.');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  const apiURI = `/api/dashboardPagesAPI/slm-geotracking`;
  const fetchTracks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(apiURI, window.location.origin);
      if (dateRange?.from) {
        url.searchParams.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        url.searchParams.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));
      }

      url.searchParams.append('_t', Date.now().toString());

      const res = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const rawData = await res.json();

      const validatedData = rawData
        .map((item: unknown) => {
          try {
            const validated = extendedJourneyOpsSchema.parse(item) as GeoTrack;
            return { ...validated } as DisplayGeoTrack; 
          } catch (e) {
            console.error('Data validation failed for item:', item, 'ZodError', e);
            return null;
          }
        })
        .filter((item: DisplayGeoTrack | null): item is DisplayGeoTrack => item !== null)
        .map((item: DisplayGeoTrack) => ({
          ...item,
          displayDate: formatDate(item.recordedAt),
          displayCheckInTime: formatTime(item.checkInTime),
          displayCheckOutTime: formatTime(item.checkOutTime),
        }));

      setTracks(validatedData);
      toast.success('Geo-tracking reports loaded successfully.');
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(errorMessage);
      toast.error(`Failed to fetch geo-tracking reports: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const zoneOptions = useMemo(() => availableRegions.map(r => ({ label: r, value: r })), [availableRegions]);
  const areaOptions = useMemo(() => availableAreas.map(a => ({ label: a, value: a })), [availableAreas]);

  // --- Client Side Filtering ---
  const allFilteredTracks = useMemo(() => {
    const lowerCaseSearch = (debouncedSearchQuery || '').toLowerCase();

    return tracks.filter(track => {
      const salesmanName = (track.salesmanName || '').toString();
      const siteName = (track.siteName || '').toString();
      const displayDate = (track.displayDate || '').toString();
      const checkIn = (track.displayCheckInTime || '').toString();
      const checkOut = (track.displayCheckOutTime || '').toString();
      const locationType = (track.locationType || '').toString();
      const appSector = (track.appRole || '').toString();

      const matchesSearch =
        !lowerCaseSearch ||
        salesmanName.toLowerCase().includes(lowerCaseSearch) ||
        siteName.toLowerCase().includes(lowerCaseSearch) ||
        displayDate.toLowerCase().includes(lowerCaseSearch) ||
        checkIn.toLowerCase().includes(lowerCaseSearch) ||
        checkOut.toLowerCase().includes(lowerCaseSearch) ||
        locationType.toLowerCase().includes(lowerCaseSearch) ||
        appSector.toLowerCase().includes(lowerCaseSearch);

      const reportArea = track.area || '';
      const areaMatch = areaFilters.length === 0 || areaFilters.includes(reportArea);

      const reportRegion = track.region || '';
      const regionMatch = zoneFilters.length === 0 || zoneFilters.includes(reportRegion);

      return matchesSearch && areaMatch && regionMatch;
    });
  }, [tracks, debouncedSearchQuery, areaFilters, zoneFilters]);

  // --- Statistics Calculation ---
  const geoStats = useMemo(() => {
    const now = new Date();

    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); 
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let total = 0;
    let weekTotal = 0;
    let monthTotal = 0;

    const salesmen = new Set<string>();

    allFilteredTracks.forEach(track => {
      const distance = track.totalDistanceTravelled;
      if (typeof distance !== 'number' || isNaN(distance)) return;

      const dateStr = track.recordedAt || track.createdAt;
      if (!dateStr) return;
      const date = new Date(dateStr);

      total += distance;

      if (date >= weekStart && date <= weekEnd) {
        weekTotal += distance;
      }

      if (date >= monthStart && date <= monthEnd) {
        monthTotal += distance;
      }

      if (track.salesmanName) {
        salesmen.add(track.salesmanName);
      }
    });

    return {
      total,
      weekTotal,
      monthTotal,
      salesmanCount: salesmen.size,
      avgPerSalesman: salesmen.size > 0 ? total / salesmen.size : 0,
    };
  }, [allFilteredTracks]);


  const columns: ColumnDef<DisplayGeoTrack>[] = [
    {
      accessorKey: 'salesmanName',
      header: 'Salesman',
      cell: ({ row }) => row.original.salesmanName ?? 'N/A',
    },
    {
      accessorKey: 'displayDate',
      header: 'Date',
    },
    {
      accessorKey: 'siteName',
      header: 'Site Name',
      cell: ({ row }) => row.original.siteName ?? 'N/A',
    },
    {
      accessorKey: 'totalDistanceTravelled',
      header: 'Distance (km)',
      cell: ({ row }) => (row.original.totalDistanceTravelled != null ? `${row.original.totalDistanceTravelled.toFixed(2)} km` : 'N/A'),
    },
    {
      accessorKey: 'locationType',
      header: 'Location Type',
      cell: ({ row }) => row.original.locationType ?? 'N/A',
    },
    {
      accessorKey: 'isActive',
      header: 'Active Now',
      cell: ({ row }) => (row.original.isActive ? 'Yes' : 'No'),
    },
    {
      accessorKey: 'checkInTime',
      header: 'Check-in Time',
      cell: ({ row }) => row.original.displayCheckInTime,
    },
    {
      accessorKey: 'checkOutTime',
      header: 'Check-out Time',
      cell: ({ row }) => row.original.displayCheckOutTime,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Salesman Geo-Tracking</h2>
          <RefreshDataButton
            cachePrefix="slm-geotracking"
            onRefresh={fetchTracks}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
              Total Distance Travelled
            </div>

            <div className="text-3xl font-bold mt-1">
              {geoStats.total.toFixed(2)} km
            </div>

            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>This Week</span>
                <span className="font-semibold text-foreground">
                  {geoStats.weekTotal.toFixed(2)} km
                </span>
              </div>
              <div className="flex justify-between">
                <span>This Month</span>
                <span className="font-semibold text-foreground">
                  {geoStats.monthTotal.toFixed(2)} km
                </span>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground mt-2">
              Based on applied filters
            </p>
          </div>

          <div className="bg-muted/20 border border-dashed rounded-lg p-4 shadow-none flex flex-col justify-center">
            <div className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
              Active Salesmen
            </div>
            <div className="text-2xl font-bold mt-1">
              {geoStats.salesmanCount}
            </div>
          </div>

          <div className="bg-muted/20 border border-dashed rounded-lg p-4 shadow-none flex flex-col justify-center">
            <div className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
              Avg Distance per Salesman
            </div>
            <div className="text-2xl font-bold mt-1">
              {geoStats.avgPerSalesman.toFixed(2)} km
            </div>
          </div>

        </div>

        {/* --- Unified Global Filter Bar --- */}
        <div className="w-full">
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
        </div>

        {(locationError) && (
          <p className="text-xs text-red-500 w-full mt-2 italic">Location Filter Error: {locationError}</p>
        )}

        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-12 flex flex-col items-center">
              <p>Error: {error}</p>
              <Button onClick={fetchTracks} variant="outline" className="mt-4">Retry</Button>
            </div>
          ) : allFilteredTracks.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No geo-tracking reports found matching the selected filters.</div>
          ) : (
            <DataTableReusable
              columns={columns}
              data={allFilteredTracks}
              enableRowDragging={false}
              onRowOrderChange={() => { }}
            />
          )}
        </div>
      </div>
    </div>
  );
}