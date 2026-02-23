// src/app/home/customReportGenerator/components/DataFilter.tsx
'use client';

import * as React from 'react';
import { Plus, X, ListFilter, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableColumn } from '../customTableHeaders';

// --- NEW IMPORTS FOR DATE PICKER ---
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRange } from "react-day-picker";

export interface FilterRule {
  id: string;
  column: string;
  operator: 'contains' | 'equals' | 'gt' | 'lt';
  value: string;
}

interface FilterBuilderProps {
  availableColumns: TableColumn[];
  filters: FilterRule[];
  setFilters: (f: FilterRule[]) => void;
}

export function DataFilter({ availableColumns, filters, setFilters }: FilterBuilderProps) {

  const addFilter = () => {
    if (availableColumns.length === 0) return;
    const newRule: FilterRule = {
      id: Math.random().toString(36).substring(2, 9),
      column: availableColumns[0].column,
      operator: 'contains',
      value: ''
    };
    setFilters([...filters, newRule]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, field: keyof FilterRule, val: string) => {
    setFilters(filters.map(f => f.id === id ? { ...f, [field]: val } : f));
  };

  return (
    <div className="space-y-4 border border-border rounded-lg p-5 bg-card/50">

      {/* Header Row: Title + Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-primary">
          <ListFilter className="w-5 h-5" />
          <h3 className="font-semibold text-base">Data Filters</h3>
        </div>
        <Button
          onClick={addFilter}
          variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/10 h-9 px-4 text-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Dowload Filter
        </Button>
      </div>

      {/* Filters List Area */}
      <div className="space-y-3 pt-2">
        {filters.length === 0 && (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-lg py-8 bg-muted/5 transition-colors hover:bg-muted/10">
            <p className="text-sm text-muted-foreground mb-3">No filters applied yet.</p>
            <Button variant="secondary" size="sm" onClick={addFilter}>
              Create First Filter
            </Button>
          </div>
        )}

        {filters.map((rule) => {
          const isDateColumn = rule.column.toLowerCase().includes('date') || rule.column.includes('At');

          // Helper: Parse the stored string "start,end" back to a DateRange object
          let dateRangeValue: DateRange | undefined;
          if (isDateColumn && rule.value) {
            const [startStr, endStr] = rule.value.split(',');
            if (startStr) {
              dateRangeValue = {
                from: new Date(startStr),
                to: endStr ? new Date(endStr) : undefined
              };
            }
          }

          return (
            <div
              key={rule.id}
              className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-md border border-border bg-card shadow-sm animate-in fade-in slide-in-from-top-2"
            >

              {/* 1. Column Selector */}
              <div className="w-full sm:w-[200px]">
                <Select
                  value={rule.column}
                  onValueChange={(v) => updateFilter(rule.id, 'column', v)}
                >
                  <SelectTrigger className="w-full h-10 bg-background border-input focus:ring-1 focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map(c => (
                      <SelectItem key={`${c.table}.${c.column}`} value={c.column}>
                        {c.column.replace(/([A-Z])/g, ' $1').trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Operator Selector */}
              <div className="w-full sm:w-40">
                <Select
                  value={rule.operator}
                  onValueChange={(v: any) => updateFilter(rule.id, 'operator', v)}
                >
                  <SelectTrigger className="w-full h-10 bg-background border-input focus:ring-1 focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="gt">{'>'} Greater Than</SelectItem>
                    <SelectItem value="lt">{'<'} Less Than</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Value Input (Conditional: Date Picker vs Text Input) */}
              <div className="flex-1 w-full min-w-[200px]">
                {isDateColumn ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        id="date"
                        className={cn(
                          "w-full justify-start text-left font-normal h-10",
                          !dateRangeValue?.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                        {dateRangeValue?.from ? (
                          dateRangeValue.to ? (
                            <>
                              {format(dateRangeValue.from, "LLL dd, y")} -{" "}
                              {format(dateRangeValue.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRangeValue.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        defaultMonth={dateRangeValue?.from}
                        selected={dateRangeValue}
                        numberOfMonths={2}
                        onSelect={(range) => {
                          if (range?.from) {
                            // Store as "YYYY-MM-DD,YYYY-MM-DD"
                            const start = format(range.from, "yyyy-MM-dd");
                            const end = range.to ? format(range.to, "yyyy-MM-dd") : '';
                            updateFilter(rule.id, 'value', `${start},${end}`);
                          } else {
                            updateFilter(rule.id, 'value', '');
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input
                    type="text"
                    className="h-10 bg-background border-input focus-visible:ring-1 focus-visible:ring-primary"
                    placeholder="Enter value..."
                    value={rule.value || ''}
                    onChange={(e) => updateFilter(rule.id, 'value', e.target.value)}
                  />
                )}
              </div>

              {/* 4. Remove Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 ml-auto sm:ml-0"
                onClick={() => removeFilter(rule.id)}
                title="Remove rule"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}