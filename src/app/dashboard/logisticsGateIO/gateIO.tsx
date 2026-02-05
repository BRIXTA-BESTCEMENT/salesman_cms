// src/app/dashboard/logisticsGateIO/gateIO.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { 
  Search, 
  MapPin, 
  ArrowRightCircle,
  Clock,
  Timer
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
  const FormatDateCell = ({ date, time, label }: { date?: string | null, time?: string | null, label?: string }) => {
    if (!date) return <span className="text-slate-500">-</span>;
    
    const d = new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const t = time || '';

    return (
      <div className="flex flex-col justify-center h-full">
         {label && <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</span>}
         <div className="flex items-center gap-2">
            <span className="font-medium text-slate-200 text-sm">{d}</span>
         </div>
         <span className="text-xs text-slate-400 font-mono mt-0.5">{t}</span>
      </div>
    );
  };

  // --- Columns Definition ---
  const columns: ColumnDef<LogisticsRecord>[] = [
    // 1. Zone & District
    {
      header: 'Location / Zone',
      accessorKey: 'zone',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-40 py-2">
          <div className="flex items-center gap-2 mb-1">
            {/* Icon Box */}
            <div className="p-1.5 bg-blue-900/50 rounded-md border border-blue-800">
              <MapPin className="h-4 w-4 text-blue-400" />
            </div>
            <span className="font-semibold text-white">{row.original.zone || 'Unknown Zone'}</span>
          </div>
          <div className="pl-9 flex flex-col">
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">District</span>
            <span className="text-sm text-slate-300">{row.original.district || '-'}</span>
          </div>
        </div>
      )
    },

    // 2. Destination
    {
      header: 'Destination',
      accessorKey: 'destination',
      cell: ({ row }) => (
        <div className="min-w-[140px] flex items-center gap-2">
          <ArrowRightCircle className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-300 truncate max-w-[180px]" title={row.original.destination || ''}>
            {row.original.destination || '-'}
          </span>
        </div>
      )
    },

    // 3. DO Order
    // {
    //   header: 'DO Order',
    //   accessorKey: 'doOrderDate',
    //   cell: ({ row }) => (
    //     <div className="min-w-[130px]">
    //       <FormatDateCell 
    //         date={row.original.doOrderDate} 
    //         time={row.original.doOrderTime} 
    //       />
    //     </div>
    //   )
    // },

    // 4. Gate In
    {
      header: 'Gate In',
      accessorKey: 'gateInDate',
      cell: ({ row }) => (
        // Darker green background for contrast
        <div className="min-w-[130px] p-2 bg-emerald-950/30 rounded-md border border-emerald-900/50">
          <FormatDateCell 
            date={row.original.gateInDate} 
            time={row.original.gateInTime} 
          />
        </div>
      )
    },

    // 5. Gate Out (Status Based)
    {
      header: 'Gate Out',
      accessorKey: 'gateOutDate',
      cell: ({ row }) => {
        const isCompleted = !!row.original.gateOutDate;
        
        if (!isCompleted) {
          return (
             <div className="min-w-[130px] flex items-center">
               <Badge variant="outline" className="bg-amber-900/20 text-amber-500 border-amber-800 hover:bg-amber-900/30">
                 <Clock className="w-3 h-3 mr-1" />
                 In Yard
               </Badge>
             </div>
          );
        }

        return (
          <div className="min-w-[130px] p-2 bg-slate-800/50 rounded-md border border-slate-700">
             <FormatDateCell 
                date={row.original.gateOutDate} 
                time={row.original.gateOutTime} 
             />
          </div>
        );
      }
    },

    // 6. Turnaround Time (TAT)
    // {
    //   header: 'Turnaround Time',
    //   accessorKey: 'diffGateInGateOut', 
    //   cell: ({ row }) => {
    //     const tat = row.original.diffGateInGateOut; 
        
    //     if (!tat) return <span className="text-slate-600 text-xs min-w-[100px] block">-</span>;

    //     return (
    //       <div className="min-w-[120px] flex items-center gap-2">
    //         <Timer className="h-4 w-4 text-purple-400" />
    //         <span className="font-bold text-slate-200 font-mono text-sm">{tat}</span>
    //       </div>
    //     )
    //   }
    // },
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