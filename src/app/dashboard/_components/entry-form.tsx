
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Info, Users, CalendarX2, CheckCircle, UserCheck, UserX } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { query, collection, where, getDocs, Timestamp } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { AttendanceRecord, Department, Class, Student, WorkingDay, AttendanceSubmission } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/auth-context';
import { useFirebase } from '@/firebase';

const studentAttendanceSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  registerNo: z.string(),
  gender: z.enum(['MALE', 'FEMALE']),
  status: z.enum(['Present', 'Absent']),
});

const formSchema = z.object({
  departmentId: z.string().min(1, 'Please select a department.'),
  classId: z.string().min(1, 'Please select a class.'),
  students: z.array(studentAttendanceSchema),
});

type EntryFormProps = {
  onAddRecords: (records: Omit<AttendanceRecord, 'id' | 'timestamp'>[], submissionData: Omit<AttendanceSubmission, 'id'>) => Promise<boolean>;
  departments: Department[];
  classes: Class[];
  students: Student[];
  workingDays: WorkingDay[];
  submissions: AttendanceSubmission[];
};

type SubmissionDetails = {
    present: number;
    absent: number;
    total: number;
} | null;

export function EntryForm({ onAddRecords, departments, classes, students, workingDays, submissions }: EntryFormProps) {
  const { staff } = useAuth();
  const { firestore: db } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);
  const [submissionDetails, setSubmissionDetails] = useState<SubmissionDetails>(null);


  const isTodayWorkingDay = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const todaySetting = workingDays.find(d => d.id === todayKey);
    return todaySetting?.isWorkingDay || false; 
  }, [workingDays]);

  const isTeacher = staff?.role === 'teacher';
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      departmentId: '',
      classId: '',
      students: [],
    },
  });
  
  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "students",
  });
  
  const selectedDepartmentId = form.watch('departmentId');
  const selectedClassId = form.watch('classId');

  useEffect(() => {
    const checkSubmissionStatus = async () => {
        if (!selectedClassId || !selectedDepartmentId) {
            setIsAlreadySubmitted(false);
            setSubmissionDetails(null);
            return;
        }

        const selectedClass = classes.find(c => c.id === selectedClassId);
        const selectedDept = departments.find(d => d.id === selectedDepartmentId);
        if (!selectedClass || !selectedDept) return;
        
        const todayDateString = format(new Date(), 'yyyy-MM-dd');
        const todaysSubmission = submissions.find(s => s.classId === selectedClassId && s.date === todayDateString);

        if (todaysSubmission) {
            const studentsInClass = students.filter(s => s.classId === selectedClass.id).length;
            setSubmissionDetails({ 
                present: todaysSubmission.presentCount, 
                absent: todaysSubmission.absentCount, 
                total: studentsInClass 
            });
            setIsAlreadySubmitted(true);
        } else {
            setIsAlreadySubmitted(false);
            setSubmissionDetails(null);
        }
    };
    checkSubmissionStatus();
  }, [selectedClassId, selectedDepartmentId, submissions, classes, departments, students]);


  useEffect(() => {
    if (isTeacher && staff?.classId) {
      const teacherClass = classes.find(c => c.id === staff.classId);
      if (teacherClass) {
        form.setValue('departmentId', teacherClass.departmentId, { shouldValidate: true });
        form.setValue('classId', teacherClass.id, { shouldValidate: true });
      }
    }
  }, [isTeacher, classes, staff?.classId, form]);

  const availableClasses = useMemo(() => {
    if (isTeacher) return classes.filter(c => c.id === staff?.classId);
    if (!selectedDepartmentId) return [];
    return classes.filter(c => c.departmentId === selectedDepartmentId);
  }, [selectedDepartmentId, classes, isTeacher, staff?.classId]);
  
  const classStudents = useMemo(() => {
    const classIdToFilter = isTeacher ? staff?.classId : selectedClassId;
    if (!classIdToFilter) return [];
    return students.filter(s => s.classId === classIdToFilter).sort((a,b) => (a.registerNo || a.name).localeCompare(b.registerNo || b.name));
  }, [selectedClassId, students, isTeacher, staff?.classId]);

  useEffect(() => {
    const studentData = classStudents.map(student => ({
        studentId: student.id,
        studentName: student.name,
        registerNo: student.registerNo || 'N/A',
        gender: student.gender,
        status: 'Present' as 'Present' | 'Absent',
    }));
    replace(studentData);
  }, [classStudents, replace]);


  async function onSubmit(values: z.infer<typeof formSchema>) {

    if (!isTodayWorkingDay) {
        toast({ variant: "destructive", title: "Holiday", description: "Cannot mark attendance on a holiday." });
        return;
    }
    
    if (isAlreadySubmitted) {
         toast({
            variant: "default",
            title: "Already Submitted",
            description: `Attendance has already been submitted for this class today.`,
        });
        return;
    }
    
    setIsSubmitting(true);
    const absentStudents = values.students.filter(s => s.status === 'Absent');
    const presentStudentsCount = values.students.length - absentStudents.length;
    
    const department = departments.find((d) => d.id === values.departmentId);
    const cls = classes.find((c) => c.id === values.classId);

    if (!department || !cls) {
        toast({ variant: "destructive", title: "Error", description: "Could not find class or department information." });
        setIsSubmitting(false);
        return;
    }

    const now = new Date();
    const dateString = format(now, 'yyyy-MM-dd');
    
    const submissionData: Omit<AttendanceSubmission, 'id'> = {
        classId: cls.id,
        departmentId: department.id,
        date: dateString,
        submittedBy: staff?.id || 'unknown',
        submittedAt: Timestamp.now(),
        presentCount: presentStudentsCount,
        absentCount: absentStudents.length,
    }

    const newRecords = absentStudents.map(student => ({
        studentId: student.studentId,
        studentName: student.studentName,
        registerNo: student.registerNo,
        gender: student.gender,
        departmentName: department.name,
        className: cls.name,
        date: dateString,
        time: format(now, 'hh:mm:ss a'),
        markedBy: staff?.name || 'Unknown',
        status: 'Not Informed' as 'Informed' | 'Not Informed' | 'Letter Given',
    }));
    
    const success = await onAddRecords(newRecords, submissionData);

    if (success) {
        toast({
            title: 'Success!',
            description: `Attendance submitted for ${cls.name}. ${absentStudents.length} absent, ${presentStudentsCount} present.`,
        });
        
        if (!isTeacher) {
            form.reset({ departmentId: '', classId: '', students: [] });
            replace([]);
        }
    }
    setIsSubmitting(false);
  }
  
  const isFormDisabled = isSubmitting || !isTodayWorkingDay || isAlreadySubmitted;
  const assignedClass = isTeacher ? classes.find(c => c.id === staff?.classId) : null;
  const assignedDepartment = isTeacher && assignedClass ? departments.find(d => d.id === assignedClass.departmentId) : null;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Mark Class Attendance</CardTitle>
        <CardDescription>
          {isTeacher && assignedClass ? `You are assigned to class: ${assignedClass.name} (${assignedDepartment?.name})` : 'Select a department and class to take attendance.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isTodayWorkingDay && (
             <Alert variant="destructive" className="mb-6">
              <CalendarX2 className="h-4 w-4" />
              <AlertTitle>Today is a Holiday!</AlertTitle>
              <AlertDescription>
                You cannot mark attendance on a holiday. Please contact an administrator to mark today as a working day if this is incorrect.
              </AlertDescription>
            </Alert>
        )}
         {isAlreadySubmitted && submissionDetails && (
             <Alert variant="default" className="mb-6 bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:text-green-200 dark:border-green-800 [&>svg]:text-green-600">
                <div className="flex flex-col space-y-4">
                    <div className="flex items-start">
                        <CheckCircle className="h-4 w-4 mt-1" />
                        <div className="ml-4">
                            <AlertTitle>Attendance Already Submitted</AlertTitle>
                            <AlertDescription>
                                Attendance has been marked for this class today.
                            </AlertDescription>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">Total Present</CardTitle>
                                <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-800 dark:text-green-200">{submissionDetails.present}</div>
                                <p className="text-xs text-green-700 dark:text-green-300">out of {submissionDetails.total} students</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-red-800 dark:text-red-200">Total Absent</CardTitle>
                                <UserX className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-800 dark:text-red-200">{submissionDetails.absent}</div>
                                <p className="text-xs text-red-700 dark:text-red-300">out of {submissionDetails.total} students</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {!isTeacher && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select 
                          onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("classId", "");
                              replace([]);
                          }} 
                          value={field.value} 
                          disabled={isSubmitting || !isTodayWorkingDay}
                      >
                      <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isTeacher && assignedDepartment ? assignedDepartment.name : "Select Department"} />
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                          ))}
                      </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="classId"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Class</FormLabel>
                      <Select 
                          onValueChange={field.onChange} 
                          value={field.value} 
                          disabled={!selectedDepartmentId || isSubmitting || !isTodayWorkingDay}
                      >
                      <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isTeacher && assignedClass ? assignedClass.name : "Select Class"} />
                            </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {availableClasses.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                          ))}
                      </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              </div>
            )}

            {fields.length > 0 && (
                <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary"/>
                        <h3 className="text-lg font-medium">Student List</h3>
                    </div>
                    <div className="rounded-md border max-h-[50vh] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                    <TableHead>Student Name</TableHead>
                                    <TableHead className="text-right">Attendance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell className="font-medium">{(form.getValues(`students.${index}.studentName`))}</TableCell>
                                        <TableCell className="text-right">
                                            <FormField
                                                control={form.control}
                                                name={`students.${index}.status`}
                                                render={({ field: switchField }) => (
                                                    <FormItem className="flex items-center justify-end">
                                                        <FormControl>
                                                            <Switch
                                                                id={`status-${field.id}`}
                                                                checked={switchField.value === 'Present'}
                                                                onCheckedChange={(checked) => {
                                                                    switchField.onChange(checked ? 'Present' : 'Absent');
                                                                }}
                                                                disabled={isFormDisabled}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
            
            {fields.length > 0 && (
                <div className="flex justify-end">
                <Button type="submit" className="bg-accent hover:bg-accent/90 w-full md:w-auto" disabled={isFormDisabled}>
                    {isSubmitting ? 'Submitting...' : isAlreadySubmitted ? 'Already Submitted' : 'Submit Attendance'}
                </Button>
                </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
