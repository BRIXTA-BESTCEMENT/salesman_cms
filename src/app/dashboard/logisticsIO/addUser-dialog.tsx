// src/app/dashboard/logisticsGateIO/addUser-dialog.tsx
'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Copy, UserPlus, Check, KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_URL = `/api/dashboardPagesAPI/logistics-io/logistics-users`;

export function AddLogisticsUserDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [sourceName, setSourceName] = useState('');

  // Success State (to show the generated password)
  const [createdCredentials, setCreatedCredentials] = useState<{ userName: string; userPassword: string; role: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleReset = () => {
    setUserName('');
    setUserRole('');
    setSourceName('');
    setCreatedCredentials(null);
    setCopied(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Delay reset slightly so it doesn't flash while closing
      setTimeout(handleReset, 300);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || userName.length < 3) return toast.error('Username must be at least 3 characters');
    if (!userRole) return toast.error('Please select a role');

    setIsLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: userName.trim(),
          userRole,
          sourceName: sourceName.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to create user');
      }

      toast.success('User created successfully!');
      // Display the credentials
      setCreatedCredentials({
        userName: data.user.userName,
        userPassword: data.user.userPassword,
        role: data.user.userRole,
      });

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!createdCredentials) return;
    const textToCopy = `Logistics Login Details:\nUsername: ${createdCredentials.userName}\nPassword: ${createdCredentials.userPassword}\nRole: ${createdCredentials.role}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Credentials copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9 shadow-sm">
          <UserPlus className="w-4 h-4" /> Add Operator
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{createdCredentials ? 'Credentials Generated' : 'Add Logistics Operator'}</DialogTitle>
          <DialogDescription>
            {createdCredentials 
              ? 'Please securely copy the password below. It will not be shown again.' 
              : 'Create a new login for the Gate, Weighbridge, or Store app.'}
          </DialogDescription>
        </DialogHeader>

        {createdCredentials ? (
          // --- SUCCESS VIEW (SHOW PASSWORD) ---
          <div className="space-y-4 py-4">
            <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
              <KeyRound className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-emerald-800 font-bold">Success!</AlertTitle>
              <AlertDescription className="text-emerald-700">
                The account has been created. Save these details.
              </AlertDescription>
            </Alert>
            
            <div className="bg-slate-50 border rounded-md p-4 space-y-3 font-mono text-sm relative">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-slate-500">Username:</span>
                <span className="font-bold text-slate-900">{createdCredentials.userName}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-slate-500">Password:</span>
                <span className="font-bold text-blue-600">{createdCredentials.userPassword}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Role:</span>
                <span className="font-bold text-slate-900">{createdCredentials.role}</span>
              </div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full gap-2 border-slate-300"
              onClick={handleCopy}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Credentials'}
            </Button>
            
            <Button 
              type="button" 
              className="w-full mt-2"
              onClick={() => handleOpenChange(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          // --- FORM VIEW ---
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Username <span className="text-red-500">*</span></Label>
              <Input 
                id="userName" 
                placeholder="e.g. gate_op_1" 
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="userRole">Role <span className="text-red-500">*</span></Label>
              <Select value={userRole} onValueChange={setUserRole} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select App Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GATE">Gate Operator (GATE)</SelectItem>
                  <SelectItem value="WB">Weighbridge Operator (WB)</SelectItem>
                  <SelectItem value="STORE">Store Operator (STORE)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceName">Assigned Source / Factory <span className="text-muted-foreground font-normal">(Optional)</span></Label>
              <Input 
                id="sourceName" 
                placeholder="e.g. Kamrup Cement Plant" 
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Useful if this operator is restricted to a specific origin plant.
              </p>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}