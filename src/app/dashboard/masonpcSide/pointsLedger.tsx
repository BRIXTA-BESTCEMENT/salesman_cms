// src/app/dashboard/masonpcSide/pointsLedger.tsx
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Import standard components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar'; 
import { useDebounce } from '@/hooks/use-debounce-search';

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const POINTS_LEDGER_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/points-ledger`;

type PointsLedgerRecord = {
  id: string;
  masonId: string;
  masonName: string;
  sourceType: string;
  sourceId: string | null;
  points: number;
  memo: string | null;
  createdAt: string; 
};

const SOURCE_TYPE_OPTIONS = ['BAG_LIFT', 'MEETING', 'SCHEME', 'BONUS', 'REDEMPTION', 'ADJUSTMENT'];

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(dateString));
  } catch {
    return 'Invalid Date';
  }
};

const getPointsBadgeColor = (points: number) => {
  if (points > 0) {
    return 'bg-green-100 text-green-700 hover:bg-green-200'; // Credit
  } else if (points < 0) {
    return 'bg-red-100 text-red-700 hover:bg-red-200'; // Debit/Redemption
  } else {
    return 'bg-gray-100 text-gray-700 hover:bg-gray-200'; // Zero
  }
};

export default function PointsLedgerPage() {
  const [ledgerRecords, setLedgerRecords] = useState<PointsLedgerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState(''); 
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all'); 

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, sourceTypeFilter]);

  const fetchPointsLedgerRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(POINTS_LEDGER_API_ENDPOINT, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (sourceTypeFilter !== 'all') url.searchParams.append('sourceType', sourceTypeFilter);

      const response = await fetch(url.toString());
      const result = await response.json();
      setLedgerRecords(result.data || []);
      setTotalCount(result.totalCount || 0);
      
      toast.success("Points Ledger records loaded successfully!");
    } catch (error: any) {
      console.error("Failed to fetch Points Ledger records:", error);
      toast.error(`Failed to fetch Points Ledger records: ${error.message}`);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearchQuery, sourceTypeFilter]);

  useEffect(() => {
    fetchPointsLedgerRecords();
  }, [fetchPointsLedgerRecords]);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const sourceTypeOptions = useMemo(() => [
    { label: 'All Source Types', value: 'all' },
    ...SOURCE_TYPE_OPTIONS.map(opt => ({ 
      label: opt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), 
      value: opt 
    }))
  ], []);

  const ledgerColumns: ColumnDef<PointsLedgerRecord>[] = [
    {
      accessorKey: "createdAt",
      header: "Date/Time",
      cell: ({ row }) => <span className="text-sm font-medium text-foreground">{formatDate(row.original.createdAt)}</span>,
      enableSorting: true,
      sortingFn: 'datetime',
    },
    {
      accessorKey: "masonName",
      header: "Mason Name",
      enableSorting: true,
    },
    {
      accessorKey: "sourceType",
      header: "Source Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize bg-blue-50 text-blue-700 border-blue-200">
          {row.original.sourceType.replace(/_/g, ' ').toLowerCase()}
        </Badge>
      )
    },
    {
      accessorKey: "points",
      header: "Points Change",
      cell: ({ row }) => {
        const points = row.original.points;
        const colorClass = getPointsBadgeColor(points);
        const sign = points > 0 ? '+' : '';
        return (
          <Badge className={`font-semibold text-sm ${colorClass} shadow-none`}>
            {sign}{points}
          </Badge>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "memo",
      header: "Memo",
      cell: ({ row }) => (
        <p className="max-w-[250px] truncate text-xs text-foreground" title={row.original.memo ?? 'N/A'}>
          {row.original.memo ?? 'N/A'}
        </p>
      )
    },
    {
      accessorKey: "sourceId",
      header: "Source ID",
      cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground">{row.original.sourceId ? `${row.original.sourceId}` : 'N/A'}</span>
    },
    {
      accessorKey: "id",
      header: "Transaction ID",
      cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground">{row.original.id}</span>
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">
        
        <div className="flex items-center justify-between space-y-2">
          <div className="flex items-center gap-4">
              <h2 className="text-3xl font-bold tracking-tight">Points Ledger</h2>
              <Badge variant="outline" className="text-base px-4 py-1">
                 Total Records: {totalCount}
              </Badge>
          </div>
          <RefreshDataButton
            cachePrefix="points-ledger"
            onRefresh={fetchPointsLedgerRecords}
          />
        </div>

        {/* --- Unified Global Filter Bar --- */}
        <div className="w-full">
          <GlobalFilterBar 
            showSearch={true}
            showDateRange={false}
            showRole={false}
            showZone={false} // Disabled since ledger doesn't have territory data
            showArea={false}
            showStatus={true} // Using Status slot for Source Type

            searchVal={searchQuery}
            statusVal={sourceTypeFilter}

            statusOptions={sourceTypeOptions}

            onSearchChange={setSearchQuery}
            onStatusChange={setSourceTypeFilter}
          />
        </div>

        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {isLoading && ledgerRecords.length === 0 ? (
             <div className="flex justify-center items-center h-64">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
               <span className="ml-2 text-muted-foreground">Loading Points Ledger records...</span>
             </div>
          ) : error ? (
            <div className="text-center text-red-500 h-64 flex flex-col items-center justify-center">
              <p>Error: {error}</p>
              <Button onClick={fetchPointsLedgerRecords} className="mt-4">Retry</Button>
            </div>
          ) : ledgerRecords.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No Points Ledger records found matching the selected filters.</div>
          ) : (
            <DataTableReusable
              columns={ledgerColumns}
              data={ledgerRecords}
              enableRowDragging={false}
              onRowOrderChange={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}