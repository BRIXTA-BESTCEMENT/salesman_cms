// app/dashboard/reports/dailyVisitReports.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { Search, Loader2 } from 'lucide-react';
import { selectDailyVisitReportSchema } from '../../../../drizzle/zodSchemas';

const extendedDailyVisitReportSchema = selectDailyVisitReportSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  role: z.string().optional().catch("N/A"),
  area: z.string().optional().catch("N/A"),
  region: z.string().optional().catch("N/A"),
  dealerName: z.string().nullable().optional(),
  subDealerName: z.string().nullable().optional(),
  latitude: z.coerce.number().optional().catch(0),
  longitude: z.coerce.number().optional().catch(0),
  dealerTotalPotential: z.coerce.number().optional().catch(0),
  dealerBestPotential: z.coerce.number().optional().catch(0),
  todayOrderMt: z.coerce.number().optional().catch(0),
  todayCollectionRupees: z.coerce.number().optional().catch(0),
  overdueAmount: z.coerce.number().nullable().optional().catch(0),
  brandSelling: z.array(z.string()).nullable().optional().catch([]),
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
      <SelectTrigger className="h-9 bg-background border-input">
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

export default function DailyVisitReportsPage() {
  const [reports, setReports] = useState<DailyVisitReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState(''); 
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, roleFilter, areaFilter, regionFilter]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/dashboardPagesAPI/reports/daily-visit-reports`, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (roleFilter !== 'all') url.searchParams.append('role', roleFilter);
      if (areaFilter !== 'all') url.searchParams.append('area', areaFilter);
      if (regionFilter !== 'all') url.searchParams.append('region', regionFilter);

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
      const rawData: any[] = result.data || [];
      
      setTotalCount(result.totalCount || 0);

      const validated = rawData.map((item) => {
        try {
          const validatedItem = extendedDailyVisitReportSchema.parse(item);
          return {
            ...validatedItem,
            id: validatedItem.id?.toString() || `${validatedItem.salesmanName}-${validatedItem.reportDate}-${Math.random()}`
          };
        } catch (e) {
          console.error('Validation error on report item:', e, item);
          return null;
        }
      }).filter(Boolean) as DailyVisitReport[];

      setReports(validated);
      toast.success('Daily Visit Reports loaded successfully!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to load daily visit reports.');
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [router, page, pageSize, debouncedSearchQuery, roleFilter, areaFilter, regionFilter]);

  const fetchLocations = useCallback(async () => {
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

  const fetchRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    setRoleError(null);
    try {
      const response = await fetch(ROLES_API_ENDPOINT);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const data: RolesResponse = await response.json();
      const roles = data.roles && Array.isArray(data.roles) ? data.roles : [];
      const safeRoles = roles.filter(Boolean);

      setAvailableRoles(safeRoles);
    } catch (err: any) {
      console.error('Failed to fetch filter roles:', err);
      setRoleError('Failed to load Role filters.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    fetchLocations();
    fetchRoles();
  }, [fetchLocations, fetchRoles]);

  const dailyVisitReportColumns = useMemo<ColumnDef<DailyVisitReport, any>[]>(() => [
    { accessorKey: 'salesmanName', header: 'Salesman' },
    { accessorKey: 'role', header: 'Role' },
    { accessorKey: 'area', header: 'Area' },
    { accessorKey: 'region', header: 'Region(Zone)' },
    { accessorKey: 'reportDate', header: 'Date' },
    { accessorKey: 'dealerType', header: 'Dealer Type' },
    { accessorKey: 'dealerName', header: 'Dealer Name', cell: info => info.getValue() || 'N/A' },
    { accessorKey: 'subDealerName', header: 'Sub Dealer Name', cell: info => info.getValue() || 'N/A' },
    { accessorKey: 'location', header: 'Location' },
    { accessorKey: 'visitType', header: 'Visit Type' },
    { 
      accessorKey: 'todayOrderMt', 
      header: 'Order (MT)', 
      cell: info => (info.getValue() ?? 0).toFixed(2) 
    },
    { 
      accessorKey: 'todayCollectionRupees', 
      header: 'Collection (₹)', 
      cell: info => (info.getValue() ?? 0).toFixed(2) 
    },
    {
      accessorKey: 'overdueAmount',
      header: 'Overdue (₹)',
      cell: info => (info.getValue() ?? 0).toFixed(2)
    },
    {
      accessorKey: 'feedbacks',
      header: 'Feedbacks',
      cell: info => <span className="max-w-[250px] truncate block">{info.getValue() || 'N/A'}</span>
    }
  ], []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
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

        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border shadow-sm">
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Salesman / Dealer</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 bg-background border-input"
              />
            </div>
          </div>

          {renderSelectFilter('Role', roleFilter, setRoleFilter, availableRoles, isLoadingRoles)}
          {renderSelectFilter('Area', areaFilter, setAreaFilter, availableAreas, isLoadingLocations)}
          {renderSelectFilter('Region', regionFilter, setRegionFilter, availableRegions, isLoadingLocations)}

          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setRoleFilter('all');
              setAreaFilter('all');
              setRegionFilter('all');
            }}
            className="mb-0.5 text-muted-foreground hover:text-destructive"
          >
            Clear Filters
          </Button>

          {locationError && <p className="text-xs text-red-500 w-full mt-2">Location Filter Error: {locationError}</p>}
          {roleError && <p className="text-xs text-red-500 w-full mt-2">Role Filter Error: {roleError}</p>}
        </div>

        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {loading ? (
             <div className="flex justify-center items-center h-64">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
             </div>
          ) : reports.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No daily visit reports found matching the selected filters.</div>
          ) : (
            <DataTableReusable
              columns={dailyVisitReportColumns}
              data={reports}
              enableRowDragging={false}
              onRowOrderChange={() => { }}
            />
          )}
        </div>
      </div>
    </div>
  );
}