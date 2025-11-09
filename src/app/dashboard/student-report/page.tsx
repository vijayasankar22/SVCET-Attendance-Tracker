
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import type { AttendanceRecord, Student, WorkingDay } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { StudentAttendanceGrid } from '../_components/student-attendance-grid';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isSunday } from 'date-fns';
import { useAuth } from '@/context/auth-context';

export default function StudentReportPage() {
  const { firestore: db } = useFirebase();
  const { staff } = useAuth();
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const { toast } = useToast();

  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!staff) return;
      try {
        setInitialDataLoading(true);
        
        let studentsPromise;
        if (staff.role === 'teacher' && staff.classId) {
            studentsPromise = getDocs(query(collection(db, 'students'), where('classId', '==', staff.classId)));
        } else {
            studentsPromise = getDocs(query(collection(db, 'students'), orderBy('name')));
        }
        
        const [studs, recs, workDays] = await Promise.all([
          studentsPromise,
          getDocs(query(collection(db, 'attendanceRecords'), orderBy('timestamp', 'desc'))),
          getDocs(query(collection(db, 'workingDays')))
        ]);

        let studsData = studs.docs.map(doc => ({id: doc.id, ...doc.data()} as Student));
        const recsData = recs.docs.map(doc => {
            const data = doc.data();
            const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp);
            return { id: doc.id, ...data, timestamp } as AttendanceRecord;
        });
        const workDaysData = workDays.docs.map(doc => {
            const data = doc.data();
            const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp);
            return { id: doc.id, ...data, timestamp } as WorkingDay;
        });

        const workingDaysMap = new Map<string, boolean>();
        workDaysData.forEach(wd => {
            workingDaysMap.set(format(wd.timestamp, 'yyyy-MM-dd'), wd.isWorkingDay);
        });

        const filteredRecords = recsData.filter(record => {
            const recordDate = record.timestamp;
            const dateKey = format(recordDate, 'yyyy-MM-dd');
            if (isSunday(recordDate)) return false;
            return workingDaysMap.get(dateKey) ?? false;
        });

        setAllStudents(studsData);
        setRecords(filteredRecords);
        setWorkingDays(workDaysData);

      } catch (error) {
        console.error("Error fetching report data: ", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch data for the report.",
        });
      } finally {
        setInitialDataLoading(false);
      }
    };

    fetchInitialData();
  }, [toast, db, staff]);

  const globalSearchResults = useMemo(() => {
    if (!globalSearchTerm) return [];
    return allStudents.filter(student =>
      student.name.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
      student.registerNo?.toLowerCase().includes(globalSearchTerm.toLowerCase())
    ).slice(0, 10);
  }, [globalSearchTerm, allStudents]);

  const handleGlobalSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalSearchTerm(e.target.value);
    if (e.target.value.length > 0) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
      setSelectedStudent(null);
    }
  };

  const handleStudentSelect = (student: Student) => {
    setGlobalSearchTerm('');
    setShowSearchResults(false);
    setSelectedStudent(student);
  };
  
  const studentRecords = useMemo(() => {
      if (!selectedStudent) return [];
      return records.filter(r => r.studentId === selectedStudent.id);
  }, [selectedStudent, records]);
  
  if (initialDataLoading) {
      return (
          <div className="space-y-6">
              <Skeleton className="h-10 w-1/3" />
              <Card>
                  <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
                  <CardContent><Skeleton className="h-96 w-full" /></CardContent>
              </Card>
          </div>
      )
  }

  return (
    <div className="space-y-6">
        <div className='flex items-center justify-between'>
            <div className='space-y-1'>
                <h1 className="text-2xl font-headline font-bold">Student Attendance Report</h1>
                <CardDescription>
                  {staff?.role === 'teacher' ? 'Search for a student in your class to view their yearly attendance.' : 'Search for any student to view their yearly attendance summary.'}
                </CardDescription>
            </div>
        </div>
      <Card>
        <CardContent className="pt-6">
           <div className="relative w-full max-w-lg mx-auto mb-6">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={staff?.role === 'teacher' ? 'Search students in your class...' : 'Search any student...'}
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
                        <p className="text-xs text-muted-foreground">{student.registerNo}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
            {selectedStudent ? (
                <StudentAttendanceGrid student={selectedStudent} records={studentRecords} workingDays={workingDays} />
            ) : (
                <div className="text-center text-muted-foreground py-12">
                    <p>Search for a student to view their report.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
