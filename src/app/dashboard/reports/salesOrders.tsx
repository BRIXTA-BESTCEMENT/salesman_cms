// app/dashboard/reports/salesOrders.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';

import { selectSalesOrderSchema } from '../../../../drizzle/zodSchemas';

const extendedSalesOrderSchema = selectSalesOrderSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  dealerName: z.string().nullable().optional(),
  dealerType: z.string().nullable().optional(),
  dealerPhone: z.string().nullable().optional(),
  dealerAddress: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  paymentAmount: z.coerce.number().nullable().optional().catch(null),
  receivedPayment: z.coerce.number().nullable().optional().catch(null),
  pendingPayment: z.coerce.number().nullable().optional().catch(null),
  orderQty: z.coerce.number().nullable().optional().catch(null),
  itemPrice: z.coerce.number().nullable().optional().catch(null),
  discountPercentage: z.coerce.number().nullable().optional().catch(null),
  itemPriceAfterDiscount: z.coerce.number().nullable().optional().catch(null),
  orderTotal: z.coerce.number().optional().catch(0),
  estimatedDelivery: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
});

type SalesOrder = z.infer<typeof extendedSalesOrderSchema>;

const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}

const columnHelper = createColumnHelper<SalesOrder>();

const num = (v: number | null | undefined) =>
  new Intl.NumberFormat('en-IN').format(v ?? 0);

const dateStr = (v: string | null | undefined) => v || '-';

export const salesOrderColumns: ColumnDef<SalesOrder, any>[] = [
  columnHelper.accessor('id', {
    header: 'Order ID',
    cell: info => info.getValue(),
    meta: { filterType: 'search' },
  }),
  columnHelper.accessor('salesmanName', {
    header: 'Salesman',
    cell: info => info.getValue(),
    meta: { filterType: 'search' },
  }),
  columnHelper.accessor('orderDate', {
    header: 'Order Date',
    cell: info => dateStr(info.getValue()),
    meta: { filterType: 'date' },
  }),
  columnHelper.accessor('orderPartyName', {
    header: 'Order Party',
    cell: info => info.getValue(),
    meta: { filterType: 'search' },
  }),
  columnHelper.accessor('partyPhoneNo', {
    header: 'Party Phone',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('partyArea', {
    header: 'Party Area',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('partyRegion', {
    header: 'Party Region',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('partyAddress', {
    header: 'Party Address',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('deliveryDate', {
    header: 'Delivery Date',
    cell: info => dateStr(info.getValue()),
    meta: { filterType: 'date' },
  }),
  columnHelper.accessor('estimatedDelivery', {
    header: 'Delivery ETA',
    cell: info => dateStr(info.getValue() || info.row.original.deliveryDate),
    meta: { filterType: 'date' },
  }),
  columnHelper.accessor('deliveryArea', {
    header: 'Delivery Area',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('deliveryRegion', {
    header: 'Delivery Region',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('deliveryAddress', {
    header: 'Delivery Address',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('deliveryLocPincode', {
    header: 'Delivery PIN',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('paymentMode', {
    header: 'Payment Mode',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('paymentTerms', {
    header: 'Payment Terms',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('paymentAmount', {
    header: 'Payment Amount (₹)',
    cell: info => num(info.getValue()),
  }),
  columnHelper.accessor('receivedPayment', {
    header: 'Received (₹)',
    cell: info => num(info.getValue()),
  }),
  columnHelper.accessor('receivedPaymentDate', {
    header: 'Received On',
    cell: info => dateStr(info.getValue()),
    meta: { filterType: 'date' },
  }),
  columnHelper.accessor('pendingPayment', {
    header: 'Pending (₹)',
    cell: info => num(info.getValue()),
  }),
  columnHelper.accessor('orderQty', {
    header: 'Quantity',
    cell: info => {
      const qty = info.getValue();
      const unit = info.row.original.orderUnit || '';
      return qty != null ? `${qty} ${unit}` : '-';
    },
  }),
  columnHelper.accessor('orderUnit', {
    header: 'Unit',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('itemPrice', {
    header: 'Item Price (₹)',
    cell: info => num(info.getValue()),
  }),
];

export default function SalesOrdersTable() {
  const router = useRouter();
  const [data, setData] = useState<SalesOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);

  // --- Backend Filter Options ---
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, areaFilters, zoneFilters, dateRange]);

  const fetchSalesOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/dashboardPagesAPI/reports/sales-orders`, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);

      // Join arrays for multi-select
      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
      if (zoneFilters.length > 0) url.searchParams.append('region', zoneFilters.join(','));

      // Add Date Params
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

      const result = await response.json();
      const orders: any[] = result.data || [];

      setTotalCount(result.totalCount || 0);

      const validatedOrders = z.array(extendedSalesOrderSchema).parse(orders).map(order => ({
        ...order,
        id: order.id?.toString() || `${Math.random()}`,
      })) as SalesOrder[];

      setData(validatedOrders);
      toast.success("Sales orders loaded successfully!");
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error((error as Error).message);
      setError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [router, page, pageSize, debouncedSearchQuery, areaFilters, zoneFilters, dateRange]);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
    try {
      const url = new URL(LOCATION_API_ENDPOINT, window.location.origin);
      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data: LocationsResponse = await response.json();
      const safeAreas = Array.isArray(data.areas) ? data.areas.filter(Boolean) : [];
      const safeRegions = Array.isArray(data.regions) ? data.regions.filter(Boolean) : [];

      setAvailableAreas(safeAreas);
      setAvailableRegions(safeRegions);
    } catch (err: any) {
      console.error('Failed to fetch filter locations:', err);
      setLocationError('Failed to load Area/Region filters.');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesOrders();
  }, [fetchSalesOrders]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const zoneOptions = useMemo(() => availableRegions.sort().map(r => ({ label: r, value: r })), [availableRegions]);
  const areaOptions = useMemo(() => availableAreas.sort().map(a => ({ label: a, value: a })), [availableAreas]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">

        <div className="flex items-center justify-between space-y-2">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight">Sales Orders</h2>
            <Badge variant="outline" className="text-base px-4 py-1">
              Total Reports: {totalCount}
            </Badge>
          </div>
          <RefreshDataButton
            cachePrefix="sales-orders"
            onRefresh={fetchSalesOrders}
          />
        </div>

        {/* --- Unified Global Filter Bar --- */}
        <div className="w-full">
          <GlobalFilterBar
            showSearch={true}
            showRole={false}
            showZone={true}
            showArea={true}
            showDateRange={true}
            showStatus={false}

            searchVal={searchQuery}
            dateRangeVal={dateRange}
            zoneVals={zoneFilters}
            areaVals={areaFilters}

            zoneOptions={zoneOptions}
            areaOptions={areaOptions}

            onSearchChange={setSearchQuery}
            onDateRangeChange={setDateRange}
            onZoneChange={setZoneFilters}
            onAreaChange={setAreaFilters}
          />
        </div>

        {locationError && <p className="text-xs text-red-500 w-full mt-2 italic">Location Filter Error: {locationError}</p>}

        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
              <p className="text-muted-foreground">Loading sales orders...</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">
              Error loading sales orders: {error}
              <Button onClick={fetchSalesOrders} className="ml-4">Retry</Button>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No sales orders found matching the selected filters.
            </div>
          ) : (
            <DataTableReusable
              columns={salesOrderColumns}
              data={data}
              enableRowDragging={false}
              onRowOrderChange={() => { }}
            />
          )}
        </div>
      </div>
    </div>
  );
};