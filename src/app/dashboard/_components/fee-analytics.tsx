'use client';

import { useMemo } from 'react';
import type { Student, Fee, Class, Department } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { IndianRupee } from 'lucide-react';

type FeeAnalyticsProps = {
  students: Student[];
  fees: Fee[];
  classes: Class[];
  departments: Department[];
};

export function FeeAnalytics({ students, fees, classes, departments }: FeeAnalyticsProps) {

  const analyticsData = useMemo(() => {
    return departments.map(dept => {
      const classesInDept = classes.filter(c => c.departmentId === dept.id);
      
      const classData = classesInDept.map(cls => {
        const studentsInClass = students.filter(s => s.classId === cls.id);
        const studentIdsInClass = studentsInClass.map(s => s.id);
        const feesForClass = fees.filter(f => studentIdsInClass.includes(f.studentId));

        const totalFee = feesForClass.reduce((sum, f) => sum + f.totalAmount, 0);
        const collectedFee = feesForClass.reduce((sum, f) => sum + f.totalPaid, 0);
        const balance = totalFee - collectedFee;
        
        return {
          classId: cls.id,
          className: cls.name,
          totalStudents: studentsInClass.length,
          totalFee,
          collectedFee,
          balance,
        };
      }).filter(c => c.totalStudents > 0); // Only include classes with students

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        classes: classData,
      };
    }).filter(d => d.classes.length > 0); // Only include departments with classes
  }, [students, fees, classes, departments]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Collection Analytics</CardTitle>
        <CardDescription>A department and class-wise breakdown of fee collections. (Admin View)</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {analyticsData.map(deptData => (
            <AccordionItem value={deptData.departmentId} key={deptData.departmentId}>
              <AccordionTrigger className="text-lg font-medium">
                {deptData.departmentName}
              </AccordionTrigger>
              <AccordionContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead className="text-center">Students</TableHead>
                        <TableHead className="text-right">Total Fee</TableHead>
                        <TableHead className="text-right">Collected</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deptData.classes.map(clsData => (
                        <TableRow key={clsData.classId}>
                          <TableCell className="font-medium">{clsData.className}</TableCell>
                          <TableCell className="text-center">{clsData.totalStudents}</TableCell>
                          <TableCell className="text-right">₹{clsData.totalFee.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-green-600">₹{clsData.collectedFee.toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right text-destructive">₹{clsData.balance.toLocaleString('en-IN')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
