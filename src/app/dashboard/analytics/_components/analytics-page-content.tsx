
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import type { AttendanceRecord, Class, Department, Student, WorkingDay, Staff } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DayWiseChart } from './day-wise-chart';
import { AbsenteesList } from './absentees-list';
import { Separator } from '@/components/ui/separator';
import { DepartmentWiseChart } from './department-wise-chart';
import { format, isSunday } from 'date-fns';
import { ClassWiseReport } from './class-wise-report';
import { MonthlyClassReport } from './monthly-class-report';
import { MonthlyDetailedReport } from './monthly-detailed-report';

type AnalyticsPageContentProps = {
  staff: Staff;
};

export function AnalyticsPageContent({ staff }: AnalyticsPageContentProps) {
  const { firestore: db } = useFirebase();
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Staff is guaranteed to exist here by the parent component
    const fetchInitialData = async () => {
      try {
        setLoading(true);

        const deptsPromise = getDocs(query(collection(db, 'departments')));
        const classesPromise = getDocs(query(collection(db, 'classes')));
        const workDaysPromise = getDocs(query(collection(db, 'workingDays')));
        
        let studentsPromise;
        let recordsPromise;

        if (staff?.role === 'teacher' && staff.classId) {
            studentsPromise = getDocs(query(collection(db, 'students'), where('classId', '==', staff.classId)));
            recordsPromise = getDocs(query(collection(db, 'attendanceRecords'), orderBy('timestamp', 'desc')));
        } else {
            studentsPromise = getDocs(query(collection(db, 'students')));
            recordsPromise = getDocs(query(collection(db, 'attendanceRecords'), orderBy('timestamp', 'desc')));
        }

        const [depts, clss, workDays, studs, recs] = await Promise.all([
            deptsPromise,
            classesPromise,
            workDaysPromise,
            studentsPromise,
            recordsPromise,
        ]);
        
        const deptsData = depts.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
        const clssData = clss.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
        const studsData = studs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        const workDaysData = workDays.docs.map(doc => {
          const data = doc.data();
          const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp);
          return { id: doc.id, ...data, timestamp } as WorkingDay;
        });
        
        let fetchedRecords: AttendanceRecord[] = recs.docs.map((doc) => {
          const data = doc.data();
          const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp);
          return { id: doc.id, ...data, timestamp: timestamp } as AttendanceRecord;
        });
        
        if (staff?.role === 'teacher') {
            const studentIdsInClass = studsData.map(s => s.id);
            fetchedRecords = fetchedRecords.filter(r => studentIdsInClass.includes(r.studentId));
        }

        const workingDaysMap = new Map<string, boolean>();
        workDaysData.forEach(wd => {
            workingDaysMap.set(format(wd.timestamp, 'yyyy-MM-dd'), wd.isWorkingDay);
        });

        const filteredRecords = fetchedRecords.filter(record => {
            const recordDate = record.timestamp;
            const dateKey = format(recordDate, 'yyyy-MM-dd');
            if (isSunday(recordDate)) return false;
            return workingDaysMap.get(dateKey) ?? false;
        });

        setAllRecords(filteredRecords);
        setStudents(studsData);
        setDepartments(deptsData);
        setClasses(clssData);
        setWorkingDays(workDaysData);

      } catch (error) {
        console.error("Error fetching initial data: ", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch data for analytics. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [staff, db, toast]);
  
  if (loading) {
    return (
        <div className="space-y-8">
            <Skeleton className="h-12 w-1/3" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Skeleton className="h-[450px] w-full" />
                <Skeleton className="h-[450px] w-full" />
            </div>
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
        </div>
    )
  }

  const isAdminOrViewer = staff?.role === 'admin' || staff?.role === 'viewer';

  return (
    <div className="space-y-8">
      <div className='flex items-center justify-between'>
        <div className='space-y-1'>
            <h1 className="text-2xl font-headline font-bold">Attendance Analytics</h1>
            <CardDescription>View daily attendance summary and absentee list for all students.</CardDescription>
        </div>
      </div>
     
      <div className={`grid grid-cols-1 ${isAdminOrViewer ? 'lg:grid-cols-2' : ''} gap-8`}>
        <Card>
            <CardContent className="pt-6">
                <DayWiseChart 
                  records={allRecords} 
                  students={students}
                  user={staff}
                  departments={departments}
                  classes={classes}
                  workingDays={workingDays}
                />
            </CardContent>
        </Card>

        {isAdminOrViewer && (
          <Card>
              <CardContent className="pt-6">
                  <DepartmentWiseChart 
                    records={allRecords} 
                    students={students}
                    departments={departments}
                    workingDays={workingDays}
                  />
              </CardContent>
          </Card>
        )}
      </div>
      
       <Separator />

      <Card>
        <CardContent className="pt-6">
            <AbsenteesList 
                records={allRecords}
                user={staff}
                departments={departments}
                classes={classes}
                students={students}
            />
        </CardContent>
      </Card>

       <Separator />

       <Card>
        <CardContent className="pt-6">
            <MonthlyDetailedReport
              user={staff}
              departments={departments}
              classes={classes}
              students={students}
              records={allRecords}
              workingDays={workingDays}
            />
        </CardContent>
      </Card>
      
      <Separator />

      <Card>
        <CardContent className="pt-6">
            <MonthlyClassReport
              user={staff}
              departments={departments}
              classes={classes}
              students={students}
              records={allRecords}
              workingDays={workingDays}
            />
        </CardContent>
      </Card>
      
      <Separator />

      <Card>
        <CardContent className="pt-6">
            <ClassWiseReport 
                user={staff}
                departments={departments}
                classes={classes}
                students={students}
                records={allRecords}
                workingDays={workingDays}
            />
        </CardContent>
      </Card>
    </div>
  );
}
