// src/app/home/customReportGenerator/components/FilterBuilder.tsx
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

export function FilterBuilder({ availableColumns, filters, setFilters }: FilterBuilderProps) {
  
  const addFilter = () => {
    if(availableColumns.length === 0) return;
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
    <Card className="border-border bg-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center space-x-2">
          <ListFilter className="w-4 h-4 text-primary" />
          <span>Data Filters</span>
        </CardTitle>
        <Button onClick={addFilter} size="sm" variant="outline" className="h-7 px-2 text-xs">
          <Plus className="w-3 h-3 mr-1" /> Add Rule
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        
        {filters.length === 0 && (
           <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-md py-6 bg-muted/5">
             <p className="text-xs text-muted-foreground mb-2">No active filters</p>
             <Button variant="ghost" size="sm" onClick={addFilter} className="text-xs h-7">
                Create First Filter
             </Button>
           </div>
        )}
        
        {filters.map((rule) => {
          const isDateColumn = rule.column.toLowerCase().includes('date') || rule.column.includes('At');
          
          return (
            <div key={rule.id} className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              
              {/* 1. Column */}
              <Select 
                value={rule.column} 
                onValueChange={(v) => updateFilter(rule.id, 'column', v)}
              >
                <SelectTrigger className="w-[110px] h-8 text-xs bg-background">
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

              {/* 2. Operator */}
              <Select 
                value={rule.operator} 
                onValueChange={(v: any) => updateFilter(rule.id, 'operator', v)}
              >
                <SelectTrigger className="w-[95px] h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="gt">{'>'} Greater</SelectItem>
                  <SelectItem value="lt">{'<'} Less</SelectItem>
                </SelectContent>
              </Select>

              {/* 3. Value Input (Conditional: Date Picker vs Text Input) */}
              <div className="flex-1 min-w-[100px]">
                  {isDateColumn ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full h-8 justify-start text-left font-normal text-xs px-2",
                            !rule.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {rule.value ? format(new Date(rule.value), "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={rule.value ? new Date(rule.value) : undefined}
                          onSelect={(date) => {
                             if (date) {
                               // Format to YYYY-MM-DD for consistency with string comparison
                               updateFilter(rule.id, 'value', format(date, "yyyy-MM-dd"));
                             } else {
                               updateFilter(rule.id, 'value', '');
                             }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Input
                      type="text"
                      className="h-8 text-xs"
                      placeholder="Enter value..."
                      value={rule.value || ''}
                      onChange={(e) => updateFilter(rule.id, 'value', e.target.value)}
                    />
                  )}
              </div>

              {/* 4. Remove */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => removeFilter(rule.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}