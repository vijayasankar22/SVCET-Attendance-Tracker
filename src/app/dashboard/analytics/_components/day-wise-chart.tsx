
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AttendanceRecord, Class, Department, Staff, Student, WorkingDay } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format, isSameDay, eachDayOfInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, isSunday, startOfMonth, endOfMonth, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DateRange } from 'react-day-picker';

type ChartProps = {
  records: AttendanceRecord[];
  students: Student[];
  user: Staff | null;
  departments: Department[];
  classes: Class[];
  workingDays: WorkingDay[];
};

type LegendPayload = {
    dataKey: string;
    color: string;
};

const CustomLegend = (props: any) => {
    const { payload, onLegendClick } = props;

    return (
        <div className="flex items-center justify-center gap-4 text-sm">
            {payload.map((entry: LegendPayload, index: number) => (
                 <Button
                    key={`item-${index}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => onLegendClick(entry.dataKey)}
                    className={cn(
                        "flex items-center gap-2",
                        !props.visibility[entry.dataKey] && "opacity-50"
                    )}
                >
                    <div className="w-3 h-3" style={{ backgroundColor: entry.color }} />
                    {entry.dataKey}
                </Button>
            ))}
        </div>
    );
};

export function DayWiseChart({ records, students, user, departments, classes, workingDays }: ChartProps) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfWeek(new Date()),
    to: endOfWeek(new Date()),
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [visibility, setVisibility] = useState({
    Present: true,
    Absent: true,
    Holiday: true,
  });
  
  const isAdminOrViewer = user?.role === 'admin' || user?.role === 'viewer';

  const workingDaysMap = useMemo(() => {
    const map = new Map<string, boolean>();
    workingDays.forEach(wd => {
        map.set(format(wd.timestamp, 'yyyy-MM-dd'), wd.isWorkingDay);
    });
    return map;
  }, [workingDays]);

  const availableClasses = useMemo(() => {
    if (departmentFilter === 'all') {
      return classes;
    }
    return classes.filter(c => c.departmentId === departmentFilter);
  }, [departmentFilter, classes]);

  useEffect(() => {
    if (departmentFilter !== 'all' && !availableClasses.some(c => c.id === classFilter)) {
        setClassFilter('all');
    }
  }, [departmentFilter, availableClasses, classFilter]);
  
  const { chartData, totalStudents } = useMemo(() => {
    let relevantStudents = students;
    if (classFilter !== 'all') {
        relevantStudents = students.filter(s => s.classId === classFilter);
    } else if (departmentFilter !== 'all') {
        const classIdsInDept = classes.filter(c => c.departmentId === departmentFilter).map(c => c.id);
        relevantStudents = students.filter(s => classIdsInDept.includes(s.classId));
    }

    if (!date?.from) {
        return { chartData: [], totalStudents: relevantStudents.length };
    }

    const start = startOfDay(date.from);
    const end = endOfDay(date.to || date.from);
    const intervalDays = eachDayOfInterval({ start, end });

    const data = intervalDays.map(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const isWorking = (workingDaysMap.get(dateKey) ?? false) && !isSunday(day);

        if (!isWorking) {
          return {
            name: format(day, 'MMM dd'),
            Present: 0,
            Absent: 0,
            Holiday: relevantStudents.length, // Full bar for holiday
          };
        }

        const filteredRecords = records.filter(record => {
            const isDateMatch = isSameDay(new Date(record.timestamp), day);
            const isDeptMatch = departmentFilter === 'all' || record.departmentName === departments.find(d => d.id === departmentFilter)?.name;
            const isClassMatch = classFilter === 'all' || record.className === classes.find(c => c.id === classFilter)?.name;

            return isDateMatch && isDeptMatch && isClassMatch;
        });

        const absentUniqueStudentIds = new Set<string>();
        filteredRecords.forEach(record => {
          if (record.studentId) absentUniqueStudentIds.add(record.studentId);
        });
        
        const absentCount = absentUniqueStudentIds.size;
        const presentCount = relevantStudents.length - absentCount;

        return {
            name: format(day, 'MMM dd'),
            Present: presentCount >= 0 ? presentCount : 0,
            Absent: absentCount,
            Holiday: 0,
        };
    });


    return { chartData: data, totalStudents: relevantStudents.length };

  }, [records, date, students, classFilter, departmentFilter, classes, departments, workingDaysMap]);

  const handleLegendClick = (dataKey: string) => {
    setVisibility(prev => ({ ...prev, [dataKey]: !prev[dataKey as keyof typeof visibility] }));
  };
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
       if (data.Holiday > 0 && visibility.Holiday) {
        return (
          <div className="rounded-lg border bg-background p-2 shadow-sm">
            <p className="font-medium">{label}</p>
            <p className="text-sm text-muted-foreground">Holiday</p>
          </div>
        );
      }
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <p className="font-medium">{label}</p>
          {visibility.Present && <p className="text-sm text-green-500">Present: {data.Present}</p>}
          {visibility.Absent && <p className="text-sm text-red-500">Absent: {data.Absent}</p>}
        </div>
      );
    }
    return null;
  };

  const xAxisInterval = chartData.length > 15 ? 3 : 0;

  return (
    <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <h3 className="text-lg font-medium">Daily Attendance Summary</h3>
             <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {isAdminOrViewer && (
                  <>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map(dept => (
                                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={classFilter} onValueChange={setClassFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Class" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Classes</SelectItem>
                            {availableClasses.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </>
                )}
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                         id="date"
                        variant={"outline"}
                        className={cn(
                          "w-full sm:w-[300px] justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                            <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                            </>
                            ) : (
                            format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                       <div className="flex flex-col sm:flex-row">
                          <div className="p-2 border-b sm:border-r sm:border-b-0">
                            <div className="grid grid-cols-1 gap-2">
                                <Button
                                    variant="ghost"
                                    className="justify-start"
                                    onClick={() => {
                                        const today = new Date();
                                        setDate({ from: startOfWeek(today), to: endOfWeek(today) });
                                        setIsDatePickerOpen(false);
                                    }}
                                >
                                    This Week
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="justify-start"
                                    onClick={() => {
                                        const today = new Date();
                                        setDate({ from: startOfMonth(today), to: endOfMonth(today) });
                                        setIsDatePickerOpen(false);
                                    }}
                                >
                                    This Month
                                </Button>
                                 <Button
                                    variant="ghost"
                                    className="justify-start"
                                    onClick={() => {
                                        const lastWeekStart = startOfWeek(subWeeks(new Date(), 1));
                                        const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1));
                                        setDate({ from: lastWeekStart, to: lastWeekEnd });
                                        setIsDatePickerOpen(false);
                                    }}
                                >
                                    Last Week
                                </Button>
                            </div>
                          </div>
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={(range) => {
                                setDate(range)
                                // Automatically close if a full range is selected
                                if (range?.from && range?.to) {
                                    setIsDatePickerOpen(false)
                                }
                            }}
                            numberOfMonths={1}
                          />
                       </div>
                    </PopoverContent>
                  </Popover>
             </div>
        </div>
        
        <div className="h-[400px] w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={60} 
                      interval={xAxisInterval}
                    />
                    <YAxis allowDecimals={false} domain={[0, totalStudents]} />
                    <Tooltip
                        content={<CustomTooltip />}
                    />
                    <Legend 
                        content={<CustomLegend onLegendClick={handleLegendClick} visibility={visibility} />}
                        payload={[
                            { value: 'Present', type: 'square', id: 'ID01', dataKey: 'Present', color: 'hsl(var(--chart-2))' },
                            { value: 'Absent', type: 'square', id: 'ID02', dataKey: 'Absent', color: 'hsl(var(--destructive))' },
                            { value: 'Holiday', type: 'square', id: 'ID03', dataKey: 'Holiday', color: 'hsl(var(--secondary))' }
                        ]}
                    />
                    {visibility.Present && <Bar 
                      dataKey="Present" 
                      stackId="a" 
                      fill="hsl(var(--chart-2))" 
                    />}
                     {visibility.Absent && <Bar 
                      dataKey="Absent" 
                      stackId="a" 
                      fill="hsl(var(--destructive))" 
                    />}
                     {visibility.Holiday && <Bar 
                      dataKey="Holiday" 
                      stackId="a" 
                      fill="hsl(var(--secondary))" 
                    />}
                </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
}
