
'use client';

import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalyticsPageContent } from './_components/analytics-page-content';

export default function AnalyticsPage() {
  const { staff, isUserLoading } = useAuth();

  if (isUserLoading || !staff) {
    return (
        <div className="space-y-8">
            <Skeleton className="h-12 w-1/3" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Skeleton className="h-[450px] w-full" />
                <Skeleton className="h-[450px] w-full" />
            </div>
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
        </div>
    );
  }

  return <AnalyticsPageContent staff={staff} />;
}
