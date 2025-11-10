'use client';

import { useMemo } from 'react';
import type { Student, Fee, Class, Department } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, HandCoins, Hourglass } from 'lucide-react';

type FeeAnalyticsProps = {
  students: Student[];
  fees: Fee[];
  classes: Class[];
  departments: Department[];
};

export function FeeAnalytics({ students, fees, classes, departments }: FeeAnalyticsProps) {

  const analyticsData = useMemo(() => {
    return departments.map(dept => {
      const classesInDept = classes.filter(c => c.departmentId === dept.id);
      const studentIdsInDept = students.filter(s => s.departmentId === dept.id).map(s => s.id);
      const feesForDept = fees.filter(f => studentIdsInDept.includes(f.studentId));

      const totalFee = feesForDept.reduce((sum, f) => sum + f.totalAmount, 0);
      const collectedFee = feesForDept.reduce((sum, f) => sum + f.totalPaid, 0);
      const balance = totalFee - collectedFee;
      
      const classData = classesInDept.map(cls => {
        const studentsInClass = students.filter(s => s.classId === cls.id);
        const studentIdsInClass = studentsInClass.map(s => s.id);
        const feesForClass = fees.filter(f => studentIdsInClass.includes(f.studentId));

        const classTotalFee = feesForClass.reduce((sum, f) => sum + f.totalAmount, 0);
        const classCollectedFee = feesForClass.reduce((sum, f) => sum + f.totalPaid, 0);
        const classBalance = classTotalFee - classCollectedFee;
        
        return {
          classId: cls.id,
          className: cls.name,
          totalStudents: studentsInClass.length,
          totalFee: classTotalFee,
          collectedFee: classCollectedFee,
          balance: classBalance,
        };
      }).filter(c => c.totalStudents > 0);

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        totalFee,
        collectedFee,
        balance,
        classes: classData,
      };
    }).filter(d => d.classes.length > 0);
  }, [students, fees, classes, departments]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Collection Analytics</CardTitle>
        <CardDescription>A department-wise breakdown of fee collections. (Admin View)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
          {analyticsData.map(deptData => (
            <div key={deptData.departmentId} className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold text-lg">{deptData.departmentName} Department</h3>
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Fee</CardTitle>
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₹{deptData.totalFee.toLocaleString('en-IN')}</div>
                    </CardContent>
                  </Card>
                   <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Collected</CardTitle>
                      <HandCoins className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">₹{deptData.collectedFee.toLocaleString('en-IN')}</div>
                    </CardContent>
                  </Card>
                   <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Balance</CardTitle>
                      <Hourglass className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">₹{deptData.balance.toLocaleString('en-IN')}</div>
                    </CardContent>
                  </Card>
              </div>
            </div>
          ))}
          {analyticsData.length === 0 && (
            <div className="text-center text-muted-foreground p-8">No fee data available to display.</div>
          )}
      </CardContent>
    </Card>
  );
}
