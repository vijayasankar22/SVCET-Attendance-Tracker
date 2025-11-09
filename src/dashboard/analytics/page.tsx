
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import type { AttendanceRecord, Class, Department, Student, WorkingDay } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DayWiseChart } from './_components/day-wise-chart';
import { useAuth } from '@/context/auth-context';
import { AbsenteesList } from './_components/absentees-list';
import { Separator } from '@/components/ui/separator';
import { DepartmentWiseChart } from './_components/department-wise-chart';
import { format, isSunday } from 'date-fns';
import { ClassWiseReport } from './_components/class-wise-report';
import { MonthlyClassReport } from './_components/monthly-class-report';
import { MonthlyDetailedReport } from './_components/monthly-detailed-report';

export default function AnalyticsPage() {
  const { user, staff } = useAuth();
  const { firestore: db } = useFirebase();
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

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
            // This is less efficient, but necessary without composite indexes or duplicating classId on records
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
        let studsData = studs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
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
        
        // If teacher, filter records to only include their students
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
  }, [toast, user, staff, db]);

  return (
    <div className="space-y-8">
      <div className='flex items-center justify-between'>
        <div className='space-y-1'>
            <h1 className="text-2xl font-headline font-bold">Attendance Analytics</h1>
            <CardDescription>View daily attendance summary and absentee list for all students.</CardDescription>
        </div>
      </div>
     
      <div className={`grid grid-cols-1 ${staff?.role === 'admin' ? 'lg:grid-cols-2' : ''} gap-8`}>
        <Card>
            <CardContent className="pt-6">
                {loading ? (
                    <Skeleton className="h-[450px] w-full" />
                ) : (
                    <DayWiseChart 
                      records={allRecords} 
                      students={students}
                      user={staff}
                      departments={departments}
                      classes={classes}
                      workingDays={workingDays}
                    />
                )}
            </CardContent>
        </Card>

        {staff?.role === 'admin' && (
          <Card>
              <CardContent className="pt-6">
                  {loading ? (
                      <Skeleton className="h-[450px] w-full" />
                  ) : (
                      <DepartmentWiseChart 
                        records={allRecords} 
                        students={students}
                        departments={departments}
                        workingDays={workingDays}
                      />
                  )}
              </CardContent>
          </Card>
        )}
      </div>
      
       <Separator />

      <Card>
        <CardContent className="pt-6">
            {loading ? (
                 <Skeleton className="h-[200px] w-full" />
            ) : (
                <AbsenteesList 
                    records={allRecords}
                    user={staff}
                    departments={departments}
                    classes={classes}
                    students={students}
                />
            )}
        </CardContent>
      </Card>

       <Separator />

       <Card>
        <CardContent className="pt-6">
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <MonthlyDetailedReport
              user={staff}
              departments={departments}
              classes={classes}
              students={students}
              records={allRecords}
              workingDays={workingDays}
            />
          )}
        </CardContent>
      </Card>
      
      <Separator />

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <MonthlyClassReport
              user={staff}
              departments={departments}
              classes={classes}
              students={students}
              records={allRecords}
              workingDays={workingDays}
            />
          )}
        </CardContent>
      </Card>
      
      <Separator />

      <Card>
        <CardContent className="pt-6">
            {loading ? (
                 <Skeleton className="h-[200px] w-full" />
            ) : (
                <ClassWiseReport 
                    user={staff}
                    departments={departments}
                    classes={classes}
                    students={students}
                    records={allRecords}
                    workingDays={workingDays}
                />
            )}
        </CardContent>
      </Card>
    </div>
  );
}
