// src/app/dashboard/assignTasks/tasks.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ColumnDef } from '@tanstack/react-table';
import { DateRange } from "react-day-picker";
import { format, parseISO } from "date-fns";

// Icons
import { Eye, MapPin, User, Calendar as CalendarIcon, Target, Route, Phone, ClipboardList, Clock, Hash, Loader2 } from 'lucide-react';

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Standard Components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search'; 
import { AssignTasksDialog } from "@/app/dashboard/assignTasks/assign-tasks-dialog";

// Types & Schemas
import { selectDailyTaskSchema } from '../../../../drizzle/zodSchemas';
import { z } from "zod";

type Salesman = { id: number; firstName: string | null; lastName: string | null; email: string; salesmanLoginId: string | null; area: string | null; region: string | null; };
type DailyTaskRecord = z.infer<typeof selectDailyTaskSchema> & { salesmanName?: string; relatedDealerName?: string; assignedByUserName?: string };

const InfoField = ({ label, value, icon: Icon, fullWidth = false }: { label: string, value: React.ReactNode, icon?: any, fullWidth?: boolean }) => (
  <div className={`flex flex-col space-y-1.5 ${fullWidth ? 'col-span-2' : ''}`}>
    <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 tracking-wider">{Icon && <Icon className="w-3 h-3" />}{label}</Label>
    <div className="text-sm font-medium p-2.5 bg-secondary/30 rounded-md border border-border/50 min-h-10 flex items-center wrap-break-word">{value || <span className="text-muted-foreground italic text-xs">N/A</span>}</div>
  </div>
);

export default function TasksListPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Data States
  const [tasks, setTasks] = useState<DailyTaskRecord[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Pagination & Loading
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // Modal State
  const [selectedTask, setSelectedTask] = useState<DailyTaskRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const apiURI = `/api/dashboardPagesAPI/assign-tasks`;

  // Reset page when any filter changes
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, zoneFilters, areaFilters, statusFilter, dateRange]);

  const fetchFilters = useCallback(async () => {
    try {
      const response = await fetch(`${apiURI}?action=fetch_filters`);
      if (response.ok) {
        const data = await response.json();
        setSalesmen(data.salesmen || []);
        setAvailableZones(data.uniqueZones || []);
        setAvailableAreas(data.uniqueAreas || []);
        setAvailableStatuses(data.uniqueStatuses || []);
      }
    } catch (e) {
      console.error("Failed to load task filters", e);
    }
  }, [apiURI]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(apiURI, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (zoneFilters.length > 0) url.searchParams.append('zone', zoneFilters.join(','));
      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
      if (statusFilter !== 'all') url.searchParams.append('status', statusFilter);
      
      if (dateRange?.from) url.searchParams.append('fromDate', format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange?.to) {
        url.searchParams.append('toDate', format(dateRange.to, "yyyy-MM-dd"));
      } else if (dateRange?.from) {
        url.searchParams.append('toDate', format(dateRange.from, "yyyy-MM-dd"));
      }

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Failed to fetch tasks");
      
      const result = await response.json();
      setTasks(result.data || []);
      setTotalCount(result.totalCount || 0);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiURI, page, pageSize, debouncedSearchQuery, zoneFilters, areaFilters, statusFilter, dateRange]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const zoneOptions = useMemo(() => availableZones.sort().map(z => ({ label: z, value: z })), [availableZones]);
  const areaOptions = useMemo(() => availableAreas.sort().map(a => ({ label: a, value: a })), [availableAreas]);
  const statusOptions = useMemo(() => [
    { label: 'All Statuses', value: 'all' },
    ...availableStatuses.map(st => ({ label: st, value: st }))
  ], [availableStatuses]);

  const taskColumns: ColumnDef<DailyTaskRecord>[] = [
    { accessorKey: 'salesmanName', header: 'Salesman' },
    { 
      accessorKey: 'taskDate', 
      header: 'Date', 
      cell: ({ row }) => { 
        const dateStr = row.original.taskDate; 
        if (!dateStr) return "N/A";
        return format(parseISO(dateStr), "dd-MM-yyyy"); 
      } 
    },
    { 
      accessorKey: 'relatedDealerName', 
      header: 'Visiting', 
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.original.relatedDealerName || "N/A"}</span>
          {(row.original.zone || row.original.area) && (
            <span className="text-[10px] text-muted-foreground">
              {[row.original.area, row.original.zone].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
      ) 
    },
    { 
      accessorKey: 'visitType', 
      header: 'Type', 
      cell: ({ row }) => <span className="text-xs">{row.original.visitType || "N/A"}</span> 
    },
    { 
      accessorKey: 'status', 
      header: 'Status', 
      cell: ({ row }) => { 
        const status = row.original.status || "Assigned"; 
        const upperStatus = status.toUpperCase();

        if (upperStatus === 'COMPLETED') { 
          return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shadow-none tracking-wide">{status}</Badge>; 
        }
        if (upperStatus === 'APPROVED' || upperStatus === 'VERIFIED') { 
          return <Badge className="bg-green-100 text-green-800 border-green-200 shadow-none tracking-wide">{status}</Badge>; 
        }
        if (upperStatus === 'ASSIGNED') { 
          return <Badge className="bg-blue-100 text-blue-800 border-blue-200 shadow-none tracking-wide">{status}</Badge>; 
        }

        return <Badge variant="secondary" className="shadow-none tracking-wide">{status}</Badge>; 
      } 
    },
    { 
      id: "actions", 
      header: "View", 
      cell: ({ row }) => (
        <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => { setSelectedTask(row.original); setIsViewModalOpen(true); }}>
          <Eye className="h-4 w-4 mr-1" /> View
        </Button>
      ) 
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold tracking-tight">Weekly Sales PJPs</h1>
              <Badge variant="outline" className="text-base px-4 py-1">Total Pjps: {totalCount}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <RefreshDataButton cachePrefix="assign-tasks" onRefresh={fetchTasks} />
          </div>
        </div>

        <AssignTasksDialog 
          isOpen={isFormOpen} 
          setIsOpen={setIsFormOpen} 
          salesmen={salesmen} 
          uniqueZones={availableZones} 
          uniqueAreas={availableAreas} 
          onSuccess={fetchTasks} 
        /> 

        <div className="w-full">
          <GlobalFilterBar 
            showSearch={true}
            showDateRange={true}
            showZone={true}
            showArea={true}
            showRole={false} // Hidden: Dropdown not required as Search handles salesman
            showStatus={true} 

            searchVal={searchQuery}
            dateRangeVal={dateRange}
            zoneVals={zoneFilters}
            areaVals={areaFilters}
            statusVal={statusFilter}

            zoneOptions={zoneOptions}
            areaOptions={areaOptions}
            statusOptions={statusOptions}

            onSearchChange={setSearchQuery}
            onDateRangeChange={setDateRange}
            onZoneChange={setZoneFilters}
            onAreaChange={setAreaFilters}
            onStatusChange={setStatusFilter}
          />
        </div>

        <div className="bg-card p-1 rounded-lg border shadow-sm flex-1">
          {loading && tasks.length === 0 ? (
            <div className="flex justify-center items-center h-64">
               <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
               <p className="text-muted-foreground">Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
               No tasks found matching the selected filters.
            </div>
          ) : (
            <DataTableReusable columns={taskColumns} data={tasks} enableRowDragging={false} onRowOrderChange={() => { }} />
          )}
        </div>
      </div>

      {selectedTask && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">
            <div className="px-6 py-4 border-b bg-muted/30 border-l-[6px] border-l-primary">
              <DialogTitle className="text-xl flex items-center justify-between">
                <span>Task Details</span>
                <Badge className="text-xs uppercase" variant={selectedTask.status?.toUpperCase() === 'COMPLETED' ? 'default' : 'secondary'}>{selectedTask.status}</Badge>
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1"><User className="w-3 h-3 text-primary" /> {selectedTask.salesmanName}</span>
                {/* MODIFIED: Formatting to DD-MM-YYYY */}
                <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3 text-primary" /> {selectedTask.taskDate ? format(parseISO(selectedTask.taskDate), "dd-MM-yyyy") : "N/A"}</span>
              </DialogDescription>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-primary/5 border-primary/10">
                  <CardHeader className="p-3 border-b border-dashed"><CardTitle className="text-xs uppercase flex items-center gap-2"><MapPin className="w-3 h-3" /> Visit Location</CardTitle></CardHeader>
                  <CardContent className="p-3 space-y-3">
                    <InfoField label="Zone" value={selectedTask.zone} />
                    <InfoField label="Area" value={selectedTask.area} />
                    <InfoField label="Planned Route" value={selectedTask.route} icon={Route} />
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/10">
                  <CardHeader className="p-3 border-b border-dashed"><CardTitle className="text-xs uppercase flex items-center gap-2"><Target className="w-3 h-3" /> Task Focus</CardTitle></CardHeader>
                  <CardContent className="p-3 space-y-3">
                    <InfoField label="Visit Type" value={selectedTask.visitType} />
                    <InfoField label="Required Count" value={selectedTask.requiredVisitCount?.toString()} />
                    <InfoField label="Objective" value={selectedTask.objective} icon={ClipboardList} />
                  </CardContent>
                </Card>
              </div>
              <Card className="bg-primary/5 border-primary/10">
                <CardHeader className="p-3 border-b border-orange-100"><CardTitle className="text-xs uppercase font-bold text-orange-800">Dealer Information</CardTitle></CardHeader>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoField label="Dealer Name" value={selectedTask.relatedDealerName || selectedTask.dealerNameSnapshot} />
                  <InfoField label="Dealer Mobile" value={selectedTask.dealerMobile} icon={Phone} />
                </CardContent>
              </Card>
              <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1"><Hash className="w-3 h-3" /> Batch & Tracking</p>
                  <div className="flex gap-4"><span><strong>Batch:</strong> {selectedTask.pjpBatchId || "Manual"}</span><span><strong>Week:</strong> {selectedTask.week || "N/A"}</span></div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> Timestamps</p>
                  <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                    <span>Created: {selectedTask.createdAt ? format(new Date(selectedTask.createdAt), "PP pp") : "N/A"}</span>
                    <span>Updated: {selectedTask.updatedAt ? format(new Date(selectedTask.updatedAt), "PP pp") : "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-4 bg-muted/20 border-t"><Button onClick={() => setIsViewModalOpen(false)}>Close View</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}