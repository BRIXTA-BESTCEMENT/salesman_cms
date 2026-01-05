// src/app/dashboard/permanentJourneyPlan/pjpList.tsx
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Eye,
  MapPin,
  User,
  Calendar as CalendarIcon,
  Target,
  Users,
  Route,
  ClipboardList
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Reusable Components
import { cn } from '@/lib/utils';
import { DataTableReusable } from '@/components/data-table-reusable';
import { permanentJourneyPlanSchema } from '@/lib/shared-zod-schema';

type PermanentJourneyPlan = z.infer<typeof permanentJourneyPlanSchema>;

// --- REUSABLE READ-ONLY FIELD ---
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

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [selectedStatusFilter, setSelectedStatusFilter] = React.useState<string>('all');
  const [selectedSalesmanFilter, setSelectedSalesmanFilter] = React.useState<string>('all');

  // Modal State
  const [selectedPjp, setSelectedPjp] = React.useState<PermanentJourneyPlan | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false);

  const fetchPjps = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboardPagesAPI/permanent-journey-plan?verificationStatus=VERIFIED`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: any[] = await response.json();
      const validatedData = data.map((item) => {
        const validated = permanentJourneyPlanSchema.parse(item);
        return { ...validated, id: validated.id.toString() };
      });
      setPjps(validatedData);
    } catch (e: any) {
      setError(e.message);
      toast.error("Failed to load Permanent Journey Plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchPjps(); }, [fetchPjps]);

  // Summary Stats
  const stats = React.useMemo(() => {
    return {
      totalPlans: pjps.length,
      totalBags: pjps.reduce((acc, curr) => acc + (curr.noOfConvertedBags || 0), 0),
      totalSites: pjps.reduce((acc, curr) => acc + (curr.plannedNewSiteVisits || 0) + (curr.plannedFollowUpSiteVisits || 0), 0)
    };
  }, [pjps]);

  const filteredPjps = React.useMemo(() => {
    return pjps.filter((pjp) => {
      const matchesSearch = (pjp.salesmanName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pjp.areaToBeVisited || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatusFilter === 'all' || pjp.status === selectedStatusFilter;
      const matchesSalesman = selectedSalesmanFilter === 'all' || pjp.salesmanName === selectedSalesmanFilter;
      return matchesSearch && matchesStatus && matchesSalesman;
    });
  }, [pjps, searchQuery, selectedStatusFilter, selectedSalesmanFilter]);

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

        // Logic for dynamic badge styling
        if (status === 'VERIFIED') {
          return (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-none">
              {status}
            </Badge>
          );
        }

        if (status === 'COMPLETED') {
          return (
            <Badge variant="default" className="shadow-none">
              {status}
            </Badge>
          );
        }

        return (
          <Badge variant="secondary" className="shadow-none">
            {status}
          </Badge>
        );
      }
    },
    {
      id: "actions",
      header: "View",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => {
            setSelectedPjp(row.original);
            setIsViewModalOpen(true);
          }}
        >
          <Eye className="h-4 w-4 mr-1" /> View
        </Button>
      ),
    },
  ];

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">

        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Verified Journey Plans</h2>
        </div>

        {/* --- Summary Cards --- */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Total Verified Plans</CardTitle>
              <ClipboardList className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.totalPlans}</div></CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Total Target Bags</CardTitle>
              <Target className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-600">{stats.totalBags}</div></CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Planned Site Visits</CardTitle>
              <MapPin className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-orange-600">{stats.totalSites}</div></CardContent>
          </Card>
        </div>

        {/* --- Filters --- */}
        <div className="flex flex-wrap gap-4 p-5 rounded-xl bg-card border shadow-sm items-end">
          <div className="flex flex-col space-y-1.5 w-full md:w-[250px]">
            <label className="text-xs font-bold text-muted-foreground uppercase">Search Plans</label>
            <Input placeholder="Salesman or area..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          {/* 1. Date Range Picker */}
            <div className="flex flex-col space-y-1.5 w-full sm:w-[300px]">
              <label className="text-xs font-bold text-muted-foreground uppercase">Filter by Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-9",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
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
                  <Calendar
                    mode="range"
                    defaultMonth={dateRange?.from || new Date()}
                    selected={dateRange}
                    onSelect={(range) => setDateRange(range)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          <div className="flex flex-col space-y-1.5 w-[180px]">
            <label className="text-xs font-bold text-muted-foreground uppercase">Salesman</label>
            <Select value={selectedSalesmanFilter} onValueChange={setSelectedSalesmanFilter}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Salesmen</SelectItem>
                {Array.from(new Set(pjps.map(p => p.salesmanName))).map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" className="text-muted-foreground" onClick={() => { setSearchQuery(""); setSelectedSalesmanFilter("all"); }}>Clear</Button>
        </div>

        <div className="bg-card p-4 rounded-lg border shadow-sm">
          <DataTableReusable columns={columns} data={filteredPjps} />
        </div>
      </div>

      {/* --- Smart Details Modal --- */}
      {selectedPjp && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto p-0 gap-0">
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
              {/* 1. Logistics Section */}
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

              {/* 2. Business Values */}
              <Card className="bg-primary/5 border-primary/10">
                <CardContent className="p-4 grid grid-cols-2 gap-4">
                  <InfoField label="Conversion Target (Bags)" value={`${selectedPjp.noOfConvertedBags} Bags`} icon={Target} />
                  <InfoField label="Scheme Enrolments" value={selectedPjp.noOfMasonPcSchemes} icon={Users} />
                </CardContent>
              </Card>

              {/* 3. Influencer Plan Details */}
              <Card className="bg-primary/5 border-primary/10">
                <CardHeader className="p-3 border-b border-orange-100"><CardTitle className="text-xs uppercase font-bold text-white">Specific Influencer Plan</CardTitle></CardHeader>
                <CardContent className="p-4 grid grid-cols-3 gap-3">
                  <InfoField label="Contact Name" value={selectedPjp.influencerName} />
                  <InfoField label="Phone" value={selectedPjp.influencerPhone} />
                  <InfoField label="Activity" value={selectedPjp.activityType} />
                </CardContent>
              </Card>

              {/* 4. Creator Info */}
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