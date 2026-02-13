// src/app/dashboard/logisticsGateIO/tabsLoader.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LogisticsIOList from './records';

interface LogisticsTabsProps {
  canView: boolean;
}

export function LogisticsTabsLoader({
  canView,
}: LogisticsTabsProps) {

  // Default tab logic
  let defaultTab = "";
  if (canView) defaultTab = "records";

  if (!defaultTab) {
    return <div>No access to any tabs.</div>;
  }

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canView && (
          <TabsTrigger value="records" className="flex items-center gap-2">
            Logictics Records
          </TabsTrigger>
        )}
      </TabsList>

      {/* --- Tab Content --- */}
      {canView && (
        <TabsContent value="records" className="space-y-4">
          <LogisticsIOList />
        </TabsContent>
      )}
    </Tabs>
  );
}