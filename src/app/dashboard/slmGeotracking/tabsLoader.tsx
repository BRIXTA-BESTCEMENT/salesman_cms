// src/app/dashboard/slmGeotracking/tabsLoader.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, } from 'lucide-react';

// Components
import SalesmanGeoTrackingPage from './slmGeotracking';
import { SalesmanLiveLocation } from './salesmanLiveLocation';

interface TabsProps {
  canSeeGeotracking: boolean;
  canSeeLiveLocation: boolean;
}

export function GeotrackingTabs({ canSeeGeotracking, canSeeLiveLocation }: TabsProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  if (!isMounted) return <Loader2 className="w-8 h-8 animate-spin mx-auto mt-10" />;

  const defaultTab = canSeeGeotracking ? "geotracking" : (canSeeLiveLocation ? "live-map" : "");

  if (!defaultTab) {
      return <div className="p-10 text-center text-muted-foreground">You do not have access to these views.</div>;
  }

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList>
            {canSeeGeotracking && (
                <TabsTrigger value="geotracking" className="flex gap-2">Geotracking Logs</TabsTrigger>
            )}
            {canSeeLiveLocation && (
                <TabsTrigger value="live-map" className="flex gap-2">Live Location</TabsTrigger>
            )}
        </TabsList>
      </div>
      {canSeeGeotracking && (
        <TabsContent value="geotracking" className="space-y-4">
            <SalesmanGeoTrackingPage />
        </TabsContent>
      )}
      {canSeeLiveLocation && (
        <TabsContent value="live-map" className="space-y-4">
          <SalesmanLiveLocation />
        </TabsContent>
      )}

    </Tabs>
  );
}