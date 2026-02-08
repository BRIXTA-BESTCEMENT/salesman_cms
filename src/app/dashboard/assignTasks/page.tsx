// src/app/dashboard/assignTasks/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ColumnDef } from '@tanstack/react-table';
import { DateRange } from "react-day-picker";
import { format, addDays } from "date-fns";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MultiSelect } from "@/components/multi-select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconCalendar, IconCheck, IconX } from "@tabler/icons-react"; // Added icons
import { DataTableReusable } from '@/components/data-table-reusable';
import { dailyTaskSchema } from "@/lib/shared-zod-schema";
import { z } from "zod";

// Types
type Salesman = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  salesmanLoginId: string | null;
  area: string | null;
  region: string | null;
};

type Dealer = {
  id: string;
  name: string;
  type: string;
  area: string | null;
  region: string | null;
};

type DailyTaskRecord = z.infer<typeof dailyTaskSchema>;

export default function AssignTasksPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [tasks, setTasks] = useState<DailyTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Form State ---
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 6),
  });
  
  // New Filter States
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  
  const [selectedDealers, setSelectedDealers] = useState<string[]>([]);

  const apiURI = `/api/dashboardPagesAPI/assign-tasks`;

  // --- 1. Fetch Data ---
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiURI);
      if (!response.ok) throw new Error("Failed to fetch data");
      const data = await response.json();
      
      setSalesmen(data.salesmen || []);
      setDealers(data.dealers || []);
      setTasks(data.tasks || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiURI]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- 2. Derived Lists (Unique Zones/Areas) ---
  const uniqueZones = useMemo(() => {
    const zones = dealers.map(d => d.region).filter(Boolean) as string[];
    return Array.from(new Set(zones)).sort();
  }, [dealers]);

  const uniqueAreas = useMemo(() => {
    let filtered = dealers;
    if (selectedZone !== "all") {
      filtered = dealers.filter(d => d.region === selectedZone);
    }
    const areas = filtered.map(d => d.area).filter(Boolean) as string[];
    return Array.from(new Set(areas)).sort();
  }, [dealers, selectedZone]);

  // --- 3. Filter Logic ---
  // Auto-fill Zone/Area when Salesman is selected
  useEffect(() => {
    if (selectedSalesmanId) {
      const s = salesmen.find(user => user.id.toString() === selectedSalesmanId);
      if (s) {
        if (s.region && uniqueZones.includes(s.region)) setSelectedZone(s.region);
        else setSelectedZone("all");
        
        // Short timeout to let Zone update before setting Area (optional but safer for UI)
        setTimeout(() => {
          if (s.area) setSelectedArea(s.area);
          else setSelectedArea("all");
        }, 0);
      }
    }
  }, [selectedSalesmanId, salesmen, uniqueZones]);

  // Filter Dealers based on Dropdowns
  const filteredDealers = useMemo(() => {
    return dealers.filter(d => {
      const zoneMatch = selectedZone === "all" || d.region === selectedZone;
      const areaMatch = selectedArea === "all" || d.area === selectedArea;
      return zoneMatch && areaMatch;
    });
  }, [dealers, selectedZone, selectedArea]);

  // --- 4. Select All Logic ---
  const handleSelectAll = () => {
    const allIds = filteredDealers.map(d => d.id);
    // If all are already selected, deselect all. Otherwise, select all.
    const isAllSelected = allIds.every(id => selectedDealers.includes(id));
    
    if (isAllSelected) {
      setSelectedDealers([]);
    } else {
      setSelectedDealers(allIds);
    }
  };

  // --- 5. Submit Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalesmanId) { toast.error("Please select a salesman."); return; }
    if (!dateRange?.from || !dateRange?.to) { toast.error("Please select a date range."); return; }
    if (selectedDealers.length === 0) { toast.error("Please select at least one dealer."); return; }

    setIsSubmitting(true);
    try {
      const payload = {
        salesmanId: parseInt(selectedSalesmanId),
        dateRange: {
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
        },
        dealerIds: selectedDealers
      };

      const response = await fetch(apiURI, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to assign PJP/tasks");

      const resData = await response.json();
      toast.success(resData.message || "PJP/Tasks assigned!");
      setIsFormOpen(false);
      fetchAllData();

      // Reset
      setSelectedSalesmanId("");
      setSelectedDealers([]);
      setSelectedZone("all");
      setSelectedArea("all");
      setDateRange(undefined);

    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const taskColumns: ColumnDef<DailyTaskRecord>[] = [
    { accessorKey: 'salesmanName', header: 'Salesman' },
    { accessorKey: 'taskDate', header: 'Date' },
    { accessorKey: 'relatedDealerName', header: 'Dealer' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'assignedByUserName', header: 'Assigned By' },
  ];

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Assign Weekly PJP/Tasks</h1>
        <Button onClick={() => setIsFormOpen(true)}>+ New PJP Assignment</Button>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Setup Weekly Plan</DialogTitle>
            <DialogDescription>
              Assign pjp/tasks by selecting a salesman, defining the region, and choosing dealers.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="grid gap-5 py-2">
            
            {/* 1. Salesman */}
            <div className="grid gap-2">
              <Label>Salesman</Label>
              <Select value={selectedSalesmanId} onValueChange={setSelectedSalesmanId}>
                <SelectTrigger><SelectValue placeholder="Select salesman..." /></SelectTrigger>
                <SelectContent>
                  {salesmen.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.firstName} {s.lastName} ({s.salesmanLoginId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Date Range */}
            <div className="grid gap-2">
              <Label>Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={`w-full justify-start text-left font-normal ${!dateRange && "text-muted-foreground"}`}>
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}` : format(dateRange.from, "LLL dd, y")
                    ) : <span>Pick a date range</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                </PopoverContent>
              </Popover>
            </div>

            {/* 3. Filters (Zone & Area) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Zone (Region)</Label>
                <Select 
                  value={selectedZone} 
                  onValueChange={(val) => {
                    setSelectedZone(val);
                    setSelectedArea("all"); // Reset area when zone changes
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Filter Zone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Zones</SelectItem>
                    {uniqueZones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Area</Label>
                <Select value={selectedArea} onValueChange={setSelectedArea}>
                  <SelectTrigger><SelectValue placeholder="Filter Area" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Areas</SelectItem>
                    {uniqueAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 4. Dealers & Select All */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Select Dealers ({filteredDealers.length} found)</Label>
                {filteredDealers.length > 0 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs text-primary"
                    onClick={handleSelectAll}
                  >
                    {filteredDealers.every(d => selectedDealers.includes(d.id)) ? (
                      <span className="flex items-center"><IconX className="w-3 h-3 mr-1"/> Deselect All</span>
                    ) : (
                      <span className="flex items-center"><IconCheck className="w-3 h-3 mr-1"/> Select All</span>
                    )}
                  </Button>
                )}
              </div>
              
              <MultiSelect
                options={filteredDealers.map(d => ({
                  label: d.name,
                  value: d.id,
                }))}
                selectedValues={selectedDealers}
                onValueChange={setSelectedDealers}
                placeholder={selectedZone === 'all' && selectedArea === 'all' 
                  ? "Search all dealers..." 
                  : "Search filtered dealers..."}
              />
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Plan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-lg border mt-6">
        <DataTableReusable columns={taskColumns} data={tasks} enableRowDragging={false} onRowOrderChange={() => {}} />
      </div>
    </div>
  );
}