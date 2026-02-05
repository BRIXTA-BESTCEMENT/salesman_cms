// src/app/dashboard/logisticsGateIO/tabsLoader.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LogisticsGateIOList from './gateIO';

interface LogisticsTabsProps {
  canView: boolean;
}

export function LogisticsTabsLoader({
  canView,
}: LogisticsTabsProps) {

  // Default tab logic
  let defaultTab = "";
  if (canView) defaultTab = "gateIO";

  if (!defaultTab) {
    return <div>No access to any tabs.</div>;
  }

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canView && (
          <TabsTrigger value="gateIO" className="flex items-center gap-2">
            Gate I/O List
          </TabsTrigger>
        )}
      </TabsList>

      {/* --- Tab Content --- */}
      {canView && (
        <TabsContent value="gateIO" className="space-y-4">
          <LogisticsGateIOList />
        </TabsContent>
      )}
    </Tabs>
  );
}