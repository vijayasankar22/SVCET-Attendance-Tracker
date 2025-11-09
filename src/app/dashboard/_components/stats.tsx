
"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Building, CalendarIcon as CalendarIconStat } from "lucide-react";
import type { AttendanceRecord } from "@/lib/types";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type StatsProps = {
  records: AttendanceRecord[];
};

export function Stats({ records }: StatsProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [flippedDepartments, setFlippedDepartments] = useState<Record<string, boolean>>({});

  const handleFlip = (deptName: string) => {
    setFlippedDepartments(prev => ({ ...prev, [deptName]: !prev[deptName] }));
  };
  
  const dailyStats = useMemo(() => {
    
    const filtered = records.filter(record => {
      if (!selectedDate) {
        return false;
      }
      try {
        const recordDate = new Date(record.timestamp);
        return isSameDay(recordDate, selectedDate);
      } catch (e) {
          console.error("Error filtering stats by date:", e);
          return true;
      }
    });

    const uniqueStudentRecords: AttendanceRecord[] = [];
    const uniqueStudentIds = new Set<string>();

    for (const record of filtered) {
        const studentIdentifier = record.studentId || record.studentName;
        if (!uniqueStudentIds.has(studentIdentifier)) {
            uniqueStudentIds.add(studentIdentifier);
            uniqueStudentRecords.push(record);
        }
    }
    
    const boysCount = uniqueStudentRecords.filter(r => r.gender === 'MALE').length;
    const girlsCount = uniqueStudentRecords.filter(r => r.gender === 'FEMALE').length;

    const departmentCounts = filtered.reduce((acc, record) => {
        const deptName = record.departmentName;
        if (!acc[deptName]) {
            acc[deptName] = { total: 0, boys: 0, girls: 0 };
        }
        acc[deptName].total += 1;
        if (record.gender === 'MALE') {
            acc[deptName].boys += 1;
        } else if (record.gender === 'FEMALE') {
            acc[deptName].girls += 1;
        }
        return acc;
    }, {} as {[key: string]: { total: number, boys: number, girls: number }});


    return {
      lateCount: uniqueStudentRecords.length,
      boysCount,
      girlsCount,
      totalRecords: filtered.length,
      departmentCounts: Object.entries(departmentCounts).sort((a,b) => b[1].total - a[1].total),
    };
  }, [records, selectedDate]);


  return (
    <div className="space-y-4">
        <div className="flex items-center justify-end">
             <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-[300px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIconStat className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      format(selectedDate, "LLL dd, y")
                    ) : (
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Students Late</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-bold">{dailyStats.lateCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Across all departments for the selected date
                    </p>
                </CardContent>
            </Card>
            
            <Card className="col-span-1 lg:col-span-2">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Department Breakdown
                    </CardTitle>
                     <CardDescription className="flex items-center text-xs">
                        <Building className="h-4 w-4 mr-1 text-muted-foreground" />
                        Repeated entries are included
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="text-4xl font-bold">{dailyStats.totalRecords}</div>
                   <p className="text-xs text-muted-foreground">
                        Total number of times students have been marked late.
                    </p>
                    {dailyStats.departmentCounts.length > 0 ? (
                        <div className="mt-4 border-t pt-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
                          {dailyStats.departmentCounts.map(([dept, counts]) => (
                            <div key={dept} className="flip-card cursor-pointer" onClick={() => handleFlip(dept)}>
                                <motion.div 
                                    className="flip-card-inner relative w-full h-full"
                                    initial={false}
                                    animate={{ rotateY: flippedDepartments[dept] ? 180 : 0 }}
                                    transition={{ duration: 0.6, animationDirection: "normal" }}
                                >
                                    {/* Front of the card */}
                                    <div className="flip-card-front absolute w-full h-full">
                                        <Card className="w-full h-full flex flex-col justify-center items-center border-none bg-secondary/50">
                                            <CardHeader className="p-2">
                                                <CardTitle className="text-sm font-semibold text-primary truncate">{dept}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-2 flex-grow flex flex-col justify-center items-center">
                                                <p className="text-4xl font-bold text-primary">{counts.total}</p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Back of the card */}
                                    <div className="flip-card-back absolute w-full h-full">
                                        <Card className="w-full h-full flex flex-col justify-center items-center bg-primary text-primary-foreground border-none">
                                             <CardHeader className="p-2 flex-row items-center justify-between w-full">
                                                <CardTitle className="text-sm font-semibold truncate">{dept}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-2 flex-grow grid grid-cols-2 gap-2 w-full">
                                                <div className="text-center bg-primary-foreground/10 p-2 rounded-lg flex flex-col justify-center">
                                                    <p className="font-bold text-2xl">{counts.boys}</p>
                                                    <p className="text-xs">Boys</p>
                                                </div>
                                                <div className="text-center bg-primary-foreground/10 p-2 rounded-lg flex flex-col justify-center">
                                                    <p className="font-bold text-2xl">{counts.girls}</p>
                                                    <p className="text-xs">Girls</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </motion.div>
                            </div>
                          ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground mt-4 pt-4 border-t">No entries for selected date.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
