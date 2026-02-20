// src/app/dashboard/masonpcSide/pointsLedger.tsx
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
// import { BASE_URL } from '@/lib/Reusable-constants'; // Keep if needed elsewhere

const POINTS_LEDGER_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/points-ledger`;

// Type for data coming from the API (must match the flattened response structure)
type PointsLedgerRecord = {
  id: string;
  masonId: string;
  masonName: string;
  sourceType: string;
  sourceId: string | null;
  points: number;
  memo: string | null;
  createdAt: string; // ISO string
};

// Static options for the Source Type filter
const SOURCE_TYPE_OPTIONS = ['BAG_LIFT', 'MEETING', 'SCHEME', 'BONUS', 'REDEMPTION', 'ADJUSTMENT'];


// --- HELPER FUNCTIONS ---

/**
 * Helper function to render the Select filter component
 * Simplified for static options (Source Type)
 */
const renderSelectFilter = (
  label: string,
  value: string,
  onValueChange: (v: string) => void,
  options: string[],
) => (
  <div className="flex flex-col space-y-1 w-full sm:w-[150px] min-w-[120px]">
    <label className="text-sm font-medium text-muted-foreground">{label}</label>
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder={`Select ${label}`} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label}s</SelectItem>
        {options.map(option => (
          <SelectItem key={option} value={option}>
            {option.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} {/* Format for display */}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

/**
 * Formats an ISO date string to a readable date (including time).
 */
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

/**
 * Determines the color for the points badge based on positive/negative value.
 */
const getPointsBadgeColor = (points: number) => {
  if (points > 0) {
    return 'bg-green-100 text-green-700 hover:bg-green-200'; // Credit
  } else if (points < 0) {
    return 'bg-red-100 text-red-700 hover:bg-red-200'; // Debit/Redemption
  } else {
    return 'bg-gray-100 text-gray-700 hover:bg-gray-200'; // Zero
  }
};


// --- MAIN COMPONENT ---

export default function PointsLedgerPage() {
  const [ledgerRecords, setLedgerRecords] = useState<PointsLedgerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = useState(''); // Mason Name search
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all'); // Source Type filter

  // --- Data Fetching Function ---

  /**
   * Fetches the main Points Ledger data.
   */
  const fetchPointsLedgerRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(POINTS_LEDGER_API_ENDPOINT);
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
      const data: PointsLedgerRecord[] = await response.json();
      setLedgerRecords(data);
      toast.success("Points Ledger records loaded successfully!");
    } catch (error: any) {
      console.error("Failed to fetch Points Ledger records:", error);
      toast.error(`Failed to fetch Points Ledger records: ${error.message}`);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchPointsLedgerRecords();
  }, [fetchPointsLedgerRecords]);


  // --- Filtering Logic ---
  const filteredRecords = useMemo(() => {
    // ⚠️ Removed manual reset of currentPage state

    return ledgerRecords.filter((record) => {
      // 1. Mason Name Search
      const nameMatch = !searchQuery ||
        record.masonName.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Source Type Filter
      const typeMatch = sourceTypeFilter === 'all' ||
        record.sourceType.toLowerCase() === sourceTypeFilter.toLowerCase();

      return nameMatch && typeMatch;
    });
  }, [ledgerRecords, searchQuery, sourceTypeFilter]);

  // --- Define Columns for Points Ledger DataTable (unchanged) ---
  const ledgerColumns: ColumnDef<PointsLedgerRecord>[] = [
    {
      accessorKey: "createdAt",
      header: "Date/Time",
      cell: ({ row }) => <span className="text-sm font-medium text-gray-100">{formatDate(row.original.createdAt)}</span>,
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
          <Badge className={`font-semibold text-sm ${colorClass}`}>
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
        <p className="max-w-[200px] truncate text-xs text-foreground" title={row.original.memo ?? 'N/A'}>
          {row.original.memo ?? 'N/A'}
        </p>
      )
    },
    {
      accessorKey: "sourceId",
      header: "Source ID",
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.sourceId ? `${row.original.sourceId}` : 'N/A'}</span>
    },
    {
      accessorKey: "id",
      header: "Transaction ID",
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.id}</span>
    },
  ];

  const handleLedgerOrderChange = (newOrder: PointsLedgerRecord[]) => {
    console.log("New Ledger order:", newOrder.map(r => r.id));
  };

  // --- Loading / Error Gates ---
  if (isLoading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <span className="ml-2">Loading Points Ledger records...</span>
    </div>
  );

  if (error) return (
    <div className="text-center text-red-500 min-h-screen pt-10">
      Error: {error}
      <Button onClick={fetchPointsLedgerRecords} className="ml-4">Retry</Button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        {/* Header Section */}
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Points Ledger</h2>
          <RefreshDataButton
          cachePrefix="points-ledger"
          onRefresh={fetchPointsLedgerRecords}
        />
        </div>

        {/* --- Filter Components --- */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border">
          {/* 1. Mason Name Search Input */}
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-sm font-medium text-muted-foreground">Mason Name</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by mason name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* 2. Source Type Filter */}
          {renderSelectFilter(
            'Source Type',
            sourceTypeFilter,
            (v) => { setSourceTypeFilter(v); },
            SOURCE_TYPE_OPTIONS
          )}

        </div>
        {/* --- End Filter Components --- */}

        {/* Data Table Section */}
        <div className="bg-card p-6 rounded-lg border border-border">
          {filteredRecords.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No Points Ledger records found matching the selected filters.</div>
          ) : (
            <DataTableReusable
              columns={ledgerColumns}
              data={filteredRecords}
              enableRowDragging={false}
              onRowOrderChange={handleLedgerOrderChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}