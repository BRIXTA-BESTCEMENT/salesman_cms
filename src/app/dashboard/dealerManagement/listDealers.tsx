// src/app/dashboard/dealerManagement/listDealers.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2, Search, MapPin, ExternalLink } from 'lucide-react'; // Added Icons
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { useDealerLocations } from '@/components/reusable-dealer-locations';
import { getDealersSchema } from '@/lib/shared-zod-schema';

type DealerRecord = z.infer<typeof getDealersSchema>;

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

export default function ListDealersPage() {
  // --- State for Dealer Listing ---
  const [dealers, setDealers] = useState<DealerRecord[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(true);
  const [errorDealers, setErrorDealers] = useState<string | null>(null);

  // --- Delete Dialog ---
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [dealerToDeleteId, setDealerToDeleteId] = useState<string | null>(null);

  // --- Filters ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Locations from shared hook
  const { locations, loading: locationsLoading, error: locationsError } = useDealerLocations();

  // Types
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typesError, setTypesError] = useState<string | null>(null);

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
      toast.error('Failed to load dealer types.');
    } finally {
      setLoadingTypes(false);
    }
  }, []);

  // --- Fetch Dealers ---
  const fetchDealers = useCallback(async () => {
    setLoadingDealers(true);
    setErrorDealers(null);
    try {
      const response = await fetch(`${DEALER_LOCATIONS_API}?status=VERIFIED`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      const validatedDealers = z.array(getDealersSchema).parse(data);
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
  }, []);

  useEffect(() => {
    fetchDealers();
    fetchDealerTypes();
  }, [fetchDealers, fetchDealerTypes]);

  // --- Delete Handler ---
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

  // --- Client-side filtering ---
  const filteredDealers = dealers.filter(d => {
    const nameMatch = !searchQuery || (d.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const regionMatch = filterRegion === 'all' || d.region === filterRegion;
    const areaMatch = filterArea === 'all' || d.area === filterArea;
    const typeMatch = filterType === 'all' || d.type === filterType;
    return nameMatch && regionMatch && areaMatch && typeMatch;
  });

  // --- Helper for Maps ---
  const getGoogleMapsLink = (lat?: number | null, lng?: number | null) => {
    if (!lat || !lng) return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  // --- Table columns ---
  const dealerColumns: ColumnDef<DealerRecord>[] = [
    { accessorKey: 'name', header: 'Name', cell: info => <span className="font-semibold">{info.getValue() as string}</span> },
    { accessorKey: 'type', header: 'Type' },
    
    // Combined Location Column (Region + Area + Address + Map)
    {
      header: 'Location',
      accessorKey: 'address', // Used for sorting fallback
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
    
    // Combined Business Info
    {
      header: 'Business Info',
      cell: ({ row }) => (
        <div className="flex flex-col text-xs space-y-1 min-w-[120px]">
           <div>Total: <span className="font-medium">{(row.original.totalPotential)?.toFixed(2)}</span></div>
           <div>Best: <span className="font-medium">{(row.original.bestPotential)?.toFixed(2)}</span></div>
           <div className="text-muted-foreground truncate max-w-[150px]" title={row.original.brandSelling.join(', ')}>
             {row.original.brandSelling.join(', ')}
           </div>
        </div>
      )
    },

    { accessorKey: 'createdAt', header: 'Added On', cell: info => new Date(info.getValue() as string).toLocaleDateString() },
    
    // {
    //   id: 'actions',
    //   header: 'Actions',
    //   cell: ({ row }) => (
    //     <Button
    //       className="bg-red-800 hover:bg-red-900 text-white h-7 px-3 text-xs"
    //       size="sm"
    //       onClick={() => {
    //         setDealerToDeleteId(row.original.id);
    //         setIsDeleteDialogOpen(true);
    //       }}
    //     >
    //       Delete
    //     </Button>
    //   ),
    // },
  ];

  // --- Loading / Error gates ---
  if (loadingDealers || locationsLoading || loadingTypes) {
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

  // --- UI ---
  return (
    <div className="container mx-auto p-4 max-w-[100vw] overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Manage Dealers</h1>
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

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border mb-6 shadow-sm">
        
        {/* 1. Name Search Input */}
        <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
          <label className="text-sm font-medium text-muted-foreground">Dealer Name</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by dealer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* 2. Type Filter */}
        {renderSelectFilter(
          'Type',
          filterType,
          setFilterType,
          availableTypes,
          loadingTypes
        )}

        {/* 3. Region Filter */}
        {renderSelectFilter(
          'Region',
          filterRegion,
          setFilterRegion,
          (locations.regions || []).filter(Boolean).sort(),
          locationsLoading
        )}

        {/* 4. Area Filter */}
        {renderSelectFilter(
          'Area',
          filterArea,
          setFilterArea,
          (locations.areas || []).filter(Boolean).sort(),
          locationsLoading
        )}
      </div>

      {/* Table */}
      {dealers.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">No dealers found for your company.</div>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <DataTableReusable
            columns={dealerColumns}
            data={filteredDealers}
            enableRowDragging={false}
            onRowOrderChange={() => { }}
          />
        </div>
      )}
    </div>
  );
}