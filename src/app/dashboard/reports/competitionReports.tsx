// src/app/dashboard/reports/competitionReports.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';

// Import your Shadcn UI components
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IconDotsVertical } from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTableReusable } from '@/components/data-table-reusable';
import { selectCompetitionReportSchema } from '../../../../drizzle/zodSchemas';

// --- EXTEND THE DRIZZLE SCHEMA ---
// Add the relational fields and type coercions that your API returns
const extendedCompetitionReportSchema = selectCompetitionReportSchema.extend({
  salesmanName: z.string().optional().catch("Unknown"),
  // Drizzle's numeric/decimal types often return as strings; coerce it to a number
  avgSchemeCost: z.coerce.number().optional().catch(0),
  // Handle cases where the API might still be mapping 'reportDate' to 'date'
  date: z.string().optional(),
  // Remarks is nullable in Drizzle, ensure it falls back gracefully
  remarks: z.string().nullable().optional().transform(val => val || ""),
});

// Infer the TypeScript type from the EXTENDED schema
type CompetitionReport = z.infer<typeof extendedCompetitionReportSchema>;

export default function CompetitionReportsPage() {
  const [reports, setReports] = useState<CompetitionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<CompetitionReport | null>(null);

  // --- Data Fetching Logic ---
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboardPagesAPI/reports/competition-reports`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: any[] = await response.json();
      
      const validatedData = data.map((item) => {
        try {
          // Parse using the extended schema
          const validated = extendedCompetitionReportSchema.parse(item);
          return { 
            ...validated, 
            id: validated.id?.toString() || `${validated.salesmanName}-${validated.reportDate}` 
          }; 
        } catch (e) {
          console.error("Validation error for item:", item, e);
          return null;
        }
      }).filter(Boolean) as CompetitionReport[]; 

      setReports(validatedData);
      toast.success("Competition reports loaded successfully!");
    } catch (e: any) {
      console.error("Failed to fetch competition reports:", e);
      setError(e.message || "Failed to fetch reports.");
      toast.error(e.message || "Failed to load competition reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // --- Filtering Logic ---
  const filteredReports = useMemo(() => {
    const q = searchQuery.toLowerCase();

    return reports.filter((report) => {
      const matchesSearch =
        (report.salesmanName || '').toLowerCase().includes(q) ||
        report.brandName.toLowerCase().includes(q) ||
        (report.remarks || '').toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [reports, searchQuery]);

  const handleViewReport = (report: CompetitionReport) => {
    setSelectedReport(report);
    setIsViewModalOpen(true);
  };

  // --- Define Columns ---
  const competitionReportColumns: ColumnDef<CompetitionReport>[] = [
    { accessorKey: "salesmanName", header: "Salesman" },
    { accessorKey: "brandName", header: "Competitor Brand" },
    { 
      id: "reportDate", 
      header: "Report Date",
      // Fallback in case your API sends 'date' instead of the raw table's 'reportDate'
      cell: ({ row }) => <span>{row.original.date || row.original.reportDate}</span>
    },
    { accessorKey: "billing", header: "Billing" },
    { accessorKey: "nod", header: "NOD" },
    { accessorKey: "retail", header: "Retail Channel" },
    { accessorKey: "schemesYesNo", header: "Schemes?" },
    { accessorKey: "avgSchemeCost", header: "Avg Scheme Cost (₹)" },
    { 
      accessorKey: "remarks", 
      header: "Remarks",
      cell: ({ row }) => <span className="max-w-[250px] truncate block">{row.original.remarks || 'N/A'}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <IconDotsVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover text-popover-foreground border-border">
              <DropdownMenuItem onClick={() => handleViewReport(row.original)}>
                View Details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading competition reports...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 min-h-screen pt-10">
        Error: {error}
        <Button onClick={fetchReports} className="ml-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        {/* Header Section */}
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Competitor Information Reports</h2>
        </div>

        {/* Search Input */}
        <div className="flex justify-end mb-4">
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Data Table Section */}
        <div className="bg-card p-6 rounded-lg border border-border">
          {filteredReports.length === 0 && !loading && !error ? (
            <div className="text-center text-gray-500 py-8">No competition reports found.</div>
          ) : (
            <>
              <DataTableReusable
                columns={competitionReportColumns}
                data={filteredReports}    
                enableRowDragging={false}               
                onRowOrderChange={() => {}}
              />
            </>
          )}
        </div>
      </div>

      {selectedReport && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Competition Report Details</DialogTitle>
              <DialogDescription>
                Detailed information about the competitor.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 py-4">
              <div>
                <Label htmlFor="salesmanName">Salesman Name</Label>
                <Input id="salesmanName" value={selectedReport.salesmanName} readOnly />
              </div>
              <div>
                <Label htmlFor="brandName">Competitor Brand</Label>
                <Input id="brandName" value={selectedReport.brandName} readOnly />
              </div>
              <div>
                <Label htmlFor="date">Report Date</Label>
                <Input id="date" value={selectedReport.date || selectedReport.reportDate} readOnly />
              </div>
              <div>
                <Label htmlFor="billing">Billing</Label>
                <Input id="billing" value={selectedReport.billing} readOnly />
              </div>
              <div>
                <Label htmlFor="nod">NOD</Label>
                <Input id="nod" value={selectedReport.nod} readOnly />
              </div>
              <div>
                <Label htmlFor="retail">Retail Channel</Label>
                <Input id="retail" value={selectedReport.retail} readOnly />
              </div>
              <div>
                <Label htmlFor="schemesYesNo">Schemes?</Label>
                <Input id="schemesYesNo" value={selectedReport.schemesYesNo} readOnly />
              </div>
              <div>
                <Label htmlFor="avgSchemeCost">Avg Scheme Cost (₹)</Label>
                {/* Safe coercion in Zod guarantees this is a number now */}
                <Input id="avgSchemeCost" value={(selectedReport.avgSchemeCost ?? 0).toFixed(2)} readOnly />
              </div>
              <div className="col-span-1">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea id="remarks" value={selectedReport.remarks || "No remarks provided."} readOnly className="h-24" />
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