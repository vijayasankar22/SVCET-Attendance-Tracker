
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { AttendanceRecord, Class, Department, Student } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isSameDay, isToday } from 'date-fns';
import { Users, UserCheck, UserX, Calendar as CalendarIcon, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type StrengthSummaryProps = {
  records: AttendanceRecord[];
  students: Student[];
  classes: Class[];
  departments: Department[];
};

const getBatchFromClassName = (className: string): string | null => {
    if (className.startsWith('I-') || className === 'I' || /\bI\b/.test(className)) return 'I Year';
    if (className.startsWith('II-') || className === 'II' || /\bII\b/.test(className)) return 'II Year';
    if (className.startsWith('III-') || className === 'III' || /\bIII\b/.test(className)) return 'III Year';
    if (className.startsWith('IV-') || className === 'IV' || /\bIV\b/.test(className)) return 'IV Year';
    return null;
}

type SelectedItemInfo = {
  type: 'department' | 'class' | 'batch';
  name: string;
  absentees: Student[];
} | null;


export function StrengthSummary({ records, students, classes, departments }: StrengthSummaryProps) {
  const [isTotalPresentFlipped, setIsTotalPresentFlipped] = useState(false);
  const [isTotalAbsentFlipped, setIsTotalAbsentFlipped] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SelectedItemInfo>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    fetch('/svcet-head.png')
      .then(response => response.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      }).catch(error => {
        console.error("Error fetching or converting logo:", error);
      });
  }, []);

  const dailyRecords = useMemo(() => {
    if (!selectedDate) return [];
    return records.filter(record => isSameDay(new Date(record.timestamp), selectedDate))
  }, [records, selectedDate]);

  const absentStudentIdsOnSelectedDate = useMemo(() => {
    const uniqueAbsentees = new Set<string>();
    dailyRecords.forEach(r => {
        if(r.studentId !== 'placeholder_all_present') {
            uniqueAbsentees.add(r.studentId);
        }
    });
    return uniqueAbsentees;
  }, [dailyRecords]);

  const { totalStudents, totalPresent, totalAbsent, presentBoys, presentGirls, absentBoys, absentGirls } = useMemo(() => {
    const totalStudents = students.length;
    const totalAbsent = absentStudentIdsOnSelectedDate.size;
    const totalPresent = totalStudents - totalAbsent;

    const absentStudentsList = students.filter(s => absentStudentIdsOnSelectedDate.has(s.id));
    const absentBoys = absentStudentsList.filter(s => s.gender === 'MALE').length;
    const absentGirls = absentStudentsList.filter(s => s.gender === 'FEMALE').length;

    const presentStudentsList = students.filter(s => !absentStudentIdsOnSelectedDate.has(s.id));
    const presentBoys = presentStudentsList.filter(s => s.gender === 'MALE').length;
    const presentGirls = presentStudentsList.filter(s => s.gender === 'FEMALE').length;
    
    return { totalStudents, totalPresent, totalAbsent, presentBoys, presentGirls, absentBoys, absentGirls };
  }, [students, absentStudentIdsOnSelectedDate]);

  const departmentStrength = useMemo(() => {
    return departments.map(dept => {
      const studentsInDept = students.filter(s => s.departmentId === dept.id);
      
      const absentStudentsInDept = studentsInDept.filter(s => absentStudentIdsOnSelectedDate.has(s.id));
      const absentCount = absentStudentsInDept.length;

      const totalBoys = studentsInDept.filter(s => s.gender === 'MALE').length;
      const totalGirls = studentsInDept.filter(s => s.gender === 'FEMALE').length;
      
      const absentBoys = absentStudentsInDept.filter(s => s.gender === 'MALE').length;
      const absentGirls = absentStudentsInDept.filter(s => s.gender === 'FEMALE').length;
      
      const presentBoys = totalBoys - absentBoys;
      const presentGirls = totalGirls - absentGirls;
      
      const presentTotal = presentBoys + presentGirls;
      const totalStrength = studentsInDept.length;
      const percentage = totalStrength > 0 ? (presentTotal / totalStrength) * 100 : 100;

      return {
        id: dept.id,
        name: dept.name,
        presentBoys,
        totalBoys,
        presentGirls,
        totalGirls,
        presentTotal,
        totalStrength,
        percentage
      };
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [departments, students, absentStudentIdsOnSelectedDate]);

  const classStrength = useMemo(() => {
    return classes.map(cls => {
      const department = departments.find(d => d.id === cls.departmentId);
      const studentsInClass = students.filter(s => s.classId === cls.id);
      
      const absentStudentsInClass = studentsInClass.filter(s => absentStudentIdsOnSelectedDate.has(s.id));
      const absentCount = absentStudentsInClass.length;

      const totalBoys = studentsInClass.filter(s => s.gender === 'MALE').length;
      const totalGirls = studentsInClass.filter(s => s.gender === 'FEMALE').length;

      const absentBoys = absentStudentsInClass.filter(s => s.gender === 'MALE').length;
      const absentGirls = absentStudentsInClass.filter(s => s.gender === 'FEMALE').length;

      const presentBoys = totalBoys - absentBoys;
      const presentGirls = totalGirls - absentGirls;

      const presentTotal = presentBoys + presentGirls;
      const totalStrength = studentsInClass.length;
      const percentage = totalStrength > 0 ? (presentTotal / totalStrength) * 100 : 100;


      return {
        ...cls,
        departmentName: department?.name || 'N/A',
        presentBoys,
        totalBoys,
        presentGirls,
        totalGirls,
        presentTotal,
        totalStrength,
        percentage
      };
    }).sort((a,b) => {
        if (a.departmentName < b.departmentName) return -1;
        if (a.departmentName > b.departmentName) return 1;
        return a.name.localeCompare(b.name);
    });
  }, [classes, students, departments, absentStudentIdsOnSelectedDate]);

  const batchStrength = useMemo(() => {
    const batches = ['I Year', 'II Year', 'III Year', 'IV Year', 'PG First Year', 'PG Second Year'];
    return batches.map(batch => {
        let classesInBatch: Class[];
        
        if (batch === 'PG First Year') {
            classesInBatch = classes.filter(c => c.departmentId === 'mba' && (c.name.startsWith('I-') || c.name === 'I'));
        } else if (batch === 'PG Second Year') {
            classesInBatch = classes.filter(c => c.departmentId === 'mba' && (c.name.startsWith('II-') || c.name === 'II'));
        } else {
            classesInBatch = classes.filter(c => getBatchFromClassName(c.name) === batch && c.departmentId !== 'mba');
        }

        const classIdsInBatch = classesInBatch.map(c => c.id);

        const studentsInBatch = students.filter(s => classIdsInBatch.includes(s.classId));
        const absentStudentsInBatch = studentsInBatch.filter(s => absentStudentIdsOnSelectedDate.has(s.id));
        const absentCount = absentStudentsInBatch.length;

        const totalBoys = studentsInBatch.filter(s => s.gender === 'MALE').length;
        const totalGirls = studentsInBatch.filter(s => s.gender === 'FEMALE').length;

        const absentBoys = absentStudentsInBatch.filter(s => s.gender === 'MALE').length;
        const absentGirls = absentStudentsInBatch.filter(s => s.gender === 'FEMALE').length;

        const presentBoys = totalBoys - absentBoys;
        const presentGirls = totalGirls - absentGirls;

        const presentTotal = presentBoys + presentGirls;
        const totalStrength = studentsInBatch.length;
        const percentage = totalStrength > 0 ? (presentTotal / totalStrength) * 100 : 100;

        return {
            id: batch,
            name: batch,
            presentBoys,
            totalBoys,
            presentGirls,
            totalGirls,
            presentTotal,
            totalStrength,
            percentage
        };
    }).filter(batch => batch.totalStrength > 0); // Don't show batches with no students
  }, [classes, students, absentStudentIdsOnSelectedDate]);

  const handleDepartmentClick = (dept: (typeof departmentStrength)[0]) => {
      const absentees = students.filter(s => s.departmentId === dept.id && absentStudentIdsOnSelectedDate.has(s.id));
      setSelectedItem({
          type: 'department',
          name: dept.name,
          absentees: absentees.sort((a,b) => a.name.localeCompare(b.name)),
      });
  }
  
  const handleClassClick = (cls: (typeof classStrength)[0]) => {
      const absentees = students.filter(s => s.classId === cls.id && absentStudentIdsOnSelectedDate.has(s.id));
       setSelectedItem({
          type: 'class',
          name: `${cls.name} (${cls.departmentName})`,
          absentees: absentees.sort((a,b) => a.name.localeCompare(b.name)),
      });
  }

  const handleBatchClick = (batch: (typeof batchStrength)[0]) => {
    let classesInBatch: Class[];
    if (batch.name === 'PG First Year') {
      classesInBatch = classes.filter(c => c.departmentId === 'mba' && (c.name.startsWith('I-') || c.name === 'I'));
    } else if (batch.name === 'PG Second Year') {
      classesInBatch = classes.filter(c => c.departmentId === 'mba' && (c.name.startsWith('II-') || c.name === 'II'));
    } else {
      classesInBatch = classes.filter(c => getBatchFromClassName(c.name) === batch.name && c.departmentId !== 'mba');
    }
    const classIdsInBatch = classesInBatch.map(c => c.id);
    const absentees = students.filter(s => classIdsInBatch.includes(s.classId) && absentStudentIdsOnSelectedDate.has(s.id));

    setSelectedItem({
      type: 'batch',
      name: batch.name,
      absentees: absentees.sort((a, b) => a.name.localeCompare(b.name)),
    });
  };

  const summaryTitle = useMemo(() => {
    if (!selectedDate) return "Attendance Summary";
    if (isToday(selectedDate)) return "Today's Attendance Summary";
    return `Attendance Summary for ${format(selectedDate, "PPP")}`;
  }, [selectedDate]);

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const dateStr = selectedDate ? format(selectedDate, 'PPP') : 'N/A';
    const pageWidth = doc.internal.pageSize.getWidth();
    let contentY = 10;
    
    const drawContent = () => {
        const title = `Attendance Summary - ${dateStr}`.toUpperCase();
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title, pageWidth / 2, contentY, { align: "center" });
        contentY += 10;

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        doc.text(`Total Students: ${totalStudents}`, 14, contentY);
        contentY += 4;
        
        autoTable(doc, {
            startY: contentY,
            head: [['', 'Total', 'Boys', 'Girls']],
            body: [
                ['Present', totalPresent, presentBoys, presentGirls],
                ['Absent', totalAbsent, absentBoys, absentGirls],
            ],
            theme: 'grid',
            headStyles: { fillColor: [0, 67, 176] },
        });
        
        let finalY = (doc as any).lastAutoTable.finalY + 15;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Department-wise Strength", 14, finalY);
        autoTable(doc, {
            startY: finalY + 4,
            head: [['Department', 'Boys', 'Girls', 'Total', 'Present %']],
            body: departmentStrength.map(d => [d.name, `${d.presentBoys}/${d.totalBoys}`, `${d.presentGirls}/${d.totalGirls}`, `${d.presentTotal}/${d.totalStrength}`, `${d.percentage.toFixed(1)}%`]),
            theme: 'grid',
            headStyles: { fillColor: [0, 67, 176] },
        });
        finalY = (doc as any).lastAutoTable.finalY + 15;
        
        if (finalY > 260) {
            doc.addPage();
            finalY = 22;
        }

        doc.setFontSize(14);
        doc.text("Class-wise Strength", 14, finalY);
        autoTable(doc, {
            startY: finalY + 4,
            head: [['Department', 'Class', 'Boys', 'Girls', 'Total', 'Present %']],
            body: classStrength.map(c => [c.departmentName, c.name, `${c.presentBoys}/${c.totalBoys}`, `${c.presentGirls}/${c.totalGirls}`, `${c.presentTotal}/${c.totalStrength}`, `${c.percentage.toFixed(1)}%`]),
            theme: 'grid',
            headStyles: { fillColor: [0, 67, 176] },
        });
        
        finalY = (doc as any).lastAutoTable.finalY + 15;
        
        if (finalY > 260) { 
          doc.addPage();
          finalY = 22;
        }

        doc.setFontSize(14);
        doc.text("Batch-wise Strength", 14, finalY);
        autoTable(doc, {
            startY: finalY + 4,
            head: [['Batch', 'Boys', 'Girls', 'Total', 'Present %']],
            body: batchStrength.map(b => [b.name, `${b.presentBoys}/${b.totalBoys}`, `${b.presentGirls}/${b.totalGirls}`, `${b.presentTotal}/${b.totalStrength}`, `${b.percentage.toFixed(1)}%`]),
            theme: 'grid',
            headStyles: { fillColor: [0, 67, 176] },
        });
        
        doc.save(`Attendance-Summary-${format(selectedDate || new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    if (logoBase64) {
        try {
            const img = new window.Image();
            img.src = logoBase64;
            img.onload = () => {
                const originalWidth = 190;
                const scalingFactor = 0.75;
                const imgWidth = originalWidth * scalingFactor;
                const ratio = img.width / img.height;
                const imgHeight = imgWidth / ratio;
                const x = (pageWidth - imgWidth) / 2;
                doc.addImage(logoBase64, 'PNG', x, contentY, imgWidth, imgHeight);
                contentY += imgHeight + 5;
                drawContent();
            };
            img.onerror = () => {
                console.error("Error loading image for PDF.");
                drawContent();
            };
        } catch (e) {
            console.error("Error adding image to PDF:", e);
            drawContent();
        }
    } else {
        drawContent();
    }
  };

  return (
    <>
    <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <CardTitle>{summaryTitle}</CardTitle>
                    <CardDescription>A summary of student attendance. Click cards for details.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full md:w-[240px] justify-start text-left font-normal",
                                    !selectedDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(day) => {
                                    setSelectedDate(day);
                                    setIsDatePickerOpen(false);
                                }}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleExportPdf} size="sm" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                 <div className="flip-card cursor-pointer" onClick={() => setIsTotalPresentFlipped(f => !f)}>
                    <motion.div 
                        className="flip-card-inner relative w-full h-full"
                        initial={false}
                        animate={{ rotateY: isTotalPresentFlipped ? 180 : 0 }}
                        transition={{ duration: 0.6, animationDirection: "normal" }}
                    >
                        <div className="flip-card-front absolute w-full h-full">
                            <Card className="h-full">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Present</CardTitle>
                                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-green-600">{totalPresent}</div>
                                    <p className="text-xs text-muted-foreground">out of {totalStudents} students</p>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="flip-card-back absolute w-full h-full">
                            <Card className="h-full bg-green-600 text-white">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Present Breakdown</CardTitle>
                                    <UserCheck className="h-4 w-4 text-white/80" />
                                </CardHeader>
                                <CardContent className="flex justify-around items-center pt-2">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold">{presentBoys}</div>
                                        <p className="text-xs text-white/80">Boys</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold">{presentGirls}</div>
                                        <p className="text-xs text-white/80">Girls</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </motion.div>
                </div>

                <div className="flip-card cursor-pointer" onClick={() => setIsTotalAbsentFlipped(f => !f)}>
                     <motion.div 
                        className="flip-card-inner relative w-full h-full"
                        initial={false}
                        animate={{ rotateY: isTotalAbsentFlipped ? 180 : 0 }}
                        transition={{ duration: 0.6, animationDirection: "normal" }}
                    >
                        <div className="flip-card-front absolute w-full h-full">
                            <Card className="h-full">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Absent</CardTitle>
                                    <UserX className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-destructive">{totalAbsent}</div>
                                    <p className="text-xs text-muted-foreground">out of {totalStudents} students</p>
                                </CardContent>
                            </Card>
                        </div>
                         <div className="flip-card-back absolute w-full h-full">
                            <Card className="h-full bg-destructive text-white">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Absent Breakdown</CardTitle>
                                    <UserX className="h-4 w-4 text-white/80" />
                                </CardHeader>
                                <CardContent className="flex justify-around items-center pt-2">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold">{absentBoys}</div>
                                        <p className="text-xs text-white/80">Boys</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold">{absentGirls}</div>
                                        <p className="text-xs text-white/80">Girls</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </motion.div>
                </div>
            </div>
            <Tabs defaultValue="department">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="department">By Department</TabsTrigger>
                    <TabsTrigger value="class">By Class</TabsTrigger>
                    <TabsTrigger value="batch">By Batch</TabsTrigger>
                </TabsList>
                <TabsContent value="department" className="mt-4">
                     <div className="rounded-md border max-h-96 overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                <TableHead>Department</TableHead>
                                <TableHead className="text-center">Boys</TableHead>
                                <TableHead className="text-center">Girls</TableHead>
                                <TableHead className="text-center">Total</TableHead>
                                <TableHead className="text-right">Present %</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {departmentStrength.map((dept) => (
                                <TableRow key={dept.id} onClick={() => handleDepartmentClick(dept)} className="cursor-pointer">
                                    <TableCell className="font-medium">{dept.name}</TableCell>
                                    <TableCell className="text-center">{dept.presentBoys}/{dept.totalBoys}</TableCell>
                                    <TableCell className="text-center">{dept.presentGirls}/{dept.totalGirls}</TableCell>
                                    <TableCell className="text-center font-bold">{dept.presentTotal}/{dept.totalStrength}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            <span className="font-semibold text-sm min-w-[40px]">{dept.percentage.toFixed(1)}%</span>
                                            <Progress value={dept.percentage} className="w-24 h-2" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
                <TabsContent value="class" className="mt-4">
                     <div className="rounded-md border max-h-96 overflow-y-auto">
                        <Table>
                             <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                <TableHead>Class</TableHead>
                                <TableHead className="text-center">Boys</TableHead>
                                <TableHead className="text-center">Girls</TableHead>
                                <TableHead className="text-center">Total</TableHead>
                                <TableHead className="text-right">Present %</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {classStrength.map((cls) => (
                                <TableRow key={cls.id} onClick={() => handleClassClick(cls)} className="cursor-pointer">
                                    <TableCell>
                                        <div className="font-medium">{cls.departmentName}</div>
                                        <div className="text-sm text-muted-foreground">{cls.name}</div>
                                    </TableCell>
                                    <TableCell className="text-center">{cls.presentBoys}/{cls.totalBoys}</TableCell>
                                    <TableCell className="text-center">{cls.presentGirls}/{cls.totalGirls}</TableCell>
                                    <TableCell className="text-center font-bold">{cls.presentTotal}/{cls.totalStrength}</TableCell>
                                     <TableCell className="text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            <span className="font-semibold text-sm min-w-[40px]">{cls.percentage.toFixed(1)}%</span>
                                            <Progress value={cls.percentage} className="w-24 h-2" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
                 <TabsContent value="batch" className="mt-4">
                     <div className="rounded-md border max-h-96 overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                <TableHead>Batch</TableHead>
                                <TableHead className="text-center">Boys</TableHead>
                                <TableHead className="text-center">Girls</TableHead>
                                <TableHead className="text-center">Total</TableHead>
                                <TableHead className="text-right">Present %</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {batchStrength.map((batch) => (
                                <TableRow key={batch.id} onClick={() => handleBatchClick(batch)} className="cursor-pointer">
                                    <TableCell className="font-medium">{batch.name}</TableCell>
                                    <TableCell className="text-center">{batch.presentBoys}/{batch.totalBoys}</TableCell>
                                    <TableCell className="text-center">{batch.presentGirls}/{batch.totalGirls}</TableCell>
                                    <TableCell className="text-center font-bold">{batch.presentTotal}/{batch.totalStrength}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            <span className="font-semibold text-sm min-w-[40px]">{batch.percentage.toFixed(1)}%</span>
                                            <Progress value={batch.percentage} className="w-24 h-2" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>
        </CardContent>
    </Card>

    {selectedItem && (
        <Dialog open={!!selectedItem} onOpenChange={(isOpen) => !isOpen && setSelectedItem(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-6 w-6" /> 
                Absentees for {selectedItem.name}
              </DialogTitle>
              <DialogDescription>
                List of students absent on {selectedDate ? format(selectedDate, 'PPP') : 'the selected date'}.
              </DialogDescription>
            </DialogHeader>
             {selectedItem.absentees.length > 0 ? (
                <div className="max-h-[60vh] overflow-y-auto border rounded-md">
                  <Table>
                      <TableHeader>
                        <TableRow>
                            <TableHead>Register No.</TableHead>
                            <TableHead>Student Name</TableHead>
                            {selectedItem.type === 'batch' && <TableHead>Department</TableHead>}
                            <TableHead>Class</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                      {selectedItem.absentees.map((student) => {
                          const studentClass = classes.find(c => c.id === student.classId);
                          const studentDept = departments.find(d => d.id === student.departmentId);
                          return (
                              <TableRow key={student.id}>
                                <TableCell>{student.registerNo || 'N/A'}</TableCell>
                                <TableCell className="font-medium">{student.name}</TableCell>
                                {selectedItem.type === 'batch' && <TableCell>{studentDept?.name || 'N/A'}</TableCell>}
                                <TableCell>{studentClass?.name || 'N/A'}</TableCell>
                              </TableRow>
                          );
                      })}
                      </TableBody>
                  </Table>
                </div>
            ) : (
                <div className="text-center p-8 text-muted-foreground">
                    <p>No absentees found for this {selectedItem.type} on the selected day.</p>
                </div>
             )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
