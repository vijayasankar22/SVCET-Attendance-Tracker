
'use client';

import { useMemo } from 'react';
import type { Fee } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

type FeesAnalyticsProps = {
  fees: Fee[];
};

export function FeesAnalytics({ fees }: FeesAnalyticsProps) {
  const stats = useMemo(() => {
    let totalAmount = 0;
    let totalPaid = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let partialCount = 0;

    fees.forEach(fee => {
      totalAmount += fee.amount;
      if (fee.status === 'Paid') {
        totalPaid += fee.amount;
        paidCount++;
      } else if (fee.status === 'Unpaid') {
        unpaidCount++;
      } else if (fee.status === 'Partial') {
        partialCount++; // Assuming partial payments are tracked elsewhere for total paid
      }
    });

    const totalOutstanding = totalAmount - totalPaid;

    return {
      totalAmount,
      totalPaid,
      totalOutstanding,
      paidCount,
      unpaidCount,
      partialCount,
      totalRecords: fees.length,
    };
  }, [fees]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fees Collection Analytics</CardTitle>
        <CardDescription>An overview of the fee collection status.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.totalPaid.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">out of ₹{stats.totalAmount.toLocaleString()} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.totalOutstanding.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{stats.unpaidCount + stats.partialCount} students with dues</p>
            </CardContent>
          </Card>
          <div className="grid grid-cols-3 gap-2 col-span-full lg:col-span-1">
             <Card className="flex flex-col items-center justify-center text-center">
                <CardHeader className="p-2 pb-0"><CheckCircle2 className="h-5 w-5 text-green-500" /></CardHeader>
                <CardContent className="p-2">
                    <div className="text-lg font-bold">{stats.paidCount}</div>
                    <p className="text-xs text-muted-foreground">Paid</p>
                </CardContent>
             </Card>
             <Card className="flex flex-col items-center justify-center text-center">
                <CardHeader className="p-2 pb-0"><Clock className="h-5 w-5 text-yellow-500" /></CardHeader>
                <CardContent className="p-2">
                    <div className="text-lg font-bold">{stats.partialCount}</div>
                    <p className="text-xs text-muted-foreground">Partial</p>
                </CardContent>
             </Card>
             <Card className="flex flex-col items-center justify-center text-center">
                <CardHeader className="p-2 pb-0"><AlertCircle className="h-5 w-5 text-red-500" /></CardHeader>
                <CardContent className="p-2">
                    <div className="text-lg font-bold">{stats.unpaidCount}</div>
                    <p className="text-xs text-muted-foreground">Unpaid</p>
                </CardContent>
             </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

    