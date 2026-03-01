'use client';

import { useMemo, useState, useEffect } from 'react';
import type { AttendanceSubmission, Class, Department, WorkingDay } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isSunday } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CalendarCheck, Calendar as CalendarIcon, Download } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type AttendanceStatusProps = {
  submissions: AttendanceSubmission[];
  classes: Class[];
  departments: Department[];
  workingDays: WorkingDay[];
};

export function AttendanceStatus({ submissions, classes, departments, workingDays }: AttendanceStatusProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
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
  
  const handleExportPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let contentY = 10;

    const drawContent = () => {
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("ATTENDANCE SUBMISSION STATUS", pageWidth / 2, contentY, { align: "center" });
        contentY += 8;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        const dateText = `Date: ${date ? format(date, 'PPP') : 'N/A'}`;
        doc.text(dateText, pageWidth / 2, contentY, { align: 'center' });
        contentY += 10;

        const tableData: any[] = [];
        statusData.forEach(dept => {
            dept.classes.forEach((cls, index) => {
                const row = [];
                if (index === 0) {
                    // Use rowSpan for the department cell to merge it
                    row.push({ 
                        content: dept.name, 
                        rowSpan: dept.classes.length, 
                        styles: { valign: 'middle', halign: 'left', fontStyle: 'bold' } 
                    });
                }
                row.push(cls.name);
                row.push(cls.status);
                tableData.push(row);
            });
        });

        autoTable(doc, {
          startY: contentY,
          head: [['Department', 'Class', 'Status']],
          body: tableData,
          headStyles: { fillColor: [30, 58, 138], lineColor: [44, 62, 80], lineWidth: 0.1 },
          styles: { cellPadding: 2, fontSize: 10, lineColor: [44, 62, 80], lineWidth: 0.1 },
          theme: 'grid',
          didParseCell: (data) => {
              if (data.section === 'body') {
                  // Get the status from the raw data of the row
                  // The status is always the last element in our row array
                  const rowRaw = data.row.raw as any[];
                  const status = rowRaw[rowRaw.length - 1];
                  
                  if (status === 'Pending') {
                      // Highlight pending rows with light red background and dark red text
                      data.cell.styles.fillColor = [254, 226, 226];
                      data.cell.styles.textColor = [153, 27, 27];
                  }
              }
          }
        });

        doc.save(`Attendance-Submission-Status-${format(date || new Date(), 'dd-MM-yyyy')}.pdf`);
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

  const cardDescription = date ? `An overview of which classes submitted attendance on ${format(date, 'PPP')}.` : 'Select a date to see attendance submission status.';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <CardTitle>Attendance Submission Status</CardTitle>
              <CardDescription>{cardDescription}</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
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
                <Button 
                    onClick={handleExportPdf} 
                    variant="outline" 
                    size="sm" 
                    className="w-full sm:w-auto"
                    disabled={statusData.length === 0 || !isSelectedDateWorkingDay}
                >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                </Button>
            </div>
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