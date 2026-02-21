// src/app/account/page.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils'; // Assuming you have shadcn's cn utility
import { MessageSquareText } from 'lucide-react'; // Import icons

export default function AccountPage() {
  const router = useRouter();

  const handleCardClick = (path: string) => {
    router.push(path);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 sm:p-6 lg:p-8 text-foreground">
      <div className="w-full max-w-4xl mx-auto space-y-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Your Account Overview</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Quick access to manage your personal settings and communicate with support.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {/* Card for "Account Settings" */}
          {/* <Card
            className={cn(
              "bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors cursor-pointer", 
            )}
            onClick={() => handleCardClick('/account/settings')}
          >
            
            <CardHeader className="p-0 mb-4 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto"> 
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl font-semibold text-card-foreground mb-2">Account Settings</CardTitle>
              <CardDescription className="text-muted-foreground text-base leading-relaxed">
                Manage your profile details, change your password, and set your personal preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
            </CardContent>
          </Card> */}

          {/* Card for "Raise a Query" */}
          <Card
            className={cn(
              "bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors cursor-pointer", // Feature card styling
              // Removed "flex flex-col items-start" from here
            )}
            onClick={() => handleCardClick('/account/querry')}
          >
            {/* Added text-center here to center all contents of the header */}
            <CardHeader className="p-0 mb-4 text-center">
              <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <MessageSquareText className="w-6 h-6 text-chart-2" />
              </div>
              <CardTitle className="text-xl font-semibold text-card-foreground mb-2">Raise a Query</CardTitle>
              <CardDescription className="text-muted-foreground text-base leading-relaxed">
                Send a direct message to the developers for any questions, issues, or suggestions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
            </CardContent>
          </Card>

          {/* Add more cards here following the same pattern */}
        </div>
      </div>
    </div>
  );
}