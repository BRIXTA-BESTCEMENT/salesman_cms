// app/dashboard/reports/technicalVisitReports.tsx
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Loader2,
  Search,
  Eye,
  ExternalLink,
  MapPin,
  ImageIcon
} from 'lucide-react';

// Import the reusable DataTable
import { DataTableReusable } from '@/components/data-table-reusable';
import { technicalVisitReportSchema } from '@/lib/shared-zod-schema';

// UI Components
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

// --- CONSTANTS AND TYPES ---
const LOCATION_API_ENDPOINT = `/api/users/user-locations`;
const ROLES_API_ENDPOINT = `/api/users/user-roles`;

interface LocationsResponse {
  areas: string[];
  regions: string[];
}
interface RolesResponse {
  roles: string[];
}

// Extend the inferred type
type TechnicalVisitReport = z.infer<typeof technicalVisitReportSchema> & {
  salesmanName: string;
  role: string;
  area: string;
  region: string;
};

const CUSTOMER_TYPE_OPTIONS = [
  'IHB',
  'Engineer/Architect',
  'Contractor/Head Mason',
  'Channel Partner(Dealer/Sub-Dealer)',
  'Competitor Channel Partner (Dealer/Sub-Dealer)',
];

// --- HELPER FUNCTIONS ---

const formatTimeIST = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
  } catch (e) {
    return 'N/A';
  }
};

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
      <SelectTrigger className="h-9 w-full bg-background border-input">
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

export default function TechnicalVisitReportsPage() {
  const router = useRouter();
  const [technicalReports, setTechnicalReports] = React.useState<TechnicalVisitReport[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Modal State ---
  const [selectedReport, setSelectedReport] = useState<TechnicalVisitReport | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  // --- Filter Options States ---
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  // --- Data Fetching ---
  const fetchTechnicalReports = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboardPagesAPI/reports/technical-visit-reports`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (response.status === 403) {
          router.push('/dashboard');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const rawData: TechnicalVisitReport[] = await response.json();

      const validatedData = rawData.map((item) => {
        try {
          const validated = technicalVisitReportSchema.parse(item);
          return {
            ...validated,
            id: (validated as any).id?.toString() || `${validated.salesmanName}-${validated.date}-${Math.random()}`
          } as TechnicalVisitReport;
        } catch (e) {
          console.error("Validation error for item:", item, e);
          return null;
        }
      }).filter(Boolean) as TechnicalVisitReport[];

      setTechnicalReports(validatedData);
      toast.success("Reports loaded successfully!");
    } catch (error: any) {
      console.error("Failed to fetch reports:", error);
      toast.error(`Failed to load reports: ${error.message}`);
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
      console.error('Failed to load locations', err);
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
      console.error('Failed to load roles', err);
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTechnicalReports();
    fetchLocations();
    fetchRoles();
  }, [fetchTechnicalReports, fetchLocations, fetchRoles]);

  // --- Filtering Logic ---
  const filteredReports = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return technicalReports.filter((report) => {
      const usernameMatch = !searchQuery || report.salesmanName.toLowerCase().includes(q);
      const customerTypeMatch = customerTypeFilter === 'all' || report.customerType === customerTypeFilter;
      const roleMatch = roleFilter === 'all' || report.role?.toLowerCase() === roleFilter.toLowerCase();
      const areaMatch = areaFilter === 'all' || report.area?.toLowerCase() === areaFilter.toLowerCase();
      const regionMatch = regionFilter === 'all' || report.region?.toLowerCase() === regionFilter.toLowerCase();
      return usernameMatch && customerTypeMatch && roleMatch && areaMatch && regionMatch;
    });
  }, [technicalReports, customerTypeFilter, searchQuery, roleFilter, areaFilter, regionFilter]);

  const isDealerVisit = (r: TechnicalVisitReport) =>
    r.customerType?.includes('Dealer');

  const isIHBVisit = (r: TechnicalVisitReport) =>
    r.customerType === 'IHB';

  const isInfluencerVisit = (r: TechnicalVisitReport) =>
    !isIHBVisit(r) && !isDealerVisit(r);

  // --- Columns Definition ---
  const columns = useMemo<ColumnDef<TechnicalVisitReport>[]>(() => [
    { accessorKey: "salesmanName", header: "Salesman" },
    { accessorKey: "role", header: "Role" },
    {
      accessorKey: "date",
      header: "Visit Date",
      cell: ({ row }) => <div className="whitespace-nowrap font-medium">{row.getValue("date")}</div>
    },
    {
      accessorKey: "siteNameConcernedPerson",
      header: "Site Name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{row.original.siteNameConcernedPerson}</span>
          <span className="text-xs text-muted-foreground">{row.original.phoneNo}</span>
        </div>
      )
    },
    { accessorKey: "region", header: "Region" },
    { accessorKey: "area", header: "Area" },
    {
      accessorKey: "visitType",
      header: "Type",
      cell: ({ row }) => <Badge variant="outline">{row.getValue("visitType")}</Badge>
    },
    {
      accessorKey: "checkInTime",
      header: "Check-In",
      cell: ({ row }) => formatTimeIST(row.getValue("checkInTime"))
    },
    {
      accessorKey: "checkOutTime",
      header: "Check-Out",
      cell: ({ row }) => formatTimeIST(row.getValue("checkOutTime"))
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-blue-500 border-blue-500 hover:bg-blue-50 h-8 px-2"
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

  // --- Render ---
  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /> <span className="ml-2">Loading reports...</span></div>;
  if (error) return <div className="text-center text-red-500 pt-10">Error: {error}<Button onClick={fetchTechnicalReports} className="ml-4">Retry</Button></div>;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        <h2 className="text-3xl font-bold tracking-tight">Technical Visit Reports</h2>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border">
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-sm font-medium text-muted-foreground">Salesman / Username</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 bg-background border-input"
              />
            </div>
          </div>
          {renderSelectFilter('Customer Type', customerTypeFilter, setCustomerTypeFilter, CUSTOMER_TYPE_OPTIONS)}
          {renderSelectFilter('Role', roleFilter, setRoleFilter, availableRoles, isLoadingRoles)}
          {renderSelectFilter('Area', areaFilter, setAreaFilter, availableAreas, isLoadingLocations)}
          {renderSelectFilter('Region', regionFilter, setRegionFilter, availableRegions, isLoadingLocations)}
        </div>

        {/* Data Table */}
        <div className="bg-card p-6 rounded-lg border border-border">
          <DataTableReusable
            columns={columns}
            data={filteredReports}
            enableRowDragging={false}
          />
        </div>
      </div>

      {/* --- DETAILS MODAL (Applied BagsLift Style) --- */}
      {selectedReport && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Technical Visit Details</DialogTitle>
              <DialogDescription>
                Review the full technical report submitted by {selectedReport.salesmanName}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">

              <div>
                <Label>Customer Type</Label>
                <Badge variant="secondary">{selectedReport.customerType}</Badge>
              </div>

              {/* 1. SALESMAN & LOCATION INFO */}
              <div className="md:col-span-2 text-lg font-semibold border-b pb-2">
                Salesman & Location Info
              </div>

              <div>
                <Label>Salesman Name</Label>
                <Input value={selectedReport.salesmanName} readOnly />
              </div>
              <div>
                <Label>Role</Label>
                <Input value={selectedReport.role ?? ''} readOnly />
              </div>
              <div>
                <Label>Area / Market</Label>
                <Input value={`${selectedReport.area || ''} / ${selectedReport.marketName || ''}`} readOnly />
              </div>
              <div>
                <Label>Region</Label>
                <Input value={selectedReport.region} readOnly />
              </div>

              {/* 2. VISIT & SITE INFO */}
              <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">
                Visit & Site Details
              </div>

              <div>
                <Label>Visit Date</Label>
                <Input value={selectedReport.date} readOnly />
              </div>
              <div>
                <Label>Visit Type</Label>
                <Input value={selectedReport.visitType} readOnly />
              </div>
              <div>
                <Label>Site / Concerned Person</Label>
                <Input value={selectedReport.siteNameConcernedPerson} readOnly />
              </div>
              <div>
                <Label>Phone No</Label>
                <Input value={selectedReport.phoneNo} readOnly />
              </div>
              <div className="md:col-span-2">
                <Label>Site Address</Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" value={selectedReport.siteAddress || 'N/A'} readOnly />
                </div>
              </div>
              <div>
                <Label>Purpose of Visit</Label>
                <Input value={selectedReport.purposeOfVisit as any} readOnly />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={selectedReport.emailId || 'N/A'} readOnly />
              </div>

              {/* 3. CONSTRUCTION DETAILS */}
              <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">
                Construction & Market Data
              </div>

              <div>
                <Label>Construction Stage</Label>
                <Input value={selectedReport.siteVisitStage as any} readOnly />
              </div>
              <div>
                <Label>Construction Area (SqFt)</Label>
                <Input value={selectedReport.constAreaSqFt?.toString() ?? ''} readOnly />
              </div>
              <div>
                <Label>Site Stock (Bags)</Label>
                <Input value={selectedReport.siteStock as any} readOnly />
              </div>
              <div>
                <Label>Est. Requirement</Label>
                <Input value={selectedReport.estRequirement as any} readOnly />
              </div>
              <div className="md:col-span-2">
                <Label>Brands In Use</Label>
                <Input value={selectedReport.siteVisitBrandInUse?.join(', ') || 'None'} readOnly />
              </div>
              <div>
                <Label>Current Brand Price</Label>
                <Input value={selectedReport.currentBrandPrice as any} readOnly />
              </div>

              {/* 4. DEALER INFO */}
              <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">
                Dealer & Conversion
              </div>

              <div>
                <Label>Supplying Dealer</Label>
                <Input value={selectedReport.supplyingDealerName || 'N/A'} readOnly />
              </div>
              <div>
                <Label>Nearby Dealer</Label>
                <Input value={selectedReport.nearbyDealerName || 'N/A'} readOnly />
              </div>
              <div>
                <Label>Is Converted?</Label>
                <Input value={selectedReport.isConverted ? 'YES' : 'NO'} readOnly />
              </div>
              {selectedReport.isConverted && (
                <>
                  <div>
                    <Label>Conversion From</Label>
                    <Input value={selectedReport.conversionFromBrand || 'N/A'} readOnly />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Conversion Quantity</Label>
                    <Input value={`${selectedReport.conversionQuantityValue} ${selectedReport.conversionQuantityUnit}`} readOnly />
                  </div>
                </>
              )}

              {/* 5. REMARKS */}
              <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">
                Remarks
              </div>
              <div className="md:col-span-2">
                <Label>Client's Remarks</Label>
                <Input value={selectedReport.clientsRemarks || 'N/A'} readOnly />
              </div>
              <div className="md:col-span-2">
                <Label>Salesperson's Remarks</Label>
                <Input value={selectedReport.salespersonRemarks || 'N/A'} readOnly />
              </div>

              {/* 6. TIMINGS & IMAGES */}
              <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">
                Timings & Evidence
              </div>

              <div>
                <Label>Check In Time</Label>
                <Input value={formatTimeIST(selectedReport.checkInTime)} readOnly />
              </div>
              <div>
                <Label>Check Out Time</Label>
                <Input value={formatTimeIST(selectedReport.checkOutTime)} readOnly />
              </div>

              {/* Site Photo */}
              {selectedReport.sitePhotoUrl && (
                <div className="md:col-span-2 mt-2">
                  <Label>Site Progress Photo</Label>
                  <div className="mt-2 border p-2 rounded-md bg-muted/50">
                    <a
                      href={selectedReport.sitePhotoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center text-sm font-medium mb-2"
                    >
                      View Original <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                    <img
                      src={selectedReport.sitePhotoUrl}
                      alt="Site"
                      className="w-full h-auto max-h-[400px] object-contain rounded-md border"
                    />
                  </div>
                </div>
              )}

              {/* Check In/Out Proofs */}
              <div className="md:col-span-2 grid grid-cols-2 gap-4 mt-2">
                {selectedReport.inTimeImageUrl && (
                  <div>
                    <Label>Check-In Proof</Label>
                    <div className="mt-1 border p-1 rounded-md bg-muted/50">
                      <a href={selectedReport.inTimeImageUrl} target="_blank" rel="noreferrer">
                        <img src={selectedReport.inTimeImageUrl} alt="In" className="w-full h-40 object-cover rounded-md" />
                      </a>
                    </div>
                  </div>
                )}
                {selectedReport.outTimeImageUrl && (
                  <div>
                    <Label>Check-Out Proof</Label>
                    <div className="mt-1 border p-1 rounded-md bg-muted/50">
                      <a href={selectedReport.outTimeImageUrl} target="_blank" rel="noreferrer">
                        <img src={selectedReport.outTimeImageUrl} alt="Out" className="w-full h-40 object-cover rounded-md" />
                      </a>
                    </div>
                  </div>
                )}

                {isIHBVisit(selectedReport) && (
                  <>
                    <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">
                      Construction & Market Data
                    </div>

                    <div>
                      <Label>Construction Stage</Label>
                      <Input value={selectedReport.siteVisitStage || 'N/A'} readOnly />
                    </div>

                    <div>
                      <Label>Construction Area (SqFt)</Label>
                      <Input value={selectedReport.constAreaSqFt || 'N/A'} readOnly />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Brands In Use</Label>
                      <Input
                        value={selectedReport.siteVisitBrandInUse?.join(', ') || 'None'}
                        readOnly
                      />
                    </div>
                  </>
                )}

                {isDealerVisit(selectedReport) && (
                  <>
                    <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">
                      Dealer & Business Info
                    </div>

                    <div>
                      <Label>Influencer Type</Label>
                      <Input
                        value={selectedReport.influencerType?.join(', ') || 'N/A'}
                        readOnly
                      />
                    </div>

                    <div>
                      <Label>Productivity</Label>
                      <Input
                        value={selectedReport.influencerProductivity || 'N/A'}
                        readOnly
                      />
                    </div>

                    <div>
                      <Label>Bag Picked</Label>
                      <Input value={selectedReport.isConverted ? 'YES' : 'NO'} readOnly />
                    </div>

                    {selectedReport.isConverted && (
                      <div className="md:col-span-2">
                        <Label>Quantity</Label>
                        <Input
                          value={`${selectedReport.conversionQuantityValue} ${selectedReport.conversionQuantityUnit}`}
                          readOnly
                        />
                      </div>
                    )}
                  </>
                )}

                {isInfluencerVisit(selectedReport) && (
                  <>
                    <div className="md:col-span-2 text-lg font-semibold border-b pt-4 pb-2">
                      Influencer Details
                    </div>

                    <div>
                      <Label>Influencer Type</Label>
                      <Input
                        value={selectedReport.influencerType?.join(', ') || 'N/A'}
                        readOnly
                      />
                    </div>

                    <div>
                      <Label>Name</Label>
                      <Input value={selectedReport.influencerName || 'N/A'} readOnly />
                    </div>

                    <div>
                      <Label>Phone</Label>
                      <Input value={selectedReport.influencerPhone || 'N/A'} readOnly />
                    </div>

                    <div>
                      <Label>Scheme Enrolled</Label>
                      <Input value={selectedReport.isSchemeEnrolled ? 'YES' : 'NO'} readOnly />
                    </div>
                  </>
                )}

              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setIsViewModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}