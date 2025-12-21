// src/app/dashboard/masonpcSide/masonpc.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Loader2,
  Search,
  Check,
  X,
  Eye,
  ExternalLink,
  Save,
  ChevronsUpDown // Added for Combobox
} from 'lucide-react';

// Import the reusable DataTable
import { DataTableReusable } from '@/components/data-table-reusable';
// Import UI Components
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
// ADDED: Imports for Searchable Dropdown (Combobox)
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// --- CONSTANTS AND TYPES ---
const MASON_PC_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/mason-pc`;
const MASON_PC_ACTION_API_BASE = `/api/dashboardPagesAPI/masonpc-side/mason-pc`;
const MASON_PC_FORM_OPTIONS = `/api/dashboardPagesAPI/masonpc-side/mason-pc/form-options`;
const ROLES_API_ENDPOINT = `/api/users/user-roles`;
const LOCATION_API_ENDPOINT = `/api/users/user-locations`;

export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NONE';

export interface MasonPcFullDetails {
  id: string;
  name: string;
  phoneNumber?: string | null;
  kycDocumentName?: string | null;
  kycDocumentIdNum?: string | null;
  kycStatus?: string | null;

  pointsBalance?: number | null;
  bagsLifted?: number | null;
  isReferred?: boolean | null;

  // joined user info
  salesmanName?: string;
  role?: string;
  area?: string;
  region?: string;

  // NEW: Assignment IDs for editing
  userId?: number | null;
  dealerId?: string | null;
  siteId?: string | null;
  dealerName?: string | null;
  siteName?: string | null;
  deviceId?: string | null;

  // KYC details
  kycVerificationStatus: KycVerificationStatus;
  kycAadhaarNumber?: string | null;
  kycPanNumber?: string | null;
  kycVoterIdNumber?: string | null;
  kycDocuments?: any;
  kycSubmissionRemark?: string | null;
  kycSubmittedAt?: string | null;
}

interface RolesResponse { roles: string[]; }
interface LocationsResponse { areas: string[]; regions: string[]; }
interface OptionItem { id: string | number; name: string; }

/**
 * Helper function to render the Select filter component 
 */
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

// Helper function to format JSON keys into readable labels
const formatDocKey = (key: string): string => {
  if (key === 'aadhaarFrontUrl') return 'Aadhaar Front';
  if (key === 'aadhaarBackUrl') return 'Aadhaar Back';
  if (key === 'panUrl') return 'PAN Card';
  if (key === 'voterUrl') return 'Voter ID';
  // Fallback for any other keys
  return key.replace('Url', '').replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
};


// --- NEW REUSABLE COMPONENT: SearchableSelect ---
interface SearchableSelectProps {
  options: OptionItem[];
  value: string; // We treat the selected ID as string (or 'null')
  onChange: (value: string) => void;
  placeholder: string;
  isLoading?: boolean;
}

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  isLoading = false
}: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);

  // Find the selected item object to display its name
  const selectedItem = options.find((item) => String(item.id) === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={isLoading}
        >
          {value === 'null'
            ? placeholder
            : (selectedItem?.name || placeholder)}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {/* Option to Clear/Unassign */}
              <CommandItem
                value="-- Unassigned --"
                onSelect={() => {
                  onChange("null");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "null" ? "opacity-100" : "opacity-0"
                  )}
                />
                -- Unassigned --
              </CommandItem>

              {/* Mapped Options */}
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  // Use name for searching, but we'll select by ID
                  value={option.name}
                  onSelect={() => {
                    onChange(String(option.id));
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      String(option.id) === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};


// --- MAIN COMPONENT ---

export default function MasonPcPage() {
  const [allMasonPcRecords, setAllMasonPcRecords] = React.useState<MasonPcFullDetails[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [kycStatusFilter, setKycStatusFilter] = useState<KycVerificationStatus | 'all'>('all');

  // --- Filter Options States ---
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  const [roleError, setRoleError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // --- Action/Modal States ---
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MasonPcFullDetails | null>(null);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [pendingAction, setPendingAction] = useState<'VERIFIED' | 'REJECTED' | null>(null);

  // State for Dropdowns
  const [techUsers, setTechUsers] = useState<OptionItem[]>([]);
  const [dealers, setDealers] = useState<OptionItem[]>([]);
  const [sites, setSites] = useState<OptionItem[]>([]);

  // State for Editing
  const [editData, setEditData] = useState({ userId: 'null', dealerId: 'null', siteId: 'null' });
  const [isSaving, setIsSaving] = useState(false);


  const fetchMasonPcRecords = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch data based on the selected status filter
      const url = new URL(MASON_PC_API_ENDPOINT, window.location.origin);
      if (kycStatusFilter && kycStatusFilter !== 'all') {
        url.searchParams.set('kycStatus', kycStatusFilter);
      } else {
        url.searchParams.delete('kycStatus');
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('You are not authenticated. Redirecting to login.');
          window.location.href = '/login';
          return;
        }
        if (response.status === 403) {
          toast.error('You do not have permission to access this page. Redirecting.');
          window.location.href = '/dashboard';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: MasonPcFullDetails[] = await response.json();
      setAllMasonPcRecords(data);
      toast.success("Mason/PC records loaded successfully!");
    } catch (error: any) {
      console.error("Failed to fetch Mason/PC records:", error);
      toast.error(`Failed to fetch Mason/PC records: ${error.message}`);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [kycStatusFilter]);

  const fetchRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    setRoleError(null);
    try {
      const response = await fetch(ROLES_API_ENDPOINT);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data: RolesResponse = await response.json();
      setAvailableRoles(data.roles && Array.isArray(data.roles) ? data.roles.filter(Boolean) : []);
    } catch (err: any) {
      console.error('Failed to fetch filter roles:', err);
      setRoleError('Failed to load Role filters.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  // Fetch Locations (Areas & Regions)
  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data: LocationsResponse = await response.json();
      setAvailableAreas(Array.isArray(data.areas) ? data.areas.filter(Boolean) : []);
      setAvailableRegions(Array.isArray(data.regions) ? data.regions.filter(Boolean) : []);
    } catch (err: any) {
      console.error('Failed to fetch filter locations:', err);
      setLocationError('Failed to load Area/Region filters.');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  // Initial data loads
  React.useEffect(() => {
    fetchMasonPcRecords();
    fetchRoles();
    fetchLocations();
  }, [fetchMasonPcRecords, fetchRoles, fetchLocations]);

  // --- Action Handlers ---
  const handleVerificationAction = async (id: string, action: 'VERIFIED' | 'REJECTED', remarks: string = '') => {
    setIsUpdatingId(id);
    const toastId = `kyc-update-${id}`;
    toast.loading(`${action === 'VERIFIED' ? 'Accepting' : 'Rejecting'} KYC...`, { id: toastId });

    try {
      const response = await fetch(`${MASON_PC_ACTION_API_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationStatus: action,
          adminRemarks: remarks,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `${action} failed.`);
      }

      toast.success(`KYC successfully ${action}!`, { id: toastId });
      setAdminRemarks('');
      setIsRemarkModalOpen(false);
      fetchMasonPcRecords(); // Refresh the list
    } catch (e: any) {
      toast.error(e.message || 'An unknown error occurred.', { id: toastId });
    } finally {
      setIsUpdatingId(null);
      setPendingAction(null);
    }
  };

  const openActionWithRemark = (record: MasonPcFullDetails, action: 'VERIFIED' | 'REJECTED') => {
    setSelectedRecord(record);
    setPendingAction(action);
    setAdminRemarks('');
    setIsRemarkModalOpen(true);
  }

  // 1. Fetch Dropdown Data
  const fetchDropdownData = useCallback(async () => {
    try {
      const res = await fetch(MASON_PC_FORM_OPTIONS);
      if (res.ok) {
        const data = await res.json();
        setTechUsers(data.users || []);
        setDealers(data.dealers || []);
        setSites(data.sites || []);
      }
    } catch (e) {
      console.error("Failed to load dropdowns", e);
    }
  }, []);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  // 2. Prep Modal Data
  const handleViewKYC = (record: MasonPcFullDetails) => {
    setSelectedRecord(record);
    // Initialize edit state (convert nulls to string 'null' for Select component)
    setEditData({
      userId: record.userId ? String(record.userId) : 'null',
      dealerId: record.dealerId || 'null',
      siteId: record.siteId || 'null'
    });
    setIsViewModalOpen(true);
  };

  // 3. Save Function
  const handleSaveAssignments = async () => {
    if (!selectedRecord) return;
    setIsSaving(true);
    try {
      const payload = {
        userId: editData.userId === 'null' ? null : Number(editData.userId),
        dealerId: editData.dealerId === 'null' ? null : editData.dealerId,
        siteId: editData.siteId === 'null' ? null : editData.siteId,
      };

      const res = await fetch(`${MASON_PC_ACTION_API_BASE}/${selectedRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to save");

      toast.success("Assignments updated");
      fetchMasonPcRecords(); // Refresh list

      // Update local view immediately
      setSelectedRecord(prev => prev ? ({ ...prev, ...payload }) : null);

    } catch (e) {
      toast.error("Could not save assignments");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearMasonDeviceId = async (masonId: string) => {
    if (!confirm("Are you sure you want to clear this Mason's device lock?")) return;

    setIsSaving(true);
    try {
      const response = await fetch(`${MASON_PC_ACTION_API_BASE}/${masonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearDevice: true })
      });

      if (response.ok) {
        toast.success('Device ID cleared successfully');

        // 1. Refresh background data
        fetchMasonPcRecords();

        // 2. Update local modal state immediately
        setSelectedRecord((prev) => {
          if (!prev) return null;
          return { ...prev, deviceId: null };
        });
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to clear device');
      }
    } catch (err) {
      toast.error('Error connecting to server');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Filtering Logic ---
  const filteredRecords = useMemo<MasonPcFullDetails[]>(() => {
    return allMasonPcRecords.filter((record) => {
      const nameMatch =
        !searchQuery ||
        (record.name ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      const roleMatch =
        roleFilter === 'all' ||
        (record.role ?? '').toLowerCase() === roleFilter.toLowerCase();

      const areaMatch =
        areaFilter === 'all' ||
        (record.area ?? '').toLowerCase() === areaFilter.toLowerCase();

      const regionMatch =
        regionFilter === 'all' ||
        (record.region ?? '').toLowerCase() === regionFilter.toLowerCase();

      return nameMatch && roleMatch && areaMatch && regionMatch;
    });
  }, [allMasonPcRecords, searchQuery, roleFilter, areaFilter, regionFilter]);


  // --- 3. Define Columns for Mason/PC DataTable ---
  const masonPcColumns: ColumnDef<MasonPcFullDetails, unknown>[] = [
    { accessorKey: "name", header: "Mason Name" },
    { accessorKey: "phoneNumber", header: "Phone No." },
    {
      accessorKey: "kycVerificationStatus",
      header: "KYC Status",
      cell: ({ row }) => {
        const status = row.original.kycVerificationStatus;
        const upperStatus = status?.toUpperCase();
        let displayLabel = status;
        let color = 'text-gray-500';

        if (upperStatus === 'VERIFIED' || upperStatus === 'APPROVED') {
          displayLabel = 'VERIFIED';
          color = 'text-green-500';
        } else if (upperStatus === 'PENDING') {
          displayLabel = 'PENDING';
          color = 'text-yellow-500';
        } else if (upperStatus === 'REJECTED') {
          displayLabel = 'REJECTED';
          color = 'text-red-500';
        } else {
          displayLabel = status || 'NONE';
        }
        return <span className={`font-medium ${color}`}>{displayLabel}</span>;
      }
    },
    { accessorKey: "bagsLifted", header: "Bags Lifted" },
    { accessorKey: "pointsBalance", header: "Points Balance" },
    {
      accessorKey: "kycDocumentName",
      header: "KYC Doc",
      cell: ({ row }) => row.original.kycDocumentName || 'N/A'
    },
    { accessorKey: "salesmanName", header: "Associated TSO" },
    { accessorKey: "dealerName", header: "Associated Dealer" },
    { accessorKey: "area", header: "Area" },
    { accessorKey: "region", header: "Region(Zone)" },
    {
      id: 'actions',
      header: 'Actions',
      minSize: 200,
      cell: ({ row }) => {
        const record: any = row.original;
        const isUpdating = isUpdatingId === record.id;
        const isPending = record.kycVerificationStatus === 'PENDING';

        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewKYC(record)}
              disabled={isUpdating}
              className="text-blue-500 border-blue-500 hover:bg-blue-50"
            >
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>

            {isPending && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => openActionWithRemark(record, 'VERIFIED')}
                  disabled={isUpdating}
                >
                  {isUpdating && record.id === isUpdatingId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Accept
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openActionWithRemark(record, 'REJECTED')}
                  disabled={isUpdating}
                >
                  {isUpdating && record.id === isUpdatingId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
                  Reject
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const handleMasonPcOrderChange = (newOrder: MasonPcFullDetails[]) => {
    console.log("New Mason/PC order:", newOrder.map((r: any) => r.id));
  };

  if (isLoading) return <div className="flex justify-center items-center min-h-screen">Loading Mason/PC records...</div>;

  if (error) return (
    <div className="text-center text-red-500 min-h-screen pt-10">
      Error: {error}
      <Button onClick={() => fetchMasonPcRecords()} className="ml-4">Retry</Button>
    </div>
  );

  const kycStatusOptions: KycVerificationStatus[] = ['PENDING', 'VERIFIED', 'REJECTED', 'NONE'];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        {/* Header Section */}
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Mason/PC KYC Verification</h2>
        </div>

        {/* --- Filter Components --- */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border">

          {/* 1. KYC Status Filter */}
          {renderSelectFilter(
            'KYC Status',
            kycStatusFilter,
            (v) => { setKycStatusFilter(v as KycVerificationStatus | 'all'); },
            kycStatusOptions,
            false
          )}

          {/* 2. Mason Name Search Input */}
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-sm font-medium text-muted-foreground">Mason Name</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by mason name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* 4. Area Filter (Added) */}
          {renderSelectFilter(
            'Area',
            areaFilter,
            (v) => { setAreaFilter(v); },
            availableAreas,
            isLoadingLocations
          )}

          {/* 5. Region Filter (Added) */}
          {renderSelectFilter(
            'Region(Zone)',
            regionFilter,
            (v) => { setRegionFilter(v); },
            availableRegions,
            isLoadingLocations
          )}

          {roleError && <p className="text-xs text-red-500 w-full">Role Filter Error: {roleError}</p>}
          {locationError && <p className="text-xs text-red-500 w-full">Location Filter Error: {locationError}</p>}
        </div>
        {/* --- End Filter Components --- */}

        {/* Data Table Section */}
        <div className="bg-card p-6 rounded-lg border border-border">
          {filteredRecords.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No Mason/PC records found matching the selected filters.</div>
          ) : (
            <>
              <DataTableReusable<MasonPcFullDetails, unknown>
                columns={masonPcColumns}
                data={filteredRecords}
                enableRowDragging={false}
                onRowOrderChange={handleMasonPcOrderChange}
              />
            </>
          )}
        </div>
      </div>

      {/* --- View KYC Modal --- */}
      {selectedRecord && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>KYC Details for {selectedRecord.name}</DialogTitle>
              <DialogDescription>
                Review the full KYC information and update assignments.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">

              <div className="md:col-span-2 text-lg font-semibold border-b pb-2">Mason & Submission Info</div>
              <div>
                <Label htmlFor="name">Mason Name</Label>
                <Input id="name" value={selectedRecord.name} readOnly />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" value={selectedRecord.phoneNumber || 'N/A'} readOnly />
              </div>
              <div>
                <Label htmlFor="kycStatus">KYC Status (Master)</Label>
                <Input id="kycStatus" value={selectedRecord.kycVerificationStatus} readOnly />
              </div>
              <div>
                <Label htmlFor="submittedAt">Latest Submission Date</Label>
                <Input
                  id="submittedAt"
                  value={
                    selectedRecord.kycSubmittedAt
                      ? format(new Date(selectedRecord.kycSubmittedAt), 'LLL dd, yyyy \'at\' hh:mm a')
                      : 'N/A'
                  }
                  readOnly
                />
              </div>

              {/* --- ASSIGNMENT SECTION (Updated with SearchableSelect) --- */}
              <div className="md:col-span-2 flex items-center justify-between border-b pt-4 pb-2 mt-2">
                <span className="text-lg font-semibold">Assignments</span>
                <Button size="sm" onClick={handleSaveAssignments} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Changes
                </Button>
              </div>

              {/* Technical User Select */}
              <div className="flex flex-col space-y-2">
                <Label>Technical User (Salesman)</Label>
                <SearchableSelect
                  options={techUsers}
                  value={editData.userId}
                  onChange={(v) => setEditData(p => ({ ...p, userId: v }))}
                  placeholder="Select User"
                />
              </div>

              {/* Dealer Select */}
              <div className="flex flex-col space-y-2">
                <Label>Dealer</Label>
                <SearchableSelect
                  options={dealers}
                  value={editData.dealerId}
                  onChange={(v) => setEditData(p => ({ ...p, dealerId: v }))}
                  placeholder="Select Dealer"
                />
              </div>

              {/* Site Select */}
              <div className="md:col-span-2 flex flex-col space-y-2">
                <Label>Technical Site</Label>
                <SearchableSelect
                  options={sites}
                  value={editData.siteId}
                  onChange={(v) => setEditData(p => ({ ...p, siteId: v }))}
                  placeholder="Select Site"
                />
              </div>

              {/* --- Device ID Management Section --- */}
              <div className="md:col-span-2 space-y-2 pt-4 border-t mt-4">
                <Label className="text-sm font-semibold">Device ID Management</Label>
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 border">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Registered Device ID
                    </span>
                    <span className="text-sm font-mono truncate max-w-[200px] md:max-w-none">
                      {selectedRecord?.deviceId || "No device registered"}
                    </span>
                  </div>
                  {selectedRecord?.deviceId && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleClearMasonDeviceId(selectedRecord.id)}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Clear Device"}
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  * Clearing the device ID allows the Mason to log in from a new mobile device.
                </p>
              </div>

              <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">KYC Document Details</div>
              <div>
                <Label htmlFor="docName">Document Name</Label>
                <Input id="docName" value={selectedRecord.kycDocumentName || 'N/A'} readOnly />
              </div>
              <div>
                <Label htmlFor="docId">Document ID Number</Label>
                <Input id="docId" value={selectedRecord.kycDocumentIdNum || 'N/A'} readOnly />
              </div>

              <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">Full KYC Details</div>
              <div>
                <Label htmlFor="aadhaar">Aadhaar Number</Label>
                <Input id="aadhaar" value={selectedRecord.kycAadhaarNumber || 'N/A'} readOnly />
              </div>
              <div>
                <Label htmlFor="pan">PAN Number</Label>
                <Input id="pan" value={selectedRecord.kycPanNumber || 'N/A'} readOnly />
              </div>
              <div>
                <Label htmlFor="voter">Voter ID Number</Label>
                <Input id="voter" value={selectedRecord.kycVoterIdNumber || 'N/A'} readOnly />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="documents">Supporting Documents</Label>
                {(() => {
                  const docs = (selectedRecord.kycDocuments || {}) as Record<string, string>;
                  const validDocKeys = Object.keys(docs).filter((key) => !!docs[key]);

                  if (validDocKeys.length === 0) {
                    return (
                      <span className="text-muted-foreground text-sm block mt-1">
                        No supporting documents found.
                      </span>
                    );
                  }

                  return (
                    <div id="documents" className="flex flex-col space-y-2 mt-1">
                      {validDocKeys.map((key) => (
                        <div key={key} className="border p-2 rounded-md bg-muted/50">
                          <a
                            href={docs[key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline flex items-center break-all text-sm font-medium"
                          >
                            {formatDocKey(key)}
                            <ExternalLink className="h-4 w-4 ml-1 shrink-0" />
                          </a>
                          <img
                            src={docs[key]}
                            alt={formatDocKey(key)}
                            className="mt-2 max-w-full h-auto rounded-md border"
                          />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="remark">Mason Submission Remark</Label>
                <Textarea id="remark" value={selectedRecord.kycSubmissionRemark || 'N/A'} readOnly />
              </div>

            </div>
            <DialogFooter>
              <Button onClick={() => setIsViewModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* --- Action with Remark Modal (for Accept/Reject) --- */}
      {selectedRecord && pendingAction && (
        <Dialog open={isRemarkModalOpen} onOpenChange={setIsRemarkModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{pendingAction} KYC for {selectedRecord.name}</DialogTitle>
              <DialogDescription>
                Confirm action. Add an **Admin Remark** below (required for Reject, optional for Accept).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="adminRemarks">Admin Remarks</Label>
                <Textarea
                  id="adminRemarks"
                  placeholder={pendingAction === 'REJECTED' ? "Reason for rejection (required)" : "Optional remarks for approval"}
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                />
                {pendingAction === 'REJECTED' && adminRemarks.trim().length < 5 && (
                  <p className="text-sm text-red-500">Remarks are required to reject a submission.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsRemarkModalOpen(false)}
                disabled={isUpdatingId === selectedRecord.id}
              >
                Cancel
              </Button>
              <Button
                variant={pendingAction === 'VERIFIED' ? 'default' : 'destructive'}
                onClick={() => handleVerificationAction(selectedRecord.id, pendingAction, adminRemarks)}
                disabled={isUpdatingId === selectedRecord.id || (pendingAction === 'REJECTED' && adminRemarks.trim().length < 5)}
              >
                {isUpdatingId === selectedRecord.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {pendingAction === 'VERIFIED' ? 'Confirm Accept' : 'Confirm Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}