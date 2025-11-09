
'use client';

import { useMemo, useState } from 'react';
import type { AttendanceRecord, Class, Department, Student, WorkingDay } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isSameDay, isSunday } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Users, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

type AbsenteeSummaryProps = {
  records: AttendanceRecord[];
  classes: Class[];
  departments: Department[];
  students: Student[];
  workingDays: WorkingDay[];
};

type SelectedClassInfo = {
  className: string;
  departmentName: string;
  absentBoys: number;
  absentGirls: number;
  absentees: AttendanceRecord[];
} | null;

export function AbsenteeSummary({ records, classes, departments, students, workingDays }: AbsenteeSummaryProps) {
  const [selectedClass, setSelectedClass] = useState<SelectedClassInfo>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const workingDaysMap = useMemo(() => {
    const map = new Map<string, boolean>();
    workingDays.forEach(wd => {
        map.set(format(wd.timestamp, 'yyyy-MM-dd'), wd.isWorkingDay);
    });
    return map;
  }, [workingDays]);

  const dailyRecords = useMemo(() => {
    if (!date) return [];

    const dateKey = format(date, 'yyyy-MM-dd');
    if (isSunday(date) || !workingDaysMap.get(dateKey)) {
        return [];
    }
    
    return records.filter(record => isSameDay(new Date(record.timestamp), date));
  }, [records, date, workingDaysMap]);


  const summaryData = useMemo(() => {
    const summary = classes.map(cls => {
      const department = departments.find(d => d.id === cls.departmentId);
      
      const absentRecords = dailyRecords.filter(r => r.className === cls.name && r.departmentName === department?.name);
      
      const absentStudentIds = new Set(absentRecords.map(r => r.studentId));
      const absentCount = absentStudentIds.size;
      
      const totalStudentsInClass = students.filter(s => s.classId === cls.id).length;
      const presentCount = totalStudentsInClass - absentCount;
      const presentPercentage = totalStudentsInClass > 0 ? (presentCount / totalStudentsInClass) * 100 : 100;
      
      return {
        classId: cls.id,
        className: cls.name,
        departmentName: department?.name || 'N/A',
        absentCount: absentCount,
        presentPercentage: presentPercentage,
        totalStudents: totalStudentsInClass,
        absentRecords,
      };
    });

    return summary.sort((a, b) => {
        if (a.departmentName < b.departmentName) return -1;
        if (a.departmentName > b.departmentName) return 1;
        return a.className.localeCompare(b.className);
    });

  }, [dailyRecords, classes, departments, students]);

  const handleRowClick = (summaryItem: (typeof summaryData)[0]) => {
    const absentBoys = summaryItem.absentRecords.filter(r => r.gender === 'MALE').length;
    const absentGirls = summaryItem.absentRecords.filter(r => r.gender === 'FEMALE').length;
    
    setSelectedClass({
      className: summaryItem.className,
      departmentName: summaryItem.departmentName,
      absentBoys,
      absentGirls,
      absentees: summaryItem.absentRecords,
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
            <div>
              <CardTitle>Absentee Summary</CardTitle>
              <CardDescription>A summary of absent students by class. Click a row for details.</CardDescription>
            </div>
             <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="date"
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
          {summaryData.length > 0 ? (
            <div className="rounded-md border max-h-96 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-center">Absentee Count</TableHead>
                    <TableHead className="text-right">Present %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.map(item => (
                    <TableRow key={item.classId} onClick={() => handleRowClick(item)} className="cursor-pointer">
                      <TableCell>{item.departmentName}</TableCell>
                      <TableCell className="font-medium">{item.className}</TableCell>
                      <TableCell className="text-center">
                          <span className={`font-bold ${item.absentCount > 0 ? 'text-destructive' : 'text-primary'}`}>{item.absentCount}</span>
                          <span className="text-xs text-muted-foreground"> / {item.totalStudents}</span>
                      </TableCell>
                      <TableCell className="text-right">
                         <div className="flex items-center gap-2 justify-end">
                              <span className="font-semibold text-sm min-w-[40px]">{item.presentPercentage.toFixed(1)}%</span>
                              <Progress value={item.presentPercentage} className="w-24 h-2" />
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              <p>No classes found or it's a holiday. Please seed the database or select a working day.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {selectedClass && (
        <Dialog open={!!selectedClass} onOpenChange={(isOpen) => !isOpen && setSelectedClass(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-6 w-6" /> 
                Absentees for {selectedClass.className} ({selectedClass.departmentName})
              </DialogTitle>
              <DialogDescription>
                Detailed breakdown of students absent on {date ? format(date, 'PPP') : 'the selected date'}.
              </DialogDescription>
            </DialogHeader>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Boys Absent</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{selectedClass.absentBoys}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Girls Absent</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{selectedClass.absentGirls}</div>
                    </CardContent>
                </Card>
            </div>

            <h3 className="font-medium text-lg mb-2">Absentees List</h3>
             {selectedClass.absentees.length > 0 ? (
                <div className="max-h-[40vh] overflow-y-auto border rounded-md">
                  <Table>
                      <TableHeader>
                        <TableRow>
                            <TableHead>Register No.</TableHead>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Gender</TableHead>
                            <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                      {selectedClass.absentees.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.registerNo || 'N/A'}</TableCell>
                            <TableCell className="font-medium">{entry.studentName}</TableCell>
                            <TableCell>{entry.gender}</TableCell>
                            <TableCell>{entry.time}</TableCell>
                          </TableRow>
                      ))}
                      </TableBody>
                  </Table>
                </div>
            ) : (
                <div className="text-center p-8 text-muted-foreground">
                    <p>No absentees found for this class on the selected day.</p>
                </div>
             )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
