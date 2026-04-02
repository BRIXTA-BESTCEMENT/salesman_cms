// src/app/dashboard/masonpcSide/rewardsRedemption.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Loader2, IndianRupee, Package, CheckCircle, XCircle, Truck, Check, Eye } from 'lucide-react';

// Import standard components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// API Endpoints
const REDEMPTION_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/rewards-redemption`;
const REDEMPTION_ACTION_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/rewards-redemption`;

// Type for data coming from the API
type RedemptionRecord = {
  id: string;
  masonId: string;
  masonName: string;
  rewardId: number;
  rewardName: string;
  quantity: number;
  status: string;
  pointsDebited: number;
  deliveryName: string | null;
  deliveryPhone: string | null;
  deliveryAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

// Options
const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED', 'SHIPPED', 'DELIVERED'];

const formatDate = (dateString: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateString));
  } catch { return 'N/A'; }
};

const getStatusBadgeProps = (status: string) => {
  switch (status.toUpperCase()) {
    case 'APPROVED': return { icon: CheckCircle, className: 'bg-green-100 text-green-700 border-green-200' };
    case 'REJECTED': return { icon: XCircle, className: 'bg-red-100 text-red-700 border-red-200' };
    case 'SHIPPED': return { icon: Truck, className: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
    case 'DELIVERED': return { icon: Package, className: 'bg-teal-100 text-teal-700 border-teal-200' };
    default: return { icon: Loader2, className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  }
};

export default function RewardsRedemptionPage() {
  const [redemptionRecords, setRedemptionRecords] = useState<RedemptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState('all');

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);

  // Action States
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RedemptionRecord | null>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected' | 'shipped' | 'delivered' | null>(null);
  const [fulfillmentNote, setFulfillmentNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Inside RewardsRedemptionPage component

  // 1. Update the useEffect for resetting page
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, statusFilter, dateRange]);

  // 2. Update the fetchRedemptionRecords dependencies
  const fetchRedemptionRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(REDEMPTION_API_ENDPOINT, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      // CRITICAL: Ensure we use the debounced query here
      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (statusFilter !== 'all') url.searchParams.append('status', statusFilter);

      if (dateRange?.from) url.searchParams.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange?.to) {
        url.searchParams.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));
      } else if (dateRange?.from) {
        url.searchParams.append('endDate', format(dateRange.from, 'yyyy-MM-dd'));
      }

      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const data = await response.json();
      // Since the API now returns the filtered list directly:
      setRedemptionRecords(Array.isArray(data) ? data : data.data);

      toast.success("Log updated");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
    // Add debouncedSearchQuery to the dependency array
  }, [page, pageSize, debouncedSearchQuery, statusFilter, dateRange]);

  useEffect(() => {
    fetchRedemptionRecords();
  }, [fetchRedemptionRecords]);

  // --- Mapped Options ---
  const statusOptions = useMemo(() => [
    { label: 'All Statuses', value: 'all' },
    ...STATUS_OPTIONS.map(opt => ({
      label: opt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: opt
    }))
  ], []);

  // --- Handlers ---
  const handleActionClick = (record: RedemptionRecord, type: 'approved' | 'rejected' | 'shipped' | 'delivered') => {
    setSelectedRecord(record);
    setActionType(type);
    setFulfillmentNote('');
    setIsActionModalOpen(true);
  };

  const handleViewClick = (record: RedemptionRecord) => {
    setSelectedRecord(record);
    setIsViewModalOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedRecord || !actionType) return;
    setIsProcessing(true);
    const toastId = toast.loading("Processing...");

    try {
      const res = await fetch(`${REDEMPTION_ACTION_API_ENDPOINT}/${selectedRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: actionType,
          fulfillmentNotes: fulfillmentNote
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Update failed");
      }

      toast.success(`Order ${actionType} successfully!`, { id: toastId });
      setIsActionModalOpen(false);
      fetchRedemptionRecords();
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Columns ---
  const redemptionColumns: ColumnDef<RedemptionRecord>[] = [
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => <span className="text-xs">{formatDate(row.original.createdAt)}</span>,
    },
    { accessorKey: "masonName", header: "Mason" },
    { accessorKey: "rewardName", header: "Item" },
    { accessorKey: "quantity", header: "Qty" },
    {
      accessorKey: "pointsDebited",
      header: "Cost",
      cell: ({ row }) => (
        <div className='flex items-center text-red-600 font-medium text-xs'>
          -{row.original.pointsDebited} <IndianRupee className='w-3 h-3 ml-0.5' />
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const { icon: Icon, className } = getStatusBadgeProps(status);
        return (
          <Badge className={`capitalize font-medium ${className}`}>
            <Icon className="w-3 h-3 mr-1" />
            {status.toLowerCase()}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const r = row.original;
        const status = r.status.toLowerCase();

        return (
          <div className="flex gap-2 items-center">
            {/* View Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => handleViewClick(r)}
            >
              <Eye className="w-3 h-3 mr-1" /> View
            </Button>

            {/* PLACED -> APPROVE / REJECT */}
            {(status === 'placed' || status === 'pending') && (
              <>
                <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700" onClick={() => handleActionClick(r, 'approved')}>
                  Approve
                </Button>
                <Button size="sm" variant="destructive" className="h-7" onClick={() => handleActionClick(r, 'rejected')}>
                  Reject
                </Button>
              </>
            )}

            {/* APPROVED -> SHIP / REJECT */}
            {status === 'approved' && (
              <>
                <Button size="sm" className="h-7 bg-indigo-600 hover:bg-indigo-700" onClick={() => handleActionClick(r, 'shipped')}>
                  <Truck className="w-3 h-3 mr-1" /> Ship
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleActionClick(r, 'rejected')}>
                  Reject
                </Button>
              </>
            )}

            {/* SHIPPED -> DELIVER */}
            {status === 'shipped' && (
              <Button size="sm" className="h-7 bg-teal-600 hover:bg-teal-700" onClick={() => handleActionClick(r, 'delivered')}>
                <Check className="w-3 h-3 mr-1" /> Mark Delivered
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Rewards Redemption Log</h2>
          <RefreshDataButton
            cachePrefix="rewards-redemption"
            onRefresh={fetchRedemptionRecords}
          />
        </div>

        {/* --- Unified Global Filter Bar --- */}
        <div className="w-full">
          <GlobalFilterBar
            showSearch={true}
            showDateRange={true}
            showRole={false}
            showZone={false} // Hidden as no territory data exists here
            showArea={false}
            showStatus={true}

            searchVal={searchQuery}
            dateRangeVal={dateRange}
            statusVal={statusFilter}

            statusOptions={statusOptions}

            onSearchChange={setSearchQuery}
            onDateRangeChange={setDateRange}
            onStatusChange={setStatusFilter}
          />
        </div>

        <div className="bg-card p-1 rounded-lg border border-border">
          {isLoading ? (
            <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
          ) : (
            <DataTableReusable columns={redemptionColumns} data={redemptionRecords} enableRowDragging={false} />
          )}
        </div>
      </div>

      {/* --- Action Modal (Approve/Reject) --- */}
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionType} Order</DialogTitle>
            <DialogDescription>
              {actionType === 'approved' && "This will deduct stock from inventory."}
              {actionType === 'rejected' && "This will REFUND points to the Mason and return stock (if previously deducted)."}
              {actionType === 'shipped' && "Mark item as dispatched."}
              {actionType === 'delivered' && "Mark transaction as complete."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Admin Notes (Optional)</Label>
              <Textarea
                placeholder="Add courier details or rejection reason..."
                value={fulfillmentNote}
                onChange={(e) => setFulfillmentNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionModalOpen(false)}>Cancel</Button>
            <Button
              variant={actionType === 'rejected' ? "destructive" : "default"}
              onClick={confirmAction}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Confirm {actionType}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- View Details Modal --- */}
      {selectedRecord && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Redemption Details</DialogTitle>
              <DialogDescription>Transaction ID: {selectedRecord.id}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">

              {/* Reward Info Section */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Reward Information</h3>
                <div className="bg-muted/30 p-3 rounded-md border border-border space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Item:</span>
                    <span className="text-sm">{selectedRecord.rewardName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Quantity:</span>
                    <span className="text-sm">{selectedRecord.quantity}</span>
                  </div>
                  <div className="flex justify-between text-red-600 font-semibold">
                    <span className="text-sm">Total Cost:</span>
                    <div className="flex items-center text-sm">
                      -{selectedRecord.pointsDebited} <IndianRupee className="w-3 h-3 ml-1" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mason Info Section */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Mason Information</h3>
                <div className="bg-muted/30 p-3 rounded-md border border-border space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Name:</span>
                    <span className="text-sm">{selectedRecord.masonName}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Info Section */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Delivery Details</h3>
                <div className="bg-muted/30 p-3 rounded-md border border-border space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Recipient:</span>
                    <span className="text-sm">{selectedRecord.deliveryName || 'Same as Mason'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Phone:</span>
                    <span className="text-sm">{selectedRecord.deliveryPhone || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col mt-1">
                    <span className="text-sm font-medium mb-1">Address:</span>
                    <p className="text-sm text-muted-foreground bg-background p-2 rounded border">
                      {selectedRecord.deliveryAddress || 'No address provided'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">Current Status:</span>
                <Badge className={`capitalize ${getStatusBadgeProps(selectedRecord.status).className}`}>
                  {selectedRecord.status.toLowerCase()}
                </Badge>
              </div>

            </div>

            <DialogFooter>
              <Button onClick={() => setIsViewModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}