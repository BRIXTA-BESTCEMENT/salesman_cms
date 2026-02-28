// src/app/dashboard/dealerManagement/listDealers.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2, Search, MapPin, ExternalLink } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
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

export default function ListDealersPage() {
  const [dealers, setDealers] = useState<DealerRecord[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(true);
  const [errorDealers, setErrorDealers] = useState<string | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [dealerToDeleteId, setDealerToDeleteId] = useState<string | null>(null);

  // --- Pagination & Filters ---
  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const { locations, loading: locationsLoading, error: locationsError } = useDealerLocations();

  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typesError, setTypesError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, filterRegion, filterArea, filterType]);

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
      if (filterRegion !== 'all') url.searchParams.append('region', filterRegion);
      if (filterArea !== 'all') url.searchParams.append('area', filterArea);
      if (filterType !== 'all') url.searchParams.append('type', filterType);

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const result = await response.json();
      
      const rawData = result.data || result; // Fallback in case of shape mismatch
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
  }, [page, pageSize, debouncedSearchQuery, filterRegion, filterArea, filterType]);

  useEffect(() => {
    fetchDealers();
  }, [fetchDealers]);

  useEffect(() => {
    fetchDealerTypes();
  }, [fetchDealerTypes]);

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

      <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border mb-6 shadow-sm">
        
        <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Dealer Name / Firm</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 bg-background border-input"
            />
          </div>
        </div>

        {renderSelectFilter('Type', filterType, setFilterType, availableTypes, loadingTypes)}
        {renderSelectFilter('Region', filterRegion, setFilterRegion, (locations.regions || []).filter(Boolean).sort(), locationsLoading)}
        {renderSelectFilter('Area', filterArea, setFilterArea, (locations.areas || []).filter(Boolean).sort(), locationsLoading)}

        <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setFilterType('all');
              setFilterRegion('all');
              setFilterArea('all');
            }}
            className="mb-0.5 text-muted-foreground hover:text-destructive"
          >
            Clear Filters
        </Button>
      </div>

      {dealers.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 bg-muted/20 rounded-lg">No dealers found matching the selected filters.</div>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden p-1">
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