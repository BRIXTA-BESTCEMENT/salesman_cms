// app/dashboard/reports/tsoPerformanceMetrics.tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

import {
    Loader2, Search, Eye, MapPin, User,
    Activity, Building2, HardHat, Users, Target, Calendar as CalendarIcon
} from 'lucide-react';

import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from "@/lib/utils";

// --- Validation Schema ---
const metricNode = z.object({
    aop: z.number(),
    mtd: z.number(),
    pct: z.number(),
});

const tsoPerformanceMetricSchema = z.object({
    id: z.union([z.string(), z.number()]),
    userId: z.number().nullable().optional(),
    salesmanName: z.string().catch("Unknown"),
    region: z.string().nullable().optional().catch(""),
    area: z.string().nullable().optional().catch(""),
    totalVisits: z.coerce.number().catch(0),
    metrics: z.object({
        siteVisitNew: metricNode,
        siteVisitOld: metricNode,
        dealerRetailer: metricNode,
        siteConversion: metricNode,
        volumeConvertedMT: metricNode,
        influencerVisits: metricNode,
        enrollmentLifting: metricNode,
        siteServiceSlab: metricNode,
        technicalMeet: metricNode,
    }),
});

type TsoPerformanceMetric = z.infer<typeof tsoPerformanceMetricSchema>;

// --- API Endpoints ---
const API_ENDPOINT = `/api/dashboardPagesAPI/reports/tso-performance-metrics`;
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

interface LocationsResponse {
    areas: string[];
    regions: string[];
}

// --- Helpers ---
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
            <SelectTrigger className="h-9 w-full bg-background border-input">
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

const MetricProgressCard = ({ title, data, colorClass = "bg-primary" }: { title: string, data: { aop: number, mtd: number, pct: number }, colorClass?: string }) => (
    <Card className="shadow-sm border">
        <CardContent className="p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-muted-foreground">{title}</span>
                <Badge variant={data.pct >= 100 ? "default" : "secondary"}>{data.pct}%</Badge>
            </div>
            <div className="flex justify-between items-end">
                <span className="text-2xl font-bold">{data.mtd}</span>
                <span className="text-xs text-muted-foreground mb-1">Target: {data.aop}</span>
            </div>
            {/* Custom Progress Bar */}
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mt-1">
                <div
                    className={`h-full ${colorClass} transition-all duration-500`}
                    style={{ width: `${Math.min(data.pct, 100)}%` }}
                />
            </div>
        </CardContent>
    </Card>
);

export default function TsoPerformanceMetricsPage() {
    const router = useRouter();
    const [metrics, setMetrics] = useState<TsoPerformanceMetric[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedMetric, setSelectedMetric] = useState<TsoPerformanceMetric | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [areaFilter, setAreaFilter] = useState('all');
    const [regionFilter, setRegionFilter] = useState('all');
    
    // --- DateRange State ---
    const [tableDateRange, setTableDateRange] = useState<DateRange | undefined>();

    // Location Data
    const [availableAreas, setAvailableAreas] = useState<string[]>([]);
    const [availableRegions, setAvailableRegions] = useState<string[]>([]);
    const [isLoadingLocations, setIsLoadingLocations] = useState(true);

    const [page, setPage] = useState(0);
    const [pageSize] = useState(100);
    const [totalCount, setTotalCount] = useState(0);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset page on filter change
    useEffect(() => {
        setPage(0);
    }, [debouncedSearchQuery, areaFilter, regionFilter, tableDateRange]);

    const fetchMetrics = useCallback(async () => {
        setIsLoading(true);
        try {
            const url = new URL(API_ENDPOINT, window.location.origin);
            url.searchParams.append('page', page.toString());
            url.searchParams.append('pageSize', pageSize.toString());

            if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
            if (areaFilter !== 'all') url.searchParams.append('area', areaFilter);
            if (regionFilter !== 'all') url.searchParams.append('region', regionFilter);
            
            // --- Parse DateRange for API ---
            if (tableDateRange?.from) {
                url.searchParams.append('startDate', format(tableDateRange.from, "yyyy-MM-dd"));
            }
            if (tableDateRange?.to) {
                url.searchParams.append('endDate', format(tableDateRange.to, "yyyy-MM-dd"));
            } else if (tableDateRange?.from) {
                // If only "from" is selected, filter strictly for that day
                url.searchParams.append('endDate', format(tableDateRange.from, "yyyy-MM-dd"));
            }

            const response = await fetch(url.toString());
            const result = await response.json();

            if (!response.ok) {
                if (response.status === 401) { router.push('/login'); return; }
                if (response.status === 403) { router.push('/dashboard'); return; }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const rawData: TsoPerformanceMetric[] = result.data || [];
            setTotalCount(result.totalCount || 0);

            const validatedData = rawData.map((item, index) => {
                try {
                    const itemWithId = {
                        ...item,
                        id: item.userId ? String(item.userId) : `row-fallback-${index}`
                    };
                    return tsoPerformanceMetricSchema.parse(itemWithId);
                } catch (e) {
                    console.error("Validation error:", item, e);
                    return null;
                }
            }).filter(Boolean) as TsoPerformanceMetric[];

            setMetrics(validatedData);
            toast.success("Metrics loaded successfully!");
        } catch (error: any) {
            toast.error(`Failed to load: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [router, page, pageSize, debouncedSearchQuery, areaFilter, regionFilter, tableDateRange]);

    const fetchLocations = useCallback(async () => {
        setIsLoadingLocations(true);
        try {
            const response = await fetch(LOCATION_API_ENDPOINT);
            if (response.ok) {
                const data: LocationsResponse = await response.json();
                setAvailableAreas(data.areas || []);
                setAvailableRegions(data.regions || []);
            }
        } finally { setIsLoadingLocations(false); }
    }, []);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    // --- Table Columns ---
    const columns = useMemo<ColumnDef<TsoPerformanceMetric>[]>(() => [
        {
            accessorKey: "salesmanName",
            header: "TSO Name",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{row.original.salesmanName}</span>
                </div>
            )
        },
        {
            accessorKey: "region",
            header: "Zone",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm font-medium">{row.original.region || 'N/A'}</span>
                    <span className="text-xs text-muted-foreground">{row.original.area || 'N/A'}</span>
                </div>
            )
        },
        {
            accessorKey: "totalVisits",
            header: "Total Visits",
            cell: ({ row }) => (
                <Badge variant="default" className="text-sm px-2.5 py-0.5">
                    {row.original.totalVisits}
                </Badge>
            )
        },
        {
            id: "siteVisits",
            header: "Site Visits",
            cell: ({ row }) => {
                const totalSiteVisits = row.original.metrics.siteVisitNew.mtd + row.original.metrics.siteVisitOld.mtd;
                return <span className="font-medium text-muted-foreground">{totalSiteVisits}</span>;
            }
        },
        {
            id: "dealerVisits",
            header: "Dealer Visits",
            cell: ({ row }) => <span className="font-medium text-muted-foreground">{row.original.metrics.dealerRetailer.mtd}</span>
        },
        {
            id: "influencerVisits",
            header: "Influencer Visits",
            cell: ({ row }) => <span className="font-medium text-muted-foreground">{row.original.metrics.influencerVisits.mtd}</span>
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 h-8 px-2 shadow-sm"
                    onClick={() => {
                        setSelectedMetric(row.original);
                        setIsViewModalOpen(true);
                    }}
                >
                    <Eye className="h-3.5 w-3.5 mr-1" /> View Breakdown
                </Button>
            ),
        },
    ], []);

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <div className="flex-1 space-y-6 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">TSO Performance Metrics</h2>
                    <Badge variant="outline" className="text-base px-4 py-1">
                        Active Personnel: {totalCount}
                    </Badge>

                    <RefreshDataButton
                        cachePrefix="tso-performance-metrics"
                        onRefresh={fetchMetrics}
                    />
                </div>

                {/* --- COHESIVE FILTER BAR UI --- */}
                <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border shadow-sm">
                    <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Search</label>
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Name, area, region..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 h-9 bg-background border-input"
                            />
                        </div>
                    </div>
                    
                    {/* --- DateRange Picker Popover --- */}
                    <div className="flex flex-col space-y-1 w-full sm:w-[260px]">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Filter by Date</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button 
                                    variant={"outline"} 
                                    className={cn("w-full justify-start text-left font-normal h-9 bg-background", !tableDateRange && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {tableDateRange?.from ? (
                                        tableDateRange.to ? (
                                            <>{format(tableDateRange.from, "LLL dd, y")} - {format(tableDateRange.to, "LLL dd, y")}</>
                                        ) : (
                                            format(tableDateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Select Date Range</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar 
                                    mode="range" 
                                    defaultMonth={tableDateRange?.from || new Date()} 
                                    selected={tableDateRange} 
                                    onSelect={setTableDateRange} 
                                    numberOfMonths={2} 
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {renderSelectFilter('Area', areaFilter, setAreaFilter, availableAreas, isLoadingLocations)}
                    {renderSelectFilter('Zone(Region)', regionFilter, setRegionFilter, availableRegions, isLoadingLocations)}

                    <Button
                        variant="ghost"
                        onClick={() => {
                            setSearchQuery('');
                            setAreaFilter('all');
                            setRegionFilter('all');
                            setTableDateRange(undefined);
                        }}
                        className="mb-0.5 text-muted-foreground hover:text-destructive"
                    >
                        Clear Filters
                    </Button>
                </div>

                {/* Data Table */}
                <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <DataTableReusable
                            columns={columns}
                            data={metrics}
                            enableRowDragging={false}
                        />
                    )}
                </div>
            </div>

            {/* View Details Modal */}
            {selectedMetric && (
                <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                    <DialogContent className="sm:max-w-[600px] p-0 gap-0 bg-background">
                        <div className="px-6 py-4 border-b bg-muted/20 border-l-[6px] border-l-primary">
                            <DialogTitle className="text-xl flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-primary" />
                                    Performance Breakdown
                                </span>
                                <Badge variant="default" className="text-sm px-3">
                                    {selectedMetric.totalVisits} Total Visits
                                </Badge>
                            </DialogTitle>
                            <DialogDescription className="mt-1 flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1 font-medium text-foreground"><User className="w-3.5 h-3.5" /> {selectedMetric.salesmanName}</span>
                                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {selectedMetric.region} / {selectedMetric.area}</span>
                            </DialogDescription>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div>
                                <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Site & Field Activities</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    <MetricProgressCard title="New Site Visits" data={selectedMetric.metrics.siteVisitNew} colorClass="bg-blue-500" />
                                    <MetricProgressCard title="Old Site Visits" data={selectedMetric.metrics.siteVisitOld} colorClass="bg-blue-400" />
                                    <MetricProgressCard title="Dealer/Retailer" data={selectedMetric.metrics.dealerRetailer} colorClass="bg-amber-500" />
                                    <MetricProgressCard title="Influencer / Architect" data={selectedMetric.metrics.influencerVisits} colorClass="bg-emerald-500" />
                                    <MetricProgressCard title="Technical Meet / Canopy" data={selectedMetric.metrics.technicalMeet} colorClass="bg-purple-500" />
                                    <MetricProgressCard title="Site Service (Slab)" data={selectedMetric.metrics.siteServiceSlab} colorClass="bg-indigo-500" />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Business Impact</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <MetricProgressCard title="Site Conversions" data={selectedMetric.metrics.siteConversion} colorClass="bg-green-600" />
                                    <MetricProgressCard title="Vol. Converted (MT)" data={selectedMetric.metrics.volumeConvertedMT} colorClass="bg-green-500" />
                                    <MetricProgressCard title="Mason Enroll / Lift" data={selectedMetric.metrics.enrollmentLifting} colorClass="bg-orange-500" />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-4 bg-background border-t">
                            <Button onClick={() => setIsViewModalOpen(false)}>Close Breakdown</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}