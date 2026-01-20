// src/app/dashboard/logisticsGateIO/gateIO.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { 
  Search, 
  MapPin, 
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTableReusable } from '@/components/data-table-reusable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// We assume you added this to your shared schema as per previous steps
import { logisticsGateIOSchema } from '@/lib/shared-zod-schema';

type LogisticsRecord = z.infer<typeof logisticsGateIOSchema>;

const API_URL = `/api/dashboardPagesAPI/logistics-gate-io`;

export default function LogisticsGateIOList() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filters ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [filterDistrict, setFilterDistrict] = useState<string>('all');
  
  // Date Filters (Default to current month or empty)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Derived lists for dropdowns
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

  // --- Fetch Data ---
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build Query String
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (filterZone && filterZone !== 'all') params.append('zone', filterZone);
      if (filterDistrict && filterDistrict !== 'all') params.append('district', filterDistrict);

      const response = await fetch(`${API_URL}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // Parse with Zod
      const validatedData = z.array(logisticsGateIOSchema).parse(data);
      setRecords(validatedData);

      // Extract unique values for filters from the fetched data
      // (Alternatively, you could fetch these lists from a separate API)
      const zones = new Set<string>();
      const districts = new Set<string>();
      
      validatedData.forEach(r => {
        if (r.zone) zones.add(r.zone);
        if (r.district) districts.add(r.district);
      });

      setAvailableZones(Array.from(zones).sort());
      setAvailableDistricts(Array.from(districts).sort());

      toast.success('Logistics data loaded successfully');
    } catch (e: any) {
      console.error('Failed to fetch logistics data:', e);
      const message = e instanceof z.ZodError
        ? 'Data validation failed.'
        : (e.message || 'An unknown error occurred.');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterZone, filterDistrict]);

  // Initial Fetch
  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount, then user clicks "Apply" for dates usually, or auto-fetch on filter change if preferred

  // --- Client-side Search Filtering ---
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (record.id || '').toLowerCase().includes(q) ||
        (record.destination || '').toLowerCase().includes(q) ||
        (record.zone || '').toLowerCase().includes(q) ||
        (record.district || '').toLowerCase().includes(q);

      return matchesSearch;
    });
  }, [records, searchQuery]);

  // --- Helper: Formatters ---
  const formatTime = (dateStr?: string | null, timeStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    const t = timeStr || '';
    return (
      <div className="flex flex-col text-xs">
        <span className="font-medium">{d}</span>
        <span className="text-muted-foreground text-[10px]">{t}</span>
      </div>
    );
  };

  // --- Columns Definition ---
  const columns: ColumnDef<LogisticsRecord>[] = [
    // 1. Location Info
    {
      header: 'Location / Zone',
      accessorKey: 'zone',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-[120px] text-xs">
          <div className="flex items-center gap-1 font-semibold">
            <MapPin className="h-3 w-3 text-blue-500" />
            <span>{row.original.zone}</span>
          </div>
          <span className="text-muted-foreground">{row.original.district}</span>
          <span className="text-gray-500 italic">{row.original.destination}</span>
        </div>
      )
    },

    // 2. DO Order
    {
      header: 'DO Order',
      accessorKey: 'doOrderDate',
      cell: ({ row }) => formatTime(row.original.doOrderDate, row.original.doOrderTime)
    },

    // 3. Gate In
    {
      header: 'Gate In',
      accessorKey: 'gateInDate',
      cell: ({ row }) => formatTime(row.original.gateInDate, row.original.gateInTime)
    },

    // 4. Weighbridge In
    {
      header: 'WB In',
      accessorKey: 'wbInDate',
      cell: ({ row }) => formatTime(row.original.wbInDate, row.original.wbInTime)
    },

    // 5. Weighbridge Out
    {
      header: 'WB Out',
      accessorKey: 'wbOutDate',
      cell: ({ row }) => formatTime(row.original.wbOutDate, row.original.wbOutTime)
    },

    // 6. Gate Out
    {
      header: 'Gate Out',
      accessorKey: 'gateOutDate',
      cell: ({ row }) => formatTime(row.original.gateOutDate, row.original.gateOutTime)
    },

    // 7. TAT Metrics (Processing Time & Total)
    {
      header: 'Turnaround Time',
      accessorKey: 'processingTime',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 min-w-[140px]">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Process:</span>
            <Badge variant="outline" className="h-5 px-1">{row.original.processingTime || '-'}</Badge>
          </div>
          <div className="flex justify-between text-xs mt-1 border-t pt-1">
            <span className="font-semibold text-gray-700">Total TAT:</span>
            <span className="font-bold text-blue-700">{row.original.diffGateInGateOut || '-'}</span>
          </div>
        </div>
      )
    },
    
    // 8. Weight Differences (Optional / Advanced View)
    {
      header: 'Weight Diffs',
      id: 'weightDiffs',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 text-[10px] text-muted-foreground min-w-[150px]">
           <div className="flex justify-between">
             <span>GateIn-Tare:</span>
             <span>{row.original.diffGateInTareWt || '-'}</span>
           </div>
           <div className="flex justify-between">
             <span>Tare-Gross:</span>
             <span>{row.original.diffTareWtGrossWt || '-'}</span>
           </div>
           <div className="flex justify-between">
             <span>Gross-GateOut:</span>
             <span>{row.original.diffGrossWtGateOut || '-'}</span>
           </div>
        </div>
      )
    }
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-500">
        <p>Error: {error}</p>
        <Button variant="link" onClick={fetchRecords}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      
      {/* --- Filter Bar --- */}
      <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-wrap gap-4 items-end">
        
        {/* Search */}
        <div className="flex flex-col space-y-1 w-full sm:w-[250px]">
          <label className="text-xs font-semibold text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="ID, Zone, District..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* Date Range */}
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">From Date</label>
          <Input 
            type="date" 
            className="h-9 w-[140px]" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">To Date</label>
          <Input 
            type="date" 
            className="h-9 w-[140px]" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Zone Filter */}
        <div className="flex flex-col space-y-1 w-[150px]">
          <label className="text-xs font-semibold text-muted-foreground">Zone</label>
          <Select value={filterZone} onValueChange={setFilterZone}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {availableZones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* District Filter */}
        <div className="flex flex-col space-y-1 w-[150px]">
          <label className="text-xs font-semibold text-muted-foreground">District</label>
          <Select value={filterDistrict} onValueChange={setFilterDistrict}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Districts</SelectItem>
              {availableDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Refresh / Apply Button */}
        <Button onClick={fetchRecords} size="sm" className="h-9 mb-px">
          Apply Filters
        </Button>

      </div>

      {/* --- Data Table --- */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Loading logistics data...
        </div>
      ) : filteredRecords.length === 0 ? (
         <div className="h-64 flex flex-col items-center justify-center text-muted-foreground rounded-lg border border-dashed">
          <p>No records found matching your filters.</p>
        </div>
      ) : (
        <div className="rounded-md border bg-card">
          <DataTableReusable 
            columns={columns} 
            data={filteredRecords}
            enableRowDragging={false}
            onRowOrderChange={() => {}}
          />
        </div>
      )}
    </div>
  );
}