
'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AttendanceRecord, Department, Student, WorkingDay } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, BarChart2 } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type ChartProps = {
  records: AttendanceRecord[];
  students: Student[];
  departments: Department[];
  workingDays: WorkingDay[];
};

type LegendPayload = {
    dataKey: string;
    color: string;
};

const CustomLegend = (props: any) => {
    const { payload, onLegendClick, visibility } = props;

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
                        !visibility[entry.dataKey] && "opacity-50"
                    )}
                >
                    <div className="w-3 h-3" style={{ backgroundColor: entry.color }} />
                    {entry.dataKey}
                </Button>
            ))}
        </div>
    );
};


export function DepartmentWiseChart({ records, students, departments, workingDays }: ChartProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [visibility, setVisibility] = useState({
    Present: true,
    Absent: true,
  });

  const handleLegendClick = (dataKey: string) => {
    setVisibility(prev => ({ ...prev, [dataKey]: !prev[dataKey as keyof typeof visibility] }));
  };


  const workingDaysMap = useMemo(() => {
    const map = new Map<string, boolean>();
    workingDays.forEach(wd => {
        // The timestamp is already a Date object, so no need for .toDate()
        map.set(format(wd.timestamp, 'yyyy-MM-dd'), wd.isWorkingDay);
    });
    return map;
  }, [workingDays]);

  const isSelectedDateWorkingDay = useMemo(() => {
      if (!selectedDate) return false;
      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      return workingDaysMap.get(dateKey) ?? false;
  }, [selectedDate, workingDaysMap]);

  const chartData = useMemo(() => {
    if (!selectedDate) return [];

    // Filter records for the selected date
    const dailyRecords = records.filter(record => isSameDay(new Date(record.timestamp), selectedDate));
    const absentStudentIds = new Set(dailyRecords.map(r => r.studentId));

    return departments.map(dept => {
      const studentsInDept = students.filter(s => s.departmentId === dept.id);
      const totalStrength = studentsInDept.length;

      if (totalStrength === 0) {
        return {
          name: dept.name,
          Present: 0,
          Absent: 0,
          presentPercentage: 0,
          absentPercentage: 0,
          totalStrength: 0,
        };
      }

      const absentCount = studentsInDept.filter(s => absentStudentIds.has(s.id)).length;
      const presentCount = totalStrength - absentCount;

      return {
        name: dept.name,
        Present: presentCount,
        Absent: absentCount,
        presentPercentage: (presentCount / totalStrength) * 100,
        absentPercentage: (absentCount / totalStrength) * 100,
        totalStrength,
      };
    }).sort((a,b) => a.name.localeCompare(b.name));

  }, [records, selectedDate, students, departments]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col space-y-1">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                Department
              </span>
              <span className="font-bold text-muted-foreground">{label}</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                Total Strength
              </span>
              <span className="font-bold text-muted-foreground">{data.totalStrength}</span>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
             <div className="flex flex-col space-y-1">
              <span className="text-xs uppercase text-green-500">
                Present
              </span>
              <span className="font-bold">
                {`${data.Present} (${data.presentPercentage.toFixed(1)}%)`}
              </span>
            </div>
             <div className="flex flex-col space-y-1">
              <span className="text-xs uppercase text-red-500">
                Absent
              </span>
              <span className="font-bold">
                {`${data.Absent} (${data.absentPercentage.toFixed(1)}%)`}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <h3 className="text-lg font-medium">Department-wise Attendance</h3>
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full sm:w-[300px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "LLL dd, y") : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setIsDatePickerOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {isSelectedDateWorkingDay ? (
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
               <Legend 
                  content={<CustomLegend onLegendClick={handleLegendClick} visibility={visibility} />}
                  payload={[
                      { value: 'Present', type: 'square', id: 'ID01', dataKey: 'Present', color: 'hsl(var(--chart-2))' },
                      { value: 'Absent', type: 'square', id: 'ID02', dataKey: 'Absent', color: 'hsl(var(--destructive))' }
                  ]}
              />
              {visibility.Present && <Bar dataKey="Present" stackId="a" fill="hsl(var(--chart-2))" />}
              {visibility.Absent && <Bar dataKey="Absent" stackId="a" fill="hsl(var(--destructive))" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[400px] rounded-md border border-dashed">
            <Alert className="max-w-md text-center">
                <BarChart2 className="h-6 w-6 mx-auto mb-2" />
                <AlertTitle>It's a Holiday!</AlertTitle>
                <AlertDescription>
                    No attendance data is available for the selected day because it is marked as a holiday. Please select a working day to view the chart.
                </AlertDescription>
            </Alert>
        </div>
      )}
    </div>
  );
}
