// src/app/dashboard/dealerManagement/addAndListDealers.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { MultiSelect } from '@/components/multi-select';
import { DataTableReusable } from '@/components/data-table-reusable';
// Define the valid regions and areas
import { dealerTypes, brands } from '@/lib/Reusable-constants'
import { useDealerLocations } from '@/components/reusable-dealer-locations';
import { selectDealerSchema } from '../../../../drizzle/zodSchemas';

// Schema for form submission, which transforms string inputs to numbers.
const addDealerFormSchema = z.object({
    name: z.string().min(1, "Dealer name is required."),
    type: z.string().min(1, "Dealer type is required."),
    parentDealerId: z.string().optional().nullable(),
    region: z.string().min(1, "Region is required."),
    area: z.string().min(1, "Area is required."),
    phoneNo: z.string().min(1, "Phone number is required.").max(20, "Phone number is too long."),
    address: z.string().min(1, "Address is required.").max(500, "Address is too long."),
    pinCode: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    dateOfBirth: z.string().nullable().optional(),       // ISO date
    anniversaryDate: z.string().nullable().optional(),   // ISO date
    totalPotential: z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= 0, {
        message: "Total potential must be 0 or positive number.",
    }),
    bestPotential: z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= 0, {
        message: "Best potential must be 0 or positive number.",
    }),
    brandSelling: z.array(z.string()).min(1, "At least one brand must be selected."),
    feedbacks: z.string().min(1, "Feedbacks are required.").max(500, "Feedbacks are too long."),
    remarks: z.string().nullable().optional(),
});

type DealerRecord = z.infer<typeof selectDealerSchema>;

export default function AddAndListDealersPage() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<z.ZodIssue[]>([]);
    const [dealers, setDealers] = useState<DealerRecord[]>([]);
    const [loadingDealers, setLoadingDealers] = useState(true);
    const [errorDealers, setErrorDealers] = useState<string | null>(null);

    // Form State
    const [name, setName] = useState<string>('');
    const [type, setType] = useState<string>('');
    const [region, setRegion] = useState<string>('');
    const [area, setArea] = useState<string>('');
    const [phoneNo, setPhoneNo] = useState<string>('');
    const [address, setAddress] = useState<string>('');
    const [pinCode, setPinCode] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [anniversaryDate, setAnniversaryDate] = useState('');
    const [totalPotential, setTotalPotential] = useState<string>('');
    const [bestPotential, setBestPotential] = useState<string>('');
    const [brandSelling, setBrandSelling] = useState<string[]>([]);
    const [feedbacks, setFeedbacks] = useState<string>('');
    const [remarks, setRemarks] = useState<string>('');
    // --- State for Delete Confirmation Dialog ---
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [dealerToDeleteId, setDealerToDeleteId] = useState<string | null>(null);
    //.    Dropdown filter by area and region
    const [filterRegion, setFilterRegion] = useState<string>('');
    const [filterArea, setFilterArea] = useState<string>('');
    const { locations, loading: locationsLoading, error: locationsError } = useDealerLocations();
    // Parent dealer setting for sub dealers
    const [parentDealerId, setParentDealerId] = useState<string | null>(null);
    const isSubDealer = type.startsWith("Sub Dealer");

    const apiURI = `/api/dashboardPagesAPI/dealerManagement`;

    // --- Fetch Dealers for the Table (UPDATED to fetch ONLY VERIFIED dealers) ---
    const fetchDealers = useCallback(async () => {
        setLoadingDealers(true);
        setErrorDealers(null);
        try {
            // Fetch ONLY VERIFIED dealers by passing a query parameter
            const response = await fetch(`${apiURI}?status=VERIFIED`);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Response Error Text:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            const validatedDealers = z.array(selectDealerSchema).parse(data);
            setDealers(validatedDealers);
            toast.success('Verified dealers loaded successfully!');
        } catch (e: any) {
            console.error("Failed to fetch dealers:", e);
            const message = e instanceof z.ZodError 
                ? "Data validation failed. Schema mismatch with backend." 
                : (e.message || "An unknown error occurred.");
            toast.error(`Failed to load dealers: ${message}`);
            setErrorDealers(message);
        } finally {
            setLoadingDealers(false);
        }
    }, [apiURI]);

    useEffect(() => {
        fetchDealers();
    }, [fetchDealers]);

    // --- Form Submission Handler ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormErrors([]);
        setIsSubmitting(true);

        const formData = {
            name,
            type,
            region,
            area,
            phoneNo,
            address,
            pinCode: pinCode || undefined,
            latitude: latitude || undefined,
            longitude: longitude || undefined,
            dateOfBirth: dateOfBirth || undefined,
            anniversaryDate: anniversaryDate || undefined,
            totalPotential,
            bestPotential,
            brandSelling,
            feedbacks,
            remarks: remarks || undefined,
            parentDealerId: isSubDealer ? parentDealerId : undefined,
        };

        const validationResult = addDealerFormSchema.safeParse(formData);

        if (!validationResult.success) {
            setFormErrors(validationResult.error.issues);
            toast.error("Please correct the form errors.");
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await fetch(apiURI, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(validationResult.data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || errorData.error || "Failed to add dealer.");
            }

            toast.success("Dealer added successfully!");
            setIsFormOpen(false);
            fetchDealers();

            // Reset form state
            setName('');
            setType('');
            setParentDealerId('');
            setRegion('');
            setArea('');
            setPhoneNo('');
            setAddress('');
            setPinCode('');
            setLatitude('');
            setLongitude('');
            setDateOfBirth('');
            setAnniversaryDate('');
            setTotalPotential('');
            setBestPotential('');
            setBrandSelling([]);
            setFeedbacks('');
            setRemarks('');

        } catch (e: any) {
            console.error("Error adding dealer:", e);
            toast.error(e.message || "An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Delete Handler ---
    const handleDelete = async () => {
        if (!dealerToDeleteId) return;

        try {
            const response = await fetch(`${apiURI}?id=${dealerToDeleteId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || errorData.error || "Failed to delete dealer.");
            }

            toast.success("Dealer deleted successfully!");
            setIsDeleteDialogOpen(false);
            setDealerToDeleteId(null);
            fetchDealers(); // Re-fetch the dealers to update the table
        } catch (e: any) {
            console.error("Error deleting dealer:", e);
            toast.error(e.message || "An unexpected error occurred.");
        }
    };

    // Helper to find and display form errors
    const findFormError = (path: string) => {
        return formErrors.find(error => error.path[0] === path)?.message;
    };

    // filter handlers for area and region
    const filteredDealers = dealers.filter(d =>
        (filterRegion && filterRegion !== "all" ? d.region === filterRegion : true) &&
        (filterArea && filterArea !== "all" ? d.area === filterArea : true)
    );

    if (loadingDealers || locationsLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                Loading dealer data...
            </div>
        );
    }

    if (errorDealers || locationsError) {
        return (
            <div className="text-center text-red-500 min-h-screen pt-10">
                Error: {errorDealers || locationsError}
            </div>
        );
    }

    // Columns for the Dealers table
    const dealerColumns: ColumnDef<DealerRecord>[] = [
        { accessorKey: 'name', header: 'Name' },
        { accessorKey: 'type', header: 'Type' },
        {
            accessorKey: 'parentDealerName', header: 'Parent Dealer',
            cell: info => info.getValue() || '-'
        },
        { accessorKey: 'region', header: 'Region' },
        { accessorKey: 'area', header: 'Area' },
        { accessorKey: 'address', header: 'Address' },
        { accessorKey: 'pinCode', header: 'Pin Code' },
        { accessorKey: 'dateOfBirth', header: 'DOB', cell: info => info.getValue() || '-' },
        { accessorKey: 'anniversaryDate', header: 'Anniversary', cell: info => info.getValue() || '-' },
        { accessorKey: 'phoneNo', header: 'Phone No.' },
        {
            accessorKey: 'totalPotential', header: 'Total Potential',
            cell: info => (info.getValue() as number)?.toFixed(2)
        },
        {
            accessorKey: 'bestPotential', header: 'Best Potential',
            cell: info => (info.getValue() as number)?.toFixed(2)
        },
        {
            accessorKey: 'brandSelling', header: 'Brands',
            cell: info => (info.getValue() as string[]).join(', ')
        },
        {
            accessorKey: 'createdAt', header: 'Added On',
            cell: info => new Date(info.getValue() as string).toLocaleDateString()
        },
        {
            accessorKey: 'verificationStatus', header: 'Status',
            cell: info => (info.getValue() as string[])
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                        setDealerToDeleteId(row.original.id);
                        setIsDeleteDialogOpen(true);
                    }}
                >
                    Delete
                </Button>
            ),
        },
    ];

    return (
        <div className="container mx-auto p-4">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold">Manage Dealers</h1>
                <Button onClick={() => setIsFormOpen(true)}>+ Add New Dealer</Button>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Add new dealer or sub-dealer records to your system.
            </p>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add New Dealer</DialogTitle>
                        <DialogDescription>
                            Fill in the details to add a new dealer or sub-dealer.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                        {/* Dealer Name */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Dealer/Sub-Dealer Name <span className="text-red-500">*</span>
                            </Label>
                            <div className="col-span-3">
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter dealer name"
                                />
                                {findFormError('name') && (
                                    <p className="text-red-500 text-sm mt-1">{findFormError('name')}</p>
                                )}
                            </div>
                        </div>

                        {/* Type */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">
                                Type <span className="text-red-500">*</span>
                            </Label>
                            <div className="col-span-3">
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select dealer type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dealerTypes.map(dType => (
                                            <SelectItem key={dType} value={dType}>
                                                {dType}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {findFormError('type') && (
                                    <p className="text-red-500 text-sm mt-1">{findFormError('type')}</p>
                                )}
                            </div>
                        </div>

                        {/* Parent Dealer (only if sub-dealer) */}
                        {type.startsWith("Sub Dealer") && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="parentDealer" className="text-right">
                                    Parent Dealer <span className="text-red-500">*</span>
                                </Label>
                                <div className="col-span-3">
                                    <Select value={parentDealerId || ""} onValueChange={setParentDealerId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select parent dealer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {dealers
                                                .filter(d => d.type.startsWith("Dealer")) // only top-level dealers
                                                .map(d => (
                                                    <SelectItem key={d.id} value={d.id}>
                                                        {d.name} ({d.type})
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    {findFormError('parentDealerId') && (
                                        <p className="text-red-500 text-sm mt-1">{findFormError('parentDealerId')}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Region - Converted to Input */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="region" className="text-right">
                                Region <span className="text-red-500">*</span>
                            </Label>
                            <div className="col-span-3">
                                <Input
                                    id="region"
                                    value={region}
                                    onChange={(e) => setRegion(e.target.value)}
                                    placeholder="Enter region"
                                />
                                {findFormError('region') && (
                                    <p className="text-red-500 text-sm mt-1">{findFormError('region')}</p>
                                )}
                            </div>
                        </div>

                        {/* Area - Converted to Input */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="area" className="text-right">
                                Area <span className="text-red-500">*</span>
                            </Label>
                            <div className="col-span-3">
                                <Input
                                    id="area"
                                    value={area}
                                    onChange={(e) => setArea(e.target.value)}
                                    placeholder="Enter area"
                                />
                                {findFormError('area') && (
                                    <p className="text-red-500 text-sm mt-1">{findFormError('area')}</p>
                                )}
                            </div>
                        </div>

                        {/* Phone Number */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="phoneNo" className="text-right">
                                Phone No. <span className="text-red-500">*</span>
                            </Label>
                            <div className="col-span-3">
                                <Input
                                    id="phoneNo"
                                    value={phoneNo}
                                    onChange={(e) => setPhoneNo(e.target.value)}
                                    placeholder="Enter phone number"
                                />
                                {findFormError('phoneNo') && (
                                    <p className="text-red-500 text-sm mt-1">{findFormError('phoneNo')}</p>
                                )}
                            </div>
                        </div>

                        {/* Address */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="address" className="text-right">
                                Address <span className="text-red-500">*</span>
                            </Label>
                            <div className="col-span-3">
                                <Textarea
                                    id="address"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Enter full address"
                                    className="h-24"
                                />
                                {findFormError('address') && (
                                    <p className="text-red-500 text-sm mt-1">{findFormError('address')}</p>
                                )}
                            </div>
                        </div>

                        {/* Pin Code */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="pinCode" className="text-right">Pin Code</Label>
                            <div className="col-span-3">
                                <Input id="pinCode" value={pinCode} onChange={(e) => setPinCode(e.target.value)} placeholder="Optional" />
                            </div>
                        </div>

                        {/* --- NEW LATITUDE FIELD --- */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="latitude" className="text-right">Latitude</Label>
                            <div className="col-span-3">
                                <Input id="latitude" type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Optional, e.g., 26.1445" />
                                {findFormError('latitude') && <p className="text-red-500 text-sm mt-1">{findFormError('latitude')}</p>}
                            </div>
                        </div>

                        {/* --- NEW LONGITUDE FIELD --- */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="longitude" className="text-right">Longitude</Label>
                            <div className="col-span-3">
                                <Input id="longitude" type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Optional, e.g., 91.7362" />
                                {findFormError('longitude') && <p className="text-red-500 text-sm mt-1">{findFormError('longitude')}</p>}
                            </div>
                        </div>

                        {/* DOB */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="dateOfBirth" className="text-right">Date of Birth</Label>
                            <div className="col-span-3">
                                <Input id="dateOfBirth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                            </div>
                        </div>

                        {/* Anniversary */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="anniversaryDate" className="text-right">Anniversary</Label>
                            <div className="col-span-3">
                                <Input id="anniversaryDate" type="date" value={anniversaryDate} onChange={(e) => setAnniversaryDate(e.target.value)} />
                            </div>
                        </div>

                        {/* Total Potential */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="totalPotential" className="text-right">
                                Total Potential <span className="text-red-500">*</span>
                            </Label>
                            <div className="col-span-3">
                                <Input
                                    id="totalPotential"
                                    type="number"
                                    step="0.01"
                                    value={totalPotential}
                                    onChange={(e) => setTotalPotential(e.target.value)}
                                    placeholder="Enter total potential"
                                />
                                {findFormError('totalPotential') && (
                                    <p className="text-red-500 text-sm mt-1">{findFormError('totalPotential')}</p>
                                )}
                            </div>
                        </div>

                        {/* Best Potential */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="bestPotential" className="text-right">
                                Best Potential <span className="text-red-500">*</span>
                            </Label>
                            <div className="col-span-3">
                                <Input
                                    id="bestPotential"
                                    type="number"
                                    step="0.01"
                                    value={bestPotential}
                                    onChange={(e) => setBestPotential(e.target.value)}
                                    placeholder="Enter best potential"
                                />
                                {findFormError('bestPotential') && (
                                    <p className="text-red-500 text-sm mt-1">{findFormError('bestPotential')}</p>
                                )}
                            </div>
                        </div>

                        {/* Brand Selling */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="brandSelling" className="text-right">
                                Brands Selling <span className="text-red-500">*</span>
                            </Label>
                            <div className="col-span-3">
                                <MultiSelect
                                    options={brands.map(brand => ({ label: brand, value: brand }))}
                                    selectedValues={brandSelling}
                                    onValueChange={setBrandSelling}
                                    placeholder="Select brands"
                                />
                                {findFormError('brandSelling') && (
                                    <p className="text-red-500 text-sm mt-1">{findFormError('brandSelling')}</p>
                                )}
                            </div>
                        </div>

                        {/* Feedbacks */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="feedbacks" className="text-right">
                                Feedbacks <span className="text-red-500">*</span>
                            </Label>
                            <div className="col-span-3">
                                <Textarea
                                    id="feedbacks"
                                    value={feedbacks}
                                    onChange={(e) => setFeedbacks(e.target.value)}
                                    placeholder="Enter feedbacks"
                                    className="h-24"
                                />
                                {findFormError('feedbacks') && (
                                    <p className="text-red-500 text-sm mt-1">{findFormError('feedbacks')}</p>
                                )}
                            </div>
                        </div>

                        {/* Remarks (Optional) */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="remarks" className="text-right">
                                Remarks
                            </Label>
                            <div className="col-span-3">
                                <Textarea
                                    id="remarks"
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Optional: Add any remarks"
                                    className="h-24"
                                />
                                {findFormError('remarks') && (
                                    <p className="text-red-500 text-sm mt-1">{findFormError('remarks')}</p>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Adding..." : "Add Dealer"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Are you absolutely sure?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently delete the dealer record.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-4">

                    {/* Region Filter */}
                    <Select value={filterRegion} onValueChange={setFilterRegion}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Region" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Regions</SelectItem>
                            {locations.regions.sort().map(region => (
                                <SelectItem key={region} value={region}>
                                    {region}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Area Filter */}
                    <Select value={filterArea} onValueChange={setFilterArea}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Area" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Areas</SelectItem>
                            {locations.areas.sort().map(areas => (
                                <SelectItem key={areas} value={areas}>
                                    {areas}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                </div>
            </div>

            {/* Dealers Table */}
            <h2 className="text-2xl font-bold mt-10 mb-4">Existing Dealers</h2>
            {loadingDealers ? (
                <div className="text-center py-8">Loading dealers...</div>
            ) : errorDealers ? (
                <div className="text-center text-red-500 py-8">Error loading dealers: {errorDealers}</div>
            ) : dealers.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No dealers found for your company.</div>
            ) : (
                <div className="bg-card p-6 rounded-lg border border-border">
                    <DataTableReusable
                        columns={dealerColumns}
                        data={filteredDealers}
                        enableRowDragging={false}
                        onRowOrderChange={() => { }}
                    />
                </div>
            )}
        </div>
    );
}