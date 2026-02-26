// src/app/dashboard/assignTasks/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ColumnDef } from '@tanstack/react-table';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

// Icons
import { Eye, MapPin, User, Calendar as CalendarIcon, Target, Route, Phone, ClipboardList, Clock, Hash } from 'lucide-react';
import { IconCalendar } from "@tabler/icons-react";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DataTableReusable } from '@/components/data-table-reusable';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Types & Schemas
import { selectDailyTaskSchema } from '../../../../drizzle/zodSchemas';
import { z } from "zod";
import { AssignTasksDialog } from "@/components/assign-tasks-dialog";

type Salesman = { id: number; firstName: string | null; lastName: string | null; email: string; salesmanLoginId: string | null; area: string | null; region: string | null; };
type DailyTaskRecord = z.infer<typeof selectDailyTaskSchema> & { salesmanName?: string; relatedDealerName?: string; assignedByUserName?: string };

// Reusable Info Field
const InfoField = ({ label, value, icon: Icon, fullWidth = false }: { label: string, value: React.ReactNode, icon?: any, fullWidth?: boolean }) => (
  <div className={`flex flex-col space-y-1.5 ${fullWidth ? 'col-span-2' : ''}`}>
    <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 tracking-wider">{Icon && <Icon className="w-3 h-3" />}{label}</Label>
    <div className="text-sm font-medium p-2.5 bg-secondary/30 rounded-md border border-border/50 min-h-10 flex items-center wrap-break-word">{value || <span className="text-muted-foreground italic text-xs">N/A</span>}</div>
  </div>
);

export default function AssignTasksPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [tasks, setTasks] = useState<DailyTaskRecord[]>([]);
  const [uniqueZones, setUniqueZones] = useState<string[]>([]);
  const [uniqueAreas, setUniqueAreas] = useState<string[]>([]);

  // Table Filter State
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [tableDateRange, setTableDateRange] = useState<DateRange | undefined>();
  const [tableSelectedZone, setTableSelectedZone] = useState<string>("all");
  const [tableSelectedArea, setTableSelectedArea] = useState<string>("all");
  const [tableSelectedSalesman, setTableSelectedSalesman] = useState<string>("all");
  const [tableSelectedStatus, setTableSelectedStatus] = useState<string>("all");

  // Modal State
  const [selectedTask, setSelectedTask] = useState<DailyTaskRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const apiURI = `/api/dashboardPagesAPI/assign-tasks`;

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiURI);
      if (!response.ok) throw new Error("Failed to fetch initial data");
      const data = await response.json();
      setSalesmen(data.salesmen || []);
      setUniqueZones(data.uniqueZones || []);
      setUniqueAreas(data.uniqueAreas || []);
      setTasks(data.tasks || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiURI]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  // Table Filtering Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = (task.salesmanName || '').toLowerCase().includes(tableSearchQuery.toLowerCase()) || (task.relatedDealerName || '').toLowerCase().includes(tableSearchQuery.toLowerCase());
      const matchesZone = tableSelectedZone === 'all' || task.zone === tableSelectedZone;
      const matchesArea = tableSelectedArea === 'all' || task.area === tableSelectedArea;
      const matchesSalesman = tableSelectedSalesman === 'all' || task.salesmanName === tableSelectedSalesman;
      const matchesStatus = tableSelectedStatus === 'all' || task.status === tableSelectedStatus;

      let matchesDate = true;
      if (tableDateRange && tableDateRange.from && task.taskDate) {
        const taskDateObj = new Date(task.taskDate);
        const fromDate = new Date(tableDateRange.from);
        const toDate = tableDateRange.to ? new Date(tableDateRange.to) : new Date(tableDateRange.from);
        taskDateObj.setHours(0, 0, 0, 0); fromDate.setHours(0, 0, 0, 0); toDate.setHours(23, 59, 59, 999);
        matchesDate = taskDateObj >= fromDate && taskDateObj <= toDate;
      }
      return matchesSearch && matchesZone && matchesArea && matchesSalesman && matchesStatus && matchesDate;
    });
  }, [tasks, tableSearchQuery, tableSelectedZone, tableSelectedArea, tableSelectedSalesman, tableSelectedStatus, tableDateRange]);

  const taskColumns: ColumnDef<DailyTaskRecord>[] = [
    { accessorKey: 'salesmanName', header: 'Salesman' },
    { accessorKey: 'taskDate', header: 'Date', cell: ({ row }) => { const dateStr = row.original.taskDate; return dateStr ? format(new Date(dateStr), "MMM dd, yyyy") : "N/A"; } },
    { accessorKey: 'relatedDealerName', header: 'Dealer', cell: ({ row }) => (<div className="flex flex-col"><span className="font-medium text-sm">{row.original.relatedDealerName || "N/A"}</span>{(row.original.zone || row.original.area) && (<span className="text-[10px] text-muted-foreground">{[row.original.area, row.original.zone].filter(Boolean).join(", ")}</span>)}</div>) },
    { accessorKey: 'visitType', header: 'Type', cell: ({ row }) => <span className="text-xs">{row.original.visitType || "N/A"}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => { const status = row.original.status || "Assigned"; if (status === 'Completed' || status === 'COMPLETED') { return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shadow-none">{status}</Badge>; } return <Badge variant="secondary" className="shadow-none">{status}</Badge>; } },
    { id: "actions", header: "View", cell: ({ row }) => (<Button variant="outline" size="sm" className="h-8 px-2" onClick={() => { setSelectedTask(row.original); setIsViewModalOpen(true); }}><Eye className="h-4 w-4 mr-1" /> View</Button>) }
  ];

  if (loading) return <div className="p-10 text-center">Loading Data...</div>;

  return (
    <div className="container mx-auto p-4 flex flex-col min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Weekly Sales PJPs</h1>
        {/* <Button onClick={() => setIsFormOpen(true)}>+ New PJP Assignment</Button> */}
      </div>

      {/* <AssignTasksDialog 
        isOpen={isFormOpen} 
        setIsOpen={setIsFormOpen} 
        salesmen={salesmen} 
        uniqueZones={uniqueZones} 
        uniqueAreas={uniqueAreas} 
        onSuccess={fetchInitialData} 
      /> */}

      {/* --- Filters Section --- */}
      <div className="flex flex-wrap gap-4 p-5 rounded-xl bg-card border shadow-sm items-end mt-2">
        <div className="flex flex-col space-y-1.5 w-full md:w-[220px]">
          <Label className="text-xs font-bold text-muted-foreground uppercase">Search Tasks</Label>
          <Input placeholder="Salesman or dealer..." value={tableSearchQuery} onChange={(e) => setTableSearchQuery(e.target.value)} />
        </div>
        <div className="flex flex-col space-y-1.5 w-full sm:w-[260px]">
          <Label className="text-xs font-bold text-muted-foreground uppercase">Filter by Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9", !tableDateRange && "text-muted-foreground")}><IconCalendar className="mr-2 h-4 w-4" />{tableDateRange?.from ? (tableDateRange.to ? (<>{format(tableDateRange.from, "LLL dd, y")} - {format(tableDateRange.to, "LLL dd, y")}</>) : (format(tableDateRange.from, "LLL dd, y"))) : (<span>Select Date Range</span>)}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" defaultMonth={tableDateRange?.from || new Date()} selected={tableDateRange} onSelect={setTableDateRange} numberOfMonths={2} /></PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col space-y-1.5 w-[140px]">
          <Label className="text-xs font-bold text-muted-foreground uppercase">Zone</Label>
          <Select value={tableSelectedZone} onValueChange={(val) => { setTableSelectedZone(val); setTableSelectedArea("all"); }}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Zones</SelectItem>{Array.from(new Set(tasks.map(t => t.zone).filter(Boolean))).sort().map(z => (<SelectItem key={z as string} value={z as string}>{z}</SelectItem>))}</SelectContent></Select>
        </div>
        <div className="flex flex-col space-y-1.5 w-[140px]">
          <Label className="text-xs font-bold text-muted-foreground uppercase">Area</Label>
          <Select value={tableSelectedArea} onValueChange={setTableSelectedArea}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Areas</SelectItem>{Array.from(new Set(tasks.map(t => t.area).filter(Boolean))).sort().map(a => (<SelectItem key={a as string} value={a as string}>{a}</SelectItem>))}</SelectContent></Select>
        </div>
        <div className="flex flex-col space-y-1.5 w-40">
          <Label className="text-xs font-bold text-muted-foreground uppercase">Salesman</Label>
          <Select value={tableSelectedSalesman} onValueChange={setTableSelectedSalesman}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Salesmen</SelectItem>{Array.from(new Set(tasks.map(t => t.salesmanName).filter(Boolean))).sort().map(s => (<SelectItem key={s as string} value={s as string}>{s}</SelectItem>))}</SelectContent></Select>
        </div>
        <div className="flex flex-col space-y-1.5 w-[140px]">
          <Label className="text-xs font-bold text-muted-foreground uppercase">Status</Label>
          <Select value={tableSelectedStatus} onValueChange={setTableSelectedStatus}><SelectTrigger><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{Array.from(new Set(tasks.map(t => t.status).filter(Boolean))).sort().map(st => (<SelectItem key={st as string} value={st as string}>{st}</SelectItem>))}</SelectContent></Select>
        </div>
        <Button variant="ghost" className="text-muted-foreground" onClick={() => { setTableSearchQuery(""); setTableDateRange(undefined); setTableSelectedZone("all"); setTableSelectedArea("all"); setTableSelectedSalesman("all"); setTableSelectedStatus("all"); }}>Clear</Button>
      </div>

      <div className="bg-card rounded-lg border mt-6 flex-1">
        <DataTableReusable columns={taskColumns} data={filteredTasks} enableRowDragging={false} onRowOrderChange={() => { }} />
      </div>

      {/* --- View Modal --- */}
      {selectedTask && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto p-0 gap-0">
            <div className="px-6 py-4 border-b bg-muted/30 border-l-[6px] border-l-primary">
              <DialogTitle className="text-xl flex items-center justify-between">
                <span>Task Details</span>
                <Badge className="text-xs uppercase" variant={selectedTask.status === 'COMPLETED' || selectedTask.status === 'Completed' ? 'default' : 'secondary'}>{selectedTask.status}</Badge>
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1"><User className="w-3 h-3 text-primary" /> {selectedTask.salesmanName}</span>
                <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3 text-primary" /> {selectedTask.taskDate ? format(new Date(selectedTask.taskDate), "MMM dd, yyyy") : "N/A"}</span>
              </DialogDescription>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
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
                <CardHeader className="p-3 border-b border-orange-100"><CardTitle className="text-xs uppercase font-bold">Dealer Information</CardTitle></CardHeader>
                <CardContent className="p-4 grid grid-cols-3 gap-4">
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