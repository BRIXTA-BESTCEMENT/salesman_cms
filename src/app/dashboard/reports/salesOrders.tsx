// app/dashboard/reports/salesOrders.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';
import { selectSalesOrderSchema } from '../../../../drizzle/zodSchemas';

const extendedSalesOrderSchema = selectSalesOrderSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  salesmanRole: z.string().optional().catch("N/A"),
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
const ROLES_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-roles`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}
interface RolesResponse {
  roles: string[];
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
  columnHelper.accessor('userId', {
    header: 'User ID',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('salesmanName', {
    header: 'Salesman',
    cell: info => info.getValue(),
    meta: { filterType: 'search' },
  }),
  columnHelper.accessor('salesmanRole', {
    header: 'Role',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('dealerName', {
    header: 'Dealer',
    cell: info => info.getValue(),
    meta: { filterType: 'search' },
  }),
  columnHelper.accessor('dealerType', {
    header: 'Dealer Type',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('dealerPhone', {
    header: 'Phone',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('dealerAddress', {
    header: 'Dealer Address',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('area', {
    header: 'Area',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('region', {
    header: 'Region',
    cell: info => info.getValue(),
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
  columnHelper.accessor('discountPercentage', {
    header: 'Discount (%)',
    cell: info => {
      const v = info.getValue();
      return v == null ? '-' : `${v}`;
    },
  }),
  columnHelper.accessor('itemPriceAfterDiscount', {
    header: 'Price After Discount (₹)',
    cell: info => num(info.getValue()),
  }),
  columnHelper.accessor('itemType', {
    header: 'Item Type',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('itemGrade', {
    header: 'Item Grade',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('orderTotal', {
    header: 'Order Total (₹)',
    cell: info => num(info.getValue()),
  }),
  columnHelper.accessor('remarks', {
    header: 'Remarks',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('createdAt', {
    header: 'Created On',
    cell: info => info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : '-',
    meta: { filterType: 'date' },
  }),
  columnHelper.accessor('updatedAt', {
    header: 'Updated On',
    cell: info => info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : '-',
    meta: { filterType: 'date' },
  }),
];

const renderSelectFilter = (
  label: string,
  value: string,
  onValueChange: (v: string) => void,
  options: string[],
  isLoading: boolean = false
) => (
  <div className="flex flex-col space-y-1 w-full sm:w-[150px] min-w-[120px]">
    <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger className="h-9 bg-background border-input">
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
        <SelectItem value="all">All</SelectItem>
        {options.map(option => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default function SalesOrdersTable() {
  const router = useRouter();
  const [data, setData] = useState<SalesOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, roleFilter, areaFilter, regionFilter]);

  const fetchSalesOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/dashboardPagesAPI/reports/sales-orders`, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (roleFilter !== 'all') url.searchParams.append('role', roleFilter);
      if (areaFilter !== 'all') url.searchParams.append('area', areaFilter);
      if (regionFilter !== 'all') url.searchParams.append('region', regionFilter);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('You are not authenticated. Redirecting to login.');
          router.push('/login');
          return;
        }
        if (response.status === 403) {
          toast.error('You do not have permission to access this page. Redirecting.');
          router.push('/dashboard');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

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
  }, [router, page, pageSize, debouncedSearchQuery, roleFilter, areaFilter, regionFilter]);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
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

  const fetchRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    setRoleError(null);
    try {
      const response = await fetch(ROLES_API_ENDPOINT);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const data: RolesResponse = await response.json();
      const roles = data.roles && Array.isArray(data.roles) ? data.roles : [];
      const safeRoles = roles.filter(Boolean);

      setAvailableRoles(safeRoles);
    } catch (err: any) {
      console.error('Failed to fetch filter roles:', err);
      setRoleError('Failed to load Role filters.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesOrders();
  }, [fetchSalesOrders]);

  useEffect(() => {
    fetchLocations();
    fetchRoles();
  }, [fetchLocations, fetchRoles]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
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

        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border shadow-sm mb-6">
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Salesman / Dealer</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 bg-background border-input"
              />
            </div>
          </div>

          {renderSelectFilter('Role', roleFilter, setRoleFilter, availableRoles, isLoadingRoles)}
          {renderSelectFilter('Area', areaFilter, setAreaFilter, availableAreas, isLoadingLocations)}
          {renderSelectFilter('Region', regionFilter, setRegionFilter, availableRegions, isLoadingLocations)}

          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setRoleFilter('all');
              setAreaFilter('all');
              setRegionFilter('all');
            }}
            className="mb-0.5 text-muted-foreground hover:text-destructive"
          >
            Clear Filters
          </Button>

          {locationError && <p className="text-xs text-red-500 w-full mt-2">Location Filter Error: {locationError}</p>}
          {roleError && <p className="text-xs text-red-500 w-full mt-2">Role Filter Error: {roleError}</p>}
        </div>

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