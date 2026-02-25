// app/dashboard/scoresAndRatings/dealerScores.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { z } from 'zod';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { toast } from 'sonner';

import { DataTableReusable } from '@/components/data-table-reusable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input'; // Added Shadcn Input import
import { Search, Loader2 } from 'lucide-react';

// Assuming standard naming convention from your previous files
import { selectDealerReportsAndScoresSchema } from '../../../../drizzle/zodSchemas';

// --- EXTEND THE DRIZZLE SCHEMA ---
// Coerce numerics safely and add joined relational fields from the backend
const extendedDealerScoreSchema = selectDealerReportsAndScoresSchema.partial().extend({
  id: z.string().optional(),
  dealerName: z.string().optional().catch("Unknown Dealer"),
  
  // Coerce all Postgres numerics/decimals to JS numbers
  dealerScore: z.coerce.number().optional().catch(0),
  trustWorthinessScore: z.coerce.number().optional().catch(0),
  creditWorthinessScore: z.coerce.number().optional().catch(0),
  orderHistoryScore: z.coerce.number().optional().catch(0),
  visitFrequencyScore: z.coerce.number().optional().catch(0),
  
  // Additional joined fields
  lastUpdatedDate: z.string().optional().catch("N/A"),
  area: z.string().nullable().optional().catch(null),
  region: z.string().nullable().optional().catch(null),
  type: z.string().nullable().optional().catch(null),
});

// Strictly type the ID as a string so DataTableReusable doesn't complain
type DealerScore = Omit<z.infer<typeof extendedDealerScoreSchema>, 'id'> & { id: string };

const columnHelper = createColumnHelper<DealerScore>();

const columns: ColumnDef<DealerScore, any>[] = [
  columnHelper.accessor('dealerName', {
    header: 'Dealer Name',
    cell: (info) => info.getValue() || 'N/A',
  }),
  columnHelper.accessor('dealerScore', {
    header: 'Overall Score',
    cell: (info) => (info.getValue() ?? 0).toFixed(2),
  }),
  columnHelper.accessor('trustWorthinessScore', {
    header: 'Trust Score',
    cell: (info) => (info.getValue() ?? 0).toFixed(2),
  }),
  columnHelper.accessor('creditWorthinessScore', {
    header: 'Credit Score',
    cell: (info) => (info.getValue() ?? 0).toFixed(2),
  }),
  columnHelper.accessor('orderHistoryScore', {
    header: 'Order History Score',
    cell: (info) => (info.getValue() ?? 0).toFixed(2),
  }),
  columnHelper.accessor('visitFrequencyScore', {
    header: 'Visit Frequency Score',
    cell: (info) => (info.getValue() ?? 0).toFixed(2),
  }),
  columnHelper.accessor('lastUpdatedDate', {
    header: 'Last Updated',
    cell: (info) => {
      const val = info.getValue();
      // Format cleanly if it's a valid date string
      if (!val || val === "N/A") return 'N/A';
      return new Date(val).toLocaleDateString();
    },
  }),
];

// --- Filter helper (reused pattern) ---
const renderSelectFilter = (
  label: string,
  value: string,
  onValueChange: (v: string) => void,
  options: string[],
  isLoading: boolean = false
) => (
  <div className="flex flex-col space-y-1 w-full sm:w-40 min-w-[120px]">
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

export default function DealerScores() {
  const [data, setData] = useState<DealerScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Available options
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);

  // Fetch dealer scores
  const fetchScores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboardPagesAPI/scores-ratings?type=dealer`);
      if (!res.ok) throw new Error('Failed to fetch dealer scores');
      const raw = await res.json();
      
      const validated = z.array(extendedDealerScoreSchema).parse(raw).map(d => ({
        ...d,
        id: d.id?.toString() || d.dealerName || `${Math.random()}`, 
      })) as DealerScore[];

      setData(validated);
    } catch (err: any) {
      console.error('Fetching error:', err);
      setError(err.message || 'Failed to fetch dealer scores');
      toast.error('Failed to load dealer scores.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch locations
  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
    try {
      const res = await fetch(`/api/dashboardPagesAPI/dealerManagement/dealer-locations`);
      if (!res.ok) throw new Error('Failed to fetch dealer locations');
      const j = await res.json();
      const regions = Array.isArray(j.regions) ? j.regions.filter(Boolean) : [];
      const areas = Array.isArray(j.areas) ? j.areas.filter(Boolean) : [];
      setAvailableRegions(regions);
      setAvailableAreas(areas);
    } catch (err: any) {
      console.error('Locations fetch error:', err);
      setLocationError(err.message || 'Failed to load locations');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  // Fetch dealer types
  const fetchTypes = useCallback(async () => {
    setIsLoadingTypes(true);
    setTypeError(null);
    try {
      const res = await fetch(`/api/dashboardPagesAPI/dealerManagement/dealer-types`);
      if (!res.ok) throw new Error('Failed to fetch dealer types');
      const j = await res.json();
      const types = Array.isArray(j.type) ? j.type.filter(Boolean) : [];
      setAvailableTypes(types);
    } catch (err: any) {
      console.error('Types fetch error:', err);
      setTypeError(err.message || 'Failed to load types');
    } finally {
      setIsLoadingTypes(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
    fetchLocations();
    fetchTypes();
  }, [fetchScores, fetchLocations, fetchTypes]);

  const filteredData = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();

    return data.filter(d => {
      // Search on dealerName
      const name = (d.dealerName || '').toLowerCase();
      const matchesSearch = !q || name.includes(q);

      const rowArea = (d.area || '').trim().toLowerCase();
      const rowRegion = (d.region || '').trim().toLowerCase();
      const rowType = (d.type || '').trim().toLowerCase();

      const areaMatch = areaFilter === 'all' || (rowArea && rowArea === areaFilter.toLowerCase());
      const regionMatch = regionFilter === 'all' || (rowRegion && rowRegion === regionFilter.toLowerCase());
      const typeMatch = typeFilter === 'all' || (rowType && rowType === typeFilter.toLowerCase());

      const areaCond = !d.area ? areaFilter === 'all' : areaMatch;
      const regionCond = !d.region ? regionFilter === 'all' : regionMatch;
      const typeCond = !d.type ? typeFilter === 'all' : typeMatch;

      return matchesSearch && areaCond && regionCond && typeCond;
    });
  }, [data, searchQuery, areaFilter, regionFilter, typeFilter]);


  return (
    <>
      {/* Filters Card */}
      <Card className="w-full mb-6">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center justify-between w-full">
            <CardTitle>Dealer Scores</CardTitle>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-end gap-4 p-2 w-full">
            <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
              <label className="text-sm font-medium text-muted-foreground">Search Dealer</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Dealer name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9" 
                />
              </div>
            </div>

            {renderSelectFilter('Area', areaFilter, setAreaFilter, availableAreas, isLoadingLocations)}
            {renderSelectFilter('Region', regionFilter, setRegionFilter, availableRegions, isLoadingLocations)}
            {renderSelectFilter('Type', typeFilter, setTypeFilter, availableTypes, isLoadingTypes)}

            {locationError && <p className="text-xs text-red-500 w-full mt-2">Location Filter Error: {locationError}</p>}
            {typeError && <p className="text-xs text-red-500 w-full mt-2">Type Filter Error: {typeError}</p>}
          </div>
        </CardHeader>
      </Card>

      {/* Table Card */}
      <Card className="w-full">
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading...
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-8">
              <p>Error: {error}</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center text-gray-500 p-8">No dealer scores found for the selected filters.</div>
          ) : (
            <>
              <DataTableReusable
                columns={columns}
                data={filteredData}
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