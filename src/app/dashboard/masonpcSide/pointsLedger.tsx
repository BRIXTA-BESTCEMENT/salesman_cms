// src/app/dashboard/masonpcSide/pointsLedger.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';

// Import the reusable DataTable
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
// UI Components for Filtering
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const renderSelectFilter = (
  label: string,
  value: string,
  onValueChange: (v: string) => void,
  options: string[],
) => (
  <div className="flex flex-col space-y-1 w-full sm:w-[150px] min-w-[120px]">
    <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 bg-background border-input">
        <SelectValue placeholder={`Select ${label}`} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        {options.map(option => (
          <SelectItem key={option} value={option}>
            {option.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} 
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

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

  const [searchQuery, setSearchQuery] = useState(''); 
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all'); 

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('You are not authenticated. Redirecting to login.');
          window.location.href = '/login';
          return;
        }
        if (response.status === 403) {
          toast.error('You do not have permission to access this page. Redirecting.');
          window.location.href = '/dashboard';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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

  const handleLedgerOrderChange = (newOrder: PointsLedgerRecord[]) => {
    console.log("New Ledger order:", newOrder.map(r => r.id));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
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

        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border shadow-sm">
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Mason Name / Memo</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 bg-background border-input"
              />
            </div>
          </div>

          {renderSelectFilter('Source Type', sourceTypeFilter, setSourceTypeFilter, SOURCE_TYPE_OPTIONS)}

          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setSourceTypeFilter('all');
            }}
            className="mb-0.5 text-muted-foreground hover:text-destructive"
          >
            Clear Filters
          </Button>
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
              onRowOrderChange={handleLedgerOrderChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}