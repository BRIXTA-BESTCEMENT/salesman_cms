'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MasonPcPage from '@/app/dashboard/masonpcSide/masonpc';
import TsoMeetingsPage from '@/app/dashboard/masonpcSide/tsoMeetings';
import SchemesOffersPage from '@/app/dashboard/masonpcSide/schemesOffers';
import BagsLiftPage from '@/app/dashboard/masonpcSide/bagsLift';
import PointsLedgerPage from '@/app/dashboard/masonpcSide/pointsLedger';
import RewardsRedemptionPage from '@/app/dashboard/masonpcSide/rewardRedemption';

// This component receives the permissions as props
// from the server component (page.tsx)
interface MasonPcTabsProps {
  canSeeMasonPc: boolean;
  canSeeTsoMeetings: boolean;
  canSeeSchemesOffers: boolean;
  canSeeBagsLift: boolean;
  canSeePointsLedger: boolean;
  canSeeRewardsRedemption: boolean;
}

export function MasonPcTabs({
  canSeeMasonPc,
  canSeeTsoMeetings,
  canSeeSchemesOffers,
  canSeeBagsLift,
  canSeePointsLedger,
  canSeeRewardsRedemption,
}: MasonPcTabsProps) {

  // Determine the default tab based on the first permission they have
  let defaultTab = "";
  if (canSeeMasonPc) defaultTab = "masonPc";
  else if (canSeeTsoMeetings) defaultTab = "tsoMeetings";
  else if (canSeeSchemesOffers) defaultTab = "schemesOffers";
  else if (canSeeBagsLift) defaultTab = "bagsLift";
  else if (canSeePointsLedger) defaultTab = "pointsLedger";
  else if (canSeeRewardsRedemption) defaultTab = "rewardsRedemption";


  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canSeeMasonPc && (
          <TabsTrigger value="masonPc">Mason - Petty Contractors</TabsTrigger>
        )}
        {canSeeBagsLift && (
          <TabsTrigger value="bagsLift">Bags Lift Records</TabsTrigger>
        )}
        {canSeePointsLedger && (
          <TabsTrigger value="pointsLedger">Points Ledger</TabsTrigger>
        )}
        {canSeeTsoMeetings && (
          <TabsTrigger value="tsoMeetings">TSO Meetings</TabsTrigger>
        )}
        {canSeeSchemesOffers && (
          <TabsTrigger value="schemesOffers">Schemes & Offers</TabsTrigger>
        )}
        {canSeeRewardsRedemption && (
          <TabsTrigger value="rewardsRedemption">Rewards Redemption</TabsTrigger>
        )}
      </TabsList>

      {/* --- Tab Content --- */}
      {canSeeMasonPc && (
        <TabsContent value="masonPc" className="space-y-4">
          <MasonPcPage />
        </TabsContent>
      )}
      {canSeeSchemesOffers && (
        <TabsContent value="schemesOffers" className="space-y-4">
          <SchemesOffersPage />
        </TabsContent>
      )}
      {canSeeBagsLift && (
        <TabsContent value="bagsLift" className="space-y-4">
          <BagsLiftPage />
        </TabsContent>
      )}
      {canSeePointsLedger && (
        <TabsContent value="pointsLedger" className="space-y-4">
          <PointsLedgerPage />
        </TabsContent>
      )}
      {canSeeTsoMeetings && (
        <TabsContent value="tsoMeetings" className="space-y-4">
          <TsoMeetingsPage />
        </TabsContent>
      )}
      {canSeeRewardsRedemption && (
        <TabsContent value="rewardsRedemption" className="space-y-4">
          <RewardsRedemptionPage />
        </TabsContent>
      )}
    </Tabs>
  );
}