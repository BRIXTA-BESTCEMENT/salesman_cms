// src/app/home/customReportGenerator/components/StyleConfigurator.tsx
'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Palette, Table2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface StyleConfig {
  headerColor: string;
  headerTextColor: string;
  stripeRows: boolean;
  borderColor: string;
  fontFamily: 'Calibri' | 'Arial' | 'Helvetica';
}

interface StyleConfiguratorProps {
  config: StyleConfig;
  onChange: (newConfig: StyleConfig) => void;
}

export function StyleConfigurator({ config, onChange }: StyleConfiguratorProps) {
  
  const handleColorChange = (key: keyof StyleConfig, val: string) => {
    onChange({ ...config, [key]: val });
  };

  const toggleStripe = (checked: boolean) => {
    onChange({ ...config, stripeRows: checked });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-md font-semibold flex items-center space-x-2">
          <Palette className="w-4 h-4 text-primary" />
          <span>Export Styling</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Header Color Picker */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Header Background</Label>
            <div className="flex items-center space-x-2">
              <div 
                className="w-8 h-8 rounded border border-input shadow-sm"
                style={{ backgroundColor: config.headerColor }} 
              />
              <Input 
                type="color" 
                value={config.headerColor}
                onChange={(e) => handleColorChange('headerColor', e.target.value)}
                className="w-full h-8 px-2 py-0 cursor-pointer" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Header Text</Label>
            <div className="flex items-center space-x-2">
               <div 
                className="w-8 h-8 rounded border border-input shadow-sm"
                style={{ backgroundColor: config.headerTextColor }} 
              />
              <Input 
                type="color" 
                value={config.headerTextColor}
                onChange={(e) => handleColorChange('headerTextColor', e.target.value)}
                className="w-full h-8 px-2 py-0 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Font Selection */}
        <div className="space-y-2">
          <Label className="text-xs">Font Family</Label>
          <Select 
            value={config.fontFamily} 
            onValueChange={(v: any) => handleColorChange('fontFamily', v)}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select Font" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Calibri">Calibri (Standard)</SelectItem>
              <SelectItem value="Arial">Arial</SelectItem>
              <SelectItem value="Helvetica">Helvetica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Toggles */}
        <div className="flex items-center justify-between space-x-2 pt-2 border-t border-border">
          <div className="flex flex-col">
            <Label className="text-sm font-medium">Zebra Striping</Label>
            <span className="text-[10px] text-muted-foreground">Alternate row colors</span>
          </div>
          <Switch 
            checked={config.stripeRows} 
            onCheckedChange={toggleStripe} 
          />
        </div>
      </CardContent>
    </Card>
  );
}