// src/app/dashboard/teamOverview/tabsLoader.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, Network, MapPin } from 'lucide-react';

// Components
import { TeamTabContent } from './teamOverview';
import UsersManagement from './userManagement';

interface TabsProps {
  adminUser: any;
  canSeeUsers: any; 
  canSeeTeamView: boolean;
}

export function UsersAndTeamTabs({ adminUser, canSeeUsers, canSeeTeamView }: TabsProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  if (!isMounted) return <Loader2 className="w-8 h-8 animate-spin mx-auto mt-10" />;

  return (
    <Tabs defaultValue={canSeeUsers ? "users" : "team"} className="space-y-4">
      <TabsList>
        {canSeeUsers && <TabsTrigger value="users">Users</TabsTrigger>}
        {canSeeTeamView && <TabsTrigger value="team">Team Overview</TabsTrigger>}
      </TabsList>

      {canSeeUsers && (
      <TabsContent value="users">
        <UsersManagement adminUser={adminUser} />
      </TabsContent>
      )}

      {canSeeTeamView && (
        <TabsContent value="team">
          <TeamTabContent />
        </TabsContent>
      )}
    </Tabs>
  );
}