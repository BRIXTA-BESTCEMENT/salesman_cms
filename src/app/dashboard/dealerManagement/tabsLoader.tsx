// src/app/dashboard/dealerManagement/tabsLoader.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ListDealersPage from '@/app/dashboard/dealerManagement/listDealers';
import VerifyDealersPage from '@/app/dashboard/dealerManagement/verifyDealers';
import DealerBrandMappingPage from '@/app/dashboard/dealerManagement/dealerBrandMapping';
import ListVerifiedDealersPage from '@/app/dashboard/dealerManagement/listVerifiedDealers';

interface DealerManagementTabsProps {
  canSeeListDealers: boolean;
  canSeeVerifyDealers: boolean;
  canSeeBrandMapping: boolean;
  canSeeListVerifiedDealers: boolean;
}

export function DealerManagementTabs({
  canSeeListDealers,
  canSeeVerifyDealers,
  canSeeBrandMapping,
  canSeeListVerifiedDealers,
}: DealerManagementTabsProps) {

  // Determine the default tab based on the first permission they have
  let defaultTab = "";
  if (canSeeListDealers) defaultTab = "ListDealers";
  else if (canSeeVerifyDealers) defaultTab = "verifyDealers";
  else if (canSeeBrandMapping) defaultTab = "dealerBrandMapping";
  else if (canSeeBrandMapping) defaultTab = "ListVerifiedDealers";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canSeeListDealers && (
          <TabsTrigger value="ListDealers">List Dealers</TabsTrigger>
        )}
        {canSeeVerifyDealers && (
          <TabsTrigger value="verifyDealers">Verify Dealers</TabsTrigger>
        )}
        {/* {canSeeBrandMapping && (
          <TabsTrigger value="dealerBrandMapping">Dealer Brand Mapping</TabsTrigger>
        )} */}
        {canSeeListVerifiedDealers && (
          <TabsTrigger value="ListVerifiedDealers">List Verified-Dealers</TabsTrigger>
        )}
      </TabsList>

      {/* --- Tab Content --- */}
      {canSeeListDealers && (
        <TabsContent value="ListDealers" className="space-y-4">
          <ListDealersPage />
        </TabsContent>
      )}
      {canSeeVerifyDealers && (
        <TabsContent value="verifyDealers" className="space-y-4">
          <VerifyDealersPage />
        </TabsContent>
      )}
      {/* {canSeeBrandMapping && (
        <TabsContent value="dealerBrandMapping" className="space-y-4">
          <DealerBrandMappingPage />
        </TabsContent>
      )} */}
      {canSeeListVerifiedDealers && (
        <TabsContent value="ListVerifiedDealers" className="space-y-4">
          <ListVerifiedDealersPage />
        </TabsContent>
      )}
    </Tabs>
  );
}