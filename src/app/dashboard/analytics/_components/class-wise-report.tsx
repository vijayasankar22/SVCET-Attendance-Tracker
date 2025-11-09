'use client';

import { Button } from '@/components/ui/button';
import type { AttendanceRecord, Class, Department, Staff, Student, WorkingDay } from '@/lib/types';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useEffect, useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StudentAttendanceGridContent } from '../../_components/student-attendance-grid';
import { createRoot } from 'react-dom/client';
import { useToast } from '@/hooks/use-toast';

type ClassWiseReportProps = {
  user: Staff | null;
  departments: Department[];
  classes: Class[];
  students: Student[];
  records: AttendanceRecord[];
  workingDays: WorkingDay[];
};

export function ClassWiseReport({ user, departments, classes, students, records, workingDays }: ClassWiseReportProps) {
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [mentorFilter, setMentorFilter] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const isAdminOrViewer = user?.role === 'admin' || user?.role === 'viewer';

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
    if (classFilter === 'all') {
      setMentorFilter('all');
    }
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


  const handleExportPdf = async () => {
    if (classFilter === 'all' && mentorFilter === 'all') {
      toast({
        variant: 'destructive',
        title: 'Selection Required',
        description: 'Please select a class or a mentor to generate the report.',
      });
      return;
    }
    
    setIsGenerating(true);

    let studentsToReport = students;

    if (mentorFilter !== 'all') {
        studentsToReport = studentsToReport.filter(s => s.mentor === mentorFilter);
    }
    if (classFilter !== 'all') {
        studentsToReport = studentsToReport.filter(s => s.classId === classFilter);
    }

    if(studentsToReport.length === 0){
        toast({ title: "No students found for the selected filters."});
        setIsGenerating(false);
        return;
    }

    studentsToReport.sort((a,b) => (a.registerNo || a.name).localeCompare(b.registerNo || b.name));

    const selectedClass = classes.find(c => c.id === classFilter);
    const doc = new jsPDF('p', 'mm', 'a4');
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '800px';
    document.body.appendChild(tempContainer);
    
    for (let i = 0; i < studentsToReport.length; i++) {
        const student = studentsToReport[i];
        const studentRecords = records.filter(r => r.studentId === student.id);
        
        if (i > 0) {
            doc.addPage();
        }
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        
        let mentorText = `Mentor: ${student.mentor || 'N/A'}`;
        if (mentorFilter !== 'all') {
            mentorText = `Mentor: ${mentorFilter}`;
        }
        doc.text(mentorText, 20, 15);

        const reportContent = (
            <div style={{ padding: '20px', background: 'white' }}>
                 <StudentAttendanceGridContent student={student} records={studentRecords} workingDays={workingDays} isPdf={true} />
            </div>
        );

        const element = document.createElement('div');
        tempContainer.appendChild(element);
        
        const root = createRoot(element);
        await new Promise<void>(resolve => {
            const App = () => {
                useEffect(() => {
                    setTimeout(resolve, 50); 
                }, []);
                return reportContent;
            };
            root.render(<App />);
        });

        const canvas = await html2canvas(element.children[0] as HTMLElement, { 
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        
        const pdfWidth = doc.internal.pageSize.getWidth();
        const imgProps = doc.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        doc.addImage(imgData, 'PNG', 0, 20, pdfWidth, imgHeight);
        
        root.unmount();
        tempContainer.removeChild(element);
    }

    document.body.removeChild(tempContainer);
    let fileName = 'Class-Report';
    if(selectedClass) fileName += `-${selectedClass.name}`;
    if(mentorFilter !== 'all') fileName += `-${mentorFilter}`;
    doc.save(`${fileName}.pdf`);

    setIsGenerating(false);
  };


  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-between items-center">
        <h3 className="text-lg font-medium">Student-wise Class Report</h3>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
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
          ): (
             <p className="text-sm font-medium p-2">{classes.find(c => c.id === user?.classId)?.name}</p>
          )}

            <Button onClick={handleExportPdf} size="sm" variant="outline" disabled={isGenerating || (classFilter === 'all' && mentorFilter === 'all')}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isGenerating ? 'Generating...' : 'Download Report'}
            </Button>
        </div>
      </div>
      <div className="text-sm text-muted-foreground p-4 border rounded-lg">
        <p>Select a class and/or a mentor, then click "Download Report" to get a PDF containing the yearly attendance grid for each student in that selection.</p>
      </div>
    </div>
  );
}
