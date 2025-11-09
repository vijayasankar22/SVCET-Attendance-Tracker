
'use client';

import { useMemo } from 'react';
import { eachDayOfInterval, startOfYear, endOfYear, format, getMonth, getDay, isSunday, getWeek, startOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import type { AttendanceRecord, Student, WorkingDay } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type GridProps = {
  student: Student;
  records: AttendanceRecord[];
  workingDays: WorkingDay[];
};

type ContentProps = GridProps & { isPdf?: boolean };

export function StudentAttendanceGridContent({ student, records, workingDays, isPdf = false }: ContentProps) {
  const today = new Date();
  
  const { days, months, monthlyAttendance, overallPercentage } = useMemo(() => {
    const yearStart = startOfYear(today);
    const yearEnd = endOfYear(today);

    const dayObjects = eachDayOfInterval({ start: yearStart, end: yearEnd });

    const attendanceMap = new Map<string, { status: 'absent' | 'late' }>();
    records.forEach(record => {
      const dateKey = format(new Date(record.timestamp), 'yyyy-MM-dd');
      attendanceMap.set(dateKey, { status: 'late' });
    });
    
    const workingDaysMap = new Map<string, boolean>();
    workingDays.forEach(wd => {
        workingDaysMap.set(format(wd.timestamp, 'yyyy-MM-dd'), wd.isWorkingDay);
    });

    const days = dayObjects.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const record = attendanceMap.get(dateKey);
      const isFuture = day > today;
      const dayIsSunday = isSunday(day);
      const isWorkingDay = workingDaysMap.get(dateKey) ?? false; // Default to holiday

      let dayStatus = 'present';
      if (isFuture) {
          dayStatus = 'default';
      } else if (dayIsSunday || !isWorkingDay) {
          dayStatus = 'holiday';
      } else if (record) {
          dayStatus = record.status;
      }

      return {
        date: dateKey,
        status: dayStatus,
        dayOfWeek: getDay(day),
        month: getMonth(day),
      };
    });

    const monthLabels = Array.from({ length: 12 }, (_, i) => ({
      name: format(new Date(today.getFullYear(), i, 1), 'MMM'),
      startWeek: getWeek(startOfMonth(new Date(today.getFullYear(), i, 1))),
    }));


    const monthlyStats = Array.from({ length: 12 }).map(() => ({ present: 0, total: 0 }));
    let totalPresentDays = 0;
    let totalWorkingDays = 0;
    
    const yearDays = eachDayOfInterval({ start: startOfYear(today), end: endOfYear(today) });
    
    yearDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const record = attendanceMap.get(dateKey);
        const dayIsSunday = isSunday(day);
        const isWorkingDay = workingDaysMap.get(dateKey) ?? false; // Default to holiday

      if (day <= today && !dayIsSunday && isWorkingDay) {
        monthlyStats[getMonth(day)].total++;
        totalWorkingDays++;
        if (!record) {
          monthlyStats[getMonth(day)].present++;
          totalPresentDays++;
        }
      }
    });

    const overallPercentage = totalWorkingDays > 0 ? (totalPresentDays / totalWorkingDays) * 100 : 0;

    const monthlyAttendance = monthLabels.map((month, i) => {
        const stats = monthlyStats[i];
        const percentage = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
        return {
            name: month.name,
            percentage: isNaN(percentage) ? 0 : percentage,
        };
    });


    return { days, months: monthLabels, monthlyAttendance, overallPercentage };
  }, [records, today, workingDays]);

  const getDayColor = (status: string) => {
    switch (status) {
      case 'late':
        return 'bg-red-500';
      case 'present':
        return 'bg-green-500';
      case 'holiday':
        return 'bg-blue-300 dark:bg-blue-800';
      default:
        return 'bg-gray-200 dark:bg-gray-700';
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const daySize = isPdf ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
  const dayGap = isPdf ? 'gap-0.5' : 'gap-1';
  const monthLeftCalc = isPdf ? '(10px + 2px)' : '(14px + 4px)';

  const GridDay = ({ day, index }: { day: (typeof days)[0], index: number }) => (
    <div
      className={cn(daySize, 'rounded-sm', getDayColor(day.status))}
    />
  );
  
  const AnimatedGridDay = ({ day, index }: { day: (typeof days)[0], index: number }) => (
     <motion.div
        className={cn(daySize, 'rounded-sm', getDayColor(day.status))}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.005, duration: 0.2 }}
    />
  );

  return (
    <Card className={cn(isPdf ? "bg-white" : "")}>
      <CardHeader>
        <div>
            <CardTitle>{student.name}'s Yearly Attendance</CardTitle>
            <CardDescription>
            Register No: {student.registerNo || 'N/A'}. 
            <span className="font-semibold text-primary ml-2">Overall Attendance: {overallPercentage.toFixed(1)}%</span>
            </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div id="student-report-content">
            <div className="flex justify-end items-center gap-4 text-xs mb-4">
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-green-500" />
                    <span>Present</span>
                </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-red-500" />
                    <span>Late/Absent</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-300 dark:bg-blue-800" />
                    <span>Holiday</span>
                </div>
            </div>
            
            <TooltipProvider>
                <div className="overflow-x-auto pb-4">
                    <div className="flex gap-1.5 text-xs text-muted-foreground">
                        <div className="flex flex-col gap-1 w-8 flex-shrink-0 pt-5">
                            {weekDays.map((day, i) => (
                                <div key={day} className={cn("flex items-center", isPdf ? 'h-3' : 'h-4')}>
                                    {i % 2 !== 0 && day.slice(0, 3)}
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col min-w-0">
                           <div className="relative h-5 mb-1.5">
                             {months.map((month) => (
                                <div 
                                    key={month.name} 
                                    className="absolute text-center text-xs" 
                                    style={{ left: `calc(${month.startWeek -1} * ${monthLeftCalc})` }}
                                >
                                    {month.name}
                                </div>
                            ))}
                           </div>
                            <div className={cn("grid grid-flow-col grid-rows-7", dayGap)}>
                                {days.map((day, index) => (
                                    <Tooltip key={day.date}>
                                        <TooltipTrigger asChild>
                                          {isPdf ? <GridDay day={day} index={index} /> : <AnimatedGridDay day={day} index={index} />}
                                        </TooltipTrigger>
                                        <TooltipContent>
                                        <p>{format(new Date(day.date), 'PPP')} - <span className="capitalize">{day.status}</span></p>
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </TooltipProvider>

            <div className="mt-8">
                <h4 className="font-medium text-lg mb-4">Monthly Attendance Percentage</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                    {monthlyAttendance.map(month => (
                        <div key={month.name}>
                            <div className="flex justify-between items-baseline mb-1">
                                <span className="font-medium">{month.name}</span>
                                <span className="text-muted-foreground font-semibold">{month.percentage.toFixed(0)}%</span>
                            </div>
                            <Progress value={month.percentage} className="h-2"/>
                        </div>
                    ))}
                </div>
            </div>
         </div>
      </CardContent>
    </Card>
  );
}

export function StudentAttendanceGrid(props: GridProps) {
    return <StudentAttendanceGridContent {...props} />;
}
