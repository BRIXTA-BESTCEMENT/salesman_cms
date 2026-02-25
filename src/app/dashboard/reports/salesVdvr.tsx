// app/dashboard/reports/salesVdvr.tsx
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { IconFilter, IconRefresh, IconSearch, IconListDetails, IconTrendingUp, IconCurrencyRupee } from '@tabler/icons-react';
import { Calendar, Gauge, BarChart } from 'lucide-react'; 

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

import { DataTableReusable } from '@/components/data-table-reusable';
import { MultiSelect } from '@/components/multi-select';

import {
  useDvrPjpData,
  filterByDateRange,
  calculateTotalSalesValue,
  calculateChange,
  type SalesRecord,
  type DVRRecord,
  MoMComparisonMetrics,
} from '@/components/data-comparison-calculation';

/* =========================
   Columns
========================= */
const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

// --- SALES Columns ---
const salesColumns: ColumnDef<SalesRecord>[] = [
  {
    accessorKey: 'orderDate',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Order Date
        <IconFilter className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderDate}</span>,
    enableHiding: false,
  },
  { id: 'salesmanName', header: 'Salesman', cell: ({ row }) => <div className="font-medium text-sm">{(row.original as any).salesmanName || 'N/A'}</div> },
  { id: 'region', header: 'Region', cell: ({ row }) => <Badge variant="outline">{(row.original as any).region || 'N/A'}</Badge> },
  { id: 'area', header: 'Area', cell: ({ row }) => <Badge variant="outline">{(row.original as any).area || 'N/A'}</Badge> },
  { id: 'dealerName', header: 'Dealer', cell: ({ row }) => <span className="text-sm">{(row.original as any).dealerName || 'N/A'}</span> },
  {
    id: 'dealerType',
    header: 'Type',
    cell: ({ row }) => <Badge className="bg-sky-500/10 text-sky-600 hover:bg-sky-500/20">{(row.original as any).dealerType || 'N/A'}</Badge>,
  },
  {
    id: 'orderTotal',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="justify-end text-right w-full">
        Order Total
        <IconFilter className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
        const val = (row.original as any).orderTotal;
        return <div className="text-right font-semibold text-primary">{formatCurrency(typeof val === 'number' ? val : 0)}</div>;
    }
  },
  {
    id: 'receivedPayment',
    header: 'Received',
    cell: ({ row }) => {
        const val = (row.original as any).receivedPayment;
        return <div className="text-right text-sm text-green-600">{formatCurrency(typeof val === 'number' ? val : 0)}</div>;
    }
  },
  {
    id: 'pendingPayment',
    header: 'Pending',
    cell: ({ row }) => {
        const val = (row.original as any).pendingPayment;
        return <div className="text-right text-sm text-red-600">{formatCurrency(typeof val === 'number' ? val : 0)}</div>;
    }
  },
  { id: 'orderQty', header: 'Qty', cell: ({ row }) => <div className="text-center font-mono text-sm">{(row.original as any).orderQty ?? 0}</div> },
  { accessorKey: 'paymentMode', header: 'Payment Mode', cell: ({ row }) => <span className="text-xs text-gray-300">{row.original.paymentMode ?? '—'}</span>, enableSorting: false },
  { accessorKey: 'orderPartyName', header: 'Party Name', enableSorting: false, enableHiding: true },
];

// --- DVR Columns ---
const dvrColumns: ColumnDef<DVRRecord>[] = [
  { accessorKey: 'reportDate', header: 'Report Date', cell: ({ row }) => row.original.reportDate ? new Date(row.original.reportDate).toLocaleDateString() : 'N/A' },
  { id: 'salesmanName', header: 'Salesman', cell: ({row}) => (row.original as any).salesmanName || 'N/A' },
  { id: 'dealerName', header: 'Dealer Visited', cell: ({row}) => (row.original as any).dealerName || 'N/A' },
  { accessorKey: 'dealerType', header: 'Type', cell: ({ row }) => <Badge variant="outline">{row.original.dealerType || 'N/A'}</Badge> },
  { accessorKey: 'location', header: 'Location' },
  { 
      id: 'todayOrderMt', 
      header: 'Order (MT)', 
      cell: ({ row }) => {
          const val = (row.original as any).todayOrderMt;
          return (typeof val === 'number' ? val : 0).toFixed(2);
      }
  },
  { 
      id: 'todayCollectionRupees', 
      header: 'Collection (₹)', 
      cell: ({ row }) => {
          const val = (row.original as any).todayCollectionRupees;
          return `₹${(typeof val === 'number' ? val : 0).toLocaleString('en-IN')}`;
      }
  },
];


/* =========================
   Filters
========================= */
const TIME_PERIOD_OPTIONS = [
  { label: 'Last 7 Days', value: '7' },
  { label: 'Last 30 Days', value: '30' },
  { label: 'Last 90 Days', value: '90' },
  { label: 'All Time', value: 'all' },
];

/* =========================
   Component
========================= */
export default function SalesDVRReportPage() {
  const { loading, error, sales, dvrs, refetch } = useDvrPjpData(365);

  const [timePeriod, setTimePeriod] = React.useState('30');
  const [salesmanFilter, setSalesmanFilter] = React.useState<string[]>([]);
  const [regionFilter, setRegionFilter] = React.useState<string[]>([]);
  const [areaFilter, setAreaFilter] = React.useState<string[]>([]);
  const [dealerTypeFilter, setDealerTypeFilter] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    if (error) toast.error('Failed to load sales/DVR data.', { description: error });
  }, [error]);

  /* =========================
     Unique options
  ========================= */
  const uniqueOptions = React.useMemo(() => {
    const salesmen = new Set<string>();
    const regions = new Set<string>();
    const areas = new Set<string>();
    const dealerTypes = new Set<string>();

    (sales ?? []).forEach(d => {
      const name = (d as any).salesmanName;
      const reg = (d as any).region;
      const ar = (d as any).area;
      const type = (d as any).dealerType;

      if (name) salesmen.add(name);
      if (reg) regions.add(reg);
      if (ar) areas.add(ar);
      if (type) dealerTypes.add(type);
    });
    
    (dvrs ?? []).forEach(d => {
      if (d.dealerType) dealerTypes.add(d.dealerType);
    });

    return {
      salesmen: Array.from(salesmen).sort().map(s => ({ label: s, value: s })),
      regions: Array.from(regions).sort().map(r => ({ label: r, value: r })),
      areas: Array.from(areas).sort().map(a => ({ label: a, value: a })),
      dealerTypes: Array.from(dealerTypes).sort().map(dt => ({ label: dt, value: dt })),
    };
  }, [sales, dvrs]);

  /* =========================
     Time window helpers
  ========================= */
  const daysNumber = React.useMemo(() => {
    const n = parseInt(timePeriod, 10);
    return Number.isFinite(n) ? n : NaN;
  }, [timePeriod]);

  const salesInWindow = React.useMemo(() => {
    if (!sales) return [];
    if (timePeriod === 'all') return sales;
    if (!Number.isFinite(daysNumber)) return sales;
    return filterByDateRange<SalesRecord>(sales, daysNumber);
  }, [sales, timePeriod, daysNumber]);

  const dvrsInWindow = React.useMemo(() => {
    if (!dvrs) return [];
    if (timePeriod === 'all') return dvrs;
    if (!Number.isFinite(daysNumber)) return dvrs;
    return filterByDateRange<DVRRecord>(dvrs, daysNumber);
  }, [dvrs, timePeriod, daysNumber]);

  /* =========================
     Client-side filters
  ========================= */
  const filteredSalesData = React.useMemo(() => {
    let temp = [...salesInWindow];

    if (salesmanFilter.length) temp = temp.filter(r => salesmanFilter.includes((r as any).salesmanName));
    if (regionFilter.length) temp = temp.filter(r => regionFilter.includes((r as any).region));
    if (areaFilter.length) temp = temp.filter(r => areaFilter.includes((r as any).area));
    if (dealerTypeFilter.length) temp = temp.filter(r => dealerTypeFilter.includes((r as any).dealerType));

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      temp = temp.filter(record =>
        Object.values(record).some(value => String(value).toLowerCase().includes(s))
      );
    }

    return temp;
  }, [salesInWindow, salesmanFilter, regionFilter, areaFilter, dealerTypeFilter, searchTerm]);

  const filteredDvrData = React.useMemo(() => {
    let temp = [...dvrsInWindow];

    if (salesmanFilter.length) temp = temp.filter(r => salesmanFilter.includes((r as any).salesmanName));
    if (dealerTypeFilter.length) temp = temp.filter(r => dealerTypeFilter.includes((r as any).dealerType));

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      temp = temp.filter(record =>
        Object.values(record).some(value => String(value).toLowerCase().includes(s))
      );
    }
    return temp;
  }, [dvrsInWindow, salesmanFilter, dealerTypeFilter, searchTerm]);

  /* =========================
     Analytics (Sales vs DVR)
  ========================= */
  const totalSalesValue = React.useMemo(() => calculateTotalSalesValue(filteredSalesData), [filteredSalesData]);
  const totalVisits = filteredDvrData.length; 
  const salesPerVisit = totalVisits > 0 ? totalSalesValue / totalVisits : 0;

  const mom = React.useMemo(() => {
    if (!sales || !dvrs) return null;

    const now = new Date();
    const thisY = now.getFullYear();
    const thisM = now.getMonth();
    const last = new Date(thisY, thisM - 1, 1);
    const lastY = last.getFullYear();
    const lastM = last.getMonth();

    const isThisMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getFullYear() === thisY && d.getMonth() === thisM;
    };
    const isLastMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getFullYear() === lastY && d.getMonth() === lastM;
    };

    const thisMonthSales = sales.filter(s => isThisMonth(s.orderDate));
    const lastMonthSales = sales.filter(s => isLastMonth(s.orderDate));
    const thisMonthSalesValue = calculateTotalSalesValue(thisMonthSales);
    const lastMonthSalesValue = calculateTotalSalesValue(lastMonthSales);

    const thisMonthDvrs = dvrs.filter(d => isThisMonth(d.reportDate)).length;
    const lastMonthDvrs = dvrs.filter(d => isLastMonth(d.reportDate)).length;

    return {
      sales: {
        thisMonthValue: thisMonthSalesValue,
        lastMonthValue: lastMonthSalesValue,
        changePercentage: calculateChange(thisMonthSalesValue, lastMonthSalesValue),
      },
      dvrs: {
        thisMonthValue: thisMonthDvrs,
        lastMonthValue: lastMonthDvrs,
        changePercentage: calculateChange(thisMonthDvrs, lastMonthDvrs),
      },
    };
  }, [sales, dvrs]);

  /* =========================
     Error UI
  ========================= */
  if (error) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <IconListDetails /> Sales vs DVR Analytics Report
        </h1>
        <Card className="border-red-500 bg-red-50">
          <CardContent className="pt-6 text-red-700 font-medium">
            <p>Error: {error}</p>
            <p className="text-sm mt-1">Please ensure you have the correct permissions to view this data.</p>
            <Button onClick={refetch} className="mt-4" variant="outline">
              <IconRefresh className="mr-2 h-4 w-4" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* =========================
     Main UI
  ========================= */
  return (
    <div className="space-y-8 p-4 md:p-8">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <IconListDetails /> Sales vs DVR Analytics Report
      </h1>

      {/* --- Filters --- */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Data</CardTitle>
          <CardDescription>
            Select filters to apply to the KPIs and transactional tables below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Time Period" />
              </SelectTrigger>
              <SelectContent>
                {TIME_PERIOD_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative sm:col-span-1 lg:col-span-3">
              <Input
                placeholder="Search all fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
              <IconSearch className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MultiSelect
              options={uniqueOptions.salesmen}
              selectedValues={salesmanFilter}
              onValueChange={setSalesmanFilter}
              placeholder="Filter Salesman"
              className="w-full"
            />
            <MultiSelect
              options={uniqueOptions.regions}
              selectedValues={regionFilter}
              onValueChange={setRegionFilter}
              placeholder="Filter Region"
              className="w-full"
            />
            <MultiSelect
              options={uniqueOptions.areas}
              selectedValues={areaFilter}
              onValueChange={setAreaFilter}
              placeholder="Filter Area"
              className="w-full"
            />
            <MultiSelect
              options={uniqueOptions.dealerTypes}
              selectedValues={dealerTypeFilter}
              onValueChange={setDealerTypeFilter}
              placeholder="Filter Dealer Type"
              className="w-full"
            />
          </div>

          <Button
            variant="destructive"
            onClick={() => {
              setSalesmanFilter([]); setRegionFilter([]); setAreaFilter([]);
              setDealerTypeFilter([]); setSearchTerm(''); setTimePeriod('30');
            }}
          >
            Clear All Filters
          </Button>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-16 text-white font-semibold">Loading Sales vs DVR data...</div>}

      {!loading && sales && dvrs && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Key Performance Indicators</h2>
          
          {/* --- KPIs --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">Total Sales (Filtered)</CardTitle>
                <IconCurrencyRupee className="h-6 w-6 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-extrabold text-primary">
                  {formatCurrency(totalSalesValue)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  From {filteredSalesData.length} sales orders.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">Total Visits (Filtered)</CardTitle>
                <BarChart className="h-6 w-6 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-extrabold">{totalVisits}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  From {filteredDvrData.length} verified visits.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">Sales per Visit</CardTitle>
                <Gauge className="h-6 w-6 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-extrabold text-green-600">
                  {formatCurrency(salesPerVisit)}
                </div>
                 <p className="text-sm text-muted-foreground mt-1">
                  (Total Sales / Total Visits)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* --- MoM Cards --- */}
          {mom && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">MoM: Sales Value</CardTitle>
                  <IconTrendingUp className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(mom.sales.thisMonthValue)}</div>
                  <div className={`mt-1 font-semibold ${mom.sales.changePercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {mom.sales.changePercentage.toFixed(2)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    vs. Last Month ({formatCurrency(mom.sales.lastMonthValue)})
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">MoM: DVR Count</CardTitle>
                  <IconTrendingUp className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{mom.dvrs.thisMonthValue}</div>
                  <div className={`mt-1 font-semibold ${mom.dvrs.changePercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {mom.dvrs.changePercentage.toFixed(2)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    vs. Last Month ({mom.dvrs.lastMonthValue})
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Separator className="my-8" />

          {/* --- Tables --- */}
          <h2 className="text-2xl font-semibold border-b pb-2 pt-4">
            Transactional Data (Last {timePeriod === 'all' ? 'All Time' : `${timePeriod} Days`})
          </h2>

          <div className="space-y-8">
            {/* --- Sales Table --- */}
            <Card>
              <CardHeader>
                <CardTitle>Raw Sales Order Report</CardTitle>
                <CardDescription>
                  Showing {filteredSalesData.length} of {salesInWindow.length} records (window), from {sales.length} total.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredSalesData.length > 0 ? (
                  <DataTableReusable
                    columns={salesColumns}
                    data={filteredSalesData as any}
                    enableRowDragging={false}
                    onRowOrderChange={() => {}}
                  />
                ) : (
                  <div className="text-center text-gray-500 py-12 border border-dashed rounded-lg">
                    <p className="font-medium">No sales records match your current filters.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* --- DVR Table --- */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Visit Reports (DVRs)</CardTitle>
                <CardDescription>
                  Showing {filteredDvrData.length} of {dvrsInWindow.length} records (window), from {dvrs.length} total.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredDvrData.length > 0 ? (
                  <DataTableReusable
                    columns={dvrColumns}
                    data={filteredDvrData as any}
                    enableRowDragging={false}
                    onRowOrderChange={() => {}}
                  />
                ) : (
                  <div className="text-center text-gray-500 py-12 border border-dashed rounded-lg">
                    <p className="font-medium">No DVR records match your current filters.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}