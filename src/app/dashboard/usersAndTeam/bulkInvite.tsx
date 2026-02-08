// src/app/dashboard/users/bulkInvite.tsx (Adapted to resolution path)
'use client';

import { useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

const ROLES = [
  'president', 'senior-general-manager', 'general-manager', 'regional-sales-manager',
  'area-sales-manager', 'senior-manager', 'manager', 'assistant-manager',
];

interface BulkInviteDialogProps {
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
  // Function to refresh the main user list after a successful invite
  onRefreshUsers: () => Promise<void>; 
}

interface UserPayload {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    phoneNumber?: string;
    region?: string;
    area?: string;
    isTechnical?: boolean | null;
}


export function BulkInviteDialog({ onSuccess, onError, onRefreshUsers }: BulkInviteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const bulkInviteURI = `/api/dashboardPagesAPI/users-and-team/users/bulk-invite`;

  // Function to parse CSV or TSV data from a string
  const parseBulkData = (data: string): UserPayload[] => {
    // Determine delimiter (common for CSV/TSV)
    const delimiter = data.includes('\t') ? '\t' : (data.includes(',') ? ',' : '|');
    const lines = data.trim().split('\n').filter(line => line.trim() !== '');

    if (lines.length === 0) {
      throw new Error('No data found to process.');
    }

    // First line is header
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    // Clean headers to match the API payload (e.g., 'first name' -> 'firstname')
    const headerMap: { [key: string]: keyof UserPayload } = {
        'email': 'email',
        'firstname': 'firstName',
        'lastname': 'lastName',
        'phone': 'phoneNumber', // Added 'phone' as a common alias
        'phonenumber': 'phoneNumber',
        'role': 'role',
        'region': 'region',
        'area': 'area',
        'istechnical': 'isTechnical',
    };

    // --- FIX: Only enforce mandatory fields in the header check ---
    const mandatoryFields = ['email', 'firstname', 'lastname', 'phonenumber', 'role', 'region', 'area', 'istechnical']; 
    
    // Check if ALL mandatory headers exist
    if (!mandatoryFields.every(field => headers.includes(field))) {
      throw new Error(`Missing mandatory columns in header. Must include: ${mandatoryFields.join(', ')}.`);
    }

    const users: UserPayload[] = [];
    const roleSet = new Set(ROLES);

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim());
      const user: any = {};
      
      // Map values to user object
      headers.forEach((header, index) => {
        const key = headerMap[header];
        if (key && values[index]) {
            // Only add field if value is present
            user[key] = values[index];
        }
      });

      // Basic validation for mandatory fields in the row
      if (!user.email || !user.firstName || !user.lastName || !user.role) {
        throw new Error(`Row ${i + 1}: Missing one of (email, firstName, lastName, role).`);
      }
      
      // Normalize and validate role
      const normalizedRole = user.role.toLowerCase().replace(/[^a-z-]/g, ''); // Ensure only letters and hyphens for match
      if (!roleSet.has(normalizedRole)) {
        throw new Error(`Row ${i + 1}: Invalid role '${user.role}'. Must be one of: ${ROLES.join(', ')}`);
      }
      user.role = normalizedRole;

      users.push(user as UserPayload);
    }

    return users;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCurrentFile(file);
      setBulkData(''); // Clear paste area if file is chosen
      onError('');
    } else {
      setCurrentFile(null);
    }
  };


  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError('');
    onSuccess('');
    setLoading(true);

    let dataToProcess = bulkData;

    // 1. If file is selected, read its contents
    if (currentFile) {
        try {
            dataToProcess = await readFileContent(currentFile);
        } catch (readError: any) {
            onError(`File Read Error: ${readError.message}`);
            setLoading(false);
            return;
        }
    }
    
    if (!dataToProcess.trim()) {
        onError('No data provided via paste or file upload.');
        setLoading(false);
        return;
    }

    let usersPayload: UserPayload[];
    try {
      // 2. Parse the data string
      usersPayload = parseBulkData(dataToProcess);
      
      if (usersPayload.length === 0) {
        onError('No valid users found after parsing.');
        setLoading(false);
        return;
      }
      
    } catch (parseError: any) {
        onError(`Parsing Error: ${parseError.message}`);
        setLoading(false);
        return;
    }


    // 3. Send to API
    try {
      const response = await fetch(bulkInviteURI, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usersPayload) 
      });

      const data = await response.json();

      if (response.ok || response.status === 207) { // 207 is Multi-Status
        await onRefreshUsers(); // Refresh the main user list
        setIsOpen(false);
        setBulkData('');
        setCurrentFile(null);
        
        const successfulCount = data.successfulCount;
        const failedCount = data.failedCount;
        let successMsg = `Bulk Invitation completed: ${successfulCount} successful, ${failedCount} failed.`;
        
        if (failedCount > 0) {
            const failedEmails = data.results
                .filter((r: any) => !r.success)
                .map((r: any) => `${r.email} (${r.error})`)
                .join('; ');
            
            // Show summary of errors but log details to console
            onError(`Bulk Invitation Errors: ${failedCount} users failed. See console for details.`);
            console.error('Bulk Invite Failures:', data.results.filter((r: any) => !r.success));
        }
        
        onSuccess(successMsg);
      } else {
        onError(data.error || 'Failed to process bulk invitation (API returned non-success status)');
      }
    } catch (networkError: any) {
      onError(`Network Error: Failed to connect to server.`);
    } finally {
      setLoading(false);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve(event.target?.result as string);
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsText(file);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
            // Reset state when closing
            setBulkData('');
            setCurrentFile(null);
            onError('');
            onSuccess('');
        }
    }}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="bg-gray-600 hover:bg-gray-700 text-white">
          <Upload className="w-4 h-4 mr-2" />
          Bulk Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Bulk User Invitation</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleBulkSubmit} className="space-y-6 pt-4">
          
          <Alert>
              <AlertTitle>Instructions</AlertTitle>
              <AlertDescription className="text-xs">
                Provide user data below. Data must be in 'CSV', 'TSV', or 'pipe-separated' format.
                <div className="mt-2 space-y-1">
                    <p className="font-semibold">Mandatory Columns:</p> 
                    <p className="pl-4">
                        <code className="bg-gray-200 p-1 rounded font-mono text-gray-800">email</code>, 
                        <code className="bg-gray-200 p-1 rounded font-mono text-gray-800">firstName</code>, 
                        <code className="bg-gray-200 p-1 rounded font-mono text-gray-800">lastName</code>,
                        <code className="bg-gray-200 p-1 rounded font-mono text-gray-800">phoneNumber</code>, 
                        <code className="bg-gray-200 p-1 rounded font-mono text-gray-800">role</code> 
                        <code className="bg-gray-200 p-1 rounded font-mono text-gray-800">region(zone)</code>, 
                        <code className="bg-gray-200 p-1 rounded font-mono text-gray-800">area</code>
                    </p>
                    <p className="mt-1 pl-4">Note: <code className="bg-gray-200 p-1 rounded font-mono text-gray-800">isTechnical</code> should be TRUE (or 'yes', '1') or FALSE (or 'no', '0', empty).</p>
                </div>
              </AlertDescription>
          </Alert>

          {/* Option 1: File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Upload CSV/TXT File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              disabled={loading}
              className="text-sm"
            />
          </div>

          <Separator orientation="horizontal" className="my-4" />

          {/* Option 2: Paste Text Area */}
          <div className="space-y-2">
            <Label htmlFor="bulk-data">OR Paste Data Directly</Label>
            <Textarea
              id="bulk-data"
              value={bulkData}
              onChange={(e) => {
                  setBulkData(e.target.value);
                  setCurrentFile(null); // Clear file selection if user pastes data
                  onError('');
              }}
              rows={8}
              placeholder={`email,firstName,lastName,phoneNumber,role,region,area,isTechnical\nuser1@example.com,John,Doe,+919999900001,junior-executive,North,Central\nuser2@example.com,Jane,Smith,+919999900002,manager,South,East,FALSE`}
              disabled={loading || !!currentFile}
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="submit"
              className="flex items-center"
              disabled={loading || (!bulkData.trim() && !currentFile)}
            >
              {loading ? 'Processing...' : `Process ${currentFile ? currentFile.name : (bulkData.trim() ? 'Pasted Data' : 'Invitations')}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
