// src/app/dashboard/logisticsIO/tabsLoader.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LogisticsIOList from './records';
import LogisticsUsersList from './logisticsUsers';

interface LogisticsTabsProps {
  canViewRecords: boolean;
  canViewUsers: boolean;
}

export function LogisticsTabsLoader({
  canViewRecords,
  canViewUsers,
}: LogisticsTabsProps) {

  // Default tab logic
  let defaultTab = "";
  if (canViewRecords) defaultTab = "records";

  if (!defaultTab) {
    return <div>No access to any tabs.</div>;
  }

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canViewRecords && (
          <TabsTrigger value="records" className="flex items-center gap-2">
            Logictics Records
          </TabsTrigger>
        )}
        {/* {canViewUsers && (
          <TabsTrigger value="users" className="flex items-center gap-2">
            Logictics Users
          </TabsTrigger>
        )} */}
      </TabsList>

      {/* --- Tab Content --- */}
      {canViewRecords && (
        <TabsContent value="records" className="space-y-4">
          <LogisticsIOList />
        </TabsContent>
      )}
      {/* {canViewUsers && (
        <TabsContent value="users" className="space-y-4">
          <LogisticsUsersList />
        </TabsContent>
      )} */}
    </Tabs>
  );
}