// src/app/dashboard/reports/tabsLoader.tsx
'use client';

import * as React from 'react'; // Import React for useEffect and useState
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CompetitionReportsPage from './competitionReports';
import SalesOrdersTable from './salesOrders';
import DailyVisitReportsPage from './dailyVisitReports';
import TechnicalVisitReportsPage from './technicalVisitReports';
import DvrPjpReportPage from './dvrVpjp';
import TvrPjpReportPage from './tvrVpjp';
import SalesDVRReportPage from './salesVdvr';

// This component receives the permissions as props
// from the server component (page.tsx)
interface ReportsTabsProps {
  canSeeDVR: boolean;
  canSeeTVR: boolean;
  canSeeSalesOrders: boolean;
  canSeeCompetition: boolean;
  canSeeDvrVpjp: boolean;
  canSeeTvrVpjp: boolean;
  canSeeSalesVdvr: boolean;
}

export function ReportsTabs({
  canSeeDVR,
  canSeeTVR,
  canSeeSalesOrders,
  canSeeCompetition,
  canSeeDvrVpjp,
  canSeeTvrVpjp,
  canSeeSalesVdvr,
}: ReportsTabsProps) {

  // 1. State to track hydration completion
  const [isClient, setIsClient] = React.useState(false);

  // 2. Set the client state after mounting
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Determine the default tab based on permissions
  const defaultTab = React.useMemo(() => {
    if (canSeeDVR) return "dailyVisitReport";
    if (canSeeTVR) return "technicalVisitReport";
    if (canSeeSalesOrders) return "salesOrderReport";
    if (canSeeCompetition) return "competitionReport";
    if (canSeeDvrVpjp) return "dvrVpjp";
    if (canSeeTvrVpjp) return "tvrVpjp";
    if (canSeeSalesVdvr) return "salesVdvr";
    return ""; // Should not happen if canSeeAnyReport is checked in parent
  }, [canSeeDVR, canSeeTVR, canSeeSalesOrders, canSeeCompetition, canSeeDvrVpjp, canSeeTvrVpjp, canSeeSalesVdvr]);


  // 3. Prevent rendering the component that generates unstable IDs during SSR
  if (!isClient) {
    // Render a safe, placeholder div during SSR/Hydration
    // This allows the browser to show *something* quickly without triggering the mismatch.
    return <div className="min-h-[300px] w-full flex items-center justify-center text-muted-foreground">
      Loading Reports UI...
    </div>;
  }

  // 4. Render the full component only on the client
  return (
    // Note: We use the memoized defaultTab value
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canSeeDVR && (
          <TabsTrigger value="dailyVisitReport">DVR Report</TabsTrigger>
        )}
        {canSeeTVR && (
          <TabsTrigger value="technicalVisitReport">TVR Report</TabsTrigger>
        )}
        {canSeeSalesOrders && (
          <TabsTrigger value="salesOrderReport">Sales Orders</TabsTrigger>
        )}
        {canSeeCompetition && (
          <TabsTrigger value="competitionReport">Competition Report</TabsTrigger>
        )}
        {/* {canSeeDvrVpjp && (
          <TabsTrigger value="dvrVpjp">DVR V PJP</TabsTrigger>
        )} */}
        {/* {canSeeTvrVpjp && (
          <TabsTrigger value="tvrVpjp">TVR V PJP</TabsTrigger>
        )} */}
        {/* {canSeeSalesVdvr && (
          <TabsTrigger value="salesVdvr">Sales V DVR</TabsTrigger>
        )} */}
      </TabsList>

      {/* --- Tab Content --- */}
      {canSeeDVR && (
        <TabsContent value="dailyVisitReport" className="space-y-4">
          <DailyVisitReportsPage />
        </TabsContent>
      )}
      {canSeeTVR && (
        <TabsContent value="technicalVisitReport" className="space-y-4">
          <TechnicalVisitReportsPage />
        </TabsContent>
      )}
      {canSeeSalesOrders && (
        <TabsContent value="salesOrderReport" className="space-y-4">
          <SalesOrdersTable />
        </TabsContent>
      )}
      {canSeeCompetition && (
        <TabsContent value="competitionReport" className="space-y-4">
          <CompetitionReportsPage />
        </TabsContent>
      )}
      {/* {canSeeDvrVpjp && (
        <TabsContent value="dvrVpjp" className="space-y-4">
          <DvrPjpReportPage />
        </TabsContent>
      )} */}
      {/* {canSeeTvrVpjp && (
        <TabsContent value="TvrVpjp" className="space-y-4">
          <TvrPjpReportPage />
        </TabsContent>
      )} */}
      {/* {canSeeSalesVdvr && (
        <TabsContent value="salesVdvr" className="space-y-4">
          <SalesDVRReportPage />
        </TabsContent>
      )} */}
    </Tabs>
  );
}