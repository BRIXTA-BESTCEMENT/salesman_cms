// src/app/dashboard/dashboardGraphs.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DataTableReusable } from '@/components/data-table-reusable';
import { ChartAreaInteractive } from '@/components/chart-area-reusable';

import {
  RawGeoTrackingRecord,
  RawDailyVisitReportRecord,
  rawGeoTrackingSchema,
  rawDailyVisitReportSchema,
  RawSalesOrderReportRecord,
  rawSalesOrderSchema,
} from './data-format';

// Sales roles
const SALES_ROLES = ['junior-executive', 'executive', 'senior-executive'] as const;
type SalesRole = (typeof SALES_ROLES)[number] | 'all';

type SlimUser = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  salesmanLoginId: string | null;
};

type UsersApiResponse = {
  users: SlimUser[];
  currentUser: { role: string; companyName?: string | null; region?: string | null; area?: string | null };
};

// --- Table Columns ---
const geoTrackingColumns: ColumnDef<RawGeoTrackingRecord>[] = [
  { accessorKey: 'salesmanName', header: 'Salesman' },
  {
    accessorKey: 'recordedAt',
    header: 'Last Ping',
    cell: ({ row }) => {
      const targetDate = row.original.recordedAt || row.original.createdAt;
      if (!targetDate) return 'N/A';
      return new Date(targetDate).toLocaleString('en-IN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      })
    },
  },
  {
    accessorKey: 'totalDistanceTravelled',
    header: 'Distance (km)',
    cell: ({ row }) => `${row.original.totalDistanceTravelled?.toFixed(2) ?? '0.00'} km`,
  },
  { accessorKey: 'employeeId', header: 'Employee ID', cell: info => info.getValue() || 'N/A' },
  { accessorKey: 'locationType', header: 'Location Type', cell: info => info.getValue() || 'N/A' },
];

const salesOrderColumns: ColumnDef<RawSalesOrderReportRecord>[] = [
  { accessorKey: 'salesmanName', header: 'Salesman' },
  {
    accessorKey: 'orderDate',
    header: 'Order Date',
    cell: ({ row }) => row.original.orderDate,
    meta: { filterType: 'date' },
  },
  { accessorKey: 'dealerName', header: 'Dealer' },

  {
    accessorKey: 'orderQty',
    header: 'Quantity',
    cell: ({ row }) => `${row.original.orderQty ?? 0} ${row.original.orderUnit ?? ''}`,
  },
  {
    accessorKey: 'orderTotal',
    header: 'Order Total (₹)',
    cell: ({ row }) => `₹${Number(row.original.orderTotal ?? 0).toFixed(2)}`,
  },
  {
    accessorKey: 'receivedPayment',
    header: 'Received (₹)',
    cell: ({ row }) => `₹${Number(row.original.receivedPayment ?? 0).toFixed(2)}`,
  },
  {
    accessorKey: 'pendingPayment',
    header: 'Pending (₹)',
    cell: ({ row }) => `₹${Number(row.original.pendingPayment ?? 0).toFixed(2)}`,
  },
  {
    accessorKey: 'deliveryDate',
    header: 'Delivery Date',
    cell: ({ row }) => row.original.deliveryDate ? new Date(row.original.deliveryDate).toLocaleDateString('en-IN') : '-',
    meta: { filterType: 'date' },
  },
  { accessorKey: 'paymentMode', header: 'Payment Mode' },

  {
    accessorKey: 'itemPrice',
    header: 'Item Price (₹)',
    cell: ({ row }) => row.original.itemPrice == null ? '-' : `₹${Number(row.original.itemPrice).toFixed(2)}`,
  },
  {
    accessorKey: 'discountPercentage',
    header: 'Discount (%)',
    cell: ({ row }) => row.original.discountPercentage == null ? '-' : `${Number(row.original.discountPercentage)}%`,
  },
  {
    accessorKey: 'itemPriceAfterDiscount',
    header: 'Price After Discount (₹)',
    cell: ({ row }) =>
      row.original.itemPriceAfterDiscount == null
        ? '-'
        : `₹${Number(row.original.itemPriceAfterDiscount).toFixed(2)}`,
  },
  { accessorKey: 'itemType', header: 'Item Type' },
  { accessorKey: 'itemGrade', header: 'Item Grade' },

  {
    accessorKey: 'createdAt',
    header: 'Created On',
    cell: ({ row }) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString('en-IN') : '-',
    meta: { filterType: 'date' },
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated On',
    cell: ({ row }) => row.original.updatedAt ? new Date(row.original.updatedAt).toLocaleDateString('en-IN') : '-',
    meta: { filterType: 'date' },
  },
];

// --- Graph Data Types ---
type GeoTrackingData = { name: string; distance: number };
type DailyCollectionData = { name: string; collection: number };
type SalesQuantityData = { name: string; quantity: number };

export default function DashboardGraphs() {
  const [rawGeoTrackingRecords, setRawGeoTrackingRecords] = useState<RawGeoTrackingRecord[]>([]);
  const [rawDailyReports, setRawDailyReports] = useState<RawDailyVisitReportRecord[]>([]);
  const [rawSalesOrders, setRawSalesOrders] = useState<RawSalesOrderReportRecord[]>([]);
  const [users, setUsers] = useState<SlimUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRole, setSelectedRole] = useState<SalesRole>('all');
  const [selectedSalesman, setSelectedSalesman] = useState<string | 'all'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Added pageSize=1000 so the graphs have a larger historical dataset to plot
      const [geoRes, dailyRes, salesRes, usersRes] = await Promise.all([
        fetch(`/api/dashboardPagesAPI/slm-geotracking?pageSize=1000`, { cache: 'no-store' }),
        fetch(`/api/dashboardPagesAPI/reports/daily-visit-reports?pageSize=1000`, { cache: 'no-store' }),
        fetch(`/api/dashboardPagesAPI/reports/sales-orders?pageSize=1000`, { cache: 'no-store' }),
        fetch(`/api/dashboardPagesAPI/users-and-team/users`, { cache: 'no-store' }),
      ]);

      if (!geoRes.ok) throw new Error(`Geo API: ${geoRes.status}`);
      if (!dailyRes.ok) throw new Error(`DVR API: ${dailyRes.status}`);
      if (!salesRes.ok) throw new Error(`Sales API: ${salesRes.status}`);
      if (!usersRes.ok) throw new Error(`Users API: ${usersRes.status}`);

      const [geoData, dailyData, salesData, usersData] = await Promise.all([
        geoRes.json(),
        dailyRes.json(),
        salesRes.json(),
        usersRes.json(),
      ]);

      // Helper to extract data from the new paginated { data, totalCount } API structures
      const extractData = (res: any) => Array.isArray(res) ? res : (res.data || []);

      // Enforce `id` mappings so DataTableReusable doesn't throw a TypeScript error
      const validatedGeo = rawGeoTrackingSchema.array().parse(extractData(geoData)).map(d => ({
        ...d,
        id: d.id?.toString() || d.opId?.toString() || `${Math.random()}`
      })) as RawGeoTrackingRecord[];

      const validatedDaily = rawDailyVisitReportSchema.array().parse(extractData(dailyData)).map(d => ({
        ...d,
        id: d.id?.toString() || `${Math.random()}`
      })) as RawDailyVisitReportRecord[];

      const validatedSales = rawSalesOrderSchema.array().parse(extractData(salesData)).map(d => ({
        ...d,
        id: d.id?.toString() || `${Math.random()}`
      })) as RawSalesOrderReportRecord[];

      setRawGeoTrackingRecords(validatedGeo);
      setRawDailyReports(validatedDaily);
      setRawSalesOrders(validatedSales);
      setUsers((usersData as UsersApiResponse).users ?? []);

      toast.success('Dashboard data loaded');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('Dashboard load error:', e);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const salesmenList = useMemo(() => {
    const pool = users.filter(u =>
      selectedRole === 'all'
        ? SALES_ROLES.includes(u.role as any)
        : u.role?.toLowerCase() === selectedRole
    );

    const unique = new Map<string, { id: string; name: string }>();
    pool.forEach(u => {
      const name =
        `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() ||
        u.email ||
        u.salesmanLoginId ||
        `User-${u.id}`;
      unique.set(name, { id: name, name });
    });

    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, selectedRole]);

  useEffect(() => {
    if (selectedSalesman !== 'all' && !salesmenList.some(s => s.id === selectedSalesman)) {
      setSelectedSalesman('all');
    }
  }, [salesmenList, selectedSalesman]);

  // Filter & aggregate
  const roleFilteredDailyReports = useMemo(() => {
    if (selectedRole === 'all') return rawDailyReports;
    return rawDailyReports.filter(r => r.role?.toLowerCase() === selectedRole);
  }, [rawDailyReports, selectedRole]);

  const geoGraphData: GeoTrackingData[] = useMemo(() => {
    let filtered = rawGeoTrackingRecords;
    if (selectedSalesman !== 'all') filtered = filtered.filter(r => r.salesmanName === selectedSalesman);
    
    const agg: Record<string, number> = {};
    filtered.forEach(item => {
      // Aggregate total distance per day (Fallback to createdAt if recordedAt is null)
      const dateStr = item.recordedAt || item.createdAt;
      if (!dateStr) return;
      
      const key = new Date(dateStr).toISOString().slice(0, 10);
      agg[key] = (agg[key] || 0) + (item.totalDistanceTravelled ?? 0);
    });
    return Object.keys(agg).sort().map(k => ({ name: k, distance: agg[k] }));
  }, [rawGeoTrackingRecords, selectedSalesman]);

  const collectionGraphData: DailyCollectionData[] = useMemo(() => {
    let filtered = roleFilteredDailyReports;
    if (selectedSalesman !== 'all') filtered = filtered.filter(r => r.salesmanName === selectedSalesman);
    const agg: Record<string, number> = {};
    filtered.forEach(item => {
      const key = item.reportDate;
      agg[key] = (agg[key] || 0) + (item.todayCollectionRupees ?? 0);
    });
    return Object.keys(agg).sort().map(k => ({ name: k, collection: agg[k] }));
  }, [roleFilteredDailyReports, selectedSalesman]);

  const salesQuantityGraphData: SalesQuantityData[] = useMemo(() => {
    let filtered = rawSalesOrders;
    if (selectedSalesman !== 'all') filtered = filtered.filter(r => r.salesmanName === selectedSalesman);
    const agg: Record<string, number> = {};
    filtered.forEach(item => {
      const key = item.orderDate; 
      const qty = item.orderQty ?? 0;
      agg[key] = (agg[key] || 0) + (isNaN(qty) ? 0 : qty);
    });
    return Object.keys(agg).sort().map(k => ({ name: k, quantity: agg[k] }));
  }, [rawSalesOrders, selectedSalesman]);

  if (loading) return <div className="flex justify-center items-center min-h-[400px]">Loading dashboard data...</div>;
  if (error)
    return (
      <div className="text-center text-red-500 py-8">
        Error: {error}
        <Button onClick={fetchData} className="ml-4">
          Retry
        </Button>
      </div>
    );

  return (
    <Tabs defaultValue="graphs" className="space-y-4">
      <TabsList>
        <TabsTrigger value="graphs">Graphs</TabsTrigger>
        <TabsTrigger value="geo-table">Geo-Tracking Table</TabsTrigger>
        <TabsTrigger value="sales-orders-table">Sales Orders Table</TabsTrigger>
      </TabsList>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap gap-3 items-center justify-between">
            <span>Filters</span>
            <div className="flex flex-wrap gap-3">
              <Select value={selectedRole} onValueChange={v => setSelectedRole(v as SalesRole)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="junior-executive">Junior Executive</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="senior-executive">Senior Executive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedSalesman} onValueChange={setSelectedSalesman}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Select Salesman" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Salesmen</SelectItem>
                  {salesmenList.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Graphs */}
      <TabsContent value="graphs" className="space-y-4">
        {/* Geo-Tracking */}
        <Card>
          <CardHeader>
            <CardTitle>Geo-Tracking Activity</CardTitle>
            <CardDescription>Total distance travelled per day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartAreaInteractive data={geoGraphData} dataKey="distance" title="Distance Travelled (km)" />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Daily Collection */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Collection Reports</CardTitle>
          <CardDescription>Total collection (₹) per day.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartAreaInteractive data={collectionGraphData} dataKey="collection" title="Daily Collection (₹)" />
        </CardContent>
      </Card>

      {/* Sales Quantity */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Order Quantity</CardTitle>
          <CardDescription>Total quantity ordered per day.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartAreaInteractive data={salesQuantityGraphData} dataKey="quantity" title="Sales Order Quantity" />
        </CardContent>
      </Card>

      {/* Tables */}
      <TabsContent value="geo-table">
        <Card>
          <CardHeader>
            <CardTitle>Sales Team Geo-Tracking Table</CardTitle>
            <CardDescription>Most recent geo-tracking data.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTableReusable columns={geoTrackingColumns} data={rawGeoTrackingRecords} enableRowDragging={false} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sales-orders-table">
        <Card>
          <CardHeader>
            <CardTitle>Sales Orders Table</CardTitle>
            <CardDescription>All sales orders submitted by the team.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTableReusable columns={salesOrderColumns} data={rawSalesOrders} enableRowDragging={false} />
          </CardContent>
        </Card>
      </TabsContent>
      
    </Tabs>
  );
}