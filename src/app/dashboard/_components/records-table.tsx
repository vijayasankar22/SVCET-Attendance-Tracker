
"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Search, FileDown, History } from "lucide-react";
import type { AttendanceRecord, Department, Class, Student } from "@/lib/types";
import { exportToXlsx, exportToCsv } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

type RecordsTableProps = {
  records: AttendanceRecord[];
  loading: boolean;
  departments: Department[];
  classes: Class[];
  students: Student[];
};

export function RecordsTable({ records, loading, departments, classes, students }: RecordsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<AttendanceRecord[] | null>(null);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);

  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
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


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const globalSearchResults = useMemo(() => {
    if (!globalSearchTerm) return [];
    return students.filter(student =>
      student.name.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
      student.registerNo?.toLowerCase().includes(globalSearchTerm.toLowerCase())
    ).slice(0, 10);
  }, [globalSearchTerm, students]);

  const studentLateCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    for (const record of records) { 
        if (record.studentId) {
            counts[record.studentId] = (counts[record.studentId] || 0) + 1;
        }
    }
    return counts;
  }, [records]);

  const handleGlobalSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalSearchTerm(e.target.value);
    if (e.target.value.length > 0) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  };

  const handleStudentSelect = (student: Student) => {
    setGlobalSearchTerm('');
    setShowSearchResults(false);
    const history = records.filter(
      (record) => record.studentId === student.id
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setSelectedStudentForHistory(student);
    setSelectedStudentHistory(history);
  };

  const handleRowClick = (record: AttendanceRecord) => {
    const student = students.find(s => s.id === record.studentId);
    if (student) {
        handleStudentSelect(student);
    }
  };

  const availableClasses = useMemo(() => {
    if (departmentFilter === 'all') {
      return classes;
    }
    const dept = departments.find(d => d.id === departmentFilter);
    if (!dept) return [];
    return classes.filter(c => c.departmentId === dept.id);
  }, [departmentFilter, departments, classes]);
  
  const filteredRecords = useMemo(() => {
    return records
      .filter((record) =>
        record.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (record.registerNo && record.registerNo.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .filter((record) =>
        departmentFilter === "all" || record.departmentName === departments.find(d => d.id === departmentFilter)?.name
      )
      .filter((record) =>
        classFilter === "all" || record.className === classes.find(c => c.id === classFilter)?.name
      )
      .filter((record) =>
        statusFilter === "all" || record.status === statusFilter
      )
      .filter((record) => {
        if (!selectedDate) {
          return true;
        }
        try {
          return isSameDay(new Date(record.timestamp), selectedDate);
        } catch (e) {
          console.error("Error filtering by date:", e);
          return true;
        }
      })
      .sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return dateB - dateA;
      });
      
  }, [records, searchTerm, departmentFilter, classFilter, statusFilter, selectedDate, departments, classes, students]);
  
  const handleExportExcel = () => {
    const recordsToExport = filteredRecords.map((record, index) => {
      const student = students.find(s => s.id === record.studentId);
      return {
        "S.No.": index + 1,
        "Register No": record.registerNo,
        "Student Name": record.studentName,
        "Gender": record.gender,
        "Department": record.departmentName,
        "Class": record.className,
        "Mentor": student?.mentor || 'N/A',
        "Date": record.date,
        "Time": record.time,
        "Status": record.status,
        "Total Late Entries": studentLateCounts[record.studentId] || 0,
      }
    });
    exportToXlsx("late-records.xlsx", recordsToExport);
  };

   const handleExportCsv = () => {
    const recordsToExport = filteredRecords.map((record, index) => {
      const student = students.find(s => s.id === record.studentId);
      return {
        "S.No.": index + 1,
        "Register No": record.registerNo,
        "Student Name": record.studentName,
        "Gender": record.gender,
        "Department": record.departmentName,
        "Class": record.className,
        "Mentor": student?.mentor || 'N/A',
        "Date": record.date,
        "Time": record.time,
        "Status": record.status,
        "Total Late Entries": studentLateCounts[record.studentId] || 0,
      }
    });
    exportToCsv("late-records.csv", recordsToExport);
  };
  
 const handleExportPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let contentY = 10;
  
    const drawContent = () => {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("ACADEMIC YEAR 2025-2026 (ODD SEMESTER)", pageWidth / 2, contentY, { align: "center" });
        contentY += 16;
    
        doc.setFontSize(16);
        const mainTitle = "STUDENTS LATE REPORT";
        doc.text(mainTitle, pageWidth / 2, contentY, { align: "center" });
    
        const textWidth = doc.getTextWidth(mainTitle);
        doc.setLineWidth(0.5);
        doc.line((pageWidth - textWidth) / 2, contentY + 1, (pageWidth + textWidth) / 2, contentY + 1);
        contentY += 8;
    
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        const dateText = `Date: ${selectedDate ? format(selectedDate, 'PPP') : 'N/A'}`;
        doc.text(dateText, pageWidth / 2, contentY, { align: 'center' });
        contentY += 10;
    
        autoTable(doc, {
          startY: contentY,
          head: [['S.No.', 'Register No.', 'Student Name', 'Gender', 'Department', 'Class', 'Mentor', 'Date', 'Time', 'Status', 'Total Late Entries']],
          body: filteredRecords.map((record, index) => {
              const student = students.find(s => s.id === record.studentId);
              return [
                index + 1,
                record.registerNo,
                record.studentName,
                record.gender,
                record.departmentName,
                record.className,
                student?.mentor || 'N/A',
                record.date,
                record.time,
                record.status,
                (studentLateCounts[record.studentId] || 0).toString(),
              ]
          }),
          headStyles: { fillColor: [30, 58, 138], lineColor: [44, 62, 80], lineWidth: 0.1 },
          styles: { cellPadding: 2, fontSize: 8, lineColor: [44, 62, 80], lineWidth: 0.1 },
        });
    
        doc.save(`Late-Entry-Report-${format(selectedDate || new Date(), 'dd-MM-yyyy')}.pdf`);
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
            contentY += imgHeight;
            drawContent();
        };
        img.onerror = () => {
            console.error("Error loading image for PDF.");
            drawContent(); // Proceed without the image if it fails
        };
      } catch (e) {
        console.error("Error adding image to PDF:", e);
        drawContent();
      }
    } else {
        drawContent();
    }
  };


  const getStatusClass = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'Informed':
        return 'bg-green-100 text-green-800';
      case 'Not Informed':
        return 'bg-yellow-100 text-yellow-800';
      case 'Letter Given':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                   <CardTitle className="font-headline text-2xl">Attendance Records</CardTitle>
                  <CardDescription>Search for any student to view their history, or filter the records table below.</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleExportExcel} size="sm" variant="outline">
                      <FileDown className="mr-2 h-4 w-4" />
                      Export Excel
                  </Button>
                  <Button onClick={handleExportCsv} size="sm" variant="outline">
                      <FileDown className="mr-2 h-4 w-4" />
                      Export CSV
                  </Button>
                   <Button onClick={handleExportPdf} size="sm" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Export PDF
                  </Button>
              </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6">
            <div ref={searchRef} className="relative w-full max-w-lg mx-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search any student by name or register no..."
                className="pl-8 w-full"
                value={globalSearchTerm}
                onChange={handleGlobalSearchChange}
                onFocus={() => globalSearchTerm && setShowSearchResults(true)}
              />
              {showSearchResults && globalSearchResults.length > 0 && (
                <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
                  <CardContent className="p-2">
                    {globalSearchResults.map(student => (
                      <div key={student.id} onClick={() => handleStudentSelect(student)} className="p-2 hover:bg-accent/50 rounded-md cursor-pointer text-sm">
                        <p className="font-semibold">{student.name}</p>
                        <p className="text-xs text-muted-foreground">{student.registerNo} - {students.find(s=> s.id === student.id)?.classId}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            <Separator />
            <p className="text-sm text-center text-muted-foreground">Or, filter the attendance records table:</p>
            
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-grow min-w-[150px] sm:min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Filter current records..."
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                 <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full sm:w-auto flex-grow min-w-[150px]",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? (
                           format(selectedDate, "LLL dd, y")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger className="w-full sm:w-auto flex-grow min-w-[150px]">
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
                        <SelectTrigger className="w-full sm:w-auto flex-grow min-w-[150px]">
                          <SelectValue placeholder="Class" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">All Classes</SelectItem>
                          {availableClasses.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                   <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-auto flex-grow min-w-[150px]">
                          <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="Informed">Informed</SelectItem>
                          <SelectItem value="Not Informed">Not Informed</SelectItem>
                          <SelectItem value="Letter Given">Letter Given</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
          </div>


          <div className="rounded-lg border">
            <Table className="table-alternating-rows">
              <TableHeader>
                <TableRow>
                  <TableHead>S.No.</TableHead>
                  <TableHead>Register No.</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Mentor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Late Entries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                              <TableCell colSpan={11}><Skeleton className="h-6" /></TableCell>
                          </TableRow>
                      ))
                  ) : filteredRecords.length > 0 ? (
                      filteredRecords.map((record, index) => {
                        const student = students.find(s => s.id === record.studentId);
                        return (
                        <TableRow key={record.id} onClick={() => handleRowClick(record)} className="cursor-pointer">
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{record.registerNo || "N/A"}</TableCell>
                            <TableCell className="font-medium">{record.studentName}</TableCell>
                            <TableCell>{record.gender}</TableCell>
                            <TableCell>{record.departmentName}</TableCell>
                            <TableCell>{record.className}</TableCell>
                            <TableCell>{student?.mentor || 'N/A'}</TableCell>
                            <TableCell>{record.date}</TableCell>
                            <TableCell>{record.time}</TableCell>
                             <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(record.status)}`}>
                                    {record.status}
                                </span>
                            </TableCell>
                            <TableCell>
                                <span className={`font-bold ${ (studentLateCounts[record.studentId] || 0) >= 3 ? 'text-destructive' : 'text-primary'}`}>{studentLateCounts[record.studentId] || 0}</span>
                            </TableCell>
                        </TableRow>
                      )})
                  ) : (
                       <TableRow>
                          <TableCell colSpan={11} className="text-center">
                              No records found for the selected filters.
                          </TableCell>
                      </TableRow>
                  )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {selectedStudentHistory && selectedStudentForHistory && (
        <Dialog open={!!selectedStudentHistory} onOpenChange={(isOpen) => {
            if (!isOpen) {
                setSelectedStudentHistory(null);
                setSelectedStudentForHistory(null);
            }
        }}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-6 w-6" /> 
                Late Entry History for {selectedStudentForHistory.name}
              </DialogTitle>
              <DialogDescription>
                Register No: {selectedStudentForHistory.registerNo || "N/A"} | Total late entries: {studentLateCounts[selectedStudentForHistory.id] || 0}
              </DialogDescription>
            </DialogHeader>
             {selectedStudentHistory.length > 0 ? (
                <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Marked By</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {selectedStudentHistory.map((entry) => (
                        <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.time}</TableCell>
                        <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(entry.status)}`}>
                            {entry.status}
                            </span>
                        </TableCell>
                        <TableCell>{entry.markedBy}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>
            ) : (
                <div className="text-center p-8">
                    <p>No late entries found for this student.</p>
                </div>
             )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
