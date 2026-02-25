// app/dashboard/reports/tvrVpjp.tsx
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
import { useTvrPjpData, TVRRecord, PJPRecord, MoMComparisonMetrics } from '@/components/data-comparison-calculation';

const DATE_FILTERS = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '365', label: 'Last Year' },
];

export default function TvrPjpReportPage() {
  const [days, setDays] = React.useState<string>('30');
  const { loading, error, filteredPjps, filteredTvrs, analytics } = useTvrPjpData(Number(days));

  const [salesmanFilter, setSalesmanFilter] = React.useState<string[]>([]);
  const [areaFilter, setAreaFilter] = React.useState<string[]>([]);
  const [visitCategoryFilter, setVisitCategoryFilter] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    if (error) toast.error('Data Load Error', { description: error });
  }, [error]);

  const uniqueOptions = React.useMemo(() => {
    const salesmen = new Set<string>();
    const areas = new Set<string>();
    const categories = new Set<string>();

    (filteredPjps ?? []).forEach(d => {
      const pjpName = (d as any).salesmanName;
      if (pjpName) salesmen.add(pjpName);
      if (d.areaToBeVisited) areas.add(d.areaToBeVisited);
    });
    (filteredTvrs ?? []).forEach(t => {
      const tvrName = (t as any).salesmanName;
      const tvrArea = (t as any).area;
      if (tvrName) salesmen.add(tvrName);
      if (tvrArea) areas.add(tvrArea);
      if (t.visitCategory) categories.add(t.visitCategory);
    });

    return {
      salesmen: Array.from(salesmen).sort().map(s => ({ label: s, value: s })),
      areas: Array.from(areas).sort().map(a => ({ label: a, value: a })),
      categories: Array.from(categories).sort().map(c => ({ label: c, value: c })),
    };
  }, [filteredPjps, filteredTvrs]);

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

  const finalFilteredTvrs = React.useMemo(() => {
    if (!filteredTvrs) return [];
    let temp = [...filteredTvrs];

    if (salesmanFilter.length) temp = temp.filter(r => {
        const name = (r as any).salesmanName;
        return name && salesmanFilter.includes(name);
    });
    if (areaFilter.length) temp = temp.filter(r => {
        const area = (r as any).area;
        return area && areaFilter.includes(area);
    });
    if (visitCategoryFilter.length) temp = temp.filter(r => r.visitCategory && visitCategoryFilter.includes(r.visitCategory));

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      temp = temp.filter(record =>
        Object.values(record).some(value => String(value).toLowerCase().includes(s))
      );
    }
    return temp;
  }, [filteredTvrs, salesmanFilter, areaFilter, visitCategoryFilter, searchTerm]);

  const chartData = React.useMemo(() => {
    if (!finalFilteredPjps || !finalFilteredTvrs) return [];
    const map = new Map<string, { name: string; tvrs: number; pjps: number }>();

    finalFilteredTvrs.forEach((d: any) => {
      const key = d.date || d.reportDate; 
      if (!map.has(key)) map.set(key, { name: key, tvrs: 0, pjps: 0 });
      map.get(key)!.tvrs += 1;
    });

    finalFilteredPjps.forEach((p: any) => {
      const key = p.planDate;
      if (!map.has(key)) map.set(key, { name: key, tvrs: 0, pjps: 0 });
      map.get(key)!.pjps += 1;
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()
    );
  }, [finalFilteredPjps, finalFilteredTvrs]);

  const pjpColumns: ColumnDef<PJPRecord>[] = React.useMemo(() => [
    { accessorKey: 'planDate', header: 'Plan Date', cell: ({ row }) => row.original.planDate ? new Date(row.original.planDate).toLocaleDateString() : 'N/A' },
    { id: 'salesmanName', header: 'Salesman', cell: ({ row }) => (row.original as any).salesmanName || 'N/A' },
    { accessorKey: 'areaToBeVisited', header: 'Area' },
    { id: 'visitDealerName', header: 'Target (Site/Dealer)', cell: ({ row }) => (row.original as any).visitDealerName || 'N/A' },
    {
      id: 'verificationStatus',
      header: 'Verification',
      cell: ({ row }) => {
        const status = (row.original as any).verificationStatus;
        const className = status === 'VERIFIED'
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : status === 'PENDING'
              ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
              : 'bg-red-600 hover:bg-red-700 text-white';
        return <Badge className={className}>{status || 'N/A'}</Badge>;
      },
    },
  ], []);

  const tvrColumns: ColumnDef<TVRRecord>[] = React.useMemo(() => [
    { id: 'date', header: 'Visit Date', cell: ({ row }) => {
        const d = (row.original as any).date || row.original.reportDate;
        return d ? new Date(d).toLocaleDateString() : 'N/A';
    }},
    { id: 'salesmanName', header: 'Salesman', cell: ({ row }) => (row.original as any).salesmanName || 'N/A' },
    { accessorKey: 'siteNameConcernedPerson', header: 'Site / Concerned Person' },
    { accessorKey: 'visitCategory', header: 'Category', cell: ({ row }) => row.original.visitCategory ? <Badge variant="outline">{row.original.visitCategory}</Badge> : '-' },
    { id: 'area', header: 'Area', cell: ({ row }) => (row.original as any).area || 'N/A' },
    { accessorKey: 'siteVisitStage', header: 'Stage' },
    { id: 'isConverted', header: 'Converted?', cell: ({ row }) => (row.original as any).isConverted ? <Badge className="bg-green-600">Yes</Badge> : <Badge variant="secondary">No</Badge> },
  ], []);

  if (error) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-3xl font-bold">TVR vs PJP Analytics</h1>
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
      <h1 className="text-3xl font-bold flex items-center gap-3">TVR vs PJP Analytics Report</h1>

      {/* --- Filters --- */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Data</CardTitle>
          <CardDescription>
            Select filters to apply to the tables and chart below. Analytics use <b>only VERIFIED PJP</b>.
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
              options={uniqueOptions.categories}
              selectedValues={visitCategoryFilter}
              onValueChange={setVisitCategoryFilter}
              placeholder="Filter Visit Category"
              className="w-full"
            />
          </div>

          <Button
            variant="destructive"
            onClick={() => {
              setSalesmanFilter([]); setAreaFilter([]);
              setVisitCategoryFilter([]); setSearchTerm(''); setDays('30');
            }}
          >
            Clear All Filters
          </Button>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-16 text-white font-semibold">Loading TVR vs PJP data...</div>}

      {/* --- KPIs --- */}
      {!loading && analytics && filteredTvrs && filteredPjps && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Key Performance Indicators</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-lg hover:shadow-xl transition-shadow border-primary/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">Target Achievement (TVR vs PJP)</CardTitle>
                <Gauge className="h-6 w-6 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-extrabold text-primary">
                  {analytics.targetAchievementPercentage.toFixed(2)}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {finalFilteredTvrs.length} actual technical visits vs. {finalFilteredPjps.length} verified planned visits.
                </p>
              </CardContent>
            </Card>

            {analytics.momMetrics.find((m) => m.metric.includes('TVR')) && (
              <MoMMetricCard metricData={analytics.momMetrics.find((m) => m.metric.includes('TVR'))!} />
            )}
            {analytics.momMetrics.find((m) => m.metric.includes('PJP')) && (
              <MoMMetricCard metricData={analytics.momMetrics.find((m) => m.metric.includes('PJP'))!} />
            )}
          </div>

          {/* Trend Chart */}
          <div className="pt-6">
            <ChartAreaInteractive
              data={chartData}
              dataKey="tvrs"
              title={`Daily TVR & Verified PJP Trends (Last ${days} Days)`}
            />
          </div>

          <Separator className="my-8" />

          {/* Tables */}
          <h2 className="text-2xl font-semibold border-b pb-2 pt-4">Transactional Data (Last {days} Days)</h2>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Technical Visit Reports (TVRs)</CardTitle>
                <CardDescription>
                  Showing {finalFilteredTvrs.length} of {filteredTvrs.length} records in this period.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {finalFilteredTvrs.length > 0 ? (
                  <DataTableReusable
                    columns={tvrColumns}
                    data={finalFilteredTvrs as any} 
                    enableRowDragging={false}
                    onRowOrderChange={() => { }}
                  />
                ) : (
                  <div className="text-center text-gray-500 py-12 border border-dashed rounded-lg">
                    <p className="font-medium">No TVRs match your current filters.</p>
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
                    data={finalFilteredPjps as any} 
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

// --- Reusable MoM Card ---
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