// src/app/home/customReportGenerator/page.tsx

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Download, ListFilter, Settings2, CheckSquare, XCircle, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { DataTableReusable, DragHandle } from '@/components/data-table-reusable';
import { ColumnDef } from '@tanstack/react-table';
import { DataFilter, FilterRule } from './components/DataFilters';
import {
  tablesMetadata,
  type TableColumn,
  type ReportFormat
} from './customTableHeaders';
import { format as formatDate } from 'date-fns';

// Helper to generate column definitions dynamically for the preview table
function generateColumns(columns: TableColumn[]): ColumnDef<any, any>[] {
  return columns.map((col, idx) => {
    const flatKey = `${col.table}.${col.column}`;
    const headerText = col.column.replace(/([A-Z])/g, ' $1').trim();
    const tableMeta = tablesMetadata.find(t => t.id === col.table);
    const tableLabel = tableMeta ? tableMeta.title : col.table;

    return {
      id: flatKey,
      accessorFn: (row: Record<string, any>) => row[flatKey],
      header: () => (
        <div className="flex items-center space-x-2">
          {idx === 0 && <DragHandle id={'header'} />}
          <div className="flex flex-col">
            <span className="capitalize font-semibold">{headerText}</span>
            <span className="text-xs text-muted-foreground">{tableLabel}</span>
          </div>
        </div>
      ),
      cell: info => <div className="text-sm text-foreground">{String(info.getValue() ?? '-')}</div>,
      enableSorting: true,
      enableHiding: true,
    } as ColumnDef<any, any>;
  });
}

interface SelectedColumnsState {
  [tableId: string]: string[];
}

const apiURI = `/api/custom-report-generator`;

export default function CustomReportGeneratorPage() {
  const [downloading, setDownloading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [checkedColumns, setCheckedColumns] = useState<SelectedColumnsState>({});
  const [reportColumns, setReportColumns] = useState<TableColumn[]>([]);
  const [format, setFormat] = useState<ReportFormat>('xlsx');
  const [previewData, setPreviewData] = useState<any[]>([]);

  // State for Filters & Styles
  const [filters, setFilters] = useState<FilterRule[]>([]);

  // Derived state for current table's columns based on reportColumns
  useEffect(() => {
    if (selectedTableId) {
      const columnsForTable = reportColumns
        .filter(c => c.table === selectedTableId)
        .map(c => c.column);

      setCheckedColumns(prev => ({
        ...prev,
        [selectedTableId]: columnsForTable,
      }));
    }
  }, [selectedTableId, reportColumns]);

  const selectedTable = useMemo(() => {
    return tablesMetadata.find(t => t.id === selectedTableId);
  }, [selectedTableId]);

  const isAllColumnsSelected = useMemo(() => {
    if (!selectedTable) return false;
    const currentChecked = checkedColumns[selectedTableId] || [];
    return currentChecked.length === selectedTable.columns.length && selectedTable.columns.length > 0;
  }, [selectedTable, checkedColumns, selectedTableId]);

  const previewColumns = useMemo(() => {
    if (!selectedTableId) return [];
    const colsForCurrent = reportColumns
      .filter(rc => rc.table === selectedTableId)
      .map(rc => ({ table: rc.table, column: rc.column }));
    return generateColumns(colsForCurrent);
  }, [reportColumns, selectedTableId]);

  const fetchPreview = useCallback(async (columns: TableColumn[], currentFilters: FilterRule[]) => {
    if (columns.length === 0) {
      setPreviewData([]);
      return;
    }

    setPreviewLoading(true);
    setPreviewData([]);

    try {
      const tableId = columns[0].table;
      const payload = {
        columns,
        format: 'json',
        limit: 100,
        tableId,
        filters: currentFilters,
      };

      const res = await fetch(apiURI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => 'No details');
        throw new Error(`Preview failed for table ${tableId}: ${text}`);
      }

      const json = await res.json();
      const rows: Record<string, any>[] = json?.data || [];
      const flatKeys = columns.map(c => `${c.table}.${c.column}`);

      const mapped = rows.map((r, idx) => {
        const out: Record<string, any> = {};
        flatKeys.forEach(k => (out[k] = undefined));
        columns.forEach(col => {
          const key = `${col.table}.${col.column}`;
          out[key] = r[col.column] ?? null;
        });
        out._rid = `${tableId}-${Date.now()}-${idx}`;
        out.id = out._rid;
        return out;
      });

      setPreviewData(mapped);
    } catch (err) {
      console.error('Preview Fetch Error:', err);
      toast.error('Preview Failed', { description: 'Could not fetch preview for selected table.' });
      setPreviewData([]);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (!selectedTableId) {
        setPreviewData([]);
        return;
      }
      const columnsForCurrent = reportColumns.filter(rc => rc.table === selectedTableId);
      if (columnsForCurrent.length === 0) {
        setPreviewData([]);
        return;
      }
      // Pass filters to the fetch function
      fetchPreview(columnsForCurrent, filters);
    }, 400); // Increased debounce slightly to 400ms to avoid spamming while typing
    return () => clearTimeout(handler);
  }, [selectedTableId, reportColumns, filters, fetchPreview]);

  const handleTableChange = (tableId: string) => {
    setSelectedTableId(tableId);
    // Reset filters when switching tables
    setFilters([]);

    if (!checkedColumns[tableId]) {
      const columnsForTable = reportColumns
        .filter(c => c.table === tableId)
        .map(c => c.column);
      setCheckedColumns(prev => ({ ...prev, [tableId]: columnsForTable }));
    }
  };

  const handleColumnToggle = (column: string) => {
    const table = selectedTableId;
    setCheckedColumns(prev => {
      const currentChecked = prev[table] || [];
      const isSelected = currentChecked.includes(column);
      let newChecked: string[];
      if (isSelected) {
        newChecked = currentChecked.filter(c => c !== column);
      } else {
        newChecked = [...currentChecked, column];
      }
      setReportColumns(prevReport => {
        const filteredExisting = prevReport.filter(c => c.table !== table);
        const columnsToAdd = newChecked.map(c => ({ table, column: c }));
        return [...filteredExisting, ...columnsToAdd];
      });
      return { ...prev, [table]: newChecked };
    });
  };

  const handleSelectAllToggle = () => {
    if (!selectedTable) return;
    const table = selectedTableId;
    const allColumns = selectedTable.columns;

    if (isAllColumnsSelected) {
      setCheckedColumns(prev => ({ ...prev, [table]: [] }));
      setReportColumns(prev => prev.filter(c => c.table !== table));
    } else {
      setCheckedColumns(prev => ({ ...prev, [table]: allColumns }));
      setReportColumns(prev => {
        const otherTableColumns = prev.filter(c => c.table !== table);
        const newTableColumns = allColumns.map(c => ({ table, column: c }));
        return [...otherTableColumns, ...newTableColumns];
      });
    }
  };

  const currentTableCheckedCount = checkedColumns[selectedTableId]?.length || 0;
  const totalReportColumnsCount = reportColumns.length;

  const handleClearTableColumns = () => {
    const table = selectedTableId;
    if (!table || currentTableCheckedCount === 0) return;
    setCheckedColumns(prev => ({ ...prev, [table]: [] }));
    setReportColumns(prevReport => prevReport.filter(c => c.table !== table));
    toast.info('Columns Cleared', {
      description: `All ${currentTableCheckedCount} columns from ${selectedTable?.title} removed from the report.`,
    });
  };

  const handleDownload = async () => {
    if (reportColumns.length === 0) {
      toast.warning('Selection Required', {
        description: 'Please select columns to include in the report.',
      });
      return;
    }

    setDownloading(true);
    try {
      const payload = {
        columns: reportColumns,
        format: format, // This refers to your 'xlsx' | 'csv' state
        filters: filters,
      };

      const res = await fetch(apiURI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Download failed: ${errorText}`);
      }

      // --- Dynamic Filename Logic ---
      // 1. Get Table Title
      const tableTitle = selectedTable?.title.replace(/\s+/g, '_') || 'Report';

      // 2. Use 'formatDate' (the renamed import) to avoid the TS error
      const dateStr = formatDate(new Date(), "d-MMM-yyyy");

      // 3. Determine Extension
      const extension = format === 'csv' ? 'zip' : 'xlsx';
      const dynamicFilename = `${tableTitle}_${dateStr}.${extension}`;

      const contentDisposition = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition ? contentDisposition.match(/filename="(.+?)"/) : null;
      const filename = filenameMatch ? filenameMatch[1] : dynamicFilename;

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Download Complete', {
        description: `${filename} has been downloaded successfully.`,
      });
    } catch (error: any) {
      console.error('Download Error:', error);
      toast.error('Download Failed', {
        description: error.message || 'An unknown error occurred during download.',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col px-4 md:px-6 py-8 bg-background text-foreground">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Custom Report Generator</h1>
          <p className="text-sm text-muted-foreground">
            Select data, choose columns, and download your tailored report.
          </p>
        </div>

        <div className='flex items-center space-x-3'>
          <div className='flex flex-col items-start'>
            <Label htmlFor="format-select" className="mb-1 text-xs text-muted-foreground">Output Format</Label>
            <Select value={format} onValueChange={(value: ReportFormat) => setFormat(value)} disabled={downloading}>
              <SelectTrigger id="format-select" className="w-[120px] bg-input text-foreground border-border h-9">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border">
                <SelectItem value="xlsx">Excel</SelectItem>
                <SelectItem value="csv">CSV (ZIP)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleDownload}
            disabled={downloading || reportColumns.length === 0}
            className="w-[180px] h-9 transition-all duration-200 bg-primary hover:bg-primary/90 text-primary-foreground mt-4"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloading ? 'Processing...' : `Generate ${format.toUpperCase()}`}
          </Button>
        </div>
      </div>

      <Separator className="my-6 bg-border" />

      {/* Report Generator Card (Selection) */}
      <Card className="bg-card text-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ListFilter className="w-5 h-5 text-primary" />
            <span>Customize Your Data Export</span>
          </CardTitle>
          <CardDescription className='text-muted-foreground'>
            Select your data source and simply check/uncheck the desired columns to include them in the final report.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid md:grid-cols-2 gap-0 border-t border-border p-0">

          {/* LEFT: Table List */}
          <div className="border-b md:border-b-0 md:border-r border-border p-4 bg-muted/5">
            <h4 className="text-sm font-semibold mb-3 text-foreground/80">1. Available Tables</h4>
            <ScrollArea className="h-[350px] w-full pr-3">
              <div className="space-y-1">
                {tablesMetadata.map(table => {
                  const Icon = table.icon;
                  const committedCount = reportColumns.filter(c => c.table === table.id).length;

                  return (
                    <button
                      key={table.id}
                      onClick={() => handleTableChange(table.id)}
                      className={`
                        w-full flex items-center justify-between p-3 rounded-md text-sm transition-all
                        border
                        ${selectedTableId === table.id
                          ? 'bg-primary/10 border-primary/50 text-primary font-medium shadow-sm'
                          : 'bg-card border-transparent hover:bg-muted text-foreground hover:text-foreground'
                        }
                      `}
                    >
                      <span className='flex items-center gap-3'>
                        <Icon className="w-4 h-4" />
                        <span>{table.title}</span>
                      </span>
                      {committedCount > 0 && (
                        <span className='bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold'>
                          {committedCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* RIGHT: Column Checkboxes */}
          <div className="p-4 bg-card">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-foreground/80">2. Columns</h4>
              {selectedTable && (
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handleSelectAllToggle}
                    variant="outline" size="sm"
                    className="h-9 px-3 text-xs flex items-center gap-1.5 border-primary/20 hover:bg-primary/5 text-primary"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    {isAllColumnsSelected ? 'Unselect All' : 'Select All'}
                  </Button>

                  {currentTableCheckedCount > 0 && (
                    <Button
                      onClick={handleClearTableColumns}
                      variant="outline" size="sm"
                      className="h-9 px-3 text-xs flex items-center gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Clear
                    </Button>
                  )}
                </div>
              )}
            </div>

            {!selectedTable ? (
              <div className="h-[350px] flex items-center justify-center border-2 border-dashed border-muted rounded-md bg-muted/5">
                <p className="text-sm text-muted-foreground">Select a table to view columns</p>
              </div>
            ) : (
              <ScrollArea className="h-[350px] w-full pr-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedTable.columns.map(column => {
                    const isChecked = checkedColumns[selectedTableId]?.includes(column) || false;
                    return (
                      <div
                        key={column}
                        onClick={() => !downloading && handleColumnToggle(column)}
                        className={`
                          flex items-center space-x-3 p-2 rounded-md border transition-all cursor-pointer
                          ${isChecked ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:bg-muted/50'}
                        `}
                      >
                        <Checkbox
                          id={column}
                          checked={isChecked}
                          onCheckedChange={() => handleColumnToggle(column)}
                          disabled={downloading}
                        />
                        <Label
                          htmlFor={column}
                          className="cursor-pointer text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {column.replace(/([A-Z])/g, ' $1').trim()}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6 bg-border" />

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle>Apply filters</CardTitle>
          <CardDescription className='text-muted-foreground'>
            Apply filters to the selected table before downloading.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center space-x-2 pb-2 border-b border-border">
              <Settings2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">Configuration</h3>
            </div>

            {/* B. Filtering */}
            <DataFilter
              availableColumns={
                selectedTable ? selectedTable.columns.map(col => (
                    { table: selectedTableId, column: col }
                  )) : []
              }
              filters={filters}
              setFilters={setFilters}
            />

            {/* Summary Stats */}
            <div className="bg-muted/30 border border-border rounded-lg p-4 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">{totalReportColumnsCount}</span> columns selected across{' '}
                <span className="font-semibold text-foreground">{new Set(reportColumns.map(c => c.table)).size}</span> tables.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6 bg-border" />

      {/* Data Preview Table */}
      <Card className="bg-card text-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle>Data Preview ({reportColumns.length > 0 ? 'Selected Tables' : '...'})</CardTitle>
          <CardDescription className='text-muted-foreground'>
            Showing preview for <span className="font-semibold">{selectedTable ? selectedTable.title : '—'}</span>.
            Selected columns from other tables are preserved for download but not shown here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            {previewLoading ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-muted-foreground">Loading preview data...</p>
              </div>
            ) : totalReportColumnsCount > 0 && previewColumns.length > 0 && previewData.length > 0 ? (
              <DataTableReusable
                columns={previewColumns}
                // @ts-ignore
                data={previewData}
                enableRowDragging={false}
              />
            ) : (
              <div className="flex items-center justify-center h-48">
                <p className="text-muted-foreground">
                  {totalReportColumnsCount > 0
                    ? 'No data found for the preview table.'
                    : 'Select a table, choose columns to see a preview.'
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}