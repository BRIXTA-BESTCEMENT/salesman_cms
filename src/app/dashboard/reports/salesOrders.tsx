// app/dashboard/reports/salesOrders.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';

// UI Components for Filtering
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2 } from 'lucide-react';
import { selectSalesOrderSchema } from '../../../../drizzle/zodSchemas';

// --- EXTEND THE DRIZZLE SCHEMA ---
const extendedSalesOrderSchema = selectSalesOrderSchema.extend({
  // Joined relational fields
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

// SalesOrder type is extended from the custom extended schema
type SalesOrder = z.infer<typeof extendedSalesOrderSchema>;

// --- CONSTANTS AND TYPES ---
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;
const ROLES_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-roles`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}
interface RolesResponse {
  roles: string[];
}


// Column definitions for the sales order table
const columnHelper = createColumnHelper<SalesOrder>();

const num = (v: number | null | undefined) =>
  new Intl.NumberFormat('en-IN').format(v ?? 0);

const dateStr = (v: string | null | undefined) => v || '-';

export const salesOrderColumns: ColumnDef<SalesOrder, any>[] = [
  // IDs & foreign keys
  columnHelper.accessor('id', {
    header: 'Order ID',
    cell: info => info.getValue(),
    meta: { filterType: 'search' },
  }),
  columnHelper.accessor('userId', {
    header: 'User ID',
    cell: info => info.getValue() ?? '-',
  }),

  // Denormalized display
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

  // Business fields (raw)
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

  // Party details
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

  // Delivery details
  columnHelper.accessor('deliveryDate', {
    header: 'Delivery Date',
    cell: info => dateStr(info.getValue()),
    meta: { filterType: 'date' },
  }),
  columnHelper.accessor('estimatedDelivery', {
    header: 'Delivery ETA',
    cell: info => dateStr(info.getValue() || info.row.original.deliveryDate), // fallback alias
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

  // Payment
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

  // Order qty & unit
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

  // Pricing & discounts
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

  // Product classification
  columnHelper.accessor('itemType', {
    header: 'Item Type',
    cell: info => info.getValue() ?? '-',
  }),
  columnHelper.accessor('itemGrade', {
    header: 'Item Grade',
    cell: info => info.getValue() ?? '-',
  }),

  // Computed/convenience
  columnHelper.accessor('orderTotal', {
    header: 'Order Total (₹)',
    cell: info => num(info.getValue()),
  }),
  columnHelper.accessor('remarks', {
    header: 'Remarks',
    cell: info => info.getValue() ?? '-',
  }),

  // Timestamps
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


// Component
export default function SalesOrdersTable() {
  const router = useRouter();
  const [data, setData] = useState<SalesOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = useState(''); // Salesman or Dealer Name search
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  // --- Filter Options States ---
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);


  // --- Data Fetching Functions ---

  const fetchSalesOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboardPagesAPI/reports/sales-orders`);
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
      const orders: any[] = await response.json();
      
      // Ensure data structure matches expected extended schema
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
  }, [router]);

  /**
   * Fetches unique areas and regions for the filter dropdowns.
   */
  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data: LocationsResponse = await response.json();

      const safeAreas = Array.isArray(data.areas) ? data.areas.filter(Boolean) : [];
      const safeRegions = Array.isArray(data.regions) ? data.regions.filter(Boolean) : [];

      setAvailableAreas(safeAreas);
      setAvailableRegions(safeRegions);

    } catch (err: any) {
      console.error('Failed to fetch filter locations:', err);
      setLocationError('Failed to load Area/Region filters.');
      toast.error('Failed to load location filters.');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  /**
   * Fetches unique roles for the filter dropdowns.
   */
  const fetchRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    setRoleError(null);
    try {
      const response = await fetch(ROLES_API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data: RolesResponse = await response.json();
      const roles = data.roles && Array.isArray(data.roles) ? data.roles : [];

      const safeRoles = roles.filter(Boolean);

      setAvailableRoles(safeRoles);
    } catch (err: any) {
      console.error('Failed to fetch filter roles:', err);
      setRoleError('Failed to load Role filters.');
      toast.error('Failed to load role filters.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  // Initial data loads
  useEffect(() => {
    fetchSalesOrders();
    fetchLocations();
    fetchRoles();
  }, [fetchSalesOrders, fetchLocations, fetchRoles]);

  const filteredOrders = useMemo(() => {
    const lowerCaseSearch = searchQuery.toLowerCase();

    return data.filter((order) => {
      // 1. Search Filter (Salesman Name OR Dealer Name)
      const salesmanMatch = order.salesmanName?.toLowerCase().includes(lowerCaseSearch);
      const dealerMatch = order.dealerName?.toLowerCase().includes(lowerCaseSearch);
      const searchMatch = !lowerCaseSearch || salesmanMatch || dealerMatch;

      // 2. Role Filter 
      const roleMatch = roleFilter === 'all' ||
        order.salesmanRole?.toLowerCase() === roleFilter.toLowerCase();

      // 3. Area Filter 
      const areaMatch = areaFilter === 'all' ||
        order.area?.toLowerCase() === areaFilter.toLowerCase();

      // 4. Region Filter 
      const regionMatch = regionFilter === 'all' ||
        order.region?.toLowerCase() === regionFilter.toLowerCase();

      // Combine all conditions
      return searchMatch && roleMatch && areaMatch && regionMatch;
    });
  }, [data, searchQuery, roleFilter, areaFilter, regionFilter]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <p className="text-gray-500">Loading sales orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-8">
        Error loading sales orders: {error}
        <Button onClick={fetchSalesOrders} className="ml-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Sales Orders</h2>
          <RefreshDataButton
            cachePrefix="sales-orders"
            onRefresh={fetchSalesOrders}
          />
        </div>

        {/* --- Filter Components --- */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border mb-6">
          {/* 1. Username/Dealer Search Input */}
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-sm font-medium text-muted-foreground">Salesman/Dealer Search</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* 2. Role Filter */}
          {renderSelectFilter(
            'Role',
            roleFilter,
            (v) => { setRoleFilter(v); },
            availableRoles,
            isLoadingRoles
          )}

          {/* 3. Area Filter */}
          {renderSelectFilter(
            'Area',
            areaFilter,
            (v) => { setAreaFilter(v); },
            availableAreas,
            isLoadingLocations
          )}

          {/* 4. Region Filter */}
          {renderSelectFilter(
            'Region',
            regionFilter,
            (v) => { setRegionFilter(v); },
            availableRegions,
            isLoadingLocations
          )}

          {/* Display filter option errors if any */}
          {locationError && <p className="text-xs text-red-500 w-full">Location Filter Error: {locationError}</p>}
          {roleError && <p className="text-xs text-red-500 w-full">Role Filter Error: {roleError}</p>}
        </div>
        {/* --- End Filter Components --- */}

        {/* Data Table */}
        <div className="bg-card p-6 rounded-lg border border-border">
          {filteredOrders.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No sales orders found matching the selected filters.
            </div>
          ) : (
            <DataTableReusable
              columns={salesOrderColumns}
              data={filteredOrders}
              enableRowDragging={false}
              onRowOrderChange={() => { }}
            />
          )}
        </div>
      </div>
    </div>
  );
};