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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/multi-select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconCalendar, IconCheck, IconX, IconSearch, IconLoader3 } from "@tabler/icons-react";
import { DataTableReusable } from '@/components/data-table-reusable';

// Note: Ensure your local dailyTaskSchema matches the new schema if you are validating here.
import { selectDailyTaskSchema } from '../../../../drizzle/zodSchemas';
import { z } from "zod";

// Types
type Salesman = { id: number; firstName: string | null; lastName: string | null; email: string; salesmanLoginId: string | null; area: string | null; region: string | null; };
// UnifiedDealer now only needs a string ID since we are only querying the `dealers` table
type UnifiedDealer = { id: string; name: string; region: string | null; area: string | null; };
type DailyTaskRecord = z.infer<typeof selectDailyTaskSchema> & { salesmanName?: string; relatedDealerName?: string; assignedByUserName?: string };

export default function AssignTasksPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [tasks, setTasks] = useState<DailyTaskRecord[]>([]);
  const [uniqueZones, setUniqueZones] = useState<string[]>([]);
  const [uniqueAreas, setUniqueAreas] = useState<string[]>([]);

  // Dynamic Dealer Fetching State
  const [dealers, setDealers] = useState<UnifiedDealer[]>([]);
  const [isFetchingDealers, setIsFetchingDealers] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Form State ---
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>("");
  const [salesmanSearch, setSalesmanSearch] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: new Date(), to: addDays(new Date(), 4) });
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [areaSearch, setAreaSearch] = useState<string>("");
  
  // Array of string IDs (no more verified/regular prefixes)
  const [selectedDealerIds, setSelectedDealerIds] = useState<string[]>([]);

  const apiURI = `/api/dashboardPagesAPI/assign-tasks`;

  // --- 1. Initial Data Load ---
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

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // search filters
  const filteredSalesmen = useMemo(() => {
    if (!salesmanSearch) return salesmen;
    const lowerSearch = salesmanSearch.toLowerCase();
    return salesmen.filter(s =>
      (s.firstName && s.firstName.toLowerCase().includes(lowerSearch)) ||
      (s.lastName && s.lastName.toLowerCase().includes(lowerSearch)) ||
      (s.salesmanLoginId && s.salesmanLoginId.toLowerCase().includes(lowerSearch))
    );
  }, [salesmen, salesmanSearch]);

  const filteredAreasList = useMemo(() => {
    if (!areaSearch) return uniqueAreas;
    const lowerSearch = areaSearch.toLowerCase();
    return uniqueAreas.filter(a => a.toLowerCase().includes(lowerSearch));
  }, [uniqueAreas, areaSearch]);

  // --- 2. Dynamic Dealer Fetching ---
  const fetchDealersBasedOnFilters = async () => {
    setIsFetchingDealers(true);
    setDealers([]); 
    setSelectedDealerIds([]); 

    try {
      const params = new URLSearchParams({
        action: 'fetch_dealers',
        zone: selectedZone,
        area: selectedArea,
        // Dealer type filter removed since backend only queries the unified dealers table now
      });

      const response = await fetch(`${apiURI}?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch dealers");
      const data = await response.json();

      setDealers(data.dealers || []);
      toast.success(`Found ${data.dealers?.length || 0} dealers matching filters`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsFetchingDealers(false);
    }
  };

  // --- 3. Filter Auto-fills based on Salesman ---
  useEffect(() => {
    if (selectedSalesmanId) {
      const s = salesmen.find(user => user.id.toString() === selectedSalesmanId);
      if (s) {
        setSelectedZone(s.region && uniqueZones.includes(s.region) ? s.region : "all");
        setTimeout(() => setSelectedArea(s.area && uniqueAreas.includes(s.area) ? s.area : "all"), 0);
      }
    }
  }, [selectedSalesmanId, salesmen, uniqueZones, uniqueAreas]);

  // --- 4. Selection Logic ---
  const handleSelectAll = () => {
    const allIds = dealers.map(d => d.id);
    const isAllSelected = allIds.every(id => selectedDealerIds.includes(id));

    if (isAllSelected) setSelectedDealerIds([]);
    else setSelectedDealerIds(allIds);
  };

  // --- 5. Submit Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalesmanId) { toast.error("Please select a salesman."); return; }
    if (!dateRange?.from || !dateRange?.to) { toast.error("Please select a date range."); return; }
    if (selectedDealerIds.length === 0) { toast.error("Please select at least one dealer."); return; }

    setIsSubmitting(true);
    try {
      // Simplified payload structure
      const payload = {
        salesmanId: parseInt(selectedSalesmanId),
        dateRange: { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() },
        dealerIds: selectedDealerIds 
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
      fetchInitialData();

      // Reset Form State
      setSelectedSalesmanId("");
      setSelectedDealerIds([]);
      setDealers([]);
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
  ];

  if (loading) return <div className="p-10 text-center">Loading Data...</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Assign Weekly PJP</h1>
        <Button onClick={() => setIsFormOpen(true)}>+ New PJP Assignment</Button>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Setup Weekly Plan</DialogTitle>
            <DialogDescription>
              Filter by zone/area, fetch available dealers, and we'll automatically distribute the load across your selected date range.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid gap-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>1. Salesman</Label>
                <Select value={selectedSalesmanId} onValueChange={setSelectedSalesmanId}>
                  <SelectTrigger><SelectValue placeholder="Select salesman..." /></SelectTrigger>
                  <SelectContent>
                    <div className="p-2 sticky top-0 bg-background z-10 border-b">
                      <Input
                        placeholder="Search name or ID..."
                        value={salesmanSearch}
                        onChange={(e) => setSalesmanSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()} 
                        className="h-8"
                      />
                    </div>
                    {filteredSalesmen.length === 0 ? (
                      <div className="p-2 text-sm text-center text-muted-foreground">No salesman found</div>
                    ) : (
                      filteredSalesmen.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.firstName} {s.lastName} ({s.salesmanLoginId})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>2. Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className={`w-full justify-start text-left font-normal ${!dateRange && "text-muted-foreground"}`}>
                      <IconCalendar className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? `${format(dateRange.from, "LLL dd")} - ${format(dateRange.to, "LLL dd")}` : format(dateRange.from, "LLL dd")
                      ) : <span>Pick dates</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="bg-secondary/30 p-4 rounded-lg border space-y-4">
              <Label className="text-md font-semibold text-primary">3. Filters</Label>
              <div className="grid grid-cols-2 gap-4">
                <Select value={selectedZone} onValueChange={(val) => { setSelectedZone(val); setSelectedArea("all"); }}>
                  <SelectTrigger><SelectValue placeholder="Zone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Zones</SelectItem>
                    {uniqueZones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={selectedArea} onValueChange={setSelectedArea}>
                  <SelectTrigger><SelectValue placeholder="Area" /></SelectTrigger>
                  <SelectContent>
                    <div className="p-2 sticky top-0 bg-background z-10 border-b">
                      <Input 
                        placeholder="Search area..." 
                        value={areaSearch}
                        onChange={(e) => setAreaSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-8"
                      />
                    </div>
                    <SelectItem value="all">All Areas</SelectItem>
                    {filteredAreasList.length === 0 ? (
                      <div className="p-2 text-sm text-center text-muted-foreground">No area found</div>
                    ) : (
                      filteredAreasList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                onClick={fetchDealersBasedOnFilters}
                disabled={isFetchingDealers}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md font-medium"
              >
                {isFetchingDealers ? (
                  <span className="flex items-center"><IconLoader3 className="w-4 h-4 mr-2 animate-spin" /> Searching...</span>
                ) : (
                  <span className="flex items-center"><IconSearch className="w-4 h-4 mr-2" /> Find Matching Dealers</span>
                )}
              </Button>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>4. Select Dealers to Distribute ({dealers.length} available)</Label>
                {dealers.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={handleSelectAll}>
                    {dealers.every(d => selectedDealerIds.includes(d.id)) ? (
                      <span className="flex items-center"><IconX className="w-3 h-3 mr-1" /> Deselect All</span>
                    ) : (
                      <span className="flex items-center"><IconCheck className="w-3 h-3 mr-1" /> Select All</span>
                    )}
                  </Button>
                )}
              </div>

              <MultiSelect
                options={dealers.map(d => ({
                  label: d.name,
                  value: d.id,
                }))}
                selectedValues={selectedDealerIds}
                onValueChange={setSelectedDealerIds}
                placeholder={dealers.length === 0 ? "Apply filters to search..." : "Select dealers to assign..."}
                disabled={dealers.length === 0}
              />
            </div>

            <DialogFooter className="mt-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || selectedDealerIds.length === 0}>
                {isSubmitting ? "Generating Plan..." : "Generate Plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-lg border mt-6">
        <DataTableReusable columns={taskColumns} data={tasks} enableRowDragging={false} onRowOrderChange={() => { }} />
      </div>
    </div>
  );
}