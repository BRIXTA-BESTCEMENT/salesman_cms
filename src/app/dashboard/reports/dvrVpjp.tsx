// app/dashboard/reports/dvrVpjp.tsx
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { ChevronUp, ChevronDown, Gauge, List } from 'lucide-react';
import { IconSearch } from '@tabler/icons-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/multi-select';

import { DataTableReusable } from '@/components/data-table-reusable';
import { ChartAreaInteractive } from '@/components/chart-area-reusable';

// Import the validated, safely coerced types directly from your central calculator file
import { 
  useDvrPjpData, 
  PJPRecord, 
  DVRRecord, 
  MoMComparisonMetrics, 
  DVRvPJPAnalytics 
} from '@/components/data-comparison-calculation';

const DATE_FILTERS = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '365', label: 'Last Year' },
];

export default function DvrPjpReportPage() {
  // --- States ---
  const [days, setDays] = React.useState<string>('30');

  // Client-side fetch + compute (uses ONLY VERIFIED PJPs internally)
  const { loading, error, filteredPjps, filteredDvrs, analytics } = useDvrPjpData(Number(days));

  // --- New Filter States ---
  const [salesmanFilter, setSalesmanFilter] = React.useState<string[]>([]);
  const [areaFilter, setAreaFilter] = React.useState<string[]>([]);
  const [dealerTypeFilter, setDealerTypeFilter] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    if (error) toast.error('Data Load Error', { description: error });
  }, [error]);

  // --- Unique filter options (derived from date-filtered data) ---
  const uniqueOptions = React.useMemo(() => {
    const salesmen = new Set<string>();
    const areas = new Set<string>();
    const dealerTypes = new Set<string>();

    (filteredPjps ?? []).forEach(d => {
      // Cast safely since base Drizzle schema makes salesmanName optional
      const pjpName = (d as any).salesmanName;
      if (pjpName) salesmen.add(pjpName);
      if (d.areaToBeVisited) areas.add(d.areaToBeVisited);
    });
    
    (filteredDvrs ?? []).forEach(d => {
      const dvrName = (d as any).salesmanName;
      if (dvrName) salesmen.add(dvrName);
      if (d.dealerType) dealerTypes.add(d.dealerType);
    });

    return {
      salesmen: Array.from(salesmen).sort().map(s => ({ label: s, value: s })),
      areas: Array.from(areas).sort().map(a => ({ label: a, value: a })),
      dealerTypes: Array.from(dealerTypes).sort().map(dt => ({ label: dt, value: dt })),
    };
  }, [filteredPjps, filteredDvrs]);

  // --- Apply client-side filters ---
  const finalFilteredPjps = React.useMemo(() => {
    if (!filteredPjps) return [];
    let temp = [...filteredPjps];

    if (salesmanFilter.length) temp = temp.filter(r => {
        const name = (r as any).salesmanName;
        return name && salesmanFilter.includes(name);
    });
    
    if (areaFilter.length) temp = temp.filter(r => r.areaToBeVisited && areaFilter.includes(r.areaToBeVisited));

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      temp = temp.filter(record =>
        Object.values(record).some(value => String(value).toLowerCase().includes(s))
      );
    }
    return temp;
  }, [filteredPjps, salesmanFilter, areaFilter, searchTerm]);

  const finalFilteredDvrs = React.useMemo(() => {
    if (!filteredDvrs) return [];
    let temp = [...filteredDvrs];

    if (salesmanFilter.length) temp = temp.filter(r => {
        const name = (r as any).salesmanName;
        return name && salesmanFilter.includes(name);
    });
    if (dealerTypeFilter.length) temp = temp.filter(r => r.dealerType && dealerTypeFilter.includes(r.dealerType));

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      temp = temp.filter(record =>
        Object.values(record).some(value => String(value).toLowerCase().includes(s))
      );
    }
    return temp;
  }, [filteredDvrs, salesmanFilter, dealerTypeFilter, searchTerm]);


  // --- Chart data (uses FINAL filtered data) ---
  const chartData = React.useMemo(() => {
    if (!finalFilteredPjps || !finalFilteredDvrs) return [];
    const map = new Map<string, { name: string; dvrs: number; pjps: number }>();

    finalFilteredDvrs.forEach((d: any) => {
      const key = d.reportDate;
      if (!map.has(key)) map.set(key, { name: key, dvrs: 0, pjps: 0 });
      map.get(key)!.dvrs += 1;
    });

    finalFilteredPjps.forEach((p: any) => {
      const key = p.planDate;
      if (!map.has(key)) map.set(key, { name: key, dvrs: 0, pjps: 0 });
      map.get(key)!.pjps += 1;
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()
    );
  }, [finalFilteredPjps, finalFilteredDvrs]);

  // Columns — PJP
  const pjpColumns: ColumnDef<PJPRecord>[] = React.useMemo(() => [
    { 
      accessorKey: 'planDate', 
      header: 'Plan Date', 
      cell: ({ row }) => {
        const d = row.original.planDate;
        return d ? new Date(d).toLocaleDateString() : 'N/A';
      }
    },
    // Map dynamically because salesmanName is technically an extended field not on base PJPRecord yet
    { 
        id: 'salesmanName', 
        header: 'Salesman',
        cell: ({ row }) => (row.original as any).salesmanName || 'N/A'
    },
    { accessorKey: 'areaToBeVisited', header: 'Area' },
    { accessorKey: 'visitDealerName', header: 'Dealer' },
    {
      accessorKey: 'status',
      header: 'Plan Status',
      cell: ({ row }) => {
        const status = (row.original as any).status;

        const className =
          status === 'APPROVED' || status === 'COMPLETED'
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : status === 'PENDING'
              ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
              : 'bg-red-600 hover:bg-red-700 text-white';

        return <Badge className={className}>{status || 'N/A'}</Badge>;
      },
    },
    {
      accessorKey: 'verificationStatus',
      header: 'Verification',
      cell: ({ row }) => {
        const status = (row.original as any).verificationStatus;

        const className =
          status === 'VERIFIED'
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : status === 'PENDING'
              ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
              : 'bg-red-600 hover:bg-red-700 text-white';

        return <Badge className={className}>{status || 'N/A'}</Badge>;
      },
    },
  ], []);

  // Columns — DVR (aligned to shared schema)
  const dvrColumns: ColumnDef<DVRRecord>[] = React.useMemo(() => [
    { 
      accessorKey: 'reportDate', 
      header: 'Report Date', 
      cell: ({ row }) => {
        const d = row.original.reportDate;
        return d ? new Date(d).toLocaleDateString() : 'N/A';
      }
    },
    { 
        id: 'salesmanName', 
        header: 'Salesman',
        cell: ({ row }) => (row.original as any).salesmanName || 'N/A'
    },
    { 
        id: 'dealerName', 
        header: 'Dealer Visited',
        cell: ({ row }) => (row.original as any).dealerName || 'N/A'
    },
    { accessorKey: 'dealerType', header: 'Type', cell: ({ row }) => <Badge variant="outline">{row.original.dealerType || 'N/A'}</Badge> },
    { accessorKey: 'location', header: 'Location' },
    // Use fallback ?? 0 before calling .toFixed() to satisfy TypeScript
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
  ], []);

  // Error UI
  if (error) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-3xl font-bold">DVR vs PJP Analytics</h1>
        <Card className="border-red-500 bg-red-50">
          <CardContent className="pt-6 text-red-700 font-medium">
            <p>Error: Failed to load analytics data: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold flex items-center gap-3">DVR vs PJP Analytics Report</h1>

      {/* --- Filters (NEW) --- */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Data</CardTitle>
          <CardDescription>
            Select filters to apply to the tables and chart below. KPIs are date-based. Analytics use <b>only VERIFIED PJP</b>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select value={days} onValueChange={setDays} disabled={loading}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {DATE_FILTERS.map(f => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MultiSelect
              options={uniqueOptions.salesmen}
              selectedValues={salesmanFilter}
              onValueChange={setSalesmanFilter}
              placeholder="Filter Salesman"
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
              setSalesmanFilter([]); setAreaFilter([]);
              setDealerTypeFilter([]); setSearchTerm(''); setDays('30');
            }}
          >
            Clear All Filters
          </Button>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-16 text-white font-semibold">Loading DVR vs PJP data...</div>}

      {/* --- KPIs (Uses analytics object but FINAL counts) --- */}
      {!loading && analytics && filteredDvrs && filteredPjps && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Key Performance Indicators</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Target Achievement */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow border-primary/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">Target Achievement (DVR vs PJP)</CardTitle>
                <Gauge className="h-6 w-6 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-extrabold text-primary">
                  {/* Percentage is from the date-based analytics hook */}
                  {analytics.targetAchievementPercentage.toFixed(2)}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {/* Counts are from the FINAL filtered data */}
                  {finalFilteredDvrs.length} actual visits vs. {finalFilteredPjps.length} verified planned visits.
                </p>
              </CardContent>
            </Card>

            {/* MoM Cards (from analytics hook) */}
            {analytics.momMetrics.find((m: any) => m.metric.includes('DVR')) && (
              <MoMMetricCard metricData={analytics.momMetrics.find((m: any) => m.metric.includes('DVR'))!} />
            )}
            {analytics.momMetrics.find((m: any) => m.metric.includes('PJP')) && (
              <MoMMetricCard metricData={analytics.momMetrics.find((m: any) => m.metric.includes('PJP'))!} />
            )}
          </div>

          {/* Trend Chart (uses FINAL filtered data) */}
          <div className="pt-6">
            <ChartAreaInteractive
              data={chartData}
              dataKey="dvrs"
              title={`Daily DVR & Verified PJP Trends (Last ${days} Days)`}
            />
          </div>

          <Separator className="my-8" />

          {/* Tables (uses FINAL filtered data) */}
          <h2 className="text-2xl font-semibold border-b pb-2 pt-4">Transactional Data (Last {days} Days)</h2>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Daily Visit Reports (DVRs)</CardTitle>
                <CardDescription>
                  Showing {finalFilteredDvrs.length} of {filteredDvrs.length} records in this period.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {finalFilteredDvrs.length > 0 ? (
                  <DataTableReusable
                    columns={dvrColumns}
                    data={finalFilteredDvrs as any} // Cast safely since we defined columns dynamically
                    enableRowDragging={false}
                    onRowOrderChange={() => { }}
                  />
                ) : (
                  <div className="text-center text-gray-500 py-12 border border-dashed rounded-lg">
                    <p className="font-medium">No DVRs match your current filters.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Permanent Journey Plans (VERIFIED PJPs)</CardTitle>
                <CardDescription>
                  Showing {finalFilteredPjps.length} of {filteredPjps.length} records in this period.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {finalFilteredPjps.length > 0 ? (
                  <DataTableReusable
                    columns={pjpColumns}
                    data={finalFilteredPjps as any} // Cast safely since we defined columns dynamically
                    enableRowDragging={false}
                    onRowOrderChange={() => { }}
                  />
                ) : (
                  <div className="text-center text-gray-500 py-12 border border-dashed rounded-lg">
                    <p className="font-medium">No PJPs match your current filters.</p>
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

// --- Reusable MoM Card (No changes) ---
interface MoMMetricCardProps { metricData: MoMComparisonMetrics; }

const MoMMetricCard: React.FC<MoMMetricCardProps> = ({ metricData }) => {
  const isGrowth = metricData.changePercentage > 0;
  const isDecline = metricData.changePercentage < 0;
  const isNeutral = metricData.changePercentage === 0 || !isFinite(metricData.changePercentage);

  const Icon = isGrowth ? ChevronUp : isDecline ? ChevronDown : List;
  const changeColor = isGrowth ? 'text-green-500' : isDecline ? 'text-red-500' : 'text-gray-500';

  const changeText = isFinite(metricData.changePercentage)
    ? `${Math.abs(metricData.changePercentage).toFixed(2)}%`
    : 'N/A';

  const formattedValue = metricData.thisMonthValue.toLocaleString();
  const formattedLastMonthValue = metricData.lastMonthValue.toLocaleString();

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">{metricData.metric} MoM</CardTitle>
        <Icon className={`h-6 w-6 ${changeColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-extrabold">{formattedValue}</div>
        <div className={`text-sm mt-1 flex items-center ${changeColor}`}>
          {isNeutral ? (
            <span className="font-semibold text-gray-500">No Change/N/A</span>
          ) : (
            <span className="font-semibold">
              {changeText} {isGrowth ? 'Increase' : 'Decrease'}
            </span>
          )}
          <span className="ml-1 text-muted-foreground"> vs. Last Month ({formattedLastMonthValue})</span>
        </div>
      </CardContent>
    </Card>
  );
};