'use client';

import { Button } from '@/components/ui/button';
import type { AttendanceRecord, Class, Department, Staff, Student, WorkingDay } from '@/lib/types';
import { Download, Loader2 } from 'lucide-react';
import { startOfMonth, endOfMonth, format, isSameDay, isSunday, eachDayOfInterval, isFuture } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useEffect, useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { exportToCsv } from '@/lib/utils';

type MonthlyDetailedReportProps = {
  user: Staff | null;
  departments: Department[];
  classes: Class[];
  students: Student[];
  records: AttendanceRecord[];
  workingDays: WorkingDay[];
};

export function MonthlyDetailedReport({ user, departments, classes, students, records, workingDays }: MonthlyDetailedReportProps) {
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [mentorFilter, setMentorFilter] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMonthYear, setSelectedMonthYear] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
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
    if (!isAdminOrViewer && user?.classId) {
      return classes.filter(c => c.id === user.classId);
    }
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

    let studentsToReport = students;
    if (mentorFilter !== 'all') {
        studentsToReport = studentsToReport.filter(s => s.mentor === mentorFilter);
    }
     if (classFilter !== 'all') {
        studentsToReport = studentsToReport.filter(s => s.classId === classFilter);
    }

    studentsToReport.sort((a, b) => (a.registerNo || a.name).localeCompare(b.registerNo || b.name));

    if (studentsToReport.length === 0) {
      toast({ title: "No students found for the selected filters." });
      return null;
    }

    const today = new Date();
    const monthStart = startOfMonth(new Date(selectedMonthYear.year, selectedMonthYear.month - 1));
    const monthEnd = endOfMonth(monthStart);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const workingDaysMap = new Map<string, boolean>();
    workingDays.forEach(wd => {
      workingDaysMap.set(format(wd.timestamp, 'yyyy-MM-dd'), wd.isWorkingDay);
    });

    const monthWorkingDays = monthDays.filter(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        return (workingDaysMap.get(dateKey) ?? false) && !isSunday(day) && day <= today;
    });
    const totalWorkingDays = monthWorkingDays.length;

    const monthRecords = records.filter(r => {
      const recordDate = new Date(r.timestamp);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    const body: (string | number)[][] = [];
    const head: string[] = ['S.No', 'Register No.', 'Student Name', ...monthDays.map(d => format(d, 'd')), 'Total', 'Present', 'Absent', '%'];
    
    const dailyPresentCounts: (number | string)[] = Array(monthDays.length).fill(0);
    const dailyAbsentCounts: (number | string)[] = Array(monthDays.length).fill(0);

    studentsToReport.forEach((student, index) => {
      let presentCount = 0;
      let absentCount = 0;
      const dailyStatuses = monthDays.map((day, dayIndex) => {
          if (isFuture(day)) return '';
          
          const dateKey = format(day, 'yyyy-MM-dd');
          const isWorking = (workingDaysMap.get(dateKey) ?? false) && !isSunday(day);
          
          if (!isWorking) return 'H';

          const isAbsent = monthRecords.some(r => r.studentId === student.id && isSameDay(new Date(r.timestamp), day));
          if(isAbsent) {
              absentCount++;
              (dailyAbsentCounts[dayIndex] as number)++;
              return 'A';
          } else {
              if (day <= today) {
                  presentCount++;
                  (dailyPresentCounts[dayIndex] as number)++;
                  return 'P';
              }
              return '';
          }
      });
      
      const percentage = totalWorkingDays > 0 ? (presentCount / totalWorkingDays) * 100 : 0;
      
      const row: (string | number)[] = [
          index + 1, 
          student.registerNo || 'N/A', 
          student.name, 
          ...dailyStatuses,
          totalWorkingDays,
          presentCount,
          absentCount,
          `${percentage.toFixed(1)}%`
      ];

      body.push(row);
    });

    monthDays.forEach((day, index) => {
      if (isFuture(day)) {
        dailyPresentCounts[index] = '';
        dailyAbsentCounts[index] = '';
      }
    });
    
    const presentRow: (string | number)[] = ['', '', 'Total Present', ...dailyPresentCounts, '', '', '', ''];
    const absentRow: (string | number)[] = ['', '', 'Total Absent', ...dailyAbsentCounts, '', '', '', ''];
    body.push(presentRow);
    body.push(absentRow);


    return { head, body };
  }

  const handleExportCsv = () => {
    const reportData = generateReportData();
    if (!reportData) return;

    const { head, body } = reportData;
    const csvData = body.map(row => {
      const rowObject: { [key: string]: any } = {};
      head.forEach((header, index) => {
        rowObject[header] = row[index];
      });
      return rowObject;
    });

    const selectedClass = classes.find(c => c.id === classFilter);
    let fileName = `Monthly-Detailed-Report`;
    if(selectedClass && classFilter !== 'all') fileName += `-${selectedClass.name}`;
    if(mentorFilter !== 'all') fileName += `-${mentorFilter}`;
    fileName += `-${format(new Date(selectedMonthYear.year, selectedMonthYear.month - 1), 'MMM-yyyy')}.csv`;
    
    exportToCsv(fileName, csvData);
  }

  const handleExportPdf = async () => {
    setIsGenerating(true);

    const reportData = generateReportData();
    if (!reportData) {
      setIsGenerating(false);
      return;
    }

    const { head, body } = reportData;

    const selectedClass = classes.find(c => c.id === classFilter);
    const selectedDepartment = departments.find(d => d.id === selectedClass?.departmentId);

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let contentY = 10;
    
    const drawContent = () => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("ACADEMIC YEAR 2025-2026 (ODD SEMESTER)", pageWidth / 2, contentY, { align: "center" });
      contentY += 8;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("MONTHLY ATTENDANCE DETAILED REPORT", pageWidth / 2, contentY, { align: 'center' });
      contentY += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      let rightTextY = contentY;
      let leftTextY = contentY;

      if (classFilter !== 'all' && selectedClass) {
        doc.text(`Class: ${selectedClass.name}`, 14, leftTextY);
        leftTextY +=5;
      }
       if (departmentFilter !== 'all' && selectedDepartment && classFilter !== 'all') {
          doc.text(`Department: ${selectedDepartment.name}`, 14, leftTextY);
          leftTextY += 5;
      }
      if (mentorFilter !== 'all') {
        doc.text(`Mentor: ${mentorFilter}`, 14, leftTextY);
      }


      const dateStr = format(new Date(selectedMonthYear.year, selectedMonthYear.month - 1), 'MMMM yyyy');
      doc.text(`Month: ${dateStr}`, pageWidth - 14, rightTextY, { align: 'right' });
      contentY += 12;

      autoTable(doc, {
        startY: contentY,
        head: [head],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: 255, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
        columnStyles: {
            2: { halign: 'left' }
        },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.cell.text.includes('A')) {
            const cell = data.cell;
            const currentFill = data.row.index % 2 === 0 ? [255,255,255] : [240,240,240];
            doc.setFillColor(currentFill[0], currentFill[1], currentFill[2]);
            doc.rect(cell.x, cell.y, cell.width, cell.height, 'F');
            
            doc.setTextColor(255, 0, 0);
            doc.text('A', cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' });
            doc.setTextColor(0, 0, 0);
          }
        },
      });

      let fileName = `Monthly-Detailed-Report`;
      if(selectedClass && classFilter !== 'all') fileName += `-${selectedClass.name}`;
      if(mentorFilter !== 'all') fileName += `-${mentorFilter}`;
      fileName += `-${format(new Date(selectedMonthYear.year, selectedMonthYear.month - 1), 'MMM-yyyy')}.pdf`;
      doc.save(fileName);
      setIsGenerating(false);
    }

    if (logoBase64) {
      try {
        const img = new window.Image();
        img.src = logoBase64;
        img.onload = () => {
          const originalWidth = 190;
          const scalingFactor = 0.55;
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
        <h3 className="text-lg font-medium">Monthly Detailed Attendance Report</h3>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
          <MonthYearPicker date={selectedMonthYear} onDateChange={setSelectedMonthYear} />
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
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isGenerating ? 'Generating...' : 'Download CSV'}
          </Button>

          <Button onClick={handleExportPdf} size="sm" variant="outline" disabled={isGenerating || (classFilter === 'all' && mentorFilter === 'all')}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>
      <div className="text-sm text-muted-foreground p-4 border rounded-lg">
        <p>Select a month and a class or mentor, then click a download button to get a detailed daily attendance report for each student.</p>
        <p className="text-xs mt-1">Note: 'P' = Present, 'A' = Absent, 'H' = Holiday.</p>
      </div>
    </div>
  );
}
