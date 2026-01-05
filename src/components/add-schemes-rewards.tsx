// src/components/add-schemes-rewards.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Gift, ScrollText } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface AddSchemesRewardsProps {
  onSuccess: () => void;
}

export function AddSchemesRewards({ onSuccess }: AddSchemesRewardsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('scheme');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [schemeForm, setSchemeForm] = useState({ name: '', description: '', startDate: '', endDate: '' });
  const [rewardForm, setRewardForm] = useState({
    name: '',
    pointCost: 0,
    stock: 0,
    categoryId: '',
    isActive: true,
    schemeIds: [] as string[]
  });

  // Options Data
  const [schemes, setSchemes] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  const fetchOptions = useCallback(async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        fetch('/api/dashboardPagesAPI/masonpc-side/schemes-offers'),
        fetch('/api/dashboardPagesAPI/masonpc-side/reward-categories')
      ]);
      if (sRes.ok) setSchemes(await sRes.json());
      if (cRes.ok) setCategories(await cRes.json());
    } catch (e) {
      console.error("Failed to load options", e);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchOptions();
  }, [isOpen, fetchOptions]);

  const handleCreateScheme = async () => {
    if (!schemeForm.name) return toast.error("Scheme name is required");
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/dashboardPagesAPI/masonpc-side/schemes-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schemeForm)
      });
      if (!res.ok) throw new Error("Failed to create scheme");
      toast.success("Scheme created successfully");
      setSchemeForm({ name: '', description: '', startDate: '', endDate: '' });
      onSuccess();
      setIsOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateReward = async () => {
    if (!rewardForm.name || rewardForm.pointCost <= 0) return toast.error("Please fill mandatory reward fields");
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/dashboardPagesAPI/masonpc-side/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rewardForm,
          categoryId: rewardForm.categoryId ? Number(rewardForm.categoryId) : null
        })
      });
      if (!res.ok) throw new Error("Failed to create reward");
      toast.success("Reward added to inventory");
      setRewardForm({ name: '', pointCost: 0, stock: 0, categoryId: '', isActive: true, schemeIds: [] });
      onSuccess();
      setIsOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Create New...
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Management Console</DialogTitle>
          <DialogDescription>
            Add a new marketing scheme or register a new reward item in the inventory.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="scheme" className="flex items-center">
              <ScrollText className="w-4 h-4 mr-2" /> Scheme
            </TabsTrigger>
            <TabsTrigger value="reward" className="flex items-center">
              <Gift className="w-4 h-4 mr-2" /> Reward
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheme" className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Scheme Name</Label>
              <Input 
                placeholder="e.g., Monsoon Dhamaka 2024" 
                value={schemeForm.name} 
                onChange={e => setSchemeForm(p => ({ ...p, name: e.target.value }))} 
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea 
                placeholder="Details about points slabs or eligibility..." 
                value={schemeForm.description} 
                onChange={e => setSchemeForm(p => ({ ...p, description: e.target.value }))} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input type="date" value={schemeForm.startDate} onChange={e => setSchemeForm(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input type="date" value={schemeForm.endDate} onChange={e => setSchemeForm(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button onClick={handleCreateScheme} disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Plus className="w-4 h-4 mr-2" />}
                Register Scheme
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="reward" className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid gap-2">
              <Label>Item Name</Label>
              <Input 
                placeholder="e.g., Samsung Galaxy M14" 
                value={rewardForm.name} 
                onChange={e => setRewardForm(p => ({ ...p, name: e.target.value }))} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Point Cost</Label>
                <Input type="number" value={rewardForm.pointCost} onChange={e => setRewardForm(p => ({ ...p, pointCost: Number(e.target.value) }))} />
              </div>
              <div className="grid gap-2">
                <Label>Initial Stock</Label>
                <Input type="number" value={rewardForm.stock} onChange={e => setRewardForm(p => ({ ...p, stock: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={rewardForm.categoryId} onValueChange={v => setRewardForm(p => ({ ...p, categoryId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Reward Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 border p-3 rounded-md bg-muted/30">
              <Label className="mb-2 text-xs font-bold uppercase text-muted-foreground">Link to Active Schemes</Label>
              <div className="grid grid-cols-1 gap-2">
                {schemes.map(s => (
                  <div key={s.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`link-${s.id}`} 
                      checked={rewardForm.schemeIds.includes(s.id)} 
                      onCheckedChange={checked => {
                        setRewardForm(p => ({
                          ...p,
                          schemeIds: checked ? [...p.schemeIds, s.id] : p.schemeIds.filter(id => id !== s.id)
                        }));
                      }}
                    />
                    <Label htmlFor={`link-${s.id}`} className="text-sm font-normal cursor-pointer truncate">{s.name}</Label>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button onClick={handleCreateReward} disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Gift className="w-4 h-4 mr-2" />}
                Add to Inventory
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}