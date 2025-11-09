
'use client';

import { useMemo } from 'react';
import type { AttendanceSubmission, Class, Department, WorkingDay } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, isSunday } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CalendarCheck } from 'lucide-react';

type AttendanceStatusProps = {
  submissions: AttendanceSubmission[];
  classes: Class[];
  departments: Department[];
  workingDays: WorkingDay[];
};

export function AttendanceStatus({ submissions, classes, departments, workingDays }: AttendanceStatusProps) {
  
  const isTodayWorkingDay = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    if (isSunday(new Date())) return false;
    const todaySetting = workingDays.find(d => d.id === todayKey);
    return todaySetting?.isWorkingDay ?? false;
  }, [workingDays]);

  const statusData = useMemo(() => {
    const todayDateString = format(new Date(), 'yyyy-MM-dd');
    const submittedClassIds = new Set(
        submissions
            .filter(sub => sub.date === todayDateString)
            .map(sub => sub.classId)
    );
    
    const departmentsWithStatus = departments.map(dept => {
        const classesInDept = classes
            .filter(c => c.departmentId === dept.id)
            .map(c => ({
                id: c.id,
                name: c.name,
                status: submittedClassIds.has(c.id) ? 'Submitted' : 'Pending',
            }))
            .sort((a,b) => a.name.localeCompare(b.name));
            
        return {
            ...dept,
            classes: classesInDept,
        };
    }).filter(d => d.classes.length > 0)
      .sort((a,b) => a.name.localeCompare(b.name));

    return departmentsWithStatus;

  }, [submissions, classes, departments]);

  if (!isTodayWorkingDay) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Attendance Submission Status</CardTitle>
                <CardDescription>An overview of which classes have submitted attendance today.</CardDescription>
            </CardHeader>
            <CardContent>
                <Alert>
                  <CalendarCheck className="h-4 w-4" />
                  <AlertTitle>It's a Holiday!</AlertTitle>
                  <AlertDescription>
                    No attendance submission is required today as it is marked as a holiday.
                  </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Submission Status</CardTitle>
        <CardDescription>An overview of which classes have submitted attendance today.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-96 overflow-y-auto">
            <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {statusData.map(dept => (
                    dept.classes.map((cls, index) => (
                         <TableRow key={cls.id}>
                            {index === 0 && (
                                <TableCell rowSpan={dept.classes.length} className="font-medium align-top">
                                    {dept.name}
                                </TableCell>
                            )}
                            <TableCell>{cls.name}</TableCell>
                            <TableCell className="text-right">
                                <Badge variant={cls.status === 'Submitted' ? 'default' : 'destructive'} className={cls.status === 'Submitted' ? 'bg-green-600' : ''}>
                                    {cls.status}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))
                ))}
                </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}
