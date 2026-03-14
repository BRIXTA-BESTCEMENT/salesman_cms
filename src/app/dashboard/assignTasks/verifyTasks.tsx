// src/app/dashboard/assignTasks/verifyTasks.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
    Loader2,
    Search,
    Check,
    ClipboardCheck,
    FilterX,
    Store,
    Route,
    Target,
    MapPin,
    Phone,
    CalendarDays
} from 'lucide-react';
import { IconCalendar } from '@tabler/icons-react';
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";

import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Zone } from '@/lib/Reusable-constants';
import { Calendar } from "@/components/ui/calendar";
import { ChevronsUpDown } from 'lucide-react';

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

// --- TYPES FOR DROPDOWNS ---
interface OptionItem {
    id: string;
    name: string;
    address?: string;
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

    // Dependency Data
    const [allDealers, setAllDealers] = useState<OptionItem[]>([]);

    // Selection States
    const [selectedDealerId, setSelectedDealerId] = useState<string>('null');

    // Modal/UI States
    const [isModificationDialogOpen, setIsModificationDialogOpen] = useState(false);
    const [taskToModify, setTaskToModify] = useState<TaskModificationState | null>(null);
    const [isPatching, setIsPatching] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSalesmanFilter, setSelectedSalesmanFilter] = useState<string>('all');
    const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    const [verifyAllTasks, setVerifyAllTasks] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const API_BASE = `/api/dashboardPagesAPI/assign-tasks/task-verification`;
    const OPTIONS_API = `/api/dashboardPagesAPI/masonpc-side/mason-pc/form-options`;
    const BULK_VERIFY = `/api/dashboardPagesAPI/assign-tasks/task-verification/bulk-verify`;

    // Helper to toggle a single selection
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const fetchDependencies = useCallback(async () => {
        try {
            const res = await fetch(OPTIONS_API);
            if (res.ok) {
                const data = await res.json();
                setAllDealers(data.dealers || []);
            }
        } catch (e) { toast.error("Error loading dependency data."); }
    }, []);

    const fetchPendingTasks = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}`);
            const data = await response.json();
            setPendingTasks(z.array(frontendTaskSchema.loose()).parse(data.tasks || data));
        } catch (e: any) { toast.error("Error loading verification queue."); } finally { setLoading(false); }
    }, [API_BASE]);

    useEffect(() => { fetchPendingTasks(); fetchDependencies(); }, [fetchPendingTasks, fetchDependencies]);

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

    const selectAll = () => {
        if (selectedIds.size === filteredTasks.length && filteredTasks.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredTasks.map(t => t.id)));
        }
    };

    const handleBulkVerify = async () => {
        const idsToVerify = Array.from(selectedIds);
        if (idsToVerify.length === 0) return;

        setVerifyAllTasks(true);
        try {
            const res = await fetch(`${BULK_VERIFY}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
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
            setVerifyAllTasks(false);
        }
    };

    // --- FILTER LOGIC ---
    const filteredTasks = useMemo(() => {
        return pendingTasks.filter(task => {
            const searchStr = searchQuery.toLowerCase();
            const matchesSearch = (task.salesmanName || '').toLowerCase().includes(searchStr) ||
                (task.salesmanArea || '').toLowerCase().includes(searchStr) ||
                (task.relatedDealerName || '').toLowerCase().includes(searchStr);

            const matchesSalesman = selectedSalesmanFilter === 'all' || task.salesmanName === selectedSalesmanFilter;
            const matchesRegion = selectedRegionFilter === 'all' || selectedRegionFilter === 'All Zone' || task.salesmanRegion === selectedRegionFilter;

            let matchesDate = true;
            if (dateRange && dateRange.from) {
                const taskDate = new Date(task.taskDate);
                const fromDate = new Date(dateRange.from);
                const toDate = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);

                taskDate.setHours(0, 0, 0, 0);
                fromDate.setHours(0, 0, 0, 0);
                toDate.setHours(23, 59, 59, 999);

                matchesDate = taskDate >= fromDate && taskDate <= toDate;
            }

            return matchesSearch && matchesSalesman && matchesRegion && matchesDate;
        });
    }, [pendingTasks, searchQuery, selectedSalesmanFilter, selectedRegionFilter, dateRange]);

    const taskVerificationColumns: ColumnDef<TaskVerification>[] = [
        { accessorKey: 'salesmanName', header: 'Salesman' },
        { accessorKey: 'taskDate', header: 'Date', cell: ({ row }) => format(new Date(row.original.taskDate), "MMM dd, yyyy") },
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
        { accessorKey: 'visitType', header: 'Type', cell: ({ row }) => <span className="text-xs">{row.original.visitType || "N/A"}</span> },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status || "Assigned";
                if (status.toUpperCase() === 'PENDING') {
                    // Update 1: Yellow pending badge
                    return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 shadow-none font-bold tracking-wider">{status}</Badge>;
                }
                if (status.toUpperCase() === 'COMPLETED') {
                    return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shadow-none font-bold tracking-wider">{status}</Badge>;
                }
                return <Badge variant="secondary" className="shadow-none font-bold tracking-wider">{status}</Badge>;
            }
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700 font-bold" onClick={() => openModificationDialog(row.original)}>Review & Verify</Button>
                </div>
            )
        },
        {
            id: 'select',
            header: () => (
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-white font-bold tracking-widest">Select</span>
                    <input
                        name='Select'
                        type="checkbox"
                        onChange={selectAll}
                        checked={selectedIds.size === filteredTasks.length && filteredTasks.length > 0}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-800 cursor-pointer accent-amber-500"
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={selectedIds.has(row.original.id)}
                        onChange={() => toggleSelect(row.original.id)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-800 cursor-pointer accent-amber-500"
                    />
                </div>
            ),
        },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground space-y-6">
            <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold tracking-tight">Task Verification Queue</h2>
                <RefreshDataButton cachePrefix="assign-tasks" onRefresh={fetchPendingTasks} />
            </div>

            {/* --- BULK ACTION BAR --- */}
            {selectedIds.size > 0 && (
                <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            {selectedIds.size}
                        </div>
                        <div>
                            <p className="font-bold text-amber-500">Items Selected</p>
                            <p className="text-xs text-amber-500/80 font-medium tracking-wide">Bulk verify will approve these tasks without modifications.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white font-bold">
                            Cancel
                        </Button>
                        <Button onClick={handleBulkVerify} disabled={verifyAllTasks} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                            {verifyAllTasks ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                            Verify Selected Tasks
                        </Button>
                    </div>
                </div>
            )}

            <Card className="shadow-xl bg-card border-border">
                <CardContent className="p-6">

                    {/* --- FIXED FILTER SECTION WITH BORDERS --- */}
                    <div className="flex flex-wrap gap-4 mb-8 p-4 rounded-xl border border-border items-end bg-secondary/10">
                        <div className="space-y-1.5 flex flex-col w-full sm:w-[300px]">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Task Date Range</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-bold h-10 border-input bg-background text-foreground",
                                            !dateRange && "text-muted-foreground font-medium"
                                        )}
                                    >
                                        <IconCalendar className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                                            ) : (format(dateRange.from, "LLL dd, y"))
                                        ) : (
                                            <span>All Dates</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 border-border bg-card" align="start">
                                    <Calendar
                                        mode="range"
                                        defaultMonth={dateRange?.from || new Date()}
                                        selected={dateRange}
                                        onSelect={setDateRange}
                                        numberOfMonths={2}
                                        className="bg-card text-foreground border-border"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Search Queue</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Salesman, Area, Dealer..."
                                    className="w-[250px] pl-9 border-input bg-background focus:border-primary transition-colors font-medium"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Salesman</Label>
                            <Select value={selectedSalesmanFilter} onValueChange={setSelectedSalesmanFilter}>
                                <SelectTrigger className="w-[200px] border-input bg-background font-bold">
                                    <SelectValue placeholder="All Salesmen" />
                                </SelectTrigger>
                                <SelectContent className="border-border bg-card font-medium">
                                    <SelectItem value="all">All Salesmen</SelectItem>
                                    {Array.from(new Set(pendingTasks.map(p => p.salesmanName)))
                                        .filter((name): name is string => Boolean(name))
                                        .sort()
                                        .map(n => (
                                            <SelectItem key={n} value={n}>{n}</SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Region</Label>
                            <Select value={selectedRegionFilter} onValueChange={setSelectedRegionFilter}>
                                <SelectTrigger className="w-[200px] border-input bg-background font-bold">
                                    <SelectValue placeholder="All Regions" />
                                </SelectTrigger>
                                <SelectContent className="border-border bg-card font-medium">
                                    <SelectItem value="all">All Regions</SelectItem>
                                    {Zone.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            variant="ghost"
                            className="text-muted-foreground hover:text-foreground hover:bg-secondary h-10 transition-all font-bold"
                            onClick={() => { setSearchQuery(""); setSelectedSalesmanFilter("all"); setSelectedRegionFilter("all"); setDateRange(undefined); }}
                        >
                            <FilterX className="w-4 h-4 mr-2" /> Reset Filters
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
                            <p className="text-muted-foreground font-medium">Loading Tasks...</p>
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8 border rounded-lg bg-secondary/20 font-medium">
                            No pending tasks found matching your filters.
                        </div>
                    ) : (
                        <div className="rounded-md border border-border">
                            <DataTableReusable columns={taskVerificationColumns} data={filteredTasks} enableRowDragging={false} onRowOrderChange={() => { }} />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isModificationDialogOpen} onOpenChange={setIsModificationDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-primary text-xl"><ClipboardCheck /> Review & Link Task</DialogTitle>
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

                        {/* Update 2: Added missing fields from Flutter app */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground">Dealer/Visiting Name</Label>
                                <Input value={taskToModify?.dealerNameSnapshot ?? ''} onChange={e => setTaskToModify(p => p ? { ...p, dealerNameSnapshot: e.target.value } : null)} className="bg-background border-input font-medium" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3"/> Dealer Mobile</Label>
                                <Input value={taskToModify?.dealerMobile ?? ''} onChange={e => setTaskToModify(p => p ? { ...p, dealerMobile: e.target.value } : null)} className="bg-background border-input font-medium" />
                            </div>
                        </div>

                        <Separator className="bg-border" />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground">Area</Label>
                                <Input value={taskToModify?.area ?? ''} onChange={e => setTaskToModify(p => p ? { ...p, area: e.target.value } : null)} className="bg-background border-input font-medium" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3"/> Zone</Label>
                                <Select value={taskToModify?.zone || 'Kamrup'} onValueChange={v => setTaskToModify(p => p ? { ...p, zone: v } : null)}>
                                    <SelectTrigger className="h-9 bg-background font-medium"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Zone.map((z) => (
                                            <SelectItem key={z} value={z}>{z}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Objective</Label>
                                <Select value={taskToModify?.objective || 'Order Related'} onValueChange={v => setTaskToModify(p => p ? { ...p, objective: v } : null)}>
                                    <SelectTrigger className="h-9 bg-background font-medium"><SelectValue /></SelectTrigger>
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
                                    <SelectTrigger className="h-9 bg-background font-medium"><SelectValue /></SelectTrigger>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Route className="w-3 h-3" /> Planned Route / Address</Label>
                                <Input value={taskToModify?.route ?? ''} onChange={e => setTaskToModify(p => p ? { ...p, route: e.target.value } : null)} className="bg-background border-input text-xs font-mono font-medium" />
                            </div>
                            <div className="space-y-1 flex gap-2">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3 h-3"/> Week</Label>
                                    <Select value={taskToModify?.week || 'week1'} onValueChange={v => setTaskToModify(p => p ? { ...p, week: v } : null)}>
                                        <SelectTrigger className="h-9 bg-background font-medium"><SelectValue /></SelectTrigger>
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
                                    <Input type="number" min={1} value={taskToModify?.requiredVisitCount ?? 1} onChange={e => setTaskToModify(p => p ? { ...p, requiredVisitCount: parseInt(e.target.value) || 1 } : null)} className="bg-background border-input font-medium" />
                                </div>
                            </div>
                        </div>

                        <Separator className="bg-border" />

                        <div className="w-1/2 space-y-1">
                            <Label className="text-xs font-bold text-muted-foreground">Task Date</Label>
                            <Input type="date" value={taskToModify?.taskDate ?? ''} onChange={e => setTaskToModify(p => p ? { ...p, taskDate: e.target.value } : null)} className="bg-background border-input font-medium" />
                        </div>

                        <DialogFooter className="gap-2 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setIsModificationDialogOpen(false)} className="border-border font-bold text-muted-foreground hover:text-foreground">Cancel</Button>
                            <Button type="submit" disabled={isPatching} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wide">
                                {isPatching ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Check className="mr-2 w-4 h-4" />} Finalize & Verify
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}