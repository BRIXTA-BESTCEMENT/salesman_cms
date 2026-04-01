// lib/components/global-filter-bar.tsx
'use client';

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Calendar as CalendarIcon } from "lucide-react";
import { MultiSelect } from "@/components/multi-select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface Option {
  label: string;
  value: string;
}

interface GlobalFilterBarProps {
  // --- TOGGLES ---
  showSearch?: boolean;
  showDateRange?: boolean;
  showZone?: boolean;
  showArea?: boolean;
  showRole?: boolean;
  showStatus?: boolean;

  // --- VALUES ---
  searchVal?: string;
  dateRangeVal?: DateRange | undefined;
  zoneVals?: string[];     // Array for MultiSelect
  areaVals?: string[];     // Array for MultiSelect
  roleVal?: string;        // Single string for Select
  statusVal?: string;      // Single string for Select

  // --- OPTIONS (Passed from parent so they are dynamic per page) ---
  zoneOptions?: Option[];
  areaOptions?: Option[];
  roleOptions?: Option[];
  statusOptions?: Option[];

  // --- SETTERS ---
  onSearchChange?: (val: string) => void;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  onZoneChange?: (vals: string[]) => void;
  onAreaChange?: (vals: string[]) => void;
  onRoleChange?: (val: string) => void;
  onStatusChange?: (val: string) => void;
}

export function GlobalFilterBar({
  showSearch = false,
  showDateRange = false,
  showZone = false,
  showArea = false,
  showRole = false,
  showStatus = false,

  searchVal = '',
  dateRangeVal,
  zoneVals = [],
  areaVals = [],
  roleVal = 'all',
  statusVal = 'all',

  zoneOptions = [],
  areaOptions = [],
  roleOptions = [
    { label: "All Roles", value: "all" },
    { label: "Sales", value: "Sales" },
    { label: "Technical", value: "Technical" }
  ],
  statusOptions = [
    { label: "All Statuses", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" }
  ],

  onSearchChange,
  onDateRangeChange,
  onZoneChange,
  onAreaChange,
  onRoleChange,
  onStatusChange,
}: GlobalFilterBarProps) {
  
  // Check if Row 2 has any active filters to prevent rendering an empty div
  const hasRow2 = showZone || showArea || showRole || showStatus;

  return (
    <div className="flex flex-col gap-4 bg-card p-5 rounded-xl border shadow-sm mb-6">
      
      {/* ROW 1: 2-Column Grid (Search & Date Range) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Search */}
        {showSearch ? (
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, dealer, phone..."
              className="pl-9 bg-background"
              value={searchVal}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </div>
        ) : <div /> /* Empty div to maintain grid structure if Search is off but Date is on */}

        {/* Date Range */}
        {showDateRange && (
          <div className="w-full">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal bg-background",
                    !dateRangeVal && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRangeVal?.from ? (
                    dateRangeVal.to ? (
                      <>
                        {format(dateRangeVal.from, "LLL dd, y")} -{" "}
                        {format(dateRangeVal.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRangeVal.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  defaultMonth={dateRangeVal?.from}
                  selected={dateRangeVal}
                  onSelect={onDateRangeChange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* ROW 2: 4-Column Grid (Zone, Area, Role, Status) */}
      {hasRow2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Zone (MultiSelect) */}
          {showZone && (
            <div className="w-full">
              <MultiSelect
                options={zoneOptions}
                onValueChange={onZoneChange || (() => {})}
                selectedValues={zoneVals}
                placeholder="Select Zones"
                variant="inverted"
                maxCount={2}
              />
            </div>
          )}

          {/* Area (MultiSelect) */}
          {showArea && (
            <div className="w-full">
              <MultiSelect
                options={areaOptions}
                onValueChange={onAreaChange || (() => {})}
                selectedValues={areaVals}
                placeholder="Select Areas"
                variant="inverted"
                maxCount={2}
              />
            </div>
          )}

          {/* Company Role (Select) */}
          {showRole && (
            <div className="w-full">
              <Select value={roleVal} onValueChange={onRoleChange}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status (Select) */}
          {showStatus && (
            <div className="w-full">
              <Select value={statusVal} onValueChange={onStatusChange}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

        </div>
      )}
    </div>
  );
}