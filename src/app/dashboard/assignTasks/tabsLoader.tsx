// src/app/dashboard/assignTasks/tabsLoader.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TasksListPage from './tasks';
import VerifyTasksPage from './verifyTasks';

interface AssignTasksTabsProps {
  canSeeTasksList: boolean;
  canSeeVerifyTasks: boolean;
}

export function AssignTasksTabs({
  canSeeTasksList,
  canSeeVerifyTasks,
}: AssignTasksTabsProps) {

  const defaultTab = canSeeTasksList ? 'tasksList' : 'verifyTasks';

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canSeeTasksList && (
          <TabsTrigger value="tasksList">PJP List</TabsTrigger>
        )}
        {canSeeVerifyTasks && (
          <TabsTrigger value="verifyTasks">PJP Verify</TabsTrigger>
        )}
      </TabsList>

      {canSeeTasksList && (
        <TabsContent value="tasksList" className="space-y-4">
          <TasksListPage />
        </TabsContent>
      )}

      {canSeeVerifyTasks && (
        <TabsContent value="verifyTasks" className="space-y-4">
          <VerifyTasksPage />
        </TabsContent>
      )}
    </Tabs>
  );
}