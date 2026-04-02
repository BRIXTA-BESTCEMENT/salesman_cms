// src/app/dashboard/dealerManagement/listVerifiedDealers.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2, MapPin } from 'lucide-react'; 
import { Badge } from '@/components/ui/badge';

// Reusable Components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar'; 
import { useDebounce } from '@/hooks/use-debounce-search';

import { selectVerifiedDealersSchema } from '../../../../drizzle/zodSchemas';

const extendedVerifiedDealersSchema = selectVerifiedDealersSchema.partial().extend({
    id: z.number(), 
    dealerPartyName: z.string().optional().catch("Unknown"),
    alias: z.string().nullable().optional(),
    zone: z.string().nullable().optional(),
    area: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    pinCode: z.string().nullable().optional(),
    contactNo1: z.string().nullable().optional(),
    contactNo2: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    contactPerson: z.string().nullable().optional(),
    creditLimit: z.coerce.number().nullable().optional(),
    salesManNameRaw: z.string().nullable().optional(),
    gstNo: z.string().nullable().optional(),
    panNo: z.string().nullable().optional(),
    dealerSegment: z.string().nullable().optional(),
    
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
});

type VerifiedDealerRecord = z.infer<typeof extendedVerifiedDealersSchema>;

const VERIFIED_DEALERS_API = `/api/dashboardPagesAPI/dealerManagement/verified-dealers`;

export default function ListVerifiedDealersPage() {
  const [dealers, setDealers] = useState<VerifiedDealerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);

  // --- Backend Filter Options ---
  const [uniqueZones, setUniqueZones] = useState<string[]>([]);
  const [uniqueAreas, setUniqueAreas] = useState<string[]>([]);
  const [uniqueSegments, setUniqueSegments] = useState<string[]>([]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, zoneFilters, areaFilters]);

  const fetchFilters = useCallback(async () => {
    try {
      const url = new URL(VERIFIED_DEALERS_API, window.location.origin);
      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUniqueZones(data.uniqueZones || []);
        setUniqueAreas(data.uniqueAreas || []);
        setUniqueSegments(data.uniqueSegments || []);
      }
    } catch (e) {
      console.error("Failed to load verified dealer filters", e);
    }
  }, []);

  const fetchVerifiedDealers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(VERIFIED_DEALERS_API, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      
      // Join arrays for multi-select
      if (zoneFilters.length > 0) url.searchParams.append('zone', zoneFilters.join(','));
      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));

      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const result = await response.json();
      const rawData = result.data || result;
      setTotalCount(result.totalCount || 0);

      const validatedDealers = z.array(extendedVerifiedDealersSchema).parse(rawData);
      setDealers(validatedDealers);
      toast.success('Verified dealers loaded successfully!');
    } catch (e: any) {
      console.error('Failed to fetch verified dealers:', e);
      const msg = e instanceof z.ZodError
        ? 'Data validation failed. Schema mismatch with backend.'
        : (e.message || 'An unknown error occurred.');
      toast.error(`Failed to load verified dealers: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearchQuery, zoneFilters, areaFilters]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchVerifiedDealers();
  }, [fetchVerifiedDealers]);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const zoneOptions = useMemo(() => uniqueZones.sort().map(r => ({ label: r, value: r })), [uniqueZones]);
  const areaOptions = useMemo(() => uniqueAreas.sort().map(a => ({ label: a, value: a })), [uniqueAreas]);

  const columns: ColumnDef<VerifiedDealerRecord>[] = [
    { 
      accessorKey: 'dealerPartyName', 
      header: 'Dealer Name', 
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.original.dealerPartyName || '-'}</span>
          {row.original.alias && <span className="text-xs text-muted-foreground">Alias: {row.original.alias}</span>}
        </div>
      )
    },
    {
      header: 'Location',
      accessorKey: 'district', 
      cell: ({ row }) => {
        const { zone, area, district, state, pinCode } = row.original;

        return (
          <div className="flex flex-col min-w-[180px] text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{zone || '-'} / {area || '-'}</span>
            </div>
            <div className="text-foreground truncate max-w-[250px]">
              {[district, state, pinCode].filter(Boolean).join(', ') || 'No Address Details'}
            </div>
          </div>
        );
      }
    },
    { 
      header: 'Contact Info',
      cell: ({ row }) => {
        const { contactNo1, contactNo2, email, contactPerson } = row.original;
        return (
          <div className="flex flex-col text-xs space-y-1 min-w-[150px]">
             {contactPerson && <div>Person: <span className="font-medium">{contactPerson}</span></div>}
             {contactNo1 && <div>Primary: <span className="font-medium">{contactNo1}</span></div>}
             {contactNo2 && <div>Alt: <span className="text-muted-foreground">{contactNo2}</span></div>}
             {email && <div className="text-blue-600 truncate max-w-[150px]" title={email}>{email}</div>}
             {!contactNo1 && !contactNo2 && !email && !contactPerson && <span className="text-gray-400 italic">No Contact Info</span>}
          </div>
        )
      }
    },
    { 
      header: 'Sales & Financials',
      cell: ({ row }) => {
        const { creditLimit, salesManNameRaw } = row.original;
        return (
          <div className="flex flex-col text-xs space-y-1 min-w-[150px]">
             <div className="truncate" title={salesManNameRaw || ''}>Salesman: <span className="font-medium">{salesManNameRaw || '-'}</span></div>
             <div>Credit Limit: <span className="text-muted-foreground">{creditLimit ? `₹${creditLimit}` : '-'}</span></div>
          </div>
        )
      }
    },
    { 
      header: 'Tax Info',
      cell: ({ row }) => {
        const { gstNo, panNo } = row.original;
        return (
          <div className="flex flex-col text-xs space-y-1 min-w-[120px]">
             <div>GST: <span className="font-medium">{gstNo || '-'}</span></div>
             <div>PAN: <span className="text-muted-foreground">{panNo || '-'}</span></div>
          </div>
        )
      }
    }
  ];

  if (loading && dealers.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading verified dealer data...</p>
      </div>
    );
  }
  
  if (error) {
    return <div className="text-center text-red-500 min-h-screen pt-10">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-[100vw] overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Verified Dealers Registry</h1>
          <Badge variant="outline" className="text-base px-4 py-1">
            Total Dealers: {totalCount}
          </Badge>
        </div>
        <RefreshDataButton 
          cachePrefix="verified-dealers-list" 
          onRefresh={fetchVerifiedDealers} 
        />
      </div>

      {/* --- Unified Global Filter Bar --- */}
      <div className="w-full mb-6 relative z-50">
        <GlobalFilterBar 
          showSearch={true}
          showRole={false} 
          showZone={true}
          showArea={true}
          showDateRange={false}
          showStatus={false}

          searchVal={searchQuery}
          zoneVals={zoneFilters}
          areaVals={areaFilters}

          zoneOptions={zoneOptions}
          areaOptions={areaOptions}

          onSearchChange={setSearchQuery}
          onZoneChange={setZoneFilters}
          onAreaChange={setAreaFilters}
        />
      </div>

      {dealers.length === 0 ? (
        <div className="text-center py-12 bg-card text-muted-foreground rounded-lg border shadow-sm">No verified dealers found matching your filters.</div>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden p-1 relative z-0">
          <DataTableReusable
            columns={columns}
            data={dealers}
            enableRowDragging={false}
            onRowOrderChange={() => { }}
          />
        </div>
      )}
    </div>
  );
}