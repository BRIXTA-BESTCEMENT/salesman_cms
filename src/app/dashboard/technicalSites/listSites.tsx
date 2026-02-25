// src/app/dashboard/technicalSites/listSites.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
  Search,
  MapPin,
  Calendar,
  ExternalLink
} from 'lucide-react';

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
  // Coerce coordinates
  latitude: z.coerce.number().nullable().optional().catch(null),
  longitude: z.coerce.number().nullable().optional().catch(null),

  // Fallback for nullable images
  imageUrl: z.string().nullable().optional(),

  // Relational Arrays (catch ensures it never crashes if API omits them)
  associatedUsers: z.array(associatedUserSchema).optional().catch([]),
  associatedDealers: z.array(associatedDealerSchema).optional().catch([]),
  associatedMasons: z.array(associatedMasonSchema).optional().catch([]),
  bagLifts: z.array(siteBagLiftSchema).optional().catch([]),
});

// Create strict type ensuring 'id' is a string for DataTableReusable
type TechnicalSiteRecord = Omit<z.infer<typeof extendedTechnicalSiteSchema>, 'id'> & { 
  id: string; 
};

const API_URL = `/api/dashboardPagesAPI/technical-sites`;

export default function ListSitesPage() {
  const [sites, setSites] = useState<TechnicalSiteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');

  // Derived lists for dropdowns
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableStages, setAvailableStages] = useState<string[]>([]);

  // --- Fetch Sites ---
  const fetchSites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      // Parse with the extended Zod schema to capture relations
      const validatedSites = z.array(extendedTechnicalSiteSchema).parse(data).map(site => ({
        ...site,
        id: site.id?.toString() || `${Math.random()}`
      })) as TechnicalSiteRecord[];
      
      setSites(validatedSites);

      // Extract unique regions and stages for filters
      const regions = new Set<string>();
      const stages = new Set<string>();
      validatedSites.forEach(s => {
        if (s.region) regions.add(s.region);
        if (s.stageOfConstruction) stages.add(s.stageOfConstruction);
      });
      setAvailableRegions(Array.from(regions).sort());
      setAvailableStages(Array.from(stages).sort());

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
  }, []);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // --- Client-side Filtering ---
  const filteredSites = React.useMemo(() => {
    return sites.filter((site) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (site.siteName || '').toLowerCase().includes(q) ||
        (site.concernedPerson || '').toLowerCase().includes(q) ||
        (site.phoneNo || '').includes(q) ||
        (site.address || '').toLowerCase().includes(q);

      const matchesRegion = filterRegion === 'all' || site.region === filterRegion;
      const matchesAreas = filterArea === 'all' || site.area === filterArea;
      const matchesStage = filterStage === 'all' || site.stageOfConstruction === filterStage;

      return matchesSearch && matchesRegion && matchesAreas && matchesStage;
    });
  }, [sites, searchQuery, filterRegion, filterArea, filterStage]);

  // --- Helpers ---
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const getGoogleMapsLink = (lat?: number | null, lng?: number | null) => {
    if (!lat || !lng) return null;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  };

  // --- Columns Definition ---
  const columns: ColumnDef<TechnicalSiteRecord>[] = [
    // 1. Basic Site Identity
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

    // 2. Primary Contact
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

    // 3. Location (Region, Area, Address, Map)
    {
      header: 'Location',
      accessorKey: 'address',
      cell: ({ row }) => {
        const { region, area, address, latitude, longitude } = row.original;
        const mapLink = getGoogleMapsLink(latitude, longitude);

        return (
          <div className="flex flex-col min-w-[180px] text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold">
              <MapPin className="h-3 w-3" />
              <span>{region || '-'} / {area || '-'}</span>
            </div>
            <span className="text-muted-foreground truncate max-w-[200px]" title={address || ''}>
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

    // 4. Construction Status & Dates
    {
      header: 'Construction',
      accessorKey: 'stageOfConstruction',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-[140px] space-y-1">
          <Badge variant="outline" className="w-fit bg-blue-50 text-blue-700 border-blue-200">
            {row.original.stageOfConstruction || 'N/A'}
          </Badge>
        </div>
      )
    },

    // 7. Key Person (Secondary Contact)
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

    // 8. Relations: Associated Users
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
                • {u.name} <span className="text-gray-400 text-[10px]">({u.role})</span>
              </div>
            ))}
          </div>
        );
      }
    },

    // 9. Relations: Associated Dealers
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

    // 10. Relations: Associated Masons
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

    // 11. Relations: Bag Lifts
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
            <span className="text-green-600">Pts: {totalPoints}</span>
          </div>
        );
      }
    }
  ];

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading technical sites...</div>;
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-12">
        <p>Error: {error}</p>
        <button onClick={fetchSites} className="underline mt-2">Retry</button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-[100vw] overflow-hidden">
      <div className="flex flex-col gap-4">
        {/* Header Section */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Technical Sites</h1>
          <RefreshDataButton
            cachePrefix="technical-sites"
            onRefresh={fetchSites}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-2 p-4 bg-card border rounded-lg shadow-sm">

          {/* Search */}
          <div className="flex flex-col space-y-1 w-full sm:w-[250px]">
            <label className="text-sm font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, Address, Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* Region Filter */}
          <div className="flex flex-col space-y-1 w-full sm:w-[200px]">
            <label className="text-sm font-medium text-muted-foreground">Region</label>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {availableRegions.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stage Filter */}
          <div className="flex flex-col space-y-1 w-full sm:w-[200px]">
            <label className="text-sm font-medium text-muted-foreground">Stage</label>
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {availableStages.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

        {/* Table Container */}
        {sites.length === 0 ? (
          <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">No technical sites found.</div>
        ) : (
          <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
            <DataTableReusable
              columns={columns}
              data={filteredSites}
              enableRowDragging={false}
              onRowOrderChange={() => { }}
            />
          </div>
        )}
      </div>
    </div>
  );
}