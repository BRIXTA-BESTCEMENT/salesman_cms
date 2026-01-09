// src/app/home/customReportGenerator/syncLocationBtn.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ReportRow {
  id: string;
  location: string;
  inTimeLatitude?: number;
  inTimeLongitude?: number;
}

export default function SyncLocationBtn({ 
  data, 
  onSyncComplete 
}: { 
  data: ReportRow[], 
  onSyncComplete: () => void 
}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSync = async () => {
    // 1. Identify rows that NEED updating (ignore already fixed addresses)
    const targetRows = data.filter(row => 
      (row.location === 'Live Location' || row.location === 'Live Location (GPS Only)') &&
      row.inTimeLatitude && 
      row.inTimeLongitude
    );

    if (targetRows.length === 0) {
      toast.info("All addresses are already synced!");
      return;
    }

    setIsSyncing(true);
    setProgress(0);
    toast.info(`Syncing ${targetRows.length} locations...`);

    let completed = 0;

    for (const row of targetRows) {
      try {
        // A. Rate Limit Delay (Prevent OSM Ban)
        await new Promise(r => setTimeout(r, 400 + Math.random() * 200));

        // B. Fetch Address from OSM
        const osmRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${row.inTimeLatitude}&lon=${row.inTimeLongitude}`,
          { headers: { 'Accept-Language': 'en-US,en;q=0.9' } }
        );
        
        if (!osmRes.ok) continue;
        const osmData = await osmRes.json();
        
        if (osmData.display_name) {
          // C. SAVE TO DB (The Magic Step)
          await fetch('/api/dashboardPagesAPI/update-location', {
            method: 'POST',
            body: JSON.stringify({
              id: row.id,
              address: osmData.display_name
            })
          });
        }
      } catch (e) {
        console.error("Sync skip", row.id);
      }

      // Update progress
      completed++;
      setProgress(Math.round((completed / targetRows.length) * 100));
    }

    setIsSyncing(false);
    toast.success("Sync Complete! Addresses saved to DB.");
    onSyncComplete(); // Trigger a data refresh on the main page
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleSync} 
      disabled={isSyncing}
      className="gap-2"
    >
      {isSyncing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving {progress}%
        </>
      ) : (
        <>
          <MapPin className="h-4 w-4" />
          Sync Missing Addresses
        </>
      )}
    </Button>
  );
}