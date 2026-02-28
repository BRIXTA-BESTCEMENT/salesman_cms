// src/app/dashboard/technicalSites/listSites.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
  Search,
  MapPin,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { Badge } from '@/components/ui/badge';

import { selectTechnicalSiteSchema } from '../../../../drizzle/zodSchemas';

// --- NESTED RELATIONAL SCHEMAS ---
const associatedUserSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional().catch("Unknown"),
  role: z.string().optional().catch(""),
});

const associatedDealerSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional().catch("Unknown"),
  area: z.string().nullable().optional().catch(""),
});

const associatedMasonSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional().catch("Unknown"),
});

const siteBagLiftSchema = z.object({
  bagCount: z.coerce.number().catch(0),
  pointsCredited: z.coerce.number().catch(0),
});

// --- EXTEND THE DRIZZLE SCHEMA ---
const extendedTechnicalSiteSchema = selectTechnicalSiteSchema.extend({
  latitude: z.coerce.number().nullable().optional().catch(null),
  longitude: z.coerce.number().nullable().optional().catch(null),
  imageUrl: z.string().nullable().optional(),

  associatedUsers: z.array(associatedUserSchema).optional().catch([]),
  associatedDealers: z.array(associatedDealerSchema).optional().catch([]),
  associatedMasons: z.array(associatedMasonSchema).optional().catch([]),
  bagLifts: z.array(siteBagLiftSchema).optional().catch([]),
});

type TechnicalSiteRecord = Omit<z.infer<typeof extendedTechnicalSiteSchema>, 'id'> & { 
  id: string; 
};

const API_URL = `/api/dashboardPagesAPI/technical-sites`;

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

export default function ListSitesPage() {
  const [sites, setSites] = useState<TechnicalSiteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');

  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableStages, setAvailableStages] = useState<string[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, filterRegion, filterArea, filterStage]);

  const fetchFilters = useCallback(async () => {
    setFiltersLoading(true);
    try {
      const response = await fetch(`${API_URL}?action=fetch_filters`);
      if (response.ok) {
        const data = await response.json();
        setAvailableRegions(data.regions || []);
        setAvailableAreas(data.areas || []);
        setAvailableStages(data.stages || []);
      }
    } catch (e) {
      console.error("Failed to load site filters", e);
    } finally {
      setFiltersLoading(false);
    }
  }, []);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(API_URL, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (filterRegion !== 'all') url.searchParams.append('region', filterRegion);
      if (filterArea !== 'all') url.searchParams.append('area', filterArea);
      if (filterStage !== 'all') url.searchParams.append('stage', filterStage);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      const data = result.data || result;
      setTotalCount(result.totalCount || 0);

      const validatedSites = z.array(extendedTechnicalSiteSchema).parse(data).map(site => ({
        ...site,
        id: site.id?.toString() || `${Math.random()}`
      })) as TechnicalSiteRecord[];
      
      setSites(validatedSites);
      toast.success('Technical sites loaded successfully!');
    } catch (e: any) {
      console.error('Failed to fetch sites:', e);
      const message = e instanceof z.ZodError
        ? 'Data validation failed.'
        : (e.message || 'An unknown error occurred.');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearchQuery, filterRegion, filterArea, filterStage]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const getGoogleMapsLink = (lat?: number | null, lng?: number | null) => {
    if (!lat || !lng) return null;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  };

  const columns: ColumnDef<TechnicalSiteRecord>[] = [
    {
      accessorKey: 'siteName',
      header: 'Site Details',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-[150px]">
          <span className="font-semibold text-sm">{row.original.siteName}</span>
          <span className="text-xs text-muted-foreground">{row.original.siteType || 'Unknown Type'}</span>
          {row.original.imageUrl && (
            <a href={row.original.imageUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline mt-1">
              View Image
            </a>
          )}
        </div>
      )
    },
    {
      header: 'Primary Contact',
      accessorKey: 'concernedPerson',
      cell: ({ row }) => (
        <div className="flex flex-col text-sm">
          <span className="font-medium">{row.original.concernedPerson}</span>
          <span className="text-muted-foreground text-xs">{row.original.phoneNo}</span>
        </div>
      )
    },
    {
      header: 'Location',
      accessorKey: 'address',
      cell: ({ row }) => {
        const { region, area, address, latitude, longitude } = row.original;
        const mapLink = getGoogleMapsLink(latitude, longitude);

        return (
          <div className="flex flex-col min-w-[180px] text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{region || '-'} / {area || '-'}</span>
            </div>
            <span className="text-foreground truncate max-w-[200px]" title={address || ''}>
              {address || 'No Address'}
            </span>
            {mapLink && (
              <a href={mapLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                <ExternalLink className="h-3 w-3" /> View Map
              </a>
            )}
          </div>
        );
      }
    },
    {
      header: 'Construction',
      accessorKey: 'stageOfConstruction',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-[140px] space-y-1">
          <Badge variant="outline" className="w-fit bg-blue-50 text-blue-700 border-blue-200 shadow-none">
            {row.original.stageOfConstruction || 'N/A'}
          </Badge>
        </div>
      )
    },
    {
      header: 'Key Person',
      accessorKey: 'keyPersonName',
      cell: ({ row }) => {
        if (!row.original.keyPersonName) return <span className="text-muted-foreground text-xs">-</span>;
        return (
          <div className="flex flex-col text-xs">
            <span className="font-medium">{row.original.keyPersonName}</span>
            <span className="text-muted-foreground">{row.original.keyPersonPhoneNum}</span>
          </div>
        );
      }
    },
    {
      header: () => <div className="flex items-center gap-1">Users</div>,
      accessorKey: 'associatedUsers',
      cell: ({ row }) => {
        const users = row.original.associatedUsers;
        if (!users || users.length === 0) return <span className="text-muted-foreground text-xs">-</span>;
        return (
          <div className="flex flex-col gap-1 max-h-20 overflow-y-auto text-xs">
            {users.map((u, i) => (
              <div key={`${u.id}-${i}`} className="whitespace-nowrap">
                • {u.name} <span className="text-muted-foreground text-[10px]">({u.role})</span>
              </div>
            ))}
          </div>
        );
      }
    },
    {
      header: () => <div className="flex items-center gap-1">Dealers</div>,
      accessorKey: 'associatedDealers',
      cell: ({ row }) => {
        const dealers = row.original.associatedDealers;
        if (!dealers || dealers.length === 0) return <span className="text-muted-foreground text-xs">-</span>;
        return (
          <div className="flex flex-col gap-1 max-h-20 overflow-y-auto text-xs">
            {dealers.map((d, i) => (
              <div key={`${d.id}-${i}`} className="whitespace-nowrap" title={d.area || ''}>
                • {d.name}
              </div>
            ))}
          </div>
        );
      }
    },
    {
      header: () => <div className="flex items-center gap-1">Masons</div>,
      accessorKey: 'associatedMasons',
      cell: ({ row }) => {
        const masons = row.original.associatedMasons;
        if (!masons || masons.length === 0) return <span className="text-muted-foreground text-xs">-</span>;
        return (
          <div className="flex flex-col gap-1 max-h-20 overflow-y-auto text-xs">
            {masons.map((m, i) => (
              <div key={`${m.id}-${i}`} className="whitespace-nowrap">
                • {m.name}
              </div>
            ))}
          </div>
        );
      }
    },
    {
      header: () => <div className="flex items-center gap-1">Lifts</div>,
      accessorKey: 'bagLifts',
      cell: ({ row }) => {
        const lifts = row.original.bagLifts;
        if (!lifts || lifts.length === 0) return <span className="text-muted-foreground text-xs">-</span>;

        const totalBags = lifts.reduce((acc, curr) => acc + curr.bagCount, 0);
        const totalPoints = lifts.reduce((acc, curr) => acc + curr.pointsCredited, 0);

        return (
          <div className="flex flex-col text-xs min-w-20">
            <span className="font-semibold">{lifts.length} Entries</span>
            <span className="text-muted-foreground">Qty: {totalBags}</span>
            <span className="text-green-600 font-medium">Pts: {totalPoints}</span>
          </div>
        );
      }
    }
  ];

  return (
    <div className="container mx-auto p-4 max-w-[100vw] overflow-hidden">
      <div className="flex flex-col gap-4">
        
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Technical Sites</h1>
              <Badge variant="outline" className="text-base px-4 py-1">
                 Total Sites: {totalCount}
              </Badge>
          </div>
          <RefreshDataButton
            cachePrefix="technical-sites"
            onRefresh={fetchSites}
          />
        </div>

        <div className="flex flex-wrap items-end gap-4 mb-2 p-4 bg-card border rounded-lg shadow-sm">
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Search Sites</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, Contact, Address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 bg-background border-input"
              />
            </div>
          </div>

          {renderSelectFilter('Stage', filterStage, setFilterStage, availableStages, filtersLoading)}
          {renderSelectFilter('Region', filterRegion, setFilterRegion, availableRegions, filtersLoading)}
          {renderSelectFilter('Area', filterArea, setFilterArea, availableAreas, filtersLoading)}

          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setFilterStage('all');
              setFilterRegion('all');
              setFilterArea('all');
            }}
            className="mb-0.5 text-muted-foreground hover:text-destructive"
          >
            Clear Filters
          </Button>
        </div>

        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {loading && sites.length === 0 ? (
             <div className="flex justify-center items-center h-64">
               <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
               <p className="text-muted-foreground">Loading technical sites...</p>
             </div>
          ) : error ? (
            <div className="text-center text-red-500 py-12 flex flex-col items-center">
              <p>Error: {error}</p>
              <Button onClick={fetchSites} variant="outline" className="mt-4">Retry</Button>
            </div>
          ) : sites.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No technical sites found matching your filters.</div>
          ) : (
            <DataTableReusable
              columns={columns}
              data={sites}
              enableRowDragging={false}
              onRowOrderChange={() => { }}
            />
          )}
        </div>
      </div>
    </div>
  );
}