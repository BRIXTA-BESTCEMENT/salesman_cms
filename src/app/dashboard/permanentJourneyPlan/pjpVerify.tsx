// src/app/dashboard/permanentJourneyPlan/pjpVerify.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { set, z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
  Loader2,
  Search,
  Check,
  X,
  Eye,
  ChevronsUpDown,
  MapPin,
  ClipboardCheck,
  User,
  FilterX,
  Store,
  HardHat
} from 'lucide-react';

import { DataTableReusable } from '@/components/data-table-reusable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zone } from '@/lib/Reusable-constants';
// Combobox / Searchable Dropdown Imports
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  permanentJourneyPlanVerificationSchema,
  type PermanentJourneyPlanVerificationSchema,
  type PjpModificationSchema
} from '@/lib/shared-zod-schema';

type PermanentJourneyPlanVerification = PermanentJourneyPlanVerificationSchema;
interface PJPModificationState extends PjpModificationSchema { id: string; }

// --- TYPES FOR DROPDOWNS ---
interface OptionItem {
  id: string;
  name: string;
  address?: string; // Used to auto-fill route
  area?: string;
  region?: string;
}

// --- SEARCHABLE SELECT COMPONENT ---
interface SearchableSelectProps {
  options: OptionItem[];
  value: string;
  onChange: (id: string, address?: string) => void;
  placeholder: string;
  isLoading?: boolean;
}

const SearchableSelect = ({ options, value, onChange, placeholder, isLoading }: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);
  const selectedItem = options.find((item) => String(item.id) === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10" disabled={isLoading}>
          {value === 'null' || !value ? placeholder : (selectedItem?.name || placeholder)}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="none" onSelect={() => { onChange("null"); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", value === "null" ? "opacity-100" : "opacity-0")} />
                -- Unassigned / Manual --
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => {
                    onChange(option.id, option.address);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", option.id === value ? "opacity-100" : "opacity-0")} />
                  {option.name} {option.area ? `(${option.area})` : ''}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function PJPVerifyPage() {
  const [pendingPJPs, setPendingPJPs] = useState<PermanentJourneyPlanVerification[]>([]);
  const [loading, setLoading] = useState(true);

  // Dependency Data
  const [allDealers, setAllDealers] = useState<OptionItem[]>([]);
  const [allSites, setAllSites] = useState<OptionItem[]>([]);

  // Selection States
  const [selectedDealerId, setSelectedDealerId] = useState<string>('null');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('null');

  // Modal/UI States
  const [isModificationDialogOpen, setIsModificationDialogOpen] = useState(false);
  const [pjpToModify, setPjpToModify] = useState<PJPModificationState | null>(null);
  const [isPatching, setIsPatching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSalesmanFilter, setSelectedSalesmanFilter] = useState<string>('all');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
  const [verifyAllpjps, setVerifyAllPjps] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const API_BASE = `/api/dashboardPagesAPI/permanent-journey-plan`;
  const OPTIONS_API = `/api/dashboardPagesAPI/masonpc-side/mason-pc/form-options`;
  const BULK_VERIFY = `/api/dashboardPagesAPI/permanent-journey-plan/pjp-verification/bulk-verify`;

  // Helper to toggle a single selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id); // Deselect if already there
      } else {
        next.add(id);    // Select if not there
      }
      return next;
    });
  };

  const fetchDependencies = useCallback(async () => {
    try {
      const res = await fetch(OPTIONS_API);
      if (res.ok) {
        const data = await res.json();
        setAllDealers(data.dealers || []);
        setAllSites(data.sites || []);
      }
    } catch (e) { toast.error("Error loading dependency data."); }
  }, []);

  const fetchPendingPJPs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/pjp-verification`);
      const data = await response.json();
      setPendingPJPs(z.array(permanentJourneyPlanVerificationSchema).parse(data.plans || data));
    } catch (e: any) { toast.error("Error loading verification queue."); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPendingPJPs(); fetchDependencies(); }, [fetchPendingPJPs, fetchDependencies]);

  const openModificationDialog = (pjp: PermanentJourneyPlanVerification) => {
    setPjpToModify({
      ...pjp,
      route: pjp.route ?? '',
      description: pjp.description ?? '',
      influencerName: pjp.influencerName ?? '',
      influencerPhone: pjp.influencerPhone ?? '',
      activityType: pjp.activityType ?? '',
      additionalVisitRemarks: pjp.additionalVisitRemarks ?? '',
    });
    setSelectedDealerId(pjp.dealerId || 'null');
    setSelectedSiteId(pjp.siteId || 'null');
    setIsModificationDialogOpen(true);
  };

  const handlePatchPJP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pjpToModify) return;
    setIsPatching(true);
    try {
      const payload = {
        ...pjpToModify,
        dealerId: selectedDealerId === 'null' ? null : selectedDealerId,
        siteId: selectedSiteId === 'null' ? null : selectedSiteId,
      };
      const res = await fetch(`${API_BASE}/pjp-verification/${pjpToModify.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Modification failed");
      toast.success("PJP Modified and Verified!");
      setIsModificationDialogOpen(false);
      fetchPendingPJPs();
    } catch (e: any) { toast.error(e.message); } finally { setIsPatching(false); }
  };

  const selectAll = () => {
    if (selectedIds.size === filteredPJPs.length && filteredPJPs.length > 0) {
      setSelectedIds(new Set());
    }
    else {
      setSelectedIds(new Set(filteredPJPs.map(p => p.id)));
    }
  };

  const handleBulkVerify = async () => {
    const idsToVerify = Array.from(selectedIds);

    if (idsToVerify.length === 0) return;

    setIsPatching(true);
    try {
      const res = await fetch(`${BULK_VERIFY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (res.ok) {
        toast.success(`${idsToVerify.length} plans verified!`);
        setSelectedIds(new Set()); // Reset checkboxes
        fetchPendingPJPs();        // Refresh the list
      }
    } catch (error) {
      toast.error("Bulk verification failed");
    } finally {
      setVerifyAllPjps(false);
    }
  };

  // --- FILTER LOGIC ---
  const filteredPJPs = useMemo(() => {
    return pendingPJPs.filter(pjp => {
      const matchesSearch = pjp.salesmanName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pjp.areaToBeVisited.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSalesman = selectedSalesmanFilter === 'all' || pjp.salesmanName === selectedSalesmanFilter;
      const matchesRegion = selectedRegionFilter === 'all' || selectedRegionFilter === 'All Zone' || pjp.salesmanRegion === selectedRegionFilter;
      return matchesSearch && matchesSalesman && matchesRegion;
    });
  }, [pendingPJPs, searchQuery, selectedSalesmanFilter, selectedRegionFilter]);

  const pjpVerificationColumns: ColumnDef<PermanentJourneyPlanVerification>[] = [
    { accessorKey: 'salesmanName', header: 'Salesman' },
    { accessorKey: 'planDate', header: 'Date' },
    { accessorKey: 'areaToBeVisited', header: 'Area' },
    {
      accessorKey: 'visitDealerName',
      header: 'Visiting',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-bold">{row.original.visitDealerName || 'N/A'}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{row.original.siteId ? 'Site' : 'Dealer'}</span>
        </div>
      )
    },
    { accessorKey: 'salesmanRegion', header: 'Region' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="default" size="sm" className="bg-green-600" onClick={() => openModificationDialog(row.original)}>Review & Verify</Button>
        </div>
      )
    },
    {
      id: 'select',
      header: () => (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-white">Select</span>
          <input
            name='Select'
            type="checkbox"
            onChange={selectAll}
            checked={selectedIds.size === filteredPJPs.length && filteredPJPs.length > 0}
            className="h-4 w-4 rounded border-slate-700 bg-slate-800 cursor-pointer"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleSelect(row.original.id)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-800 cursor-pointer"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground space-y-6 p-8 pt-6">
      <div className="space-y-0.5">
        <h2 className="text-3xl font-bold tracking-tight text-white">PJP Verification Queue</h2>
        <p className="text-muted-foreground text-sm">Review and verify plans submitted by sales executives.</p>
      </div>

      {/* --- BULK ACTION BAR --- */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-black font-bold">
              {selectedIds.size}
            </div>
            <div>
              <p className="text-white font-medium">Items Selected</p>
              <p className="text-xs text-amber-500/80">Bulk verify will approve these plans without modifications.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkVerify}
              disabled={verifyAllpjps}
              className="bg-primary text-white font-bold"
            >
              {verifyAllpjps ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Verify Selected PJPs
            </Button>
          </div>
        </div>
      )}

      <Card className="shadow-xl bg-slate-900/20 border-slate-800">
        <CardContent className="p-6">

          {/* --- FIXED FILTER SECTION WITH BORDERS --- */}
          <div className="flex flex-wrap gap-4 mb-8 p-4 rounded-xl border border-slate-800 items-end">
            <div className="space-y-1.5 flex flex-col">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Search Queue</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <Input
                  placeholder="Salesman or Area..."
                  className="w-[250px] pl-9 border-slate-700 text-white focus:border-amber-500 transition-colors"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5 flex flex-col">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Salesman</Label>
              <Select value={selectedSalesmanFilter} onValueChange={setSelectedSalesmanFilter}>
                <SelectTrigger className="w-[200px] border-slate-700 text-white">
                  <SelectValue placeholder="All Salesmen" />
                </SelectTrigger>
                <SelectContent className=" border-slate-800 text-white">
                  <SelectItem value="all">All Salesmen</SelectItem>
                  {Array.from(new Set(pendingPJPs.map(p => p.salesmanName))).sort().map(n => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex flex-col">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Region</Label>
              <Select value={selectedRegionFilter} onValueChange={setSelectedRegionFilter}>
                <SelectTrigger className="w-[200px] border-slate-700 text-white">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  {Zone.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              className="text-slate-500 hover:text-white hover:bg-slate-800 h-10 transition-all"
              onClick={() => { setSearchQuery(""); setSelectedSalesmanFilter("all"); setSelectedRegionFilter("all"); }}
            >
              <FilterX className="w-4 h-4 mr-2" /> Reset Filters
            </Button>
          </div>

          {/* Table Container */}
          <div className="rounded-md border border-slate-800">
            <DataTableReusable
              columns={pjpVerificationColumns}
              data={filteredPJPs}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModificationDialogOpen} onOpenChange={setIsModificationDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary"><ClipboardCheck /> Review & Link PJP</DialogTitle>
          </DialogHeader>

          <form onSubmit={handlePatchPJP} className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Store className="w-3 h-3" /> Link Dealer</Label>
                <SearchableSelect
                  options={allDealers}
                  value={selectedDealerId}
                  placeholder="Search Dealers..."
                  onChange={(id, address) => {
                    setSelectedDealerId(id);
                    setSelectedSiteId('null');
                    if (address) setPjpToModify(p => p ? { ...p, route: address } : null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><HardHat className="w-3 h-3" /> Link Site</Label>
                <SearchableSelect
                  options={allSites}
                  value={selectedSiteId}
                  placeholder="Search Sites..."
                  onChange={(id, address) => {
                    setSelectedSiteId(id);
                    setSelectedDealerId('null');
                    if (address) setPjpToModify(p => p ? { ...p, route: address } : null);
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-xs">Plan Date</Label><Input type="date" value={pjpToModify?.planDate ?? ''} onChange={e => setPjpToModify(p => p ? { ...p, planDate: e.target.value } : null)} className="bg-slate-800 border-slate-700" /></div>
              <div className="space-y-1"><Label className="text-xs">Route Address</Label><Input value={pjpToModify?.route ?? ''} onChange={e => setPjpToModify(p => p ? { ...p, route: e.target.value } : null)} className="bg-slate-800 border-slate-700 text-xs font-mono" /></div>
            </div>

            <Separator className="bg-slate-800" />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1"><Label className="text-xs">New Sites</Label><Input type="number" value={pjpToModify?.plannedNewSiteVisits ?? 0} onChange={e => setPjpToModify(p => p ? { ...p, plannedNewSiteVisits: +e.target.value } : null)} className="bg-slate-800 border-slate-700" /></div>
              <div className="space-y-1"><Label className="text-xs">Follow-ups</Label><Input type="number" value={pjpToModify?.plannedFollowUpSiteVisits ?? 0} onChange={e => setPjpToModify(p => p ? { ...p, plannedFollowUpSiteVisits: +e.target.value } : null)} className="bg-slate-800 border-slate-700" /></div>
              <div className="space-y-1"><Label className="text-xs">Dealers</Label><Input type="number" value={pjpToModify?.plannedNewDealerVisits ?? 0} onChange={e => setPjpToModify(p => p ? { ...p, plannedNewDealerVisits: +e.target.value } : null)} className="bg-slate-800 border-slate-700" /></div>
              <div className="space-y-1"><Label className="text-xs">Influencers</Label><Input type="number" value={pjpToModify?.plannedInfluencerVisits ?? 0} onChange={e => setPjpToModify(p => p ? { ...p, plannedInfluencerVisits: +e.target.value } : null)} className="bg-slate-800 border-slate-700" /></div>
              <div className="space-y-1"><Label className="text-xs">Bags</Label><Input type="number" value={pjpToModify?.noOfConvertedBags ?? 0} onChange={e => setPjpToModify(p => p ? { ...p, noOfConvertedBags: +e.target.value } : null)} className="bg-slate-800 border-slate-700" /></div>
              <div className="space-y-1"><Label className="text-xs">Schemes</Label><Input type="number" value={pjpToModify?.noOfMasonPcSchemes ?? 0} onChange={e => setPjpToModify(p => p ? { ...p, noOfMasonPcSchemes: +e.target.value } : null)} className="bg-slate-800 border-slate-700" /></div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Influencer Detail</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Name" value={pjpToModify?.influencerName ?? ''} onChange={e => setPjpToModify(p => p ? { ...p, influencerName: e.target.value } : null)} className="bg-slate-800 border-slate-700" />
                <Input placeholder="Activity" value={pjpToModify?.activityType ?? ''} onChange={e => setPjpToModify(p => p ? { ...p, activityType: e.target.value } : null)} className="bg-slate-800 border-slate-700" />
                <Input placeholder="Phone" value={pjpToModify?.influencerPhone ?? ''} onChange={e => setPjpToModify(p => p ? { ...p, influencerPhone: e.target.value } : null)} className="bg-slate-800 border-slate-700" />
              </div>
            </div>

            <Textarea placeholder="Verification Remarks..." value={pjpToModify?.additionalVisitRemarks ?? ''} onChange={e => setPjpToModify(p => p ? { ...p, additionalVisitRemarks: e.target.value } : null)} className="bg-slate-800 border-slate-700 h-20" />

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModificationDialogOpen(false)} className="border-slate-700 text-slate-300">Cancel</Button>
              <Button type="submit" disabled={isPatching} className="bg-primary hover:bg-primary/50 text-white font-bold">
                {isPatching ? <Loader2 className="animate-spin mr-2" /> : null} Finalize & Verify
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}