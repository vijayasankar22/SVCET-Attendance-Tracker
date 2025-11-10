
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3, UserSearch, Home, LogOut, KeyRound, Users, LockKeyhole, DollarSign } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';


function ChangePasswordDialog({ staffId, open, onOpenChange }: { staffId: string, open: boolean, onOpenChange: (open: boolean) => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      const staffDocRef = doc(firestore, 'staff', staffId);
      await updateDoc(staffDocRef, {
        password: newPassword,
      });
      toast({
        title: 'Success',
        description: 'Your password has been changed successfully.',
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating password:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update password. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Enter a new password for your account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export function Header() {
  const router = useRouter();
  const { staff, logout, isUserLoading } = useAuth();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };
  
  const isAdmin = !isUserLoading && staff?.role === 'admin';
  
  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Home', roles: ['admin', 'teacher', 'viewer', 'dean'] },
    { href: '/dashboard/student-report', icon: UserSearch, label: 'Student', roles: ['admin', 'teacher', 'viewer', 'dean'] },
    { href: '/dashboard/fees', icon: DollarSign, label: 'Fees', roles: ['admin', 'teacher'] },
    { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', roles: ['admin', 'teacher', 'viewer', 'dean'] },
    { href: '/dashboard/staff', icon: Users, label: 'Staff', roles: ['admin'] },
    { href: '/dashboard/working-days', icon: KeyRound, label: 'Days', roles: ['admin'] },
  ].filter(item => staff && item.roles.includes(staff.role));


  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-primary px-4 text-primary-foreground shadow-md sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/svcet-logo.png" alt="Logo" width={40} height={40} />
          <h1 className="text-xl font-bold font-headline tracking-tight">
              SVCET Attendance Tracker
          </h1>
        </Link>
        
        <nav className="hidden md:flex items-center gap-2 ml-auto">
            {navItems.map(item => (
                 <Button key={item.href} variant="ghost" className="hover:bg-primary-foreground/10" onClick={() => router.push(item.href)}>
                      <item.icon className="h-4 w-4 mr-2" />
                      <span>{item.label}</span>
                  </Button>
            ))}
        </nav>
        
         <div className="flex items-center gap-4 ml-auto md:ml-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10 border-2 border-primary-foreground/50">
                    <AvatarFallback className="text-black">{staff?.name ? getInitials(staff.name) : 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{staff?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{staff?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsPasswordDialogOpen(true)}>
                  <LockKeyhole className="mr-2 h-4 w-4" />
                  <span>Change Password</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </header>

      {staff && (
        <ChangePasswordDialog 
          staffId={staff.id}
          open={isPasswordDialogOpen}
          onOpenChange={setIsPasswordDialogOpen}
        />
      )}
    </>
  );
}
