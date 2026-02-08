// app/dashboard/reports/dailyVisitReports.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';

// UI Components
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTableReusable } from '@/components/data-table-reusable';
import { dailyVisitReportSchema } from '@/lib/shared-zod-schema';
import { Search, Loader2 } from 'lucide-react';
//import { BASE_URL } from '@/lib/Reusable-constants';

type DailyVisitReport = z.infer<typeof dailyVisitReportSchema> & {
  role: string;
  area: string;
  region: string;
};
const columnHelper = createColumnHelper<DailyVisitReport>();

// API Endpoints for filter options
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;
const ROLES_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-roles`;

// Type definitions for API responses
interface LocationsResponse {
  areas: string[];
  regions: string[];
}
interface RolesResponse {
  roles: string[];
}

// Helper function to render the Select filter component
const renderSelectFilter = (
  label: string,
  value: string,
  onValueChange: (v: string) => void,
  options: string[],
  isLoading: boolean = false
) => (
  <div className="flex flex-col space-y-1 w-full sm:w-[150px] min-w-[120px]">
    <label className="text-sm font-medium text-muted-foreground">{label}</label>
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger className="h-9">
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


export default function DailyVisitReportsPage() {
  const [reports, setReports] = useState<DailyVisitReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // --- Individual Filter States ---
  const [searchQuery, setSearchQuery] = useState(''); // Salesman/Username
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  // --- Filter Options States ---
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  /**
   * Fetches the main daily visit report data.
   */
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboardPagesAPI/reports/daily-visit-reports`);
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

      const data: DailyVisitReport[] = await response.json();
      const validated = data.map((item) => {
        try {
          // Add ID property needed by DataTableReusable
          const validatedItem = dailyVisitReportSchema.parse(item) as DailyVisitReport;
          return { 
            ...validatedItem, 
            id: (validatedItem as any).id?.toString() || `${validatedItem.salesmanName}-${validatedItem.reportDate}-${Math.random()}` 
          } as DailyVisitReport;
        } catch (e) {
          console.error('Validation error on report item:', e);
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
  }, [router]);


  /**
   * Fetches unique areas and regions for the filter dropdowns.
   */
  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data: LocationsResponse = await response.json();

      const safeAreas = Array.isArray(data.areas) ? data.areas.filter(Boolean) : [];
      const safeRegions = Array.isArray(data.regions) ? data.regions.filter(Boolean) : [];

      setAvailableAreas(safeAreas);
      setAvailableRegions(safeRegions);

    } catch (err: any) {
      console.error('Failed to fetch filter locations:', err);
      setLocationError('Failed to load Area/Region filters.');
      toast.error('Failed to load location filters.');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  /**
   * Fetches unique roles for the filter dropdowns.
   */
  const fetchRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    setRoleError(null);
    try {
      const response = await fetch(ROLES_API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data: RolesResponse = await response.json();
      const roles = data.roles && Array.isArray(data.roles) ? data.roles : [];

      const safeRoles = roles.filter(Boolean);

      setAvailableRoles(safeRoles);
    } catch (err: any) {
      console.error('Failed to fetch filter roles:', err);
      setRoleError('Failed to load Role filters.');
      toast.error('Failed to load role filters.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  // Initial data loads
  useEffect(() => {
    fetchReports();
    fetchLocations();
    fetchRoles();
  }, [fetchReports, fetchLocations, fetchRoles]);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return reports.filter((report) => {
      // 1) Search across salesman + dealer names
      const nameHaystack = [
        report.salesmanName,
        report.dealerName ?? '',
        report.subDealerName ?? ''
      ]
        .join(' ')
        .toLowerCase();

      const usernameMatch = !q || nameHaystack.includes(q);

      // 2. Role Filter (Uses the 'role' field)
      const roleMatch = roleFilter === 'all' ||
        report.role?.toLowerCase() === roleFilter.toLowerCase();

      // 3. Area Filter (Uses the 'area' field)
      const areaMatch = areaFilter === 'all' ||
        report.area?.toLowerCase() === areaFilter.toLowerCase();

      // 4. Region Filter (Uses the 'region' field)
      const regionMatch = regionFilter === 'all' ||
        report.region?.toLowerCase() === regionFilter.toLowerCase();

      // Combine all conditions
      return usernameMatch && roleMatch && areaMatch && regionMatch;
    });
  }, [reports, searchQuery, roleFilter, areaFilter, regionFilter]);

  // Define columns (Including the fixed Role, Area, Region accessors)
  const dailyVisitReportColumns: ColumnDef<DailyVisitReport, any>[] = [
    { accessorKey: 'salesmanName', header: 'Salesman' },
    { accessorKey: 'role', header: 'Role' }, // Uses 'role' accessor
    { accessorKey: 'area', header: 'Area' },
    { accessorKey: 'region', header: 'Region(Zone)' },
    { accessorKey: 'reportDate', header: 'Date' },
    { accessorKey: 'dealerType', header: 'Dealer Type' },
    { accessorKey: 'dealerName', header: 'Dealer Name', cell: info => info.getValue() || 'N/A' },
    { accessorKey: 'subDealerName', header: 'Sub Dealer Name', cell: info => info.getValue() || 'N/A' },
    { accessorKey: 'location', header: 'Location' },
    { accessorKey: 'visitType', header: 'Visit Type' },
    { accessorKey: 'todayOrderMt', header: 'Order (MT)', cell: info => info.getValue().toFixed(2) },
    { accessorKey: 'todayCollectionRupees', header: 'Collection (₹)', cell: info => info.getValue().toFixed(2) },
    { accessorKey: 'overdueAmount', 
      header: 'Overdue (₹)', 
      cell: info => info.getValue() ? info.getValue().toFixed(2) : '0.00'
    },
    { accessorKey: 'feedbacks', 
      header: 'Feedbacks', 
      cell: info => <span className="max-w-[250px] truncate block">{info.getValue()}</span>
    }
  ];

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading daily visit reports...</div>;

  if (error) return (
    <div className="text-center text-red-500 min-h-screen pt-10">
      Error: {error}
      <Button onClick={fetchReports} className="ml-4">Retry</Button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Daily Visit Reports</h2>
        </div>

        {/* --- Individual Filter Components --- */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border">
          {/* 1. Username/Salesman Search Input */}
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-sm font-medium text-muted-foreground">Salesman / Username</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* 2. Role Filter */}
          {renderSelectFilter(
            'Role',
            roleFilter,
            (v) => { setRoleFilter(v); },
            availableRoles,
            isLoadingRoles
          )}

          {/* 3. Area Filter (Commented out in original but kept for display) */}
          {renderSelectFilter(
            'Area', 
            areaFilter, 
            (v) => { setAreaFilter(v); }, 
            availableAreas, 
            isLoadingLocations
          )}

          {/* 4. Region Filter (Commented out in original but kept for display) */}
          {renderSelectFilter(
            'Region(Zone)', 
            regionFilter, 
            (v) => { setRegionFilter(v); }, 
            availableRegions, 
            isLoadingLocations
          )}

          {/* Display filter option errors if any */}
          {locationError && <p className="text-xs text-red-500 w-full">Location Filter Error: {locationError}</p>}
          {roleError && <p className="text-xs text-red-500 w-full">Role Filter Error: {roleError}</p>}
        </div>
        {/* --- End Individual Filter Components --- */}

        <div className="bg-card p-6 rounded-lg border border-border">
          {filteredReports.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No daily visit reports found matching the selected filters.</div>
          ) : (
            <>
              <DataTableReusable
                columns={dailyVisitReportColumns} 
                data={filteredReports} 
                enableRowDragging={false}
                onRowOrderChange={() => { }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}