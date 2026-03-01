// src/components/assign-tasks-dialog.tsx
'use client';

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { IconCalendar, IconCheck, IconX, IconSearch, IconLoader3, IconArrowRight, IconArrowLeft } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { MultiSelect } from "@/components/multi-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

type Salesman = { id: number; firstName: string | null; lastName: string | null; email: string; salesmanLoginId: string | null; area: string | null; region: string | null; };
type UnifiedDealer = { id: string; name: string; region: string | null; area: string | null; };

type DealerConfig = {
  objective: string;
  visitType: string;
  requiredVisitCount: number;
  route: string;
};

interface AssignTasksDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  salesmen: Salesman[];
  uniqueZones: string[];
  uniqueAreas: string[];
  onSuccess: () => void;
}

export function AssignTasksDialog({ isOpen, setIsOpen, salesmen, uniqueZones, uniqueAreas, onSuccess }: AssignTasksDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Step 1 State ---
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>("");
  const [salesmanSearch, setSalesmanSearch] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: new Date(), to: addDays(new Date(), 4) });
  
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [areaSearch, setAreaSearch] = useState<string>("");
  
  const [dealers, setDealers] = useState<UnifiedDealer[]>([]);
  const [isFetchingDealers, setIsFetchingDealers] = useState(false);
  const [selectedDealerIds, setSelectedDealerIds] = useState<string[]>([]);

  // --- Step 2 State (Per Dealer Config) ---
  const [dealerConfigs, setDealerConfigs] = useState<Record<string, DealerConfig>>({});
  
  // Bulk Apply State (for UX convenience)
  const [bulkConfig, setBulkConfig] = useState<DealerConfig>({
    objective: "",
    visitType: "Dealer Visit",
    requiredVisitCount: 1,
    route: ""
  });

  const apiURI = `/api/dashboardPagesAPI/assign-tasks`;

  // --- Derived State & Search ---
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

  const selectedDealersList = useMemo(() => {
    return dealers.filter(d => selectedDealerIds.includes(d.id));
  }, [dealers, selectedDealerIds]);

  // --- Auto-fill Filters based on Salesman ---
  useEffect(() => {
    if (selectedSalesmanId) {
      const s = salesmen.find(user => user.id.toString() === selectedSalesmanId);
      if (s) {
        setSelectedZone(s.region && uniqueZones.includes(s.region) ? s.region : "all");
        setTimeout(() => setSelectedArea(s.area && uniqueAreas.includes(s.area) ? s.area : "all"), 0);
      }
    }
  }, [selectedSalesmanId, salesmen, uniqueZones, uniqueAreas]);

  // --- Fetch Dealers ---
  const fetchDealersBasedOnFilters = async () => {
    setIsFetchingDealers(true);
    setDealers([]); 
    setSelectedDealerIds([]); 

    try {
      const params = new URLSearchParams({ action: 'fetch_dealers', zone: selectedZone, area: selectedArea });
      const response = await fetch(`${apiURI}?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch dealers");
      const data = await response.json();
      setDealers(data.dealers || []);
      toast.success(`Found ${data.dealers?.length || 0} dealers`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsFetchingDealers(false);
    }
  };

  // --- Navigation & Handlers ---
  const handleSelectAll = () => {
    const allIds = dealers.map(d => d.id);
    if (allIds.every(id => selectedDealerIds.includes(id))) setSelectedDealerIds([]);
    else setSelectedDealerIds(allIds);
  };

  const goToStep2 = () => {
    if (!selectedSalesmanId) return toast.error("Please select a salesman.");
    if (!dateRange?.from || !dateRange?.to) return toast.error("Please select a date range.");
    if (selectedDealerIds.length === 0) return toast.error("Please select at least one dealer.");
    
    // Initialize config for any newly selected dealers
    const newConfigs = { ...dealerConfigs };
    selectedDealerIds.forEach(id => {
      if (!newConfigs[id]) {
        newConfigs[id] = { objective: "", visitType: "Dealer Visit", requiredVisitCount: 1, route: "" };
      }
    });
    setDealerConfigs(newConfigs);
    setStep(2);
  };

  const handleConfigChange = (dealerId: string, field: keyof DealerConfig, value: any) => {
    setDealerConfigs(prev => ({
      ...prev,
      [dealerId]: { ...prev[dealerId], [field]: value }
    }));
  };

  const handleBulkApply = () => {
    const updatedConfigs = { ...dealerConfigs };
    selectedDealerIds.forEach(id => {
      updatedConfigs[id] = { ...bulkConfig };
    });
    setDealerConfigs(updatedConfigs);
    toast.success("Settings applied to all selected dealers");
  };

  // --- Final Submit ---
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Build the complex payload
      const dealerDetails = selectedDealerIds.map(id => ({
        dealerId: id,
        ...dealerConfigs[id]
      }));

      const payload = {
        salesmanId: parseInt(selectedSalesmanId),
        dateRange: { from: dateRange!.from!.toISOString(), to: dateRange!.to!.toISOString() },
        dealerDetails 
      };

      const response = await fetch(apiURI, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to assign PJP/tasks");
      
      const resData = await response.json();
      toast.success(resData.message || "Tasks assigned successfully!");
      
      // Reset and close
      setStep(1);
      setSelectedSalesmanId("");
      setSelectedDealerIds([]);
      setDealers([]);
      setDateRange(undefined);
      setDealerConfigs({});
      setIsOpen(false);
      onSuccess();

    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Setup Weekly Plan {step === 2 && "- Step 2: Configure Tasks"}</DialogTitle>
          <DialogDescription>
            {step === 1 
              ? "Filter by zone/area, fetch available dealers, and select who needs to be visited." 
              : "Customize the objective, visit type, and requirements for each selected dealer."}
          </DialogDescription>
        </DialogHeader>

        {/* --- STEP 1 UI --- */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto px-1 py-2 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>1. Salesman</Label>
                <Select value={selectedSalesmanId} onValueChange={setSelectedSalesmanId}>
                  <SelectTrigger><SelectValue placeholder="Select salesman..." /></SelectTrigger>
                  <SelectContent>
                    <div className="p-2 sticky top-0 bg-background z-10 border-b">
                      <Input placeholder="Search name or ID..." value={salesmanSearch} onChange={(e) => setSalesmanSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="h-8" />
                    </div>
                    {filteredSalesmen.length === 0 ? (
                      <div className="p-2 text-sm text-center text-muted-foreground">No salesman found</div>
                    ) : (
                      filteredSalesmen.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName} ({s.salesmanLoginId})</SelectItem>
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
                      <Input placeholder="Search area..." value={areaSearch} onChange={(e) => setAreaSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="h-8" />
                    </div>
                    <SelectItem value="all">All Areas</SelectItem>
                    {filteredAreasList.length === 0 ? <div className="p-2 text-sm text-center text-muted-foreground">No area found</div> : filteredAreasList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button type="button" onClick={fetchDealersBasedOnFilters} disabled={isFetchingDealers} className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md font-medium">
                {isFetchingDealers ? <span className="flex items-center"><IconLoader3 className="w-4 h-4 mr-2 animate-spin" /> Searching...</span> : <span className="flex items-center"><IconSearch className="w-4 h-4 mr-2" /> Find Matching Dealers</span>}
              </Button>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>4. Select Dealers to Distribute ({dealers.length} available)</Label>
                {dealers.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={handleSelectAll}>
                    {dealers.every(d => selectedDealerIds.includes(d.id)) ? <span className="flex items-center"><IconX className="w-3 h-3 mr-1" /> Deselect All</span> : <span className="flex items-center"><IconCheck className="w-3 h-3 mr-1" /> Select All</span>}
                  </Button>
                )}
              </div>
              <MultiSelect options={dealers.map(d => ({ label: d.name, value: d.id }))} selectedValues={selectedDealerIds} onValueChange={setSelectedDealerIds} placeholder={dealers.length === 0 ? "Apply filters to search..." : "Select dealers to assign..."} disabled={dealers.length === 0} />
            </div>
          </div>
        )}

        {/* --- STEP 2 UI --- */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto px-1 py-2 space-y-6">
            {/* Bulk Setup Row */}
            <Card className="bg-primary/5 border-primary/20 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <Label className="text-sm font-bold text-primary">Fast Configuration (Apply to All)</Label>
                  <Button size="sm" onClick={handleBulkApply} variant="secondary" className="h-7 text-xs bg-primary/10 hover:bg-primary/20">Apply to {selectedDealerIds.length} Dealers</Button>
                </div>
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Visit Type</Label>
                    <Select value={bulkConfig.visitType} onValueChange={v => setBulkConfig(p => ({...p, visitType: v}))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dealer Visit">Dealer Visit</SelectItem>
                        <SelectItem value="Site Visit">Site Visit</SelectItem>
                        <SelectItem value="Payment Collection">Payment Collection</SelectItem>
                        <SelectItem value="Follow-up">Follow-up</SelectItem>
                        <SelectItem value="Issue Resolution">Issue Resolution</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-5 space-y-1">
                    <Label className="text-xs">Objective</Label>
                    <Input className="h-8 text-xs" placeholder="General visit..." value={bulkConfig.objective} onChange={e => setBulkConfig(p => ({...p, objective: e.target.value}))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Route</Label>
                    <Input className="h-8 text-xs" placeholder="Route info..." value={bulkConfig.route} onChange={e => setBulkConfig(p => ({...p, route: e.target.value}))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Visits</Label>
                    <Input type="number" min={1} className="h-8 text-xs" value={bulkConfig.requiredVisitCount} onChange={e => setBulkConfig(p => ({...p, requiredVisitCount: parseInt(e.target.value) || 1}))} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Individual Dealer List */}
            <div className="space-y-4">
              <Label className="text-sm font-bold">Individual Configurations</Label>
              {selectedDealersList.map((dealer, index) => {
                const config = dealerConfigs[dealer.id] || { objective: "", visitType: "Dealer Visit", requiredVisitCount: 1, route: "" };
                
                return (
                  <div key={dealer.id} className="grid grid-cols-12 gap-3 items-center p-3 border rounded-md bg-card shadow-sm">
                    <div className="col-span-12 flex items-center gap-2 mb-1">
                      <span className="bg-secondary text-secondary-foreground text-[10px] px-2 py-0.5 rounded font-mono">{index + 1}</span>
                      <span className="text-sm font-semibold truncate">{dealer.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase ml-auto">{dealer.area}</span>
                    </div>

                    <div className="col-span-3">
                      <Select value={config.visitType} onValueChange={v => handleConfigChange(dealer.id, 'visitType', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dealer Visit">Dealer Visit</SelectItem>
                          <SelectItem value="Site Visit">Site Visit</SelectItem>
                          <SelectItem value="Payment Collection">Payment Collection</SelectItem>
                          <SelectItem value="Follow-up">Follow-up</SelectItem>
                          <SelectItem value="Issue Resolution">Issue Resolution</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-5">
                      <Input className="h-8 text-xs" placeholder="Objective..." value={config.objective} onChange={e => handleConfigChange(dealer.id, 'objective', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <Input className="h-8 text-xs" placeholder="Route..." value={config.route} onChange={e => handleConfigChange(dealer.id, 'route', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" min={1} className="h-8 text-xs" value={config.requiredVisitCount} onChange={e => handleConfigChange(dealer.id, 'requiredVisitCount', parseInt(e.target.value) || 1)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 mt-4 pt-4 border-t flex justify-between sm:justify-between w-full">
          {step === 1 ? (
            <>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="button" onClick={goToStep2}>Configure Tasks <IconArrowRight className="w-4 h-4 ml-2" /></Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(1)}><IconArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : `Assign ${selectedDealerIds.length} Tasks`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}