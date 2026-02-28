// src/app/dashboard/permanentJourneyPlan/pjpList.tsx
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Eye, MapPin, User, Calendar as CalendarIcon, Target, Users, Route, ClipboardList, Loader2
} from 'lucide-react';
import { IconCalendar } from '@tabler/icons-react';
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Reusable Components
import { cn } from '@/lib/utils';
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { selectPermanentJourneyPlanSchema } from '../../../../drizzle/zodSchemas';

const extendedPjpSchema = selectPermanentJourneyPlanSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  createdByName: z.string().optional().catch("Unknown"),
  createdByRole: z.string().optional().catch("N/A"),
  visitDealerName: z.string().nullable().optional(),
  influencerName: z.string().nullable().optional(),
  influencerPhone: z.string().nullable().optional(),
  activityType: z.string().nullable().optional(),
  route: z.string().nullable().optional(),
  noofConvertedBags: z.coerce.number().optional().catch(0),
  noofMasonpcInSchemes: z.coerce.number().optional().catch(0),
  plannedNewSiteVisits: z.coerce.number().optional().catch(0),
  plannedFollowUpSiteVisits: z.coerce.number().optional().catch(0),
  plannedNewDealerVisits: z.coerce.number().optional().catch(0),
  plannedInfluencerVisits: z.coerce.number().optional().catch(0),
});

type PermanentJourneyPlan = z.infer<typeof extendedPjpSchema>;

const InfoField = ({ label, value, icon: Icon, fullWidth = false }: { label: string, value: React.ReactNode, icon?: any, fullWidth?: boolean }) => (
  <div className={`flex flex-col space-y-1.5 ${fullWidth ? 'col-span-2' : ''}`}>
    <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 tracking-wider">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </Label>
    <div className="text-sm font-medium p-2.5 bg-secondary/30 rounded-md border border-border/50 min-h-10 flex items-center">
      {value || <span className="text-muted-foreground italic text-xs">N/A</span>}
    </div>
  </div>
);

export default function PJPListPage() {
  const [pjps, setPjps] = React.useState<PermanentJourneyPlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Pagination & Backend Meta
  const [page, setPage] = React.useState(0);
  const [pageSize] = React.useState(500);
  const [totalCount, setTotalCount] = React.useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [selectedStatusFilter, setSelectedStatusFilter] = React.useState<string>('all');
  const [selectedSalesmanFilter, setSelectedSalesmanFilter] = React.useState<string>('all');

  // Filter Options
  const [salesmen, setSalesmen] = React.useState<{id: number, firstName: string | null, lastName: string | null, email: string}[]>([]);
  const [statuses, setStatuses] = React.useState<string[]>([]);

  // Modal State
  const [selectedPjp, setSelectedPjp] = React.useState<PermanentJourneyPlan | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, selectedStatusFilter, selectedSalesmanFilter, dateRange]);

  const fetchFilters = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboardPagesAPI/permanent-journey-plan?action=fetch_filters`);
      if (res.ok) {
        const data = await res.json();
        setSalesmen(data.salesmen || []);
        setStatuses(data.statuses || []);
      }
    } catch (e) {
      console.error("Failed to load PJP filters", e);
    }
  }, []);

  const fetchPjps = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`/api/dashboardPagesAPI/permanent-journey-plan`, window.location.origin);
      url.searchParams.append('verificationStatus', 'VERIFIED');
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (selectedSalesmanFilter !== 'all') url.searchParams.append('salesmanId', selectedSalesmanFilter);
      if (selectedStatusFilter !== 'all') url.searchParams.append('status', selectedStatusFilter);
      
      if (dateRange?.from) url.searchParams.append('fromDate', format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange?.to) {
        url.searchParams.append('toDate', format(dateRange.to, "yyyy-MM-dd"));
      } else if (dateRange?.from) {
        url.searchParams.append('toDate', format(dateRange.from, "yyyy-MM-dd"));
      }

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const result = await response.json();
      const data: any[] = result.data || result;
      
      setTotalCount(result.totalCount || 0);

      const validatedData = data.map((item) => {
        const validated = extendedPjpSchema.parse(item);
        return { ...validated, id: validated.id.toString() };
      });
      setPjps(validatedData);
    } catch (e: any) {
      setError(e.message);
      toast.error("Failed to load Permanent Journey Plans.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearchQuery, selectedSalesmanFilter, selectedStatusFilter, dateRange]);

  React.useEffect(() => { fetchFilters(); }, [fetchFilters]);
  React.useEffect(() => { fetchPjps(); }, [fetchPjps]);

  // Summary Stats based on loaded subset (reflecting current active filters/page)
  const stats = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const todaysPlans = pjps.filter(p => {
      if (!p.planDate) return false;
      const planDateStr = new Date(p.planDate).toISOString().split('T')[0];
      return planDateStr === todayStr;
    });

    return {
      todayCount: todaysPlans.length,
      todayBags: todaysPlans.reduce((acc, curr) => acc + (curr.noofConvertedBags || 0), 0),
      todaySites: todaysPlans.reduce((acc, curr) => acc + (curr.plannedNewSiteVisits || 0) + (curr.plannedFollowUpSiteVisits || 0), 0),

      totalCount: totalCount, 
      pageBags: pjps.reduce((acc, curr) => acc + (curr.noofConvertedBags || 0), 0),
      pageSites: pjps.reduce((acc, curr) => acc + (curr.plannedNewSiteVisits || 0) + (curr.plannedFollowUpSiteVisits || 0), 0)
    };
  }, [pjps, totalCount]);

  const columns: ColumnDef<PermanentJourneyPlan>[] = [
    { accessorKey: "salesmanName", header: "Salesman" },
    { accessorKey: "planDate", header: "Planned Date" },
    { accessorKey: "areaToBeVisited", header: "Area" },
    {
      accessorKey: "visitDealerName",
      header: "Visiting",
      cell: ({ row }) => {
        const name = row.original.visitDealerName;
        const type = !!row.original.siteId ? 'Site' : !!row.original.dealerId ? 'Dealer' : '';
        return name ? (
          <div className="flex flex-col">
            <span className="font-medium text-sm">{name}</span>
            <span className="text-[10px] text-muted-foreground uppercase">{type}</span>
          </div>
        ) : <span className="text-muted-foreground">N/A</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;

        if (status === 'VERIFIED') {
          return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-none">{status}</Badge>;
        }
        if (status === 'COMPLETED') {
          return <Badge variant="default" className="shadow-none">{status}</Badge>;
        }
        return <Badge variant="secondary" className="shadow-none">{status}</Badge>;
      }
    },
    {
      id: "actions",
      header: "View",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => { setSelectedPjp(row.original); setIsViewModalOpen(true); }}>
          <Eye className="h-4 w-4 mr-1" /> View
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <h2 className="text-3xl font-bold tracking-tight">Weekly Technical PJPs</h2>
             <Badge variant="outline" className="text-base px-4 py-1">
                Total PJPs: {stats.totalCount}
             </Badge>
          </div>
          <RefreshDataButton cachePrefix="permanent-journey-plan" onRefresh={fetchPjps} />
        </div>

        {/* --- Summary Cards --- */}
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-primary/5 border-primary/10">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wide">Today's Verified Plans</CardTitle>
                <ClipboardList className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.todayCount}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Active plans for {format(new Date(), "dd MMM, yyyy")}</p>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/10">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wide">Today's Target Bags</CardTitle>
                <Target className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{stats.todayBags}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Conversion goal for today</p>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/10">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wide">Today's Site Visits</CardTitle>
                <MapPin className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{stats.todaySites}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Planned visits (New + Follow-up)</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <Card className="bg-muted/20 border-dashed shadow-none">
              <CardContent className="p-1 flex items-center justify-center">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Total Verified Plans:   </span>
                <span className="text-base font-bold text-foreground ml-2">{stats.totalCount}</span>
              </CardContent>
            </Card>

            <Card className="bg-muted/20 border-dashed shadow-none">
              <CardContent className="p-1 flex items-center justify-center">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Target Bags (This Page):   </span>
                <span className="text-base font-bold text-blue-600/80 ml-2">{stats.pageBags}</span>
              </CardContent>
            </Card>

            <Card className="bg-muted/20 border-dashed shadow-none">
              <CardContent className="p-1 flex items-center justify-center">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Site Visits (This Page):   </span>
                <span className="text-base font-bold text-orange-600/80 ml-2">{stats.pageSites}</span>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* --- Filters --- */}
        <div className="flex flex-wrap gap-4 p-5 rounded-xl bg-card border shadow-sm items-end">
          <div className="flex flex-col space-y-1.5 w-full md:w-[250px]">
            <label className="text-xs font-bold text-muted-foreground uppercase">Search Plans</label>
            <Input placeholder="Salesman or area..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-background" />
          </div>
          
          <div className="flex flex-col space-y-1.5 w-full sm:w-[300px]">
            <label className="text-xs font-bold text-muted-foreground uppercase">Filter by Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 bg-background", !dateRange && "text-muted-foreground")}>
                  <IconCalendar className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                    ) : (format(dateRange.from, "LLL dd, y"))
                  ) : (
                    <span>Select Date Range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" defaultMonth={dateRange?.from || new Date()} selected={dateRange} onSelect={(range) => setDateRange(range)} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col space-y-1.5 w-[220px]">
            <label className="text-xs font-bold text-muted-foreground uppercase">Salesman</label>
            <Select value={selectedSalesmanFilter} onValueChange={setSelectedSalesmanFilter}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Salesmen</SelectItem>
                {salesmen.map(s => <SelectItem key={s.id} value={s.id.toString()}>{`${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-1.5 w-40">
            <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
            <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" className="text-muted-foreground" onClick={() => { setSearchQuery(""); setSelectedSalesmanFilter("all"); setSelectedStatusFilter("all"); setDateRange(undefined); }}>Clear</Button>
        </div>

        <div className="bg-card p-1 rounded-lg border shadow-sm">
          {loading && pjps.length === 0 ? (
             <div className="flex justify-center items-center h-64">
               <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
               <p className="text-muted-foreground">Loading PJPs...</p>
             </div>
          ) : pjps.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
               No Permanent Journey Plans found matching the selected filters.
            </div>
          ) : (
            <DataTableReusable columns={columns} data={pjps} enableRowDragging={false} onRowOrderChange={() => {}} />
          )}
        </div>
      </div>

      {/* --- Smart Details Modal --- */}
      {selectedPjp && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">
            <div className="px-6 py-4 border-b bg-muted/30 border-l-[6px] border-l-primary">
              <DialogTitle className="text-xl flex items-center justify-between">
                <span>PJP Details</span>
                <Badge className="text-xs uppercase">{selectedPjp.status}</Badge>
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1"><User className="w-3 h-3 text-primary" /> {selectedPjp.salesmanName}</span>
                <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3 text-primary" /> {selectedPjp.planDate}</span>
              </DialogDescription>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-primary/5 border-primary/10">
                  <CardHeader className="p-3 border-b border-dashed"><CardTitle className="text-xs uppercase flex items-center gap-2"><MapPin className="w-3 h-3" /> Visit Location</CardTitle></CardHeader>
                  <CardContent className="p-3 space-y-3">
                    <InfoField label="Area" value={selectedPjp.areaToBeVisited} />
                    <InfoField label="Visiting Entity" value={selectedPjp.visitDealerName} />
                    <InfoField label="Planned Route" value={selectedPjp.route} icon={Route} />
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/10">
                  <CardHeader className="p-3 border-b border-dashed"><CardTitle className="text-xs uppercase flex items-center gap-2"><Target className="w-3 h-3" /> Planned Targets</CardTitle></CardHeader>
                  <CardContent className="p-3 grid grid-cols-2 gap-3">
                    <InfoField label="New Sites" value={selectedPjp.plannedNewSiteVisits} />
                    <InfoField label="Follow-ups" value={selectedPjp.plannedFollowUpSiteVisits} />
                    <InfoField label="New Dealers" value={selectedPjp.plannedNewDealerVisits} />
                    <InfoField label="Influencers" value={selectedPjp.plannedInfluencerVisits} />
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-primary/5 border-primary/10">
                <CardContent className="p-4 grid grid-cols-2 gap-4">
                  <InfoField label="Conversion Target (Bags)" value={`${selectedPjp.noofConvertedBags} Bags`} icon={Target} />
                  <InfoField label="Scheme Enrolments" value={selectedPjp.noofMasonpcInSchemes} icon={Users} />
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/10">
                <CardHeader className="p-3 border-b border-orange-100"><CardTitle className="text-xs uppercase font-bold text-orange-800">Specific Influencer Plan</CardTitle></CardHeader>
                <CardContent className="p-4 grid grid-cols-3 gap-3">
                  <InfoField label="Contact Name" value={selectedPjp.influencerName} />
                  <InfoField label="Phone" value={selectedPjp.influencerPhone} />
                  <InfoField label="Activity" value={selectedPjp.activityType} />
                </CardContent>
              </Card>

              <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Created By</p>
                  <p className="text-sm font-semibold">{selectedPjp.createdByName} <span className="text-muted-foreground font-normal">({selectedPjp.createdByRole})</span></p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Verification Status</p>
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">{selectedPjp.verificationStatus}</Badge>
                </div>
              </div>

              {selectedPjp.description && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Salesman Description</Label>
                  <div className="p-3 bg-secondary/20 rounded-md text-sm italic">"{selectedPjp.description}"</div>
                </div>
              )}
            </div>

            <DialogFooter className="p-4 bg-muted/20 border-t">
              <Button onClick={() => setIsViewModalOpen(false)}>Close View</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}