// src/app/dashboard/dealerManagement/listVerifiedDealers.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2, Search, MapPin } from 'lucide-react'; 
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { selectVerifiedDealersSchema } from '../../../../drizzle/zodSchemas';

// --- EXTEND THE DRIZZLE SCHEMA ---
// Use .partial() because the backend API omits fields like `userId`, `brandSelling`, etc.
const extendedVerifiedDealersSchema = selectVerifiedDealersSchema.partial().extend({
    id: z.number(), // Ensure ID is strictly a string for DataTableReusable
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
    
    // Coerce timestamps that Drizzle expects as Date objects back from strings
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
});

type VerifiedDealerRecord = z.infer<typeof extendedVerifiedDealersSchema>;

const VERIFIED_DEALERS_API = `/api/dashboardPagesAPI/dealerManagement/verified-dealers`;

// Helper component for dropdown filters matching the theme
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

export default function ListVerifiedDealersPage() {
  // --- State ---
  const [dealers, setDealers] = useState<VerifiedDealerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filters ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterSegment, setFilterSegment] = useState<string>('all');

  // --- Fetch Data ---
  const fetchVerifiedDealers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(VERIFIED_DEALERS_API);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      
      // Parse using our new tolerant schema
      const validatedDealers = z.array(extendedVerifiedDealersSchema).parse(data);
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
  }, []);

  useEffect(() => {
    fetchVerifiedDealers();
  }, [fetchVerifiedDealers]);

  // --- Derived Filter Options ---
  const uniqueZones = useMemo(() => {
    const zones = new Set(dealers.map(d => d.zone).filter(Boolean) as string[]);
    return Array.from(zones).sort();
  }, [dealers]);

  const uniqueAreas = useMemo(() => {
    let filtered = dealers;
    if (filterZone !== 'all') {
      filtered = dealers.filter(d => d.zone === filterZone);
    }
    const areas = new Set(filtered.map(d => d.area).filter(Boolean) as string[]);
    return Array.from(areas).sort();
  }, [dealers, filterZone]);

  const uniqueSegments = useMemo(() => {
    const segments = new Set(dealers.map(d => d.dealerSegment).filter(Boolean) as string[]);
    return Array.from(segments).sort();
  }, [dealers]);

  // --- Client-side filtering ---
  const filteredDealers = useMemo(() => {
    return dealers.filter(d => {
      const nameMatch = !searchQuery || 
        (d.dealerPartyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.alias || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const zoneMatch = filterZone === 'all' || d.zone === filterZone;
      const areaMatch = filterArea === 'all' || d.area === filterArea;
      const segmentMatch = filterSegment === 'all' || d.dealerSegment === filterSegment;
      
      return nameMatch && zoneMatch && areaMatch && segmentMatch;
    });
  }, [dealers, searchQuery, filterZone, filterArea, filterSegment]);

  // --- Table columns ---
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
      accessorKey: 'dealerSegment', 
      header: 'Segment',
      cell: info => info.getValue() || '-'
    },
    
    // Combined Location Column (Zone + Area + District + State)
    {
      header: 'Location',
      accessorKey: 'district', // Fallback for sorting
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

  // --- Loading / Error gates ---
  if (loading) {
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

  // --- UI ---
  return (
    <div className="container mx-auto p-4 max-w-[100vw] overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Verified Dealers Registry</h1>
        <RefreshDataButton 
          cachePrefix="verified-dealers-list" 
          onRefresh={fetchVerifiedDealers} 
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border mb-6 shadow-sm">
        
        {/* 1. Name Search Input */}
        <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
          <label className="text-sm font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Name or Alias..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* 2. Segment Filter */}
        {renderSelectFilter(
          'Segment',
          filterSegment,
          setFilterSegment,
          uniqueSegments,
          loading
        )}

        {/* 3. Zone Filter */}
        {renderSelectFilter(
          'Zone',
          filterZone,
          setFilterZone,
          uniqueZones,
          loading
        )}

        {/* 4. Area Filter */}
        {renderSelectFilter(
          'Area',
          filterArea,
          setFilterArea,
          uniqueAreas,
          loading
        )}
      </div>

      {/* Table */}
      {filteredDealers.length === 0 ? (
        <div className="text-center py-12 bg-card text-muted-foreground rounded-lg border">No verified dealers found matching your filters.</div>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <DataTableReusable
            columns={columns}
            data={filteredDealers}
            enableRowDragging={false}
            onRowOrderChange={() => { }}
          />
        </div>
      )}
    </div>
  );
}