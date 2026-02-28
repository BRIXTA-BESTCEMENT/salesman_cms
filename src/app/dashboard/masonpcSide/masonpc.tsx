// src/app/dashboard/masonpcSide/masonpc.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Loader2, Search, Check, X, Eye, ExternalLink, Save, ChevronsUpDown 
} from 'lucide-react';

import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const MASON_PC_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/mason-pc`;
const MASON_PC_ACTION_API_BASE = `/api/dashboardPagesAPI/masonpc-side/mason-pc`;
const MASON_PC_FORM_OPTIONS = `/api/dashboardPagesAPI/masonpc-side/mason-pc/form-options`;
const ROLES_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-roles`;
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

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
  salesmanName?: string;
  role?: string;
  area?: string;
  region?: string;
  userId?: number | null;
  dealerId?: string | null;
  siteId?: string | null;
  dealerName?: string | null;
  siteName?: string | null;
  deviceId?: string | null;
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

const renderSelectFilter = (
  label: string,
  value: string,
  onValueChange: (v: string) => void,
  options: string[],
  isLoading: boolean = false
) => (
  <div className="flex flex-col space-y-1 w-full sm:w-[150px] min-w-[120px]">
    <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger className="h-9 bg-background border-input">
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
        <SelectItem value="all">All</SelectItem>
        {options.map(option => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const formatDocKey = (key: string): string => {
  if (key === 'aadhaarFrontUrl') return 'Aadhaar Front';
  if (key === 'aadhaarBackUrl') return 'Aadhaar Back';
  if (key === 'panUrl') return 'PAN Card';
  if (key === 'voterUrl') return 'Voter ID';
  return key.replace('Url', '').replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
};

interface SearchableSelectProps {
  options: OptionItem[];
  value: string; 
  onChange: (value: string) => void;
  placeholder: string;
  isLoading?: boolean;
}

const SearchableSelect = ({ options, value, onChange, placeholder, isLoading = false }: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);
  const selectedItem = options.find((item) => String(item.id) === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal" disabled={isLoading}>
          {value === 'null' ? placeholder : (selectedItem?.name || placeholder)}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="-- Unassigned --" onSelect={() => { onChange("null"); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", value === "null" ? "opacity-100" : "opacity-0")} />
                -- Unassigned --
              </CommandItem>
              {options.map((option) => (
                <CommandItem key={option.id} value={option.name} onSelect={() => { onChange(String(option.id)); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", String(option.id) === value ? "opacity-100" : "opacity-0")} />
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

export default function MasonPcPage() {
  const [allMasonPcRecords, setAllMasonPcRecords] = React.useState<MasonPcFullDetails[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [kycStatusFilter, setKycStatusFilter] = useState<KycVerificationStatus | 'all'>('all');

  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MasonPcFullDetails | null>(null);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [pendingAction, setPendingAction] = useState<'VERIFIED' | 'REJECTED' | null>(null);

  const [techUsers, setTechUsers] = useState<OptionItem[]>([]);
  const [dealers, setDealers] = useState<OptionItem[]>([]);
  const [sites, setSites] = useState<OptionItem[]>([]);

  const [editData, setEditData] = useState({ userId: 'null', dealerId: 'null', siteId: 'null' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, roleFilter, areaFilter, regionFilter, kycStatusFilter]);

  const fetchMasonPcRecords = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(MASON_PC_API_ENDPOINT, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      if (kycStatusFilter && kycStatusFilter !== 'all') url.searchParams.set('kycStatus', kycStatusFilter);
      if (roleFilter !== 'all') url.searchParams.append('role', roleFilter);
      if (areaFilter !== 'all') url.searchParams.append('area', areaFilter);
      if (regionFilter !== 'all') url.searchParams.append('region', regionFilter);

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
      
      const result = await response.json();
      setAllMasonPcRecords(result.data || []);
      setTotalCount(result.totalCount || 0);

    } catch (error: any) {
      console.error("Failed to fetch Mason/PC records:", error);
      toast.error(`Failed to fetch Mason/PC records: ${error.message}`);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearchQuery, kycStatusFilter, roleFilter, areaFilter, regionFilter]);

  const fetchRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    try {
      const response = await fetch(ROLES_API_ENDPOINT);
      if (response.ok) {
        const data: RolesResponse = await response.json();
        setAvailableRoles(data.roles && Array.isArray(data.roles) ? data.roles.filter(Boolean) : []);
      }
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
      if (response.ok) {
        const data: LocationsResponse = await response.json();
        setAvailableAreas(Array.isArray(data.areas) ? data.areas.filter(Boolean).sort() : []);
        setAvailableRegions(Array.isArray(data.regions) ? data.regions.filter(Boolean).sort() : []);
      }
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

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

  React.useEffect(() => {
    fetchMasonPcRecords();
  }, [fetchMasonPcRecords]);

  React.useEffect(() => {
    fetchRoles();
    fetchLocations();
    fetchDropdownData();
  }, [fetchRoles, fetchLocations, fetchDropdownData]);

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
      fetchMasonPcRecords(); 
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

  const handleViewKYC = (record: MasonPcFullDetails) => {
    setSelectedRecord(record);
    setEditData({
      userId: record.userId ? String(record.userId) : 'null',
      dealerId: record.dealerId || 'null',
      siteId: record.siteId || 'null'
    });
    setIsViewModalOpen(true);
  };

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
      fetchMasonPcRecords(); 

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
        fetchMasonPcRecords();
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
    { accessorKey: "dealerName", header: "Associated Dealer", cell: info => info.getValue() || '-' },
    { accessorKey: "area", header: "Area", cell: info => info.getValue() || '-' },
    { accessorKey: "region", header: "Region(Zone)", cell: info => info.getValue() || '-' },
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
              className="text-blue-500 border-blue-500 hover:bg-blue-50 h-8 px-2"
            >
              <Eye className="h-3.5 w-3.5 mr-1" /> View
            </Button>

            {isPending && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 h-8 px-2"
                  onClick={() => openActionWithRemark(record, 'VERIFIED')}
                  disabled={isUpdating}
                >
                  {isUpdating && record.id === isUpdatingId ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                  Accept
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => openActionWithRemark(record, 'REJECTED')}
                  disabled={isUpdating}
                >
                  {isUpdating && record.id === isUpdatingId ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <X className="h-3.5 w-3.5 mr-1" />}
                  Reject
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  if (isLoading && allMasonPcRecords.length === 0) return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

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
        <div className="flex items-center justify-between space-y-2">
          <div className="flex items-center gap-4">
             <h2 className="text-3xl font-bold tracking-tight">Mason/PC KYC Verification</h2>
             <Badge variant="outline" className="text-base px-4 py-1">
                 Total Masons: {totalCount}
             </Badge>
          </div>
          <RefreshDataButton
            cachePrefix="mason-pc"
            onRefresh={fetchMasonPcRecords}
          />
        </div>

        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border shadow-sm">

          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Search Mason</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, Phone, Dealer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 bg-background border-input"
              />
            </div>
          </div>

          {renderSelectFilter('KYC Status', kycStatusFilter, (v) => { setKycStatusFilter(v as KycVerificationStatus | 'all'); }, kycStatusOptions, false)}
          {renderSelectFilter('Role', roleFilter, setRoleFilter, availableRoles, isLoadingRoles)}
          {renderSelectFilter('Area', areaFilter, setAreaFilter, availableAreas, isLoadingLocations)}
          {renderSelectFilter('Region', regionFilter, setRegionFilter, availableRegions, isLoadingLocations)}

          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setKycStatusFilter('all');
              setRoleFilter('all');
              setAreaFilter('all');
              setRegionFilter('all');
            }}
            className="mb-0.5 text-muted-foreground hover:text-destructive"
          >
            Clear Filters
          </Button>
        </div>

        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {isLoading && allMasonPcRecords.length === 0 ? (
             <div className="flex justify-center items-center h-64">
               <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" />
               <p className="text-muted-foreground">Loading Masons...</p>
             </div>
          ) : allMasonPcRecords.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No Mason/PC records found matching the selected filters.</div>
          ) : (
            <DataTableReusable<MasonPcFullDetails, unknown>
              columns={masonPcColumns}
              data={allMasonPcRecords}
              enableRowDragging={false}
              onRowOrderChange={() => {}}
            />
          )}
        </div>
      </div>

      {/* --- View KYC Modal --- */}
      {selectedRecord && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-background">
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
                <Input id="name" value={selectedRecord.name} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" value={selectedRecord.phoneNumber || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="kycStatus">KYC Status (Master)</Label>
                <Input id="kycStatus" value={selectedRecord.kycVerificationStatus} readOnly className="bg-muted/50" />
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
                  className="bg-muted/50"
                />
              </div>

              {/* --- ASSIGNMENT SECTION --- */}
              <div className="md:col-span-2 flex items-center justify-between border-b pt-4 pb-2 mt-2">
                <span className="text-lg font-semibold">Assignments</span>
                <Button size="sm" onClick={handleSaveAssignments} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white h-8">
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save Changes
                </Button>
              </div>

              <div className="flex flex-col space-y-2">
                <Label>Technical User (Salesman)</Label>
                <SearchableSelect
                  options={techUsers}
                  value={editData.userId}
                  onChange={(v) => setEditData(p => ({ ...p, userId: v }))}
                  placeholder="Select User"
                />
              </div>

              <div className="flex flex-col space-y-2">
                <Label>Dealer</Label>
                <SearchableSelect
                  options={dealers}
                  value={editData.dealerId}
                  onChange={(v) => setEditData(p => ({ ...p, dealerId: v }))}
                  placeholder="Select Dealer"
                />
              </div>

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
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border">
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
                      className="h-8"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Clear Device"}
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
                <Input id="docName" value={selectedRecord.kycDocumentName || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="docId">Document ID Number</Label>
                <Input id="docId" value={selectedRecord.kycDocumentIdNum || 'N/A'} readOnly className="bg-muted/50" />
              </div>

              <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">Full KYC Details</div>
              <div>
                <Label htmlFor="aadhaar">Aadhaar Number</Label>
                <Input id="aadhaar" value={selectedRecord.kycAadhaarNumber || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="pan">PAN Number</Label>
                <Input id="pan" value={selectedRecord.kycPanNumber || 'N/A'} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="voter">Voter ID Number</Label>
                <Input id="voter" value={selectedRecord.kycVoterIdNumber || 'N/A'} readOnly className="bg-muted/50" />
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
                        <div key={key} className="border p-2 rounded-md bg-muted/30">
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
                <Textarea id="remark" value={selectedRecord.kycSubmissionRemark || 'N/A'} readOnly className="bg-muted/50" />
              </div>

            </div>
            <DialogFooter>
              <Button onClick={() => setIsViewModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedRecord && pendingAction && (
        <Dialog open={isRemarkModalOpen} onOpenChange={setIsRemarkModalOpen}>
          <DialogContent className="sm:max-w-md bg-background">
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