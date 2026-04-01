// src/components/multi-select.tsx
"use client";

import React from "react";
import { Check, ChevronDown } from "lucide-react"; // Make sure you have lucide-react installed

import { cn } from "@/lib/utils"; // Assuming you have this utility for class merging
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge"; // Optional: for displaying selected items as badges

interface Option {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: Option[];
  selectedValues: string[];
  onValueChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  variant?: string;
  maxCount?: number | string;
}

export function MultiSelect({
  options,
  selectedValues,
  onValueChange,
  placeholder = "Select...",
  className,
  disabled,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    if (selectedValues.includes(value)) {
      onValueChange(selectedValues.filter((item) => item !== value));
    } else {
      onValueChange([...selectedValues, value]);
    }
  };

  const selectedOptions = options.filter(option => selectedValues.includes(option.value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto min-h-[38px] px-3 py-2", className)}
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((option) => (
                <Badge
                  key={option.value}
                  variant="secondary"
                  className="rounded-sm font-normal py-0.5 px-2 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent opening popover
                    handleSelect(option.value);
                  }}
                >
                  {option.label}
                  <Check className="ml-1 h-3 w-3" /> {/* Use Check to indicate removal */}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label} // Use label for search
                  onSelect={() => {
                    handleSelect(option.value);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {selectedValues.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onValueChange([])}
                    className="justify-center text-center cursor-pointer text-red-500"
                  >
                    Clear All
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}