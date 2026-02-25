// app/dashboard/scoresAndRatings/salesmanRatings.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { toast } from 'sonner';
import { DataTableReusable } from '@/components/data-table-reusable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// UI Components for Filtering
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Import base schema from Drizzle
import { selectRatingSchema } from '../../../../drizzle/zodSchemas';

// --- EXTEND THE DRIZZLE SCHEMA ---
const extendedSalesmanRatingSchema = selectRatingSchema.partial().extend({
  id: z.union([z.string(), z.number()]).optional(),
  salesPersonName: z.string().optional().catch("Unknown"),
  area: z.string().nullable().optional().catch("N/A"),
  region: z.string().nullable().optional().catch("N/A"),
  // Safely coerce rating from string to number
  rating: z.coerce.number().optional().catch(0),
  // Joined relational field for filtering
  salesmanRole: z.string().nullable().optional().catch("N/A"),
});

// Enforce that `id` is strictly a string for DataTableReusable
type SalesmanRating = Omit<z.infer<typeof extendedSalesmanRatingSchema>, 'id'> & { 
  id: string 
};


// --- CONSTANTS AND TYPES ---
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;
const ROLES_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-roles`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}
interface RolesResponse {
  roles: string[];
}

// Column helper to define the columns for the data table
const columnHelper = createColumnHelper<SalesmanRating>();

// --- COLUMN DEFINITIONS ---
const columns: ColumnDef<SalesmanRating, any>[] = [
  columnHelper.accessor('salesPersonName', {
    header: 'Sales Person Name',
    cell: (info) => info.getValue() || 'N/A',
  }),
  columnHelper.accessor('area', {
    header: 'Area',
    cell: (info) => info.getValue() || 'N/A',
  }),
  columnHelper.accessor('region', {
    header: 'Region',
    cell: (info) => info.getValue() || 'N/A',
  }),
  columnHelper.accessor('rating', {
    header: 'Rating',
    cell: (info) => {
      const rating = info.getValue();
      const numRating = Number(rating) || 0;
      const ratingClass = numRating >= 4 ? 'bg-green-500' : numRating >= 3 ? 'bg-yellow-500' : 'bg-red-500';
      const ratingText = numRating >= 4 ? 'BEST' : numRating >= 3 ? 'FAIR' : 'ALARMING';
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${ratingClass}`}>
          {ratingText} ({numRating.toFixed(1)})
        </span>
      );
    },
  }),
];

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


export default function SalesmanRatings() {
  const router = useRouter();
  const [data, setData] = useState<SalesmanRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = useState(''); // Salesman Name search
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


  // --- Data Fetching Functions ---

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboardPagesAPI/scores-ratings?type=salesman`);
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
        throw new Error('Failed to fetch salesman ratings');
      }
      const rawData = await response.json();
      
      const validatedData = z.array(extendedSalesmanRatingSchema).parse(rawData).map(d => ({
        ...d,
        id: d.id?.toString() || d.salesPersonName || `${Math.random()}`, 
      })) as SalesmanRating[];

      setData(validatedData);
      toast.success("Salesman ratings loaded successfully!");
    } catch (err: any) {
      setError(err.message);
      toast.error(`Failed to load salesman ratings: ${err.message}`);
      console.error('Fetching error:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data: LocationsResponse = await response.json();
      setAvailableAreas(Array.isArray(data.areas) ? data.areas.filter(Boolean) : []);
      setAvailableRegions(Array.isArray(data.regions) ? data.regions.filter(Boolean) : []);
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
      setAvailableRoles(data.roles && Array.isArray(data.roles) ? data.roles.filter(Boolean) : []);
    } catch (err: any) {
      console.error('Failed to fetch filter roles:', err);
      setRoleError('Failed to load Role filters.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);


  // Initial data loads
  useEffect(() => {
    fetchData();
    fetchLocations();
    fetchRoles();
  }, [fetchData, fetchLocations, fetchRoles]);


  // --- Filtering Logic
  const filteredRatings = useMemo(() => {
    const lowerCaseSearch = searchQuery.toLowerCase();

    return data.filter((rating) => {
      // 1. Salesman Name Search
      const searchMatch = !lowerCaseSearch ||
        (rating.salesPersonName || '').toLowerCase().includes(lowerCaseSearch);

      // 2. Role Filter
      const roleMatch = roleFilter === 'all' ||
        (rating.salesmanRole || '').toLowerCase() === roleFilter.toLowerCase();

      // 3. Area Filter 
      const areaMatch = areaFilter === 'all' ||
        (rating.area || '').toLowerCase() === areaFilter.toLowerCase();

      // 4. Region Filter 
      const regionMatch = regionFilter === 'all' ||
        (rating.region || '').toLowerCase() === regionFilter.toLowerCase();

      // Combine all conditions
      return searchMatch && roleMatch && areaMatch && regionMatch;
    });
  }, [data, searchQuery, roleFilter, areaFilter, regionFilter]);

  return (
    <>
      {/* Filters Card */}
      <Card className="w-full mb-6">
        <CardHeader>
          <CardTitle>Salesman Ratings</CardTitle>
        </CardHeader>
        <CardContent>
          {/* --- Filter Components --- */}
          <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg mb-6">
            {/* 1. Salesman Name Search Input */}
            <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
              <label className="text-sm font-medium text-muted-foreground">Salesman Name Search</label>
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

            {/* 3. Area Filter */}
            {renderSelectFilter(
              'Area',
              areaFilter,
              (v) => { setAreaFilter(v); },
              availableAreas,
              isLoadingLocations
            )}

            {/* 4. Region Filter */}
            {renderSelectFilter(
              'Region',
              regionFilter,
              (v) => { setRegionFilter(v); },
              availableRegions,
              isLoadingLocations
            )}

            {locationError && <p className="text-xs text-red-500 w-full">Location Filter Error: {locationError}</p>}
            {roleError && <p className="text-xs text-red-500 w-full">Role Filter Error: {roleError}</p>}
          </div>
          {/* --- End Filter Components --- */}
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="w-full">
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              Loading salesman ratings...
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-8">
              <p>Error: {error}</p>
              <Button onClick={fetchData} className="ml-4 mt-2">Retry</Button>
            </div>
          ) : filteredRatings.length === 0 ? (
            <div className="text-center text-gray-500 p-8">
              No salesman ratings found matching the selected filters.
            </div>
          ) : (
            <>
              <DataTableReusable
                columns={columns}
                data={filteredRatings}
                enableRowDragging={false}
                onRowOrderChange={() => { }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}