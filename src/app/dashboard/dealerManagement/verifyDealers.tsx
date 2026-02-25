// src/app/dashboard/dealerManagement/verifyDealers.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Check } from 'lucide-react';
// Shadcn UI Components
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DataTableReusable } from '@/components/data-table-reusable';
import { selectDealerSchema } from '../../../../drizzle/zodSchemas';

const extendedDealerSchema = selectDealerSchema.partial().extend({
    id: z.string(), // Ensure ID is always a string for DataTableReusable
    name: z.string().optional().catch("Unknown"),
    phoneNo: z.string().optional().catch("N/A"),
    region: z.string().nullable().optional(),
    nameOfFirm: z.string().nullable().optional(),
    underSalesPromoterName: z.string().nullable().optional(),
    gstinNo: z.string().nullable().optional(),
    tradeLicNo: z.string().nullable().optional(),
    dealerPicUrl: z.string().nullable().optional(),
    shopPicUrl: z.string().nullable().optional(),
});

type DealerRecord = z.infer<typeof extendedDealerSchema>;

const renderSelectFilter = (
    label: string,
    value: string,
    onValueChange: (v: string) => void,
    options: string[],
    isLoading: boolean = false
) => (
    <div className="flex flex-col space-y-1 w-full sm:w-[150px] min-w-[120px]">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
            <SelectTrigger className="h-9">
                {isLoading ? (
                    <div className="flex flex-row items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-muted-foreground">Loading...</span>
                    </div>
                ) : (
                    <SelectValue placeholder={`Select ${label}`} />
                )}
            </SelectTrigger>
            <SelectContent>
                {/* 'all' item for showing all records */}
                <SelectItem value="all">All {label}s</SelectItem>
                {options.map(option => (
                    <SelectItem key={option} value={option}>
                        {option}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </div>
);

export default function VerifyDealersPage() {
    const [pendingDealers, setPendingDealers] = useState<DealerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Filters: Search, Region, Area, Type ---
    const [searchQuery, setSearchQuery] = useState(''); // Added Search State
    const [selectedFirmNameFilter, setSelectedFirmNameFilter] = useState<string>('all');
    const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkVerifying, setIsBulkVerifying] = useState(false);

    // --- Delete loading state ---
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const apiURI = `/api/dashboardPagesAPI/dealerManagement/dealer-verify`;
    const deleteApiURI = `/api/dashboardPagesAPI/dealerManagement`;
    const bulkVerifyURI = `/api/dashboardPagesAPI/dealerManagement/dealer-verify/bulk-verify`;

    // --- Fetch Pending Dealers ---
    const fetchPendingDealers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch ONLY PENDING dealers
            const response = await fetch(`${apiURI}?status=PENDING`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const data = await response.json();

            const dealersArray = Array.isArray(data) ? data : data.dealers;

            const validatedDealers = z.array(extendedDealerSchema).parse(dealersArray);
            setPendingDealers(validatedDealers);
            toast.success(`Loaded ${validatedDealers.length} pending dealers.`, { duration: 2000 });
        } catch (e: any) {
            console.error("Failed to fetch pending dealers:", e);
            const message = e instanceof z.ZodError
                ? "Data validation failed. Schema mismatch with backend."
                : (e.message || "An unknown error occurred.");

            toast.error(`Failed to load pending dealers: ${message}`);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [apiURI]);

    useEffect(() => {
        fetchPendingDealers();
    }, [fetchPendingDealers]);


    // --- Handle Verification/Rejection Action (PUT request) ---
    const handleVerificationAction = async (dealerId: string, action: 'VERIFIED') => {
        console.log(`Attempting to set dealer ID: ${dealerId} status to ${action}`);

        toast.loading(`Updating dealer status to ${action}...`, { id: 'verification-status' });

        try {
            // Call the PUT endpoint with the dealer ID as a query param and the status in the body
            const response = await fetch(`${apiURI}?id=${dealerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                // Sending 'verificationStatus' to match the fixed backend logic
                body: JSON.stringify({ verificationStatus: action }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || errorData.error || "Verification failed.");
            }

            toast.success(`Dealer successfully marked as ${action}!`, { id: 'verification-status' });
            fetchPendingDealers();
        } catch (e: any) {
            toast.error(e.message || "An error occurred during verification.", { id: 'verification-status' });
        }
    };

    // --- NEW: Handler to DELETE a Dealer ---
    const handleDeleteDealer = async (id: string) => {
        setDeletingId(id); // Set loading state for this specific button
        const toastId = `delete-${id}`;
        toast.loading(`Rejecting and deleting dealer...`, { id: toastId });
        try {
            const response = await fetch(`${deleteApiURI}?id=${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete dealer');
            }

            toast.success('Dealer Rejected and Deleted', { id: toastId });
            fetchPendingDealers(); // Refresh the list
        } catch (e: any) {
            toast.error(e.message, { id: toastId });
        } finally {
            setDeletingId(null); // Clear loading state
        }
    };

    // --- Bulk Verification Logic ---
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedIds.size === filteredDealers.length && filteredDealers.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredDealers.map(p => p.id)));
        }
    };

    const handleBulkVerify = async () => {
        const idsToVerify = Array.from(selectedIds);
        if (idsToVerify.length === 0) return;

        setIsBulkVerifying(true);
        toast.loading(`Verifying ${idsToVerify.length} dealers...`, { id: 'bulk-verify' });

        try {
            const res = await fetch(bulkVerifyURI, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToVerify }),
            });

            if (!res.ok) throw new Error("Bulk verification failed");
            
            const data = await res.json();
            toast.success(`Successfully verified ${data.count} dealers!`, { id: 'bulk-verify' });
            
            setSelectedIds(new Set());
            fetchPendingDealers();
        } catch (error: any) {
            toast.error("Bulk verification failed", { id: 'bulk-verify' });
        } finally {
            setIsBulkVerifying(false);
        }
    };

    // --- NEW: Derived lists for filter dropdowns ---
    const nameOptions = React.useMemo(() => {
        const names = new Set<string>();
        pendingDealers.forEach((p) => {
            if (p.name) names.add(p.name);
        });
        return ['all', ...Array.from(names).sort()];
    }, [pendingDealers]);

    const firmNameOptions = React.useMemo(() => {
        const names = new Set<string>();
        pendingDealers.forEach((p) => {
            if (p.nameOfFirm) names.add(p.nameOfFirm);
        });
        return ['all', ...Array.from(names).sort()];
    }, [pendingDealers]);

    const regionOptions = React.useMemo(() => {
        const regions = new Set<string>();
        pendingDealers.forEach((p) => {
            if (p.region) regions.add(p.region);
        });
        return ['all', ...Array.from(regions).sort()];
    }, [pendingDealers]);

    // --- Client-side Filtering ---
    const filteredDealers = useMemo(() => {
        return pendingDealers.filter((dealer) => {
            // Search Query Filter
            const matchesSearch = !searchQuery ||
                (dealer.name || '').toLowerCase().includes(searchQuery.toLowerCase());

            // Dropdown Filters
            const matchesFirmName =
                selectedFirmNameFilter === 'all' ? true : dealer.nameOfFirm === selectedFirmNameFilter;

            const matchesRegion =
                selectedRegionFilter === 'all' ? true : dealer.region === selectedRegionFilter;

            return matchesSearch && matchesFirmName && matchesRegion;
        });
    }, [pendingDealers, searchQuery, selectedFirmNameFilter, selectedRegionFilter]);

    // --- Columns for PENDING Dealers Table (Updated accessors) ---
    const pendingDealerColumns: ColumnDef<DealerRecord>[] = [
        { accessorKey: 'name', header: 'Dealer Name', minSize: 150 },
        { accessorKey: 'phoneNo', header: 'Phone No.', minSize: 120 },
        { accessorKey: 'region', header: 'Region(Zone)', minSize: 100 },
        { accessorKey: 'nameOfFirm', header: 'Firm Name', minSize: 100 },
        { accessorKey: 'underSalesPromoterName', header: 'SP Name', minSize: 100 },
        { accessorKey: 'gstinNo', header: 'GSTIN', minSize: 150, cell: info => info.getValue() || <span className='text-gray-400'>N/A</span> },
        { accessorKey: 'tradeLicNo', header: 'Trade Lic. No.', minSize: 120, cell: info => info.getValue() || <span className='text-gray-400'>N/A</span> },
        {
            accessorKey: 'dealerPicUrl', header: 'Dealer/ID Pic', minSize: 100,
            cell: ({ row }) => row.original.dealerPicUrl ? (
                <a
                    href={row.original.dealerPicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 underline text-sm truncate max-w-[100px] block"
                >
                    View Dealer Pic
                </a>
            ) : (<span className='text-gray-400 text-sm'>N/A</span>),
        },
        {
            accessorKey: 'shopPicUrl', header: 'Shop Pic', minSize: 100,
            cell: ({ row }) => row.original.shopPicUrl ? (
                <a
                    href={row.original.shopPicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 underline text-sm truncate max-w-[100px] block"
                >
                    View Shop Pic
                </a>
            ) : (<span className='text-gray-400 text-sm'>N/A</span>),
        },
        {
            id: 'verificationActions',
            header: 'Actions',
            minSize: 180,
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button
                        variant="default"
                        size="sm"
                        className='bg-green-500 hover:bg-green-700 h-8'
                        onClick={() => handleVerificationAction(row.original.id, 'VERIFIED')}
                        disabled={deletingId === row.original.id}
                    >
                        Verify
                    </Button>
                    <Button
                        className="bg-red-800 hover:bg-red-900 text-white h-8"
                        size="sm"
                        onClick={() => handleDeleteDealer(row.original.id)}
                        disabled={deletingId === row.original.id}
                    >
                        Reject
                    </Button>
                </div>
            ),
        },
        {
            id: 'select',
            header: () => (
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        onChange={selectAll}
                        checked={selectedIds.size === filteredDealers.length && filteredDealers.length > 0}
                        className="h-4 w-4 rounded border-slate-700 text-primary focus:ring-primary cursor-pointer"
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={selectedIds.has(row.original.id)}
                        onChange={() => toggleSelect(row.original.id)}
                        className="h-4 w-4 rounded border-slate-700 text-primary focus:ring-primary cursor-pointer"
                    />
                </div>
            ),
            size: 40,
            enableSorting: false,
        },
    ];

    return (
        <Card className='mt-4 shadow-xl'>
            <CardHeader className='rounded-t-lg'>
                <CardTitle className='text-2xl'>Dealer Verification Queue</CardTitle>
                <CardDescription>
                    Review new dealer submissions. Check all required documentation (GSTIN, Registration, ID pic, Shop pic) before verifying.
                </CardDescription>
            </CardHeader>
            <CardContent className='p-6'>

                {/* --- Bulk Action Bar --- */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center justify-between p-4 mb-6 bg-amber-50 border border-amber-200 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <div className="h-8 w-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
                                {selectedIds.size}
                            </div>
                            <div>
                                <p className="text-amber-900 font-medium">Dealers Selected</p>
                                <p className="text-xs text-amber-700">These dealers will be marked as verified immediately.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedIds(new Set())}
                                className="text-amber-800 hover:bg-amber-100"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleBulkVerify}
                                disabled={isBulkVerifying}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                            >
                                {isBulkVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                                Verify {selectedIds.size} Dealers
                            </Button>
                        </div>
                    </div>
                )}

                {/* --- Filter Controls --- */}
                <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border mb-6">
                    {/* 1. Name Search Input */}
                    <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
                        <label className="text-sm font-medium text-muted-foreground">Dealer Name</label>
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 h-9"
                            />
                        </div>
                    </div>

                    {/* 2. Firm Name Filter */}
                    {renderSelectFilter(
                        'Firm Name',
                        selectedFirmNameFilter,
                        setSelectedFirmNameFilter,
                        firmNameOptions,
                        loading
                    )}

                    {/* 3. Region Filter */}
                    {renderSelectFilter(
                        'Region(Zone)',
                        selectedRegionFilter,
                        setSelectedRegionFilter,
                        regionOptions,
                        loading
                    )}
                </div>
                {/* --- END: Filter Controls --- */}

                {loading ? (
                    <div className="text-center py-12 text-blue-500 flex items-center justify-center space-x-2">
                        <span>Loading pending dealers...</span>
                    </div>
                ) : error ? (
                    <div className="text-center text-red-500 py-12 border border-red-200 bg-red-50 rounded-lg p-4">
                        <p className='font-semibold'>Error loading dealers.</p>
                        <p className='text-sm text-red-400'>{error}</p>
                    </div>
                ) : pendingDealers.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                        <span className='text-lg font-medium'>No new dealers pending verification.</span>
                        <p className='text-sm mt-1'>You're all caught up!</p>
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto">
                        <DataTableReusable
                            columns={pendingDealerColumns}
                            data={filteredDealers}
                            enableRowDragging={false}
                            onRowOrderChange={() => { }}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}