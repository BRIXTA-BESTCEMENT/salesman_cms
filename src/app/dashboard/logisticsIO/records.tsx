// src/app/dashboard/logisticsIO/records.tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { 
  Search, MapPin, Clock, Eye, Truck, Scale, 
  Store, Package, FileText, Factory
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTableReusable } from '@/components/data-table-reusable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Separator } from '@/components/ui/separator';
import { selectLogisticsIOSchema } from '../../../../drizzle/zodSchemas'; 

type LogisticsRecord = z.infer<typeof selectLogisticsIOSchema>;

const API_URL = `/api/dashboardPagesAPI/logistics-io`;

// --- TIME FORMATTER HELPER ---
const formatTime12Hour = (timeStr?: string | null) => {
  if (!timeStr) return '';
  if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) {
    return timeStr;
  }
  try {
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr; 
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const formattedHours = hours < 10 ? `0${hours}` : hours.toString();
    return `${formattedHours}:${minutes} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
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

export default function LogisticsIOList() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Modal State ---
  const [selectedRecord, setSelectedRecord] = useState<LogisticsRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // --- Filters ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [filterDistrict, setFilterDistrict] = useState<string>('all');
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

  // --- Fetch Data ---
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (filterZone && filterZone !== 'all') params.append('zone', filterZone);
      if (filterDistrict && filterDistrict !== 'all') params.append('district', filterDistrict);
      if (filterSource && filterSource !== 'all') params.append('sourceName', filterSource);

      const response = await fetch(`${API_URL}?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const validatedData = z.array(selectLogisticsIOSchema).parse(data);
      setRecords(validatedData);

      const sources = new Set<string>();
      const zones = new Set<string>();
      const districts = new Set<string>();
      
      validatedData.forEach(r => {
        if (r.partyName) sources.add(r.partyName);
        if (r.zone) zones.add(r.zone);
        if (r.district) districts.add(r.district);
      });

      setAvailableSources(Array.from(sources).sort());
      setAvailableZones(Array.from(zones).sort());
      setAvailableDistricts(Array.from(districts).sort());

      toast.success('Logistics data loaded successfully');
    } catch (e: any) {
      console.error('Failed to fetch logistics data:', e);
      const message = e instanceof z.ZodError ? 'Data validation failed.' : (e.message || 'An unknown error occurred.');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterZone, filterDistrict, filterSource]);

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const q = searchQuery.toLowerCase();
      return (
        (record.id || '').toLowerCase().includes(q) ||
        (record.vehicleNumber || '').toLowerCase().includes(q) ||
        (record.partyName || '').toLowerCase().includes(q) ||
        (record.zone || '').toLowerCase().includes(q) ||
        (record.district || '').toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery]);

  // --- Helper: Formatters ---
  const FormatDateCell = ({ date, time, label }: { date?: string | null, time?: string | null, label?: string }) => {
    if (!date) return <span className="text-slate-500">-</span>;
    const d = new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return (
      <div className="flex flex-col justify-center h-full">
         {label && <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</span>}
         <div className="flex items-center gap-2">
            <span className="font-medium text-slate-200 text-sm">{d}</span>
         </div>
         <span className="text-xs text-slate-400 font-mono mt-0.5">{formatTime12Hour(time)}</span>
      </div>
    );
  };

  // --- Columns Definition ---
  const columns: ColumnDef<LogisticsRecord>[] = [
    {
      header: 'Source',
      accessorKey: 'partyName',
      cell: ({ row }) => (
        <Badge variant="outline" className="bg-indigo-950/30 text-indigo-400 border-indigo-900/50">
          <Factory className="w-3 h-3 mr-1" />
          {row.original.partyName || 'Unknown'}
        </Badge>
      )
    },
    {
      header: 'Vehicle & Purpose',
      accessorKey: 'vehicleNumber',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-40 py-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-blue-900/50 rounded-md border border-blue-800">
              <Truck className="h-4 w-4 text-blue-400" />
            </div>
            <span className="font-semibold text-white">{row.original.vehicleNumber || 'Unknown'}</span>
          </div>
          <div className="pl-9 flex flex-col">
            <span className="text-sm text-slate-300">{row.original.purpose || '-'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Material',
      accessorKey: 'typeOfMaterials',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-300">
            {row.original.typeOfMaterials || '-'}
          </span>
        </div>
      )
    },
    {
      header: 'Location',
      accessorKey: 'zone',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-[120px]">
          <span className="font-medium text-white text-sm">{row.original.zone || '-'}</span>
          <span className="text-xs text-slate-400">{row.original.district || '-'}</span>
        </div>
      )
    },
    {
      header: 'Gate In',
      accessorKey: 'gateInDate',
      cell: ({ row }) => (
        <div className="min-w-[130px] p-2 bg-emerald-950/30 rounded-md border border-emerald-900/50">
          <FormatDateCell date={row.original.gateInDate} time={row.original.gateInTime} />
        </div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'gateOutDate',
      cell: ({ row }) => {
        const isCompleted = !!row.original.gateOutDate;
        return isCompleted ? (
          <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
            Completed
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-amber-900/20 text-amber-500 border-amber-800">
            <Clock className="w-3 h-3 mr-1" /> In Yard
          </Badge>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 h-8 px-2 shadow-sm"
          onClick={() => {
            setSelectedRecord(row.original);
            setIsViewModalOpen(true);
          }}
        >
          <Eye className="h-3.5 w-3.5 mr-1" /> View
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-500">
        <p>Error: {error}</p>
        <Button variant="link" onClick={fetchRecords}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* --- Filter Bar --- */}
      <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex flex-col space-y-1 w-full sm:w-[250px]">
          <label className="text-xs font-semibold text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Vehicle, Zone, Factory..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">From Date</label>
          <Input type="date" className="h-9 w-[140px]" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">To Date</label>
          <Input type="date" className="h-9 w-[140px]" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        {/* Source / Factory Filter */}
        <div className="flex flex-col space-y-1 w-[150px]">
          <label className="text-xs font-semibold text-muted-foreground">Source</label>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {availableSources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col space-y-1 w-[150px]">
          <label className="text-xs font-semibold text-muted-foreground">Zone</label>
          <Select value={filterZone} onValueChange={setFilterZone}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {availableZones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col space-y-1 w-[150px]">
          <label className="text-xs font-semibold text-muted-foreground">District</label>
          <Select value={filterDistrict} onValueChange={setFilterDistrict}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Districts</SelectItem>
              {availableDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={fetchRecords} size="sm" className="h-9 mb-px">Apply Filters</Button>
      </div>

      {/* --- Data Table --- */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">Loading logistics data...</div>
      ) : filteredRecords.length === 0 ? (
         <div className="h-64 flex flex-col items-center justify-center text-muted-foreground rounded-lg border border-dashed">
          <p>No records found matching your filters.</p>
        </div>
      ) : (
        <div className="rounded-md border bg-card">
          <DataTableReusable columns={columns} data={filteredRecords} enableRowDragging={false} onRowOrderChange={() => {}} />
        </div>
      )}

      {/* --- VIEW MODAL --- */}
      {selectedRecord && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">
            
            {/* Header */}
            <div className="px-6 py-4 border-b bg-muted/20 border-l-[6px] border-l-blue-500">
              <DialogTitle className="text-xl flex items-center justify-between">
                <span>Transaction: <span className="font-mono text-lg">{selectedRecord.id.substring(0, 8).toUpperCase()}</span></span>
                <Badge variant={selectedRecord.gateOutDate ? "default" : "outline"} className={selectedRecord.gateOutDate ? "bg-emerald-500" : "text-amber-500 border-amber-500"}>
                  {selectedRecord.gateOutDate ? "Completed" : "In Yard"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-2 flex items-center gap-4 text-sm font-semibold text-foreground">
                <span className="flex items-center gap-1"><Truck className="w-4 h-4 text-muted-foreground" /> {selectedRecord.vehicleNumber || 'N/A'}</span>
                <span className="flex items-center gap-1"><Package className="w-4 h-4 text-muted-foreground" /> {selectedRecord.typeOfMaterials || 'N/A'}</span>
              </DialogDescription>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Context */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Elevated Source Name to the top Context section! */}
                <InfoField label="Source Factory" value={selectedRecord.partyName} icon={Factory} />
                <InfoField label="Zone" value={selectedRecord.zone} icon={MapPin} />
                <InfoField label="District" value={selectedRecord.district} />
                <InfoField label="Destination" value={selectedRecord.destination} />
              </div>

              {/* 1. GATE RECORDS */}
              <Card className="border-l-4 border-l-primary shadow-sm">
                <CardHeader className="pb-2 bg-muted/10">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Gate I/O Records
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  <InfoField label="Purpose" value={selectedRecord.purpose} />
                  <InfoField label="Total TAT" value={selectedRecord.diffGateInGateOut} />
                  <InfoField label="Gate In Date" value={selectedRecord.gateInDate} />
                  <InfoField label="Gate In Time" value={formatTime12Hour(selectedRecord.gateInTime)} />
                  <InfoField label="Gate Out Date" value={selectedRecord.gateOutDate} />
                  <InfoField label="Gate Out Time" value={formatTime12Hour(selectedRecord.gateOutTime)} />
                  
                  <div className="col-span-full mt-2">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                      <FileText className="w-3 h-3" /> Gate Out Invoices & Bills ({selectedRecord.gateOutNoOfInvoice || 0})
                    </Label>
                    
                    {(!selectedRecord.gateOutInvoiceNos || selectedRecord.gateOutInvoiceNos.length === 0) ? (
                      <div className="text-sm text-muted-foreground p-3 border border-dashed rounded-md bg-muted/5 text-center">
                        No gate out documents recorded
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {selectedRecord.gateOutInvoiceNos.map((inv, idx) => (
                          <div key={idx} className="flex flex-col p-2 bg-secondary/10 border rounded text-sm">
                            <span className="font-semibold text-xs text-muted-foreground mb-1">Set {idx + 1}</span>
                            <span><span className="font-medium">INV:</span> {inv || '-'}</span>
                            <span><span className="font-medium">BILL:</span> {selectedRecord.gateOutBillNos?.[idx] || '-'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                </CardContent>
              </Card>

              {/* 2. WEIGHBRIDGE RECORDS */}
              <Card className="border-l-4 border-l-orange-500 shadow-sm">
                <CardHeader className="pb-2 bg-muted/10">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Scale className="w-4 h-4" /> Weighbridge I/O Records
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                  <InfoField label="WB In Date" value={selectedRecord.wbInDate} />
                  <InfoField label="WB In Time" value={formatTime12Hour(selectedRecord.wbInTime)} />
                  <InfoField label="Time from Gate In" value={selectedRecord.diffGateInTareWt} />
                  
                  <div className="col-span-full"><Separator /></div>

                  <InfoField label="WB Out Date" value={selectedRecord.wbOutDate} />
                  <InfoField label="WB Out Time" value={formatTime12Hour(selectedRecord.wbOutTime)} />
                  <InfoField label="Time from WB In" value={selectedRecord.diffTareWtGrossWt} />
                </CardContent>
              </Card>

              {/* 3. STORE RECORDS */}
              <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                <CardHeader className="pb-2 bg-muted/10">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Store className="w-4 h-4" /> Store Records
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 pt-4">
                  {/* partyName has been moved from here to the top Context bar */}
                  <InfoField label="Store Date" value={selectedRecord.storeDate} />
                  <InfoField label="Store Time" value={formatTime12Hour(selectedRecord.storeTime)} />
                  
                  <div className="col-span-full mt-2">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                      <FileText className="w-3 h-3" /> Invoices & Bills ({selectedRecord.noOfInvoice || 0})
                    </Label>
                    
                    {(!selectedRecord.invoiceNos || selectedRecord.invoiceNos.length === 0) ? (
                      <div className="text-sm text-muted-foreground p-3 border border-dashed rounded-md bg-muted/5 text-center">
                        No documents recorded
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedRecord.invoiceNos.map((inv, idx) => (
                          <div key={idx} className="flex flex-col p-2 bg-secondary/10 border rounded text-sm">
                            <span className="font-semibold text-xs text-muted-foreground mb-1">Set {idx + 1}</span>
                            <span><span className="font-medium">INV:</span> {inv || '-'}</span>
                            <span><span className="font-medium">BILL:</span> {selectedRecord.billNos?.[idx] || '-'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>

            <DialogFooter className="p-4 bg-background border-t">
              <Button onClick={() => setIsViewModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}