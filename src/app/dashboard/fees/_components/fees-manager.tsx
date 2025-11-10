
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Staff, Student, Fee, Class, Department } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit, Trash2, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


type FeesManagerProps = {
  staff: Staff;
};

export function FeesManager({ staff }: FeesManagerProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isTeacher = staff.role === 'teacher';

  const fetchData = async () => {
    setLoading(true);
    try {
      const studentsPromise = isTeacher
        ? getDocs(query(collection(firestore, 'students'), where('classId', '==', staff.classId)))
        : getDocs(collection(firestore, 'students'));
      
      const [studentsSnapshot, classesSnapshot, departmentsSnapshot, feesSnapshot] = await Promise.all([
        studentsPromise,
        getDocs(collection(firestore, 'classes')),
        getDocs(collection(firestore, 'departments')),
        getDocs(query(collection(firestore, 'fees'), orderBy('timestamp', 'desc')))
      ]);
      
      const studentsData = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      let feesData = feesSnapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, timestamp: data.timestamp.toDate() } as Fee;
      });

      if (isTeacher) {
        const studentIds = studentsData.map(s => s.id);
        feesData = feesData.filter(fee => studentIds.includes(fee.studentId));
      }

      setStudents(studentsData);
      setClasses(classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      setDepartments(departmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
      setFees(feesData);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [firestore, staff]);

  const handleSaveFee = (feeData: Omit<Fee, 'id' | 'timestamp'> & {id?: string}) => {
    const isEditing = !!feeData.id;
    const id = feeData.id || doc(collection(firestore, 'fees')).id;
    const feeDocRef = doc(firestore, 'fees', id);
    const feeToSave = {
        ...feeData,
        id,
        timestamp: feeData.id ? fees.find(f => f.id === feeData.id)!.timestamp : Timestamp.now(),
        updatedBy: staff.id,
    };

    setDoc(feeDocRef, feeToSave, { merge: true })
      .then(() => {
        setFees(prev => {
            const existing = prev.find(f => f.id === id);
            if (existing) {
                return prev.map(f => f.id === id ? feeToSave : f).sort((a,b) => b.timestamp - a.timestamp);
            }
            return [feeToSave, ...prev].sort((a,b) => b.timestamp - a.timestamp);
        });
        setIsDialogOpen(false);
        setEditingFee(null);
        toast({ title: 'Success', description: 'Fee record saved successfully.' });
      })
      .catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: feeDocRef.path,
            operation: isEditing ? 'update' : 'create',
            requestResourceData: feeToSave,
          });
          errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleDeleteFee = (feeId: string) => {
    const feeDocRef = doc(firestore, 'fees', feeId);
    deleteDoc(feeDocRef)
      .then(() => {
          setFees(prev => prev.filter(f => f.id !== feeId));
          toast({ title: 'Success', description: 'Fee record deleted.' });
      })
      .catch(serverError => {
        const permissionError = new FirestorePermissionError({
          path: feeDocRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const openDialog = (fee: Fee | null = null) => {
    setEditingFee(fee);
    setIsDialogOpen(true);
  };

  const filteredFees = useMemo(() => {
    return fees.filter(fee => 
        fee.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fee.registerNo.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [fees, searchTerm]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle>Manage Student Fees</CardTitle>
            <CardDescription>
              {isTeacher ? 'Track fee payments for students in your class.' : 'Track and manage fee payments for all students.'}
            </CardDescription>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative w-full md:w-64">
                 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or reg no..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={() => openDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Record
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Register No</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6" /></TableCell></TableRow>
                  ))
                ) : filteredFees.length > 0 ? (
                  filteredFees.map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell className="font-medium">{fee.studentName}</TableCell>
                      <TableCell>{fee.registerNo}</TableCell>
                      <TableCell>{fee.departmentName} - {fee.className}</TableCell>
                      <TableCell>₹{fee.amount.toLocaleString()}</TableCell>
                      <TableCell>{fee.date}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${fee.status === 'Paid' ? 'bg-green-100 text-green-800' : fee.status === 'Unpaid' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {fee.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openDialog(fee)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteFee(fee.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">No fee records found.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {isDialogOpen && (
        <FeeFormDialog
          isOpen={isDialogOpen}
          setIsOpen={setIsDialogOpen}
          fee={editingFee}
          onSave={handleSaveFee}
          students={students}
          classes={classes}
          departments={departments}
        />
      )}
    </>
  );
}

function FeeFormDialog({ isOpen, setIsOpen, fee, onSave, students, classes, departments }: { isOpen: boolean; setIsOpen: (open: boolean) => void; fee: Fee | null; onSave: (feeData: Omit<Fee, 'id' | 'timestamp'> & {id?: string}) => void; students: Student[], classes: Class[], departments: Department[] }) {
    const [selectedStudentId, setSelectedStudentId] = useState(fee?.studentId || '');
    const [amount, setAmount] = useState(fee?.amount || '');
    const [status, setStatus] = useState<Fee['status']>(fee?.status || 'Unpaid');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const student = students.find(s => s.id === selectedStudentId);
        if (!student || !amount) {
            alert('Please select a student and enter an amount.');
            return;
        }

        const studentClass = classes.find(c => c.id === student.classId);
        const studentDept = departments.find(d => d.id === student.departmentId);

        onSave({
            id: fee?.id,
            studentId: student.id,
            studentName: student.name,
            registerNo: student.registerNo,
            className: studentClass?.name || 'N/A',
            departmentName: studentDept?.name || 'N/A',
            amount: Number(amount),
            date: format(new Date(), 'yyyy-MM-dd'),
            status,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>{fee ? 'Edit Fee Record' : 'Add Fee Record'}</DialogTitle>
            <DialogDescription>Fill in the details for the fee payment.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <Label htmlFor="studentId">Student</Label>
                <Select onValueChange={setSelectedStudentId} value={selectedStudentId} disabled={!!fee}>
                <SelectTrigger id="studentId"><SelectValue placeholder="Select a student" /></SelectTrigger>
                <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.registerNo})</SelectItem>)}
                </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
            </div>
            <div>
                <Label htmlFor="status">Status</Label>
                <Select onValueChange={(v) => setStatus(v as Fee['status'])} value={status}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">Save</Button>
            </DialogFooter>
            </form>
        </DialogContent>
        </Dialog>
    );
}

    