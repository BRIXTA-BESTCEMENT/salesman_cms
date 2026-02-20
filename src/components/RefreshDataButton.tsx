// src/components/RefreshDataButton.tsx
'use client';

import { useState, useTransition } from 'react';
import { refreshCompanyCache } from '@/app/actions/cache';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react'; 

interface RefreshDataButtonProps {
  cachePrefix: string; // The tag prefix, e.g., 'dealers', 'technical-sites', etc...
  onRefresh: () => void; // A function to trigger your local useEffect to refetch
}

export function RefreshDataButton({ cachePrefix, onRefresh }: RefreshDataButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      // 1. Wipe the Server Cache
      const result = await refreshCompanyCache(cachePrefix);
      
      if (result.success) {
        // 2. Tell the local component to fetch the fresh data from the API
        onRefresh();
      } else {
        console.error(result.error);
      }
    });
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleRefresh} 
      disabled={isPending}
      className="flex items-center gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? 'Syncing...' : 'Refresh Data'}
    </Button>
  );
}