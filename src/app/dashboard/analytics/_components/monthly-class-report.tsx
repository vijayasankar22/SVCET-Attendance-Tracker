'use client';

import { Button } from '@/components/ui/button';
import type { AttendanceRecord, Class, Department, Staff, Student, WorkingDay } from '@/lib/types';
import { Download, Loader2, CalendarIcon } from 'lucide-react';
import { getDaysInMonth, startOfMonth, endOfMonth, format, isWithinInterval, eachDayOfInterval } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useEffect, useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { exportToCsv } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

type MonthlyClassReportProps = {
  user: Staff | null;
  departments: Department[];
  classes: Class[];
  students: Student[];
  records: AttendanceRecord[];
  workingDays: WorkingDay[];
};

export function MonthlyClassReport({ user, departments, classes, students, records, workingDays }: MonthlyClassReportProps) {
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [mentorFilter, setMentorFilter] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const { toast } = useToast();
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const isAdminOrViewer = user?.role === 'admin' || user?.role === 'viewer';

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
  
  const availableClasses = useMemo(() => {
    if (!isAdminOrViewer && user?.classId) return classes.filter(c => c.id === user.classId);
    if (departmentFilter === 'all') {
      return [];
    }
    return classes.filter(c => c.departmentId === departmentFilter);
  }, [departmentFilter, classes, isAdminOrViewer, user?.classId]);

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

  useEffect(() => {
    if (user?.role === 'teacher' && user.classId) {
      const teacherClass = classes.find(c => c.id === user.classId);
      if (teacherClass) {
        setDepartmentFilter(teacherClass.departmentId);
        setClassFilter(teacherClass.id);
      }
    }
  }, [user, classes]);

  const generateReportData = () => {
    if (classFilter === 'all' && mentorFilter === 'all') {
      toast({
        variant: 'destructive',
        title: 'Selection Required',
        description: 'Please select a class or a mentor to generate the report.',
      });
      return null;
    }
    
    if (!date?.from || !date?.to) {
        toast({ title: "Please select a date range." });
        return null;
    }

    let studentsToReport = students;

    if (mentorFilter !== 'all') {
        studentsToReport = studentsToReport.filter(s => s.mentor === mentorFilter);
    }
    if(classFilter !== 'all') {
        studentsToReport = studentsToReport.filter(s => s.classId === classFilter);
    }

    if (studentsToReport.length === 0) {
      toast({ title: "No students found for the selected filters." });
      return null;
    }
    
    studentsToReport.sort((a, b) => (a.registerNo || a.name).localeCompare(b.registerNo || b.name));

    const monthStart = date.from;
    const monthEnd = date.to;

    const workingDaysMap = new Map<string, boolean>();
    workingDays.forEach(wd => {
      workingDaysMap.set(format(wd.timestamp, 'yyyy-MM-dd'), wd.isWorkingDay);
    });

    let totalWorkingDays = 0;
    const intervalDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    intervalDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        if(workingDaysMap.get(dateKey) ?? false) {
            totalWorkingDays++;
        }
    });

    const monthRecords = records.filter(r => {
        const recordDate = new Date(r.timestamp);
        return isWithinInterval(recordDate, { start: monthStart, end: monthEnd });
    });

    const onlyMentorSelected = mentorFilter !== 'all' && classFilter === 'all' && departmentFilter === 'all';
    
    return studentsToReport.map((student, index) => {
      const absentCount = monthRecords.filter(r => r.studentId === student.id).length;
      const presentCount = totalWorkingDays - absentCount;
      const percentage = totalWorkingDays > 0 ? (presentCount / totalWorkingDays) * 100 : 0;
      
      const studentClass = classes.find(c => c.id === student.classId);
      const studentDept = departments.find(d => d.id === student.departmentId);

      if (onlyMentorSelected) {
          return {
            'S.No.': index + 1,
            'Register No.': student.registerNo || 'N/A',
            'Student Name': student.name,
            'Department': studentDept?.name || 'N/A',
            'Class': studentClass?.name || 'N/A',
            'Total Days': totalWorkingDays,
            'Present': presentCount,
            'Absent': absentCount,
            'Percentage': percentage.toFixed(1) + '%'
          };
      }
      return {
        'S.No.': index + 1,
        'Register No.': student.registerNo || 'N/A',
        'Student Name': student.name,
        'Mentor': student.mentor || 'N/A',
        'Total Days': totalWorkingDays,
        'Present': presentCount,
        'Absent': absentCount,
        'Percentage': percentage.toFixed(1) + '%'
      };
    });
  }

  const handleExportCsv = () => {
    const reportData = generateReportData();
    if (!reportData) return;

    const selectedClass = classes.find(c => c.id === classFilter);
    let filename = 'Periodical-Report';
    if(selectedClass && classFilter !== 'all') filename += `-${selectedClass.name}`;
    if(mentorFilter !== 'all') filename += `-${mentorFilter}`;
    filename += `-${format(date?.from || new Date(), 'dd-MM-yy')}-to-${format(date?.to || new Date(), 'dd-MM-yy')}.csv`;
    
    exportToCsv(filename, reportData);
  }

  const handleExportPdf = async () => {
    setIsGenerating(true);
    
    const reportData = generateReportData();
     if (!reportData) {
        setIsGenerating(false);
        return;
    }

    const selectedClass = classes.find(c => c.id === classFilter);
    const selectedDepartment = departments.find(d => d.id === selectedClass?.departmentId);
    
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let contentY = 10;
    
    const onlyMentorSelected = mentorFilter !== 'all' && classFilter === 'all' && departmentFilter === 'all';
    
    const head = onlyMentorSelected
        ? [['S.No.', 'Register No.', 'Student Name', 'Department', 'Class', 'Total Days', 'Present', 'Absent', 'Percentage']]
        : [['S.No.', 'Register No.', 'Student Name', 'Mentor', 'Total Days', 'Present', 'Absent', 'Percentage']];
    
    const body = reportData.map(d => Object.values(d));


    const drawContent = () => {
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("ACADEMIC YEAR 2025-2026 (ODD SEMESTER)", pageWidth / 2, contentY, { align: "center" });
        contentY += 8;

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("ATTENDANCE REPORT", pageWidth / 2, contentY, { align: 'center' });
        contentY += 8;
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        let leftTextY = contentY;
        if (classFilter !== 'all' && selectedClass) {
            doc.text(`Class: ${selectedClass.name}`, 14, leftTextY);
            leftTextY += 5;
        }
        if (departmentFilter !== 'all' && selectedDepartment && classFilter !== 'all') {
            doc.text(`Department: ${selectedDepartment.name}`, 14, leftTextY);
        } else if (onlyMentorSelected) {
            // Don't show department if only mentor is selected from all depts
        }


        if (mentorFilter !== 'all') {
             doc.text(`Mentor: ${mentorFilter}`, 14, leftTextY + 5);
        }


        if (date?.from && date?.to) {
            const fromDateStr = `From: ${format(date.from, 'dd/MM/yyyy')}`;
            const toDateStr = `To: ${format(date.to, 'dd/MM/yyyy')}`;
            doc.text(fromDateStr, pageWidth - 14, contentY, { align: 'right' });
            doc.text(toDateStr, pageWidth - 14, contentY + 5, { align: 'right' });
        }
        contentY += 12;

        autoTable(doc, {
            startY: contentY,
            head: head,
            body: body,
            headStyles: { fillColor: [30, 58, 138], lineColor: [44, 62, 80], lineWidth: 0.1 },
            styles: { cellPadding: 2, fontSize: 8, lineColor: [44, 62, 80], lineWidth: 0.1, lineCap: 'butt' },
        });

        let filename = 'Attendance-Report';
        if(selectedDepartment && departmentFilter !== 'all' && !onlyMentorSelected) filename += `-${selectedDepartment.name}`;
        if(selectedClass && classFilter !== 'all') filename += `-${selectedClass.name}`;
        if(mentorFilter !== 'all') filename += `-${mentorFilter}`;
        filename += `-${format(date?.from || new Date(), 'dd-MM-yy')}-to-${format(date?.to || new Date(), 'dd-MM-yy')}.pdf`;
        doc.save(filename);
        setIsGenerating(false);
    }
    
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
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-between items-center">
        <h3 className="text-lg font-medium">Class wise Attendance report</h3>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
          <Popover>
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
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          {isAdminOrViewer ? (
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
          ) : (
            <p className="text-sm font-medium p-2">{classes.find(c => c.id === user?.classId)?.name}</p>
          )}

          <Button onClick={handleExportCsv} size="sm" variant="outline" disabled={isGenerating || (classFilter === 'all' && mentorFilter === 'all')}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>

          <Button onClick={handleExportPdf} size="sm" variant="outline" disabled={isGenerating || (classFilter === 'all' && mentorFilter === 'all')}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>
      <div className="text-sm text-muted-foreground p-4 border rounded-lg">
        <p>Select a date range and a class or mentor, then click a download button to get a PDF or CSV summary of attendance for each student.</p>
      </div>
    </div>
  );
}
