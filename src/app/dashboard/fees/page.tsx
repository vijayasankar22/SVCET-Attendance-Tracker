
'use client';

import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { FeesManager } from './_components/fees-manager';

export default function FeesPage() {
  const { staff, isUserLoading } = useAuth();

  if (isUserLoading || !staff) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return <FeesManager staff={staff} />;
}

    