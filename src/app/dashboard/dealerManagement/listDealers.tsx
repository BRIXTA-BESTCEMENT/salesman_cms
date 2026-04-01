// src/app/dashboard/dealerManagement/listDealers.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2, MapPin, ExternalLink } from 'lucide-react'; 

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

// Reusable Components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar'; 
import { useDebounce } from '@/hooks/use-debounce-search';
import { useDealerLocations } from '@/components/reusable-dealer-locations';
import { selectDealerSchema } from '../../../../drizzle/zodSchemas';

const dealerFrontendSchema = selectDealerSchema.extend({
  totalPotential: z.number(),
  bestPotential: z.number(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),

  createdAt: z.string(),
  updatedAt: z.string(),

  parentDealerName: z.string().nullable().optional(),
});

type DealerRecord = z.infer<typeof dealerFrontendSchema>;

const DEALER_LOCATIONS_API = `/api/dashboardPagesAPI/dealerManagement`;
const DEALER_TYPES_API = `/api/dashboardPagesAPI/dealerManagement/dealer-types`;

export default function ListDealersPage() {
  const [dealers, setDealers] = useState<DealerRecord[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(true);
  const [errorDealers, setErrorDealers] = useState<string | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [dealerToDeleteId, setDealerToDeleteId] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [zoneFilters, setZoneFilters] = useState<string[]>([]);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // --- Backend Filter Options ---
  const { locations, loading: locationsLoading, error: locationsError } = useDealerLocations();
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typesError, setTypesError] = useState<string | null>(null);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, zoneFilters, areaFilters, typeFilter]);

  const fetchDealerTypes = useCallback(async () => {
    setLoadingTypes(true);
    setTypesError(null);
    try {
      const res = await fetch(DEALER_TYPES_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { type: string[] };
      const safe = Array.isArray(data.type) ? data.type.filter(Boolean) : [];
      setAvailableTypes(safe);
    } catch (e: any) {
      console.error('Failed to fetch dealer types:', e);
      setTypesError('Failed to load dealer types.');
    } finally {
      setLoadingTypes(false);
    }
  }, []);

  const fetchDealers = useCallback(async () => {
    setLoadingDealers(true);
    setErrorDealers(null);
    try {
      const url = new URL(DEALER_LOCATIONS_API, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      
      // Join arrays for multi-select
      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
      if (zoneFilters.length > 0) url.searchParams.append('region', zoneFilters.join(','));
      
      if (typeFilter !== 'all') url.searchParams.append('type', typeFilter);

      const response = await fetch(url.toString());
      const result = await response.json();
      const rawData = result.data || result; 
      setTotalCount(result.totalCount || 0);

      const validatedDealers = z.array(dealerFrontendSchema).parse(rawData);
      setDealers(validatedDealers);
      toast.success('Verified dealers loaded successfully!');
    } catch (e: any) {
      console.error('Failed to fetch dealers:', e);
      const msg = e instanceof z.ZodError
        ? 'Data validation failed. Schema mismatch with backend.'
        : (e.message || 'An unknown error occurred.');
      toast.error(`Failed to load dealers: ${msg}`);
      setErrorDealers(msg);
    } finally {
      setLoadingDealers(false);
    }
  }, [page, pageSize, debouncedSearchQuery, zoneFilters, areaFilters, typeFilter]);

  useEffect(() => {
    fetchDealers();
  }, [fetchDealers]);

  useEffect(() => {
    fetchDealerTypes();
  }, [fetchDealerTypes]);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const zoneOptions = useMemo(() => (locations.regions || []).filter(Boolean).sort().map(r => ({ label: r, value: r })), [locations.regions]);
  const areaOptions = useMemo(() => (locations.areas || []).filter(Boolean).sort().map(a => ({ label: a, value: a })), [locations.areas]);
  const typeOptions = useMemo(() => [
    { label: 'All Dealer Types', value: 'all' },
    ...availableTypes.map(t => ({ label: t, value: t }))
  ], [availableTypes]);

  const handleDelete = async () => {
    if (!dealerToDeleteId) return;
    try {
      const response = await fetch(`${DEALER_LOCATIONS_API}?id=${dealerToDeleteId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to delete dealer.');
      }
      toast.success('Dealer deleted successfully!');
      setIsDeleteDialogOpen(false);
      setDealerToDeleteId(null);
      fetchDealers();
    } catch (e: any) {
      console.error('Error deleting dealer:', e);
      toast.error(e.message || 'An unexpected error occurred.');
    }
  };

  const getGoogleMapsLink = (lat?: number | null, lng?: number | null) => {
    if (lat == null || lng == null) return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  const dealerColumns: ColumnDef<DealerRecord>[] = [
    { accessorKey: 'name', header: 'Name', cell: info => <span className="font-semibold">{info.getValue() as string}</span> },
    { accessorKey: 'type', header: 'Type' },
    {
      header: 'Location',
      accessorKey: 'address', 
      cell: ({ row }) => {
        const { region, area, address, pinCode, latitude, longitude } = row.original;
        const mapLink = getGoogleMapsLink(latitude, longitude);

        return (
          <div className="flex flex-col min-w-[180px] text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{region || '-'} / {area || '-'}</span>
            </div>
            <div className="text-foreground truncate max-w-[250px]" title={address || ''}>
              {address || 'No Address'} {pinCode ? `- ${pinCode}` : ''}
            </div>
            {mapLink ? (
              <a 
                href={mapLink} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-1 text-blue-600 hover:underline w-fit"
              >
                <ExternalLink className="h-3 w-3" /> View on Map
              </a>
            ) : (
               <span className="text-gray-400 italic text-[10px]">No Coords</span>
            )}
          </div>
        );
      }
    },
    { accessorKey: 'parentDealerName', header: 'Parent', cell: info => info.getValue() || '-' },
    { accessorKey: 'nameOfFirm', header: 'Firm Name' },
    { accessorKey: 'underSalesPromoterName', header: 'SP Name' },
    { accessorKey: 'phoneNo', header: 'Phone No.' },
   {
      header: 'Business Info',
      cell: ({ row }) => {
        const brands = row.original.brandSelling ?? [];
        const total = Number(row.original.totalPotential || 0);
        const best = Number(row.original.bestPotential || 0);
        return (
          <div className="flex flex-col text-xs space-y-1 min-w-[120px]">
            <div>
              Total: <span className="font-medium">{total.toFixed(2)}</span>
            </div>
            <div>
              Best: <span className="font-medium">{best.toFixed(2)}</span>
            </div>
            <div 
              className="text-muted-foreground truncate max-w-[150px]" 
              title={brands.join(', ')}
            >
              {brands.length > 0 ? brands.join(', ') : 'No brands'}
            </div>
          </div>
        );
      }
    },
    { accessorKey: 'createdAt', header: 'Added On', cell: info => new Date(info.getValue() as string).toLocaleDateString() },
  ];

  if (loadingDealers && dealers.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading dealer data...</p>
      </div>
    );
  }
  
  if (errorDealers || locationsError || typesError) {
    return <div className="text-center text-red-500 min-h-screen pt-10">Error: {errorDealers || locationsError || typesError}</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-[100vw] overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Manage Dealers</h1>
          <Badge variant="outline" className="text-base px-4 py-1">
            Total Dealers: {totalCount}
          </Badge>
        </div>
        <RefreshDataButton 
          cachePrefix="dealers" 
          onRefresh={fetchDealers} 
        />
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>This action cannot be undone. This will permanently delete the dealer record.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Unified Global Filter Bar --- */}
      <div className="w-full mb-6 relative z-50">
        <GlobalFilterBar 
          showSearch={true}
          showRole={true} // Re-using Role slot for "Dealer Type"
          showZone={true}
          showArea={true}
          showDateRange={false}
          showStatus={false}

          searchVal={searchQuery}
          roleVal={typeFilter}
          zoneVals={zoneFilters}
          areaVals={areaFilters}

          roleOptions={typeOptions}
          zoneOptions={zoneOptions}
          areaOptions={areaOptions}

          onSearchChange={setSearchQuery}
          onRoleChange={setTypeFilter}
          onZoneChange={setZoneFilters}
          onAreaChange={setAreaFilters}
        />
      </div>

      {dealers.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 bg-muted/20 rounded-lg">No dealers found matching the selected filters.</div>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden p-1 relative z-0">
          <DataTableReusable
            columns={dealerColumns}
            data={dealers}
            enableRowDragging={false}
            onRowOrderChange={() => { }}
          />
        </div>
      )}
    </div>
  );
}