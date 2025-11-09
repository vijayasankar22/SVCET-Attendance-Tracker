'use client';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AttendanceRecord, Class, Department, Staff, Student } from '@/lib/types';
import { Download, CalendarIcon } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useEffect, useState, useMemo } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type AbsenteesListProps = {
  records: AttendanceRecord[];
  user: Staff | null;
  departments: Department[];
  classes: Class[];
  students: Student[];
};

export function AbsenteesList({ records, user, departments, classes, students }: AbsenteesListProps) {
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [mentorFilter, setMentorFilter] = useState('all');

  const isAdminOrViewer = user?.role === 'admin' || user?.role === 'viewer';

  const availableClasses = useMemo(() => {
    if (departmentFilter === 'all') {
      return [];
    }
    return classes.filter(c => c.departmentId === departmentFilter);
  }, [departmentFilter, classes]);

  const availableMentors = useMemo(() => {
    const mentorSet = new Set<string>();
    let relevantStudents = students;
    
    if (classFilter !== 'all') {
        relevantStudents = students.filter(s => s.classId === classFilter);
    } else if (departmentFilter !== 'all') {
        const classIdsInDept = classes.filter(c => c.departmentId === departmentFilter).map(c => c.id);
        relevantStudents = students.filter(s => classIdsInDept.includes(s.classId));
    } else {
        return [];
    }

    relevantStudents.forEach(s => {
      if (s.mentor) mentorSet.add(s.mentor);
    });
    return Array.from(mentorSet).sort();
  }, [students, classFilter, departmentFilter, classes]);

  useEffect(() => {
    // If department filter changes, reset class and mentor
    setClassFilter('all');
    setMentorFilter('all');
  }, [departmentFilter]);

  useEffect(() => {
    // If class filter changes, reset mentor
    setMentorFilter('all');
  }, [classFilter]);


  const filteredRecords = useMemo(() => {
    let studentIdsToFilter: string[] | null = null;
    
    if (mentorFilter !== 'all') {
        studentIdsToFilter = students.filter(s => s.mentor === mentorFilter).map(s => s.id);
    }

    return records.filter(record => {
      const isDateMatch = selectedDate ? isSameDay(new Date(record.timestamp), selectedDate) : true;
      const isDeptMatch = departmentFilter === 'all' || record.departmentName === departments.find(d => d.id === departmentFilter)?.name;
      const isClassMatch = classFilter === 'all' || record.className === classes.find(c => c.id === classFilter)?.name;
      const isMentorMatch = !studentIdsToFilter || studentIdsToFilter.includes(record.studentId);
      
      return isDateMatch && isDeptMatch && isClassMatch && isMentorMatch;
    });
  }, [records, selectedDate, departmentFilter, classFilter, mentorFilter, departments, classes, students]);


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
  

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let contentY = 10;

    const onlyMentorSelected = mentorFilter !== 'all' && classFilter === 'all' && departmentFilter === 'all';
    
    const drawContent = () => {
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("ABSENTEES REPORT", pageWidth / 2, contentY, { align: "center" });
        contentY += 8;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        const dateText = `Date: ${selectedDate ? format(selectedDate, 'PPP') : 'N/A'}`;
        doc.text(dateText, pageWidth / 2, contentY, { align: 'center' });
        contentY += 6;

        if(mentorFilter !== 'all') {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`Mentor: ${mentorFilter}`, pageWidth / 2, contentY, { align: 'center' });
            contentY += 8;
        } else {
            contentY += 2;
        }
        
        const head = onlyMentorSelected 
            ? [['S.No.', 'Student Name', 'Register No', 'Department', 'Class', 'Date']]
            : [['S.No.', 'Student Name', 'Register No', 'Class', 'Department', 'Mentor', 'Date']];
            
        const body = filteredRecords.map((record, index) => {
            const student = students.find(s => s.id === record.studentId);
            if (onlyMentorSelected) {
                return [
                    index + 1,
                    record.studentName,
                    record.registerNo || 'N/A',
                    record.departmentName,
                    record.className,
                    format(new Date(record.timestamp), 'PPP'),
                ];
            }
            return [
                index + 1,
                record.studentName,
                record.registerNo || 'N/A',
                record.className,
                record.departmentName,
                student?.mentor || 'N/A',
                format(new Date(record.timestamp), 'PPP'),
            ];
        });
        
        autoTable(doc, {
          startY: contentY,
          head: head,
          body: body,
          headStyles: { fillColor: [30, 58, 138], lineColor: [44, 62, 80], lineWidth: 0.1 },
          styles: { cellPadding: 2, fontSize: 8, lineColor: [44, 62, 80], lineWidth: 0.1, lineCap: 'butt' },
        });

        doc.save(`Absentees-Report-${format(selectedDate || new Date(), 'dd-MM-yyyy')}.pdf`);
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <h3 className="text-lg font-medium">Absentees List</h3>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
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
                 <Select value={classFilter} onValueChange={setClassFilter} disabled={departmentFilter === 'all'}>
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
                <Select value={mentorFilter} onValueChange={setMentorFilter} disabled={departmentFilter === 'all' || classFilter === 'all'}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Mentor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Mentors</SelectItem>
                        {availableMentors.map(mentor => (
                            <SelectItem key={mentor} value={mentor}>{mentor}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </>
          )}
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

            <Button onClick={handleExportPdf} size="sm" variant="outline" disabled={filteredRecords.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student Name</TableHead>
              <TableHead>Register No</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Mentor</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record) => {
                const student = students.find(s => s.id === record.studentId);
                return (
                    <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.studentName}</TableCell>
                    <TableCell>{record.registerNo || 'N/A'}</TableCell>
                    <TableCell>{record.className}</TableCell>
                    <TableCell>{record.departmentName}</TableCell>
                    <TableCell>{student?.mentor || 'N/A'}</TableCell>
                    <TableCell>{format(new Date(record.timestamp), 'PPP')}</TableCell>
                    </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No absentees found for the selected date and filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
