
"use client";

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Header } from '@/components/header';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BarChart3, UserSearch, Home, Users, KeyRound, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { staff, isUserLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isUserLoading && !staff) {
      router.push('/login');
    }
  }, [staff, isUserLoading, router]);

  if (isUserLoading || !staff) {
    return (
        <div className="flex min-h-screen w-full flex-col">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-primary px-4 text-primary-foreground shadow-md sm:px-6">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-6 w-48" />
                <div className="ml-auto flex items-center gap-2">
                    <Skeleton className="h-8 w-24" />
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 md:p-8">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-1/2" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </main>
      </div>
    );
  }
  
  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Home', roles: ['admin', 'teacher', 'viewer', 'dean'] },
    { href: '/dashboard/student-report', icon: UserSearch, label: 'Student', roles: ['admin', 'teacher', 'viewer', 'dean'] },
    { href: '/dashboard/fees', icon: DollarSign, label: 'Fees', roles: ['admin', 'teacher'] },
    { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', roles: ['admin', 'teacher', 'viewer', 'dean'] },
    { href: '/dashboard/staff', icon: Users, label: 'Staff', roles: ['admin'] },
    { href: '/dashboard/working-days', icon: KeyRound, label: 'Days', roles: ['admin'] },
  ].filter(item => staff && item.roles.includes(staff.role));

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8 pb-20 md:pb-8">
        {children}
      </main>
      {/* Bottom Nav for Mobile */}
       <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-40 grid items-center border-t border-primary-foreground/10 bg-primary p-1 text-primary-foreground md:hidden",
        `grid-cols-${navItems.length}`
      )}>
        {navItems.map(item => (
            <Button 
                key={item.href}
                variant="ghost" 
                className={cn(
                    "flex h-auto w-full flex-col p-1 hover:bg-primary-foreground/10",
                    pathname === item.href && "bg-primary-foreground/10"
                )} 
                onClick={() => router.push(item.href)}
            >
                <item.icon className="h-5 w-5" />
                <span className="mt-1 text-xs">{item.label}</span>
            </Button>
        ))}
      </nav>
    </div>
  );
}
