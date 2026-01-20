// src/app/home/customReportGenerator/page.tsx

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Download, ListFilter, PlusCircle } from 'lucide-react';
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
import { BASE_URL } from '@/lib/Reusable-constants';

import {
  tablesMetadata,
  type TableColumn,
  type ReportFormat
} from './customTableHeaders';

// Helper to generate column definitions dynamically for the preview table
function generateColumns(columns: TableColumn[]): ColumnDef<any, any>[] {
  return columns.map((col, idx) => {
    // flatKey is the actual key we put on the preview row objects: "tableId.columnName"
    const flatKey = `${col.table}.${col.column}`;
    const headerText = col.column.replace(/([A-Z])/g, ' $1').trim();

    // Try to find table title for nicer header (fallback to table id)
    const tableMeta = tablesMetadata.find(t => t.id === col.table);
    const tableLabel = tableMeta ? tableMeta.title : col.table;

    return {
      // Set an explicit id so the table doesn't try to infer from accessor.
      id: flatKey,
      // Use accessorFn to read from the flat key on the row. This avoids React Table treating dots as path delimiters.
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
      // Keep cell rendering safe and deterministic
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

  // Derived state for current table's columns based on reportColumns
  useEffect(() => {
    if (selectedTableId) {
      // Initialize checkedColumns for the current table from reportColumns
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

  // Check if ALL columns for the current table are selected
  const isAllColumnsSelected = useMemo(() => {
    if (!selectedTable) return false;
    const currentChecked = checkedColumns[selectedTableId] || [];
    return currentChecked.length === selectedTable.columns.length && selectedTable.columns.length > 0;
  }, [selectedTable, checkedColumns, selectedTableId]);

  // PREVIEW COLUMNS: show only columns for the currently selected table
  const previewColumns = useMemo(() => {
    if (!selectedTableId) return [];
    const colsForCurrent = reportColumns
      .filter(rc => rc.table === selectedTableId)
      .map(rc => ({ table: rc.table, column: rc.column }));
    return generateColumns(colsForCurrent);
  }, [reportColumns, selectedTableId]);

  const fetchPreview = useCallback(async (columns: TableColumn[]) => {
    // Expectation: columns should be columns for a single table (the currently selected table)
    if (columns.length === 0) {
      setPreviewData([]);
      return;
    }

    setPreviewLoading(true);
    setPreviewData([]);

    try {
      // We assume all columns passed here belong to the same table
      const tableId = columns[0].table;
      const payload = {
        columns,
        format: 'json',
        limit: 100,
        tableId,
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

      // Build unified keys for this table only (table.column)
      const flatKeys = columns.map(c => `${c.table}.${c.column}`);

      const mapped = rows.map((r, idx) => {
        const out: Record<string, any> = {};
        // initialize every expected key so shape is consistent
        flatKeys.forEach(k => (out[k] = undefined));

        // Fill values for the table's columns. r is expected to have keys matching column names.
        columns.forEach(col => {
          const key = `${col.table}.${col.column}`;
          out[key] = r[col.column] ?? null;
        });

        // stable id for react-table
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

  // Update preview when selected table changes OR when committed columns for that table change
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!selectedTableId) {
        setPreviewData([]);
        return;
      }

      const columnsForCurrent = reportColumns.filter(rc => rc.table === selectedTableId);
      if (columnsForCurrent.length === 0) {
        setPreviewData([]); // nothing committed for this table yet
        return;
      }

      // fetch preview for this table only
      fetchPreview(columnsForCurrent);
    }, 200);

    return () => clearTimeout(handler);
  }, [selectedTableId, reportColumns, fetchPreview]);

  // Handles table change in the left pane
  const handleTableChange = (tableId: string) => {
    setSelectedTableId(tableId);
    // When changing tables, if checkedColumns is not initialized, initialize it to the committed columns
    if (!checkedColumns[tableId]) {
      const columnsForTable = reportColumns
        .filter(c => c.table === tableId)
        .map(c => c.column);

      setCheckedColumns(prev => ({
        ...prev,
        [tableId]: columnsForTable,
      }));
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

      // 2. Update the final reportColumns list based on the new state
      setReportColumns(prevReport => {
        // Remove all existing columns for the current table
        const filteredExisting = prevReport.filter(c => c.table !== table);

        // Add back the newly selected columns for this table
        const columnsToAdd = newChecked.map(c => ({ table, column: c }));

        return [...filteredExisting, ...columnsToAdd];
      });

      // 1. Return the updated checkedColumns state for the UI
      return {
        ...prev,
        [table]: newChecked,
      };
    });
  };

  const handleSelectAllToggle = () => {
    if (!selectedTable) return;
    const table = selectedTableId;
    const allColumns = selectedTable.columns;

    if (isAllColumnsSelected) {
      // DESELECT ALL
      setCheckedColumns(prev => ({ ...prev, [table]: [] }));
      setReportColumns(prev => prev.filter(c => c.table !== table));
    } else {
      // SELECT ALL
      setCheckedColumns(prev => ({ ...prev, [table]: allColumns }));
      setReportColumns(prev => {
        // Remove existing entries for this table to avoid dupes, then add all
        const otherTableColumns = prev.filter(c => c.table !== table);
        const newTableColumns = allColumns.map(c => ({ table, column: c }));
        return [...otherTableColumns, ...newTableColumns];
      });
    }
  };

  const currentTableCheckedCount = checkedColumns[selectedTableId]?.length || 0;
  const totalReportColumnsCount = reportColumns.length;

  // --- New Helper to clear all columns for the current table ---
  const handleClearTableColumns = () => {
    const table = selectedTableId;
    if (!table || currentTableCheckedCount === 0) return;

    // Clear the checked state
    setCheckedColumns(prev => ({
      ...prev,
      [table]: [],
    }));

    // Clear the final reportColumns for this table
    setReportColumns(prevReport =>
      prevReport.filter(c => c.table !== table)
    );

    toast.info('Columns Cleared', {
      description: `All ${currentTableCheckedCount} columns from ${selectedTable?.title} removed from the report.`,
    });
  };


  const handleDownload = async () => {
    // ... (Download logic remains the same)
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
        format: format,
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

      const contentDisposition = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition ? contentDisposition.match(/filename="(.+?)"/) : null;
      const defaultFilename = `custom_report_${Date.now()}.${format === 'csv' ? 'zip' : 'xlsx'}`;
      const filename = filenameMatch ? filenameMatch[1] : defaultFilename;

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

      {/* Header (Format Selector moved here) */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Custom Report Generator</h1>
          <p className="text-sm text-muted-foreground">
            Select data, choose columns, and download your tailored report.
          </p>
        </div>

        {/* RIGHT SIDE: Format Selector + Generate Button */}
        <div className='flex items-center space-x-3'>

          {/* Output Settings (Moved from Column 3) */}
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
        <CardContent className="grid md:grid-cols-3 gap-6">

          {/* 1. Table Selection */}
          <div className="md:col-span-1 border-r border-border pr-6">
            <h4 className="text-md font-semibold mb-3">1. Select Data Table</h4>
            <ScrollArea className="h-[400px] w-full pr-4">
              <div className="space-y-1">
                {tablesMetadata.map(table => {
                  const Icon = table.icon;
                  // Calculate committed column count for the table
                  const committedCount = reportColumns.filter(c => c.table === table.id).length;

                  return (
                    <div
                      key={table.id}
                      onClick={() => handleTableChange(table.id)}
                      className={`
                        flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors 
                        border border-transparent 
                        ${selectedTableId === table.id
                          ? 'bg-primary/20 border-primary text-primary font-semibold'
                          : 'bg-muted/30 text-foreground hover:bg-muted/70'
                        }
                      `}
                    >
                      <span className='flex items-center space-x-3'>
                        <Icon className="w-5 h-5" />
                        <span>{table.title}</span>
                      </span>
                      {/* Display the current number of selected columns */}
                      {committedCount > 0 && (
                        <span className='text-xs text-primary font-semibold ml-2'>
                          ({committedCount} cols)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* 2. Column Selection + Add Button (Now just a selection area) */}
          <div className="md:col-span-1 border-r border-border pr-6">
            <h4 className="text-md font-semibold mb-3">2. Choose Columns</h4>
            {!selectedTable ? (
              <p className="text-muted-foreground pt-2">Select a table to view its available columns.</p>
            ) : (
              <>
                {/* --- SELECT ALL CHECKS --- */}
                <div className="mb-2 pb-2 border-b border-border">
                  <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors bg-muted/20">
                    <Checkbox
                      id="select-all-cols"
                      checked={isAllColumnsSelected}
                      onCheckedChange={handleSelectAllToggle}
                      disabled={downloading}
                    />
                    <Label htmlFor="select-all-cols" className="font-semibold cursor-pointer text-foreground">
                      Select All Columns
                    </Label>
                  </div>
                </div>

                <ScrollArea className="h-[300px] w-full pr-4">
                  <div className="space-y-2">
                    {selectedTable.columns.map(column => {
                      const isChecked = checkedColumns[selectedTableId]?.includes(column) || false;
                      return (
                        <div key={column} className="flex items-start space-x-3 p-1 rounded-md hover:bg-muted/50 transition-colors">
                          <Checkbox
                            id={column}
                            checked={isChecked}
                            onCheckedChange={() => handleColumnToggle(column)}
                            disabled={downloading}
                            className="mt-1"
                          />
                          <Label htmlFor={column} className={`capitalize text-sm font-normal cursor-pointer text-foreground leading-snug`}>
                            {column.replace(/([A-Z])/g, ' $1').trim()}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                <div className='mt-4'>
                  <Button
                    onClick={handleClearTableColumns}
                    variant="outline"
                    disabled={currentTableCheckedCount === 0 || downloading}
                    className="w-full text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                  >
                    <PlusCircle className="w-4 h-4 mr-2 rotate-45" />
                    Clear Selection
                  </Button>
                </div>
              </>
            )}

            <div className='mt-4 text-sm text-muted-foreground'>
              Selected: {currentTableCheckedCount} columns
            </div>
          </div>

          {/* 3. Review (Remains the same) */}
          <div className="md:col-span-1">
            <h4 className="text-md font-semibold mb-3">3. Report Summary</h4>

            <div className="space-y-4">

              {/* Total Columns Review */}
              <div>
                <Label className="mb-2 block text-foreground">Total Columns in Report</Label>
                <p className='font-bold text-2xl text-primary'>{totalReportColumnsCount}</p>
                <p className='text-muted-foreground text-sm'>
                  Spanning {Array.from(new Set(reportColumns.map(c => c.table))).length} tables.
                </p>
              </div>

              <Separator className="bg-border" />

              {/* Detailed Table View */}
              <div>
                <Label className="mb-2 block text-foreground">Tables Included</Label>
                <ScrollArea className="h-[250px] pr-4">
                  <div className='space-y-2'>
                    {tablesMetadata.filter(t => reportColumns.some(c => c.table === t.id)).map(table => (
                      <div key={table.id} className='p-2 bg-muted/30 rounded-md'>
                        <p className='font-semibold text-sm'>{table.title}</p>
                        <p className='text-xs text-muted-foreground'>
                          {reportColumns.filter(c => c.table === table.id).length} columns
                        </p>
                      </div>
                    ))}
                    {totalReportColumnsCount === 0 && (
                      <p className="text-muted-foreground text-sm pt-2">Add columns to start building your report.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      <Separator className="my-6 bg-border" />

      {/* Data Preview Table (No change needed here) */}
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