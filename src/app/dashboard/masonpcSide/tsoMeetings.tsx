// src/app/dashboard/masonpcSide/tsoMeetings.tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Search, Loader2, Badge as BadgeIcon, XCircle, CheckCircle2,
  Eye, User, Calendar, MapPin, Store, Users, ExternalLink,
  Wallet, Gift, Camera, Image as ImageIcon
} from 'lucide-react';

// Import the reusable DataTable
import { DataTableReusable } from '@/components/data-table-reusable';
import { selectTsoMeetingSchema } from '../../../../drizzle/zodSchemas';

// UI Components
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// API Endpoints
const TSO_MEETINGS_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/tso-meetings`;
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;
const ROLES_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-roles`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}
interface RolesResponse {
  roles: string[];
}

// Extend the inferred type to include the creator's info
type TsoMeeting = z.infer<typeof selectTsoMeetingSchema> & {
  creatorName: string;
  role: string;
  area: string;
  region: string;
  meetImageUrl: string;
};

// --- HELPER FUNCTIONS ---

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

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateString));
  } catch {
    return 'Invalid Date';
  }
};

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 'N/A';
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (isNaN(numericValue)) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numericValue);
};

// --- REUSABLE READ-ONLY FIELD ---
const InfoField = ({ label, value, icon: Icon, fullWidth = false }: { label: string, value: React.ReactNode, icon?: any, fullWidth?: boolean }) => (
  <div className={`flex flex-col space-y-1.5 ${fullWidth ? 'col-span-2' : ''}`}>
    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </Label>
    <div className="text-sm font-medium p-2 bg-secondary/20 rounded-md border border-border/50 min-h-9 flex items-center">
      {value || <span className="text-muted-foreground italic text-xs">N/A</span>}
    </div>
  </div>
);

// --- MAIN COMPONENT ---

export default function TsoMeetingsPage() {
  const router = useRouter();
  const [tsoMeetings, setTsoMeetings] = useState<TsoMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Modal State ---
  const [selectedReport, setSelectedReport] = useState<TsoMeeting | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  // --- Filter Options States ---
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  // --- Data Fetching Functions ---
  const fetchTsoMeetings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(TSO_MEETINGS_API_ENDPOINT);
      if (!response.ok) {
        if (response.status === 401) { router.push('/login'); return; }
        if (response.status === 403) { router.push('/dashboard'); return; }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: TsoMeeting[] = await response.json();
      setTsoMeetings(data);
      toast.success("TSO meetings loaded successfully!");
    } catch (error: any) {
      toast.error(`Failed to fetch TSO meetings: ${error.message}`);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
      if (response.ok) {
        const data: LocationsResponse = await response.json();
        setAvailableAreas(Array.isArray(data.areas) ? data.areas.filter(Boolean) : []);
        setAvailableRegions(Array.isArray(data.regions) ? data.regions.filter(Boolean) : []);
      }
    } catch (err: any) {
      setLocationError('Failed to load Area/Region filters.');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    try {
      const response = await fetch(ROLES_API_ENDPOINT);
      if (response.ok) {
        const data: RolesResponse = await response.json();
        setAvailableRoles(Array.isArray(data.roles) ? data.roles.filter(Boolean) : []);
      }
    } catch (err: any) {
      setRoleError('Failed to load Role filters.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    fetchTsoMeetings();
    fetchLocations();
    fetchRoles();
  }, [fetchTsoMeetings, fetchLocations, fetchRoles]);

  // --- Filtering Logic ---
  const filteredMeetings = useMemo(() => {
    return tsoMeetings.filter((meeting) => {
      const creatorNameMatch = !searchQuery || meeting.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
      const roleMatch = roleFilter === 'all' || meeting.role?.toLowerCase() === roleFilter.toLowerCase();
      const areaMatch = areaFilter === 'all' || meeting.area?.toLowerCase() === areaFilter.toLowerCase();
      const regionMatch = regionFilter === 'all' || meeting.region?.toLowerCase() === regionFilter.toLowerCase();

      return creatorNameMatch && roleMatch && areaMatch && regionMatch;
    });
  }, [tsoMeetings, searchQuery, roleFilter, areaFilter, regionFilter]);

  // --- Define Columns ---
  const tsoMeetingColumns = useMemo<ColumnDef<TsoMeeting>[]>(() => [
    { accessorKey: "creatorName", header: "Creator" },
    { accessorKey: "role", header: "Role" },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.date)
    },
    { accessorKey: "market", header: "Market" },
    { accessorKey: "zone", header: "Zone" },
    {
      accessorKey: "dealerName",
      header: "Dealer",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.dealerName || '—'}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[150px]">{row.original.dealerAddress}</span>
        </div>
      )
    },
    { accessorKey: "participantsCount", header: "Participants" },
    {
      accessorKey: "totalExpenses",
      header: () => <div className="text-right">Expenses</div>,
      cell: ({ row }) => <span className="font-semibold text-right block">{formatCurrency(row.original.totalExpenses)}</span>
    },
    // {
    //   accessorKey: "billSubmitted",
    //   header: "Bill",
    //   cell: ({ row }) => (
    //     row.original.billSubmitted ? (
    //       <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 hover:bg-green-100">
    //         <CheckCircle2 size={12} /> Yes
    //       </Badge>
    //     ) : (
    //       <Badge className="bg-red-50 text-red-700 border-red-200 gap-1 hover:bg-red-100">
    //         <XCircle size={12} /> No
    //       </Badge>
    //     )
    //   )
    // },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 h-8 px-2 shadow-sm"
          onClick={() => {
            setSelectedReport(row.original);
            setIsViewModalOpen(true);
          }}
        >
          <Eye className="h-3.5 w-3.5 mr-1" /> View
        </Button>
      ),
    },
  ], []);

  // --- Loading / Error Gates ---
  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (error) return (
    <div className="text-center text-red-500 min-h-screen pt-10">
      Error: {error}
      <Button onClick={fetchTsoMeetings} className="ml-4">Retry</Button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">TSO Meetings</h2>
          <Badge variant="outline" className="text-base px-4 py-1">
            Total Meetings: {filteredMeetings.length}
          </Badge>
        </div>

        {/* --- Filter Components --- */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border">
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-sm font-medium text-muted-foreground">Creator Name</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by creator name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {renderSelectFilter('Role', roleFilter, setRoleFilter, availableRoles, isLoadingRoles)}
          {renderSelectFilter('Area', areaFilter, setAreaFilter, availableAreas, isLoadingLocations)}
          {renderSelectFilter('Region', regionFilter, setRegionFilter, availableRegions, isLoadingLocations)}

          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery('');
              setRoleFilter('all');
              setAreaFilter('all');
              setRegionFilter('all');
            }}
            className="mb-0.5 text-muted-foreground hover:text-destructive"
          >
            Clear Filters
          </Button>
        </div>

        {/* Data Table Section */}
        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {filteredMeetings.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No TSO meetings found matching the selected filters.</div>
          ) : (
            <DataTableReusable
              columns={tsoMeetingColumns}
              data={filteredMeetings}
              enableRowDragging={false}
            />
          )}
        </div>
      </div>

      {/* --- SMART DETAILS MODAL --- */}
      {selectedReport && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">

            {/* Header with Color Coding */}
            <div className="px-6 py-4 border-b bg-muted/20 border-l-[6px] border-l-indigo-500">
              <DialogTitle className="text-xl flex items-center justify-between">
                <span>Meeting Details</span>
                <Badge variant="default" className="text-sm px-3 bg-indigo-600 hover:bg-indigo-700">
                  {selectedReport.type}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedReport.creatorName} ({selectedReport.role})</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(selectedReport.date)}</span>
              </DialogDescription>
            </div>

            <div className="p-6 space-y-6">

              {/* 1. GENERAL & LOCATION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="h-full border-l-4 border-l-emerald-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Location Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 pt-2">
                    <InfoField label="Zone" value={selectedReport.zone} />
                    <InfoField label="Market" value={selectedReport.market} />
                    <InfoField label="Conducted By" value={selectedReport.conductedBy} fullWidth />
                  </CardContent>
                </Card>

                <Card className="h-full border-l-4 border-l-amber-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Store className="w-4 h-4" /> Dealer Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3 pt-2">
                    <InfoField label="Dealer Name" value={selectedReport.dealerName} />
                    <InfoField label="Dealer Address" value={selectedReport.dealerAddress} />
                  </CardContent>
                </Card>
              </div>

              {/* 2. METRICS & EXPENSES */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Metrics & Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <InfoField label="Participants" value={selectedReport.participantsCount} icon={Users} />
                  <InfoField label="Gift Type" value={selectedReport.giftType} icon={Gift} />
                  <InfoField label="Account" value={selectedReport.accountJsbJud} />

                  <div className="flex flex-col space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Total Expenses</Label>
                    <div className="text-sm font-bold p-2 text-white rounded-md border flex items-center">
                      {formatCurrency(selectedReport.totalExpenses)}
                    </div>
                  </div>

                  {/* <div className="col-span-2 md:col-span-4 mt-2">
                    <InfoField 
                      label="Bill Submitted Status" 
                      value={
                        selectedReport.billSubmitted 
                          ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1"/> Yes, Submitted</Badge>
                          : <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="w-3 h-3 mr-1"/> Not Submitted</Badge>
                      } 
                    />
                  </div> */}
                </CardContent>
              </Card>

              {/* 3. PHOTO EVIDENCE */}
              <div>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Meeting Photo Evidence
                </h4>

                <div className="flex flex-col gap-6">
                  {selectedReport.meetImageUrl ? (
                    <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
                      <div className="bg-muted px-4 py-2 text-sm font-semibold border-b flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" /> Uploaded Image
                        </span>
                      </div>
                      <a href={selectedReport.meetImageUrl} target="_blank" rel="noreferrer" className="block relative group">
                        <img
                          src={selectedReport.meetImageUrl}
                          className="w-full h-auto max-h-[500px] object-contain bg-black/5"
                          alt="Meeting Evidence"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <ExternalLink className="text-white w-5 h-5" />
                          <span className="text-white font-medium text-sm">Click to View Full Image</span>
                        </div>
                      </a>
                    </div>
                  ) : (
                    <div className="border rounded-lg h-32 flex flex-col items-center justify-center bg-muted/10 text-muted-foreground text-sm italic border-dashed">
                      <Camera className="w-8 h-8 mb-2 opacity-20" />
                      No Photo Uploaded
                    </div>
                  )}
                </div>
              </div>

            </div>

            <DialogFooter className="p-4 bg-background border-t">
              <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close Window</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}