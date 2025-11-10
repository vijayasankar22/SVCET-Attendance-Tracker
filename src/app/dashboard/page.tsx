

"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, Timestamp, writeBatch, doc, where, runTransaction, increment } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { EntryForm } from './_components/entry-form';
import type { AttendanceRecord, Department, Class, Student, WorkingDay, AttendanceSubmission } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { StrengthSummary } from './_components/strength-summary';
import { AttendanceStatus } from './_components/attendance-status';
import { format, isSunday } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { AbsenteesList } from './_components/absentees-list';

export default function DashboardPage() {
  const { firestore: db } = useFirebase();
  const { staff, isUserLoading } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [submissions, setSubmissions] = useState<AttendanceSubmission[]>([]);
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!staff) return; // Wait until staff is loaded
    
    const fetchInitialData = async () => {
      try {
        setInitialDataLoading(true);

        const deptsPromise = getDocs(query(collection(db, 'departments'), orderBy('name')));
        const classesPromise = getDocs(query(collection(db, 'classes'), orderBy('name')));
        const workDaysPromise = getDocs(query(collection(db, 'workingDays')));
        const submissionsPromise = getDocs(query(collection(db, 'attendanceSubmissions'), orderBy('submittedAt', 'desc')));
        
        let studentsPromise;
        if (staff.role === 'teacher' && staff.classId) {
            studentsPromise = getDocs(query(collection(db, 'students'), where('classId', '==', staff.classId)));
        } else {
            studentsPromise = getDocs(query(collection(db, 'students')));
        }
        const recordsPromise = getDocs(query(collection(db, 'attendanceRecords'), orderBy('timestamp', 'desc')));

        const [depts, clss, studs, recs, workDays, subs] = await Promise.all([
          deptsPromise, classesPromise, studentsPromise, recordsPromise, workDaysPromise, submissionsPromise
        ]);

        const deptsData = depts.docs.map(doc => ({id: doc.id, ...doc.data()} as Department));
        const clssData = clss.docs.map(doc => ({id: doc.id, ...doc.data()} as Class));
        const studsData = studs.docs.map(doc => ({id: doc.id, ...doc.data()} as Student));
        const subsData = subs.docs.map(doc => ({id: doc.id, ...doc.data()} as AttendanceSubmission));
        
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

        setDepartments(deptsData);
        setClasses(clssData);
        setStudents(studsData);
        setRecords(filteredRecords);
        setWorkingDays(workDaysData);
        setSubmissions(subsData);

        if (deptsData.length === 0) {
            toast({
                variant: "destructive",
                title: "Data Missing",
                description: "No departments found. Please seed the database from the /seed page.",
            });
        }

      } catch (error) {
        console.error("Error fetching initial data: ", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch data from the database. Please ensure Firestore is set up correctly and you have seeded the data.",
        });
      } finally {
        setInitialDataLoading(false);
      }
    };
    
    fetchInitialData();
  }, [staff, db, toast]);

  const teacherData = useMemo(() => {
    if (!staff || staff.role !== 'teacher' || !staff.classId) return null;
    
    const teacherClass = classes.find(c => c.id === staff.classId);
    if (!teacherClass) return null;

    const teacherDepartment = departments.find(d => d.id === teacherClass.departmentId);
    if (!teacherDepartment) return null;

    return {
      department: [teacherDepartment],
      class: [teacherClass],
      studentsInClass: students.filter(s => s.classId === staff.classId)
    }
  }, [staff, classes, departments, students]);


  const handleAddRecords = async (newRecords: Omit<AttendanceRecord, 'id' | 'timestamp'>[], submissionData: Omit<AttendanceSubmission, 'id'>) => {
    try {
      const batch = writeBatch(db);
      const timestamp = new Date();

      const recordsWithTimestamp = newRecords.map(record => {
        const docRef = doc(collection(db, 'attendanceRecords'));
        const newRecord = { ...record, timestamp };
        batch.set(docRef, newRecord);
        return { ...newRecord, id: docRef.id };
      });
      
      const submissionId = `${submissionData.classId}_${submissionData.date}`;
      const submissionRef = doc(db, 'attendanceSubmissions', submissionId);
      const newSubmission = { ...submissionData, submittedAt: timestamp };
      batch.set(submissionRef, newSubmission);

      await batch.commit();

      setRecords(prev => [...recordsWithTimestamp, ...prev].sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()));
      setSubmissions(prev => [{...newSubmission, id: submissionId}, ...prev].sort((a, b) => (b.submittedAt as any) - (a.submittedAt as any)));

      return true;
    } catch (error) {
      console.error("Error adding documents: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save the new records.",
      });
      return false;
    }
  };

  const handleUpdateRecord = async (recordId: string, classId: string, date: string) => {
    try {
        await runTransaction(db, async (transaction) => {
            const recordRef = doc(db, 'attendanceRecords', recordId);
            const submissionRef = doc(db, 'attendanceSubmissions', `${classId}_${date}`);

            // Delete the absentee record
            transaction.delete(recordRef);

            // Atomically update the submission summary
            transaction.update(submissionRef, {
                absentCount: increment(-1),
                presentCount: increment(1),
            });
        });

        // Update local state for immediate UI feedback
        setRecords(prev => prev.filter(r => r.id !== recordId));
        setSubmissions(prev => prev.map(s => {
            if (s.id === `${classId}_${date}`) {
                return { ...s, absentCount: s.absentCount - 1, presentCount: s.presentCount + 1 };
            }
            return s;
        }));

        toast({ title: "Success", description: "Student marked as present." });
    } catch (error) {
        console.error("Error updating attendance:", error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to update attendance." });
    }
  };
  
  if (isUserLoading || initialDataLoading) {
      return (
        <div className="space-y-8">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <div className="mt-8 space-y-8">
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-80 w-full" />
            </div>
        </div>
      )
  }

  if (!staff) {
    // This case should be handled by the layout redirect, but it's a good safeguard.
    return null; 
  }

  return (
    <div className="space-y-8">
       <div className="mb-8">
        <h1 className="text-3xl font-bold font-headline">Welcome, {staff.name}!</h1>
        <p className="text-muted-foreground">
          {staff.role === 'teacher' 
            ? "Please mark attendance for your class." 
            : "Here's your daily attendance overview."}
        </p>
      </div>

      {staff.role === 'teacher' ? (
        teacherData && (
          <EntryForm 
            onAddRecords={handleAddRecords}
            departments={teacherData.department}
            classes={teacherData.class}
            students={teacherData.studentsInClass}
            workingDays={workingDays}
            submissions={submissions}
          />
        )
      ) : (
        <div className="space-y-8">
            <StrengthSummary records={records} students={students} classes={classes} departments={departments} />
            <AttendanceStatus submissions={submissions} classes={classes} departments={departments} workingDays={workingDays} />
            <AbsenteesList
              records={records}
              onRecordUpdate={handleUpdateRecord}
              user={staff}
              departments={departments}
              classes={classes}
              students={students}
            />
        </div>
      )}
    </div>
  );
}
