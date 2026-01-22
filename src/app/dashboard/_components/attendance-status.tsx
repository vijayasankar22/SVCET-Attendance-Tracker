'use client';

import { useMemo, useState } from 'react';
import type { AttendanceSubmission, Class, Department, WorkingDay } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, isSunday } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CalendarCheck, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';


type AttendanceStatusProps = {
  submissions: AttendanceSubmission[];
  classes: Class[];
  departments: Department[];
  workingDays: WorkingDay[];
};

export function AttendanceStatus({ submissions, classes, departments, workingDays }: AttendanceStatusProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const isSelectedDateWorkingDay = useMemo(() => {
    if (!date) return false;
    const dateKey = format(date, 'yyyy-MM-dd');
    if (isSunday(date)) return false;
    const daySetting = workingDays.find(d => d.id === dateKey);
    return daySetting?.isWorkingDay ?? false;
  }, [date, workingDays]);

  const statusData = useMemo(() => {
    if (!date) return [];
    
    const selectedDateString = format(date, 'yyyy-MM-dd');
    const submittedClassIds = new Set(
        submissions
            .filter(sub => sub.date === selectedDateString)
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

  }, [submissions, classes, departments, date]);
  
  const cardDescription = date ? `An overview of which classes submitted attendance on ${format(date, 'PPP')}.` : 'Select a date to see attendance submission status.';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
            <div>
              <CardTitle>Attendance Submission Status</CardTitle>
              <CardDescription>{cardDescription}</CardDescription>
            </div>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full md:w-[240px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(day) => {
                      setDate(day);
                      setIsDatePickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
      </CardHeader>
      <CardContent>
         {!isSelectedDateWorkingDay ? (
             <Alert>
                  <CalendarCheck className="h-4 w-4" />
                  <AlertTitle>It's a Holiday!</AlertTitle>
                  <AlertDescription>
                    No attendance submission is required as the selected date is marked as a holiday.
                  </AlertDescription>
             </Alert>
         ) : (
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
         )}
      </CardContent>
    </Card>
  );
}
