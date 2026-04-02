// src/app/dashboard/assignTasks/verifyTasks.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
    Loader2,
    Check,
    ChevronsUpDown,
    ClipboardCheck,
    Store,
    Route,
    Target,
    MapPin,
    Phone,
    CalendarDays
} from 'lucide-react';
import { format, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";

// Import standard components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';

// UI Components
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Zone } from '@/lib/Reusable-constants';

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

import { selectDailyTaskSchema } from '../../../../drizzle/zodSchemas';

// --- EXTEND THE DRIZZLE SCHEMA ---
const frontendTaskSchema = selectDailyTaskSchema.extend({
    salesmanName: z.string().optional().catch("Unknown"),
    salesmanRegion: z.string().nullable().optional(),
    salesmanArea: z.string().nullable().optional(),
    relatedDealerName: z.string().nullable().optional(),
    taskDate: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

type TaskVerification = z.infer<typeof frontendTaskSchema>;
interface TaskModificationState extends TaskVerification { id: string; }

interface OptionItem {
    id: string;
    name: string;
    address?: string;
    area?: string;
    region?: string;
}

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
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10 bg-background" disabled={isLoading}>
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
                                    <Check className={cn("mr-2 h-4 w-4", String(option.id) === value ? "opacity-100" : "opacity-0")} />
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

export default function VerifyTasksPage() {
    const [pendingTasks, setPendingTasks] = useState<TaskVerification[]>([]);
    const [loading, setLoading] = useState(true);

    // --- Standardized Filter State ---
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [zoneFilters, setZoneFilters] = useState<string[]>([]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Dependency Data
    const [allDealers, setAllDealers] = useState<OptionItem[]>([]);
    const [isPatching, setIsPatching] = useState(false);
    const [isModificationDialogOpen, setIsModificationDialogOpen] = useState(false);
    const [taskToModify, setTaskToModify] = useState<TaskModificationState | null>(null);
    const [selectedDealerId, setSelectedDealerId] = useState<string>('null');

    const API_BASE = `/api/dashboardPagesAPI/assign-tasks/task-verification`;
    const OPTIONS_API = `/api/dashboardPagesAPI/masonpc-side/mason-pc/form-options`;
    const BULK_VERIFY = `/api/dashboardPagesAPI/assign-tasks/task-verification/bulk-verify`;

    const fetchDependencies = useCallback(async () => {
        try {
            const url = new URL(OPTIONS_API, window.location.origin);
            url.searchParams.append('_t', Date.now().toString());

            const res = await fetch(url.toString(), {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (res.ok) {
                const data = await res.json();
                setAllDealers(data.dealers || []);
            }
        } catch (e) { console.error("Error loading dependency data."); }
    }, []);

    const fetchPendingTasks = useCallback(async () => {
        setLoading(true);
        try {
            const url = new URL(API_BASE, window.location.origin);
            url.searchParams.append('_t', Date.now().toString());

            const response = await fetch(url.toString(), {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            const data = await response.json();
            setPendingTasks(z.array(frontendTaskSchema.loose()).parse(data.tasks || data));
        } catch (e: any) { toast.error("Error loading verification queue."); } finally { setLoading(false); }
    }, [API_BASE]);

    useEffect(() => { fetchPendingTasks(); fetchDependencies(); }, [fetchPendingTasks, fetchDependencies]);

    // --- Client Side Filtering ---
    const filteredTasks = useMemo(() => {
        return pendingTasks.filter(task => {
            const searchStr = debouncedSearchQuery.toLowerCase();
            const matchesSearch = !searchStr || 
                (task.salesmanName || '').toLowerCase().includes(searchStr) ||
                (task.salesmanArea || '').toLowerCase().includes(searchStr) ||
                (task.relatedDealerName || '').toLowerCase().includes(searchStr);

            const matchesRegion = zoneFilters.length === 0 || (task.salesmanRegion && zoneFilters.includes(task.salesmanRegion));

            let matchesDate = true;
            if (dateRange?.from) {
                const taskDate = new Date(task.taskDate);
                const fromDate = new Date(dateRange.from);
                const toDate = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);

                taskDate.setHours(0, 0, 0, 0);
                fromDate.setHours(0, 0, 0, 0);
                toDate.setHours(23, 59, 59, 999);
                matchesDate = taskDate >= fromDate && taskDate <= toDate;
            }

            return matchesSearch && matchesRegion && matchesDate;
        });
    }, [pendingTasks, debouncedSearchQuery, zoneFilters, dateRange]);

    const zoneOptions = useMemo(() => Zone.map(z => ({ label: z, value: z })), []);

    // --- Handlers ---
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredTasks.map(t => t.id)));
        } else {
            setSelectedIds(new Set());
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
                body: JSON.stringify({ ids: idsToVerify }),
            });

            if (res.ok) {
                toast.success(`${idsToVerify.length} tasks verified!`);
                setSelectedIds(new Set());
                fetchPendingTasks();
            } else {
                throw new Error("Bulk update failed");
            }
        } catch (error) {
            toast.error("Bulk verification failed");
        } finally {
            setIsPatching(false);
        }
    };

    const openModificationDialog = (task: TaskVerification) => {
        setTaskToModify({
            ...task,
            route: task.route ?? '',
            objective: task.objective ?? '',
            visitType: task.visitType ?? 'Dealer Visit',
            requiredVisitCount: task.requiredVisitCount ?? 1,
            dealerMobile: task.dealerMobile ?? '',
            area: task.area ?? '',
            zone: task.zone ?? 'Kamrup',
            week: task.week ?? 'week1',
            dealerNameSnapshot: task.dealerNameSnapshot ?? ''
        });
        setSelectedDealerId(task.dealerId || 'null');
        setIsModificationDialogOpen(true);
    };

    const handlePatchTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskToModify) return;
        setIsPatching(true);
        try {
            const payload = {
                ...taskToModify,
                dealerId: selectedDealerId === 'null' ? null : selectedDealerId,
            };
            const res = await fetch(`${API_BASE}/${taskToModify.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Modification failed");
            toast.success("Task Modified and Verified!");
            setIsModificationDialogOpen(false);
            fetchPendingTasks();
        } catch (e: any) { toast.error(e.message); } finally { setIsPatching(false); }
    };

    const taskVerificationColumns: ColumnDef<TaskVerification>[] = [
        { accessorKey: 'salesmanName', header: 'Salesman' },
        { 
            accessorKey: 'taskDate', 
            header: 'Date', 
            cell: ({ row }) => {
                const dateStr = row.original.taskDate;
                // FIX: Used capital 'MM' for months. dd-MM-yyyy format.
                return dateStr ? format(parseISO(dateStr), "dd-MM-yyyy") : "N/A";
            }
        },
        { accessorKey: 'salesmanArea', header: 'Area', cell: ({ row }) => row.original.salesmanArea || 'N/A' },
        {
            accessorKey: 'relatedDealerName',
            header: 'Visiting',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-bold">{row.original.relatedDealerName || row.original.dealerNameSnapshot || 'N/A'}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{row.original.visitType || 'Visit'}</span>
                </div>
            )
        },
        { accessorKey: 'salesmanRegion', header: 'Region', cell: ({ row }) => row.original.salesmanRegion || 'N/A' },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status || "Assigned";
                const upper = status.toUpperCase();
                if (upper === 'PENDING') return <Badge className="bg-amber-100 text-amber-700 border-amber-200 shadow-none font-bold">PENDING</Badge>;
                if (upper === 'COMPLETED') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shadow-none font-bold">COMPLETED</Badge>;
                return <Badge variant="secondary" className="shadow-none font-bold">{upper}</Badge>;
            }
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <Button variant="outline" size="sm" className="h-8 text-blue-600 border-blue-200" onClick={() => openModificationDialog(row.original)}>
                    Review & Verify
                </Button>
            )
        },
        {
            id: 'select',
            header: () => (
                <div className="flex items-center justify-center">
                    <input
                        type="checkbox"
                        onChange={selectAll}
                        checked={selectedIds.size === filteredTasks.length && filteredTasks.length > 0}
                        className="h-4 w-4 rounded border-slate-300 text-primary cursor-pointer accent-primary"
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={selectedIds.has(row.original.id)}
                        onChange={() => toggleSelect(row.original.id)}
                        className="h-4 w-4 rounded border-slate-300 text-primary cursor-pointer accent-primary"
                    />
                </div>
            ),
            size: 40,
        },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
            <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold tracking-tight">Task Verification Queue</h2>
                        <RefreshDataButton cachePrefix="assign-tasks" onRefresh={fetchPendingTasks} />
                    </div>
                </div>

                {/* --- BULK ACTION BAR --- */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <div className="h-8 w-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                                {selectedIds.size}
                            </div>
                            <div>
                                <p className="text-amber-900 font-medium">Items Selected</p>
                                <p className="text-xs text-amber-700">Bulk verify will approve these tasks without modifications.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-amber-800 hover:bg-amber-100">
                                Cancel
                            </Button>
                            <Button onClick={handleBulkVerify} disabled={isPatching} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                                {isPatching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                                Verify Selected Tasks
                            </Button>
                        </div>
                    </div>
                )}

                {/* --- Unified Global Filter Bar --- */}
                <div className="w-full relative z-50">
                    <GlobalFilterBar 
                        showSearch={true}
                        showRole={false} // Hidden: dropdown not required as Search handles it
                        showZone={true} 
                        showArea={false}
                        showDateRange={true}
                        showStatus={false}

                        searchVal={searchQuery}
                        zoneVals={zoneFilters}
                        dateRangeVal={dateRange}

                        zoneOptions={zoneOptions}

                        onSearchChange={setSearchQuery}
                        onZoneChange={setZoneFilters}
                        onDateRangeChange={setDateRange}
                    />
                </div>

                <div className="bg-card p-1 rounded-lg border border-border shadow-sm relative z-0">
                    {loading && pendingTasks.length === 0 ? (
                        <div className="flex flex-col justify-center items-center h-64 gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-muted-foreground font-medium">Loading tasks...</p>
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="text-center text-muted-foreground py-12">
                            No pending tasks found matching your filters.
                        </div>
                    ) : (
                        <DataTableReusable columns={taskVerificationColumns} data={filteredTasks} />
                    )}
                </div>
            </div>

            <Dialog open={isModificationDialogOpen} onOpenChange={setIsModificationDialogOpen}>
                <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto bg-background">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="text-primary" /> Review & Link Task</DialogTitle>
                        <DialogDescription className="font-medium text-muted-foreground">Review the assigned task, verify its links, and approve it into the system.</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handlePatchTask} className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1 tracking-wider"><Store className="w-3 h-3" /> Link Dealer (Optional)</Label>
                            <SearchableSelect
                                options={allDealers}
                                value={selectedDealerId}
                                placeholder="Search Dealers..."
                                onChange={(id, address) => {
                                    setSelectedDealerId(id);
                                    if (id !== 'null') {
                                        const selected = allDealers.find(d => d.id === id);
                                        if (selected) {
                                            setTaskToModify(p => p ? {
                                                ...p,
                                                dealerNameSnapshot: selected.name,
                                                area: selected.area || p.area,
                                                zone: selected.region || p.zone,
                                                route: (!p.route || p.route.trim() === '') ? (selected.address || '') : p.route
                                            } : null);
                                        }
                                    }
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground">Dealer/Visiting Name</Label>
                                <Input value={taskToModify?.dealerNameSnapshot ?? ''} onChange={e => setTaskToModify(p => p ? { ...p, dealerNameSnapshot: e.target.value } : null)} className="bg-muted/50 font-medium" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3"/> Dealer Mobile</Label>
                                <Input value={taskToModify?.dealerMobile ?? ''} onChange={e => setTaskToModify(p => p ? { ...p, dealerMobile: e.target.value } : null)} className="bg-muted/50 font-medium" />
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground">Area</Label>
                                <Input value={taskToModify?.area ?? ''} onChange={e => setTaskToModify(p => p ? { ...p, area: e.target.value } : null)} className="bg-muted/50 font-medium" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3"/> Zone</Label>
                                <Select value={taskToModify?.zone || 'Kamrup'} onValueChange={v => setTaskToModify(p => p ? { ...p, zone: v } : null)}>
                                    <SelectTrigger className="h-9 bg-muted/50 font-medium"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Zone.map((z) => (
                                            <SelectItem key={z} value={z}>{z}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Objective</Label>
                                <Select value={taskToModify?.objective || 'Order Related'} onValueChange={v => setTaskToModify(p => p ? { ...p, objective: v } : null)}>
                                    <SelectTrigger className="h-9 bg-muted/50 font-medium"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Order Related">Order Related</SelectItem>
                                        <SelectItem value="Payment Collection">Payment Collection</SelectItem>
                                        <SelectItem value="Any Support">Any Support</SelectItem>
                                        <SelectItem value="Prospect">Prospect</SelectItem>
                                        <SelectItem value="Meetings">Meetings</SelectItem>
                                        <SelectItem value="Promotional Activity">Promotional Activity</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground">Visit Type</Label>
                                <Select value={taskToModify?.visitType || 'Dealer Visit'} onValueChange={v => setTaskToModify(p => p ? { ...p, visitType: v } : null)}>
                                    <SelectTrigger className="h-9 bg-muted/50 font-medium"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Important Parties">Important Parties</SelectItem>
                                        <SelectItem value="Prospect">Prospect</SelectItem>
                                        <SelectItem value="Sub Dealer">Sub Dealer</SelectItem>
                                        <SelectItem value="Open Visit">Open Visit</SelectItem>
                                        <SelectItem value="Other Visit">Other Visit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Route className="w-3 h-3" /> Planned Route / Address</Label>
                                <Input value={taskToModify?.route ?? ''} onChange={e => setTaskToModify(p => p ? { ...p, route: e.target.value } : null)} className="bg-muted/50 text-xs font-mono" />
                            </div>
                            <div className="space-y-1 flex gap-2">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3 h-3"/> Week</Label>
                                    <Select value={taskToModify?.week || 'week1'} onValueChange={v => setTaskToModify(p => p ? { ...p, week: v } : null)}>
                                        <SelectTrigger className="h-9 bg-muted/50 font-medium"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="week1">Week 1</SelectItem>
                                            <SelectItem value="week2">Week 2</SelectItem>
                                            <SelectItem value="week3">Week 3</SelectItem>
                                            <SelectItem value="week4">Week 4</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-24 space-y-1">
                                    <Label className="text-xs font-bold text-muted-foreground">Visits</Label>
                                    <Input type="number" min={1} value={taskToModify?.requiredVisitCount ?? 1} onChange={e => setTaskToModify(p => p ? { ...p, requiredVisitCount: parseInt(e.target.value) || 1 } : null)} className="bg-muted/50" />
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-1/2 space-y-1">
                            <Label className="text-xs font-bold text-muted-foreground">Task Date</Label>
                            <Input type="date" value={taskToModify?.taskDate ?? ''} onChange={e => setTaskToModify(p => p ? { ...p, taskDate: e.target.value } : null)} className="bg-muted/50 font-medium" />
                        </div>

                        <DialogFooter className="gap-2 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setIsModificationDialogOpen(false)} className="border-border font-bold">Cancel</Button>
                            <Button type="submit" disabled={isPatching}>
                                {isPatching ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Check className="mr-2 w-4 h-4" />} Finalize & Verify
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}