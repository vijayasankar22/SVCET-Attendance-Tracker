
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, writeBatch, Timestamp, query, where, orderBy, deleteDoc, setDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Student, Fee, Class, Department } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, Search, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { FirestorePermissionError, errorEmitter } from '@/firebase';

export function FeesManager() {
  const { firestore } = useFirebase();
  const { staff, isUserLoading } = useAuth();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);

  const isAdmin = staff?.role === 'admin';

  useEffect(() => {
    if (isUserLoading || !staff) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const studentsPromise = isAdmin 
            ? getDocs(collection(firestore, 'students'))
            : getDocs(query(collection(firestore, 'students'), where('classId', '==', staff.classId)));
            
        const classesPromise = getDocs(collection(firestore, 'classes'));
        const deptsPromise = getDocs(collection(firestore, 'departments'));
        
        let feesQuery;
        if(isAdmin) {
            feesQuery = query(collection(firestore, 'fees'), orderBy('timestamp', 'desc'));
        } else {
            feesQuery = query(collection(firestore, 'fees'), where('classId', '==', staff.classId));
        }
        const feesPromise = getDocs(feesQuery);

        const [studentsSnap, classesSnap, deptsSnap, feesSnap] = await Promise.all([
            studentsPromise, classesPromise, deptsPromise, feesPromise
        ]);

        setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
        setClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
        setDepartments(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
        
        const feesData = feesSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                timestamp: data.timestamp.toDate()
            } as Fee;
        });
        
        // Sort client-side
        feesData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setFees(feesData);

      } catch (error: any) {
        console.error("Error fetching fees data:", error);
         errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: '/fees or /students',
            operation: 'list',
          })
        );
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch data. Check permissions.' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [firestore, staff, toast, isUserLoading, isAdmin]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.registerNo.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => (a.registerNo || a.name).localeCompare(b.registerNo || b.name));
  }, [students, searchTerm]);

  const getStudentFees = (studentId: string) => {
    return fees.filter(f => f.studentId === studentId);
  }

  const handleSaveFee = async (feeData: Omit<Fee, 'id' | 'timestamp'>) => {
    const isEditing = !!editingFee;
    const feeId = isEditing && editingFee?.id ? editingFee!.id : doc(collection(firestore, 'fees')).id;
    const docRef = doc(firestore, 'fees', feeId);
    
    const dataToSave: Fee = {
        ...(feeData as Fee),
        id: feeId,
        timestamp: Timestamp.now(),
    };

    try {
        await setDoc(docRef, dataToSave, { merge: isEditing });

        setFees(prev => {
            const existing = prev.find(f => f.id === feeId);
            if (existing) {
                return prev.map(f => f.id === feeId ? dataToSave : f);
            }
            return [dataToSave, ...prev];
        });
        
        setIsDialogOpen(false);
        setEditingFee(null);
        toast({ title: 'Success', description: `Fee record ${isEditing ? 'updated' : 'added'}.` });
    } catch (error) {
        console.error("Error saving fee:", error);
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: isEditing ? 'update' : 'create',
            requestResourceData: dataToSave,
          })
        );
    }
  };
  
  const handleDeleteFee = async (feeId: string) => {
    const docRef = doc(firestore, 'fees', feeId);
    try {
        await deleteDoc(docRef);
        setFees(prev => prev.filter(f => f.id !== feeId));
        toast({ title: 'Success', description: 'Fee record deleted.' });
    } catch(error) {
        console.error("Error deleting fee:", error);
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          })
        );
    }
  };

  const openDialog = (fee: Fee | null = null, student: Student) => {
    if (fee) {
      setEditingFee(fee);
    } else {
        const newFee: Partial<Fee> = {
            studentId: student.id,
            studentName: student.name,
            registerNo: student.registerNo,
            classId: student.classId,
            status: 'Unpaid',
            date: format(new Date(), 'yyyy-MM-dd'),
            recordedBy: staff?.name || 'Unknown',
        }
        setEditingFee(newFee as Fee);
    }
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-64 w-full" />
        </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Fees Management</CardTitle>
          <CardDescription>
            {isAdmin ? 'Search for any student to manage their fees.' : "Manage fees for students in your class."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 max-w-lg">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search by student name or register no..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
          </div>

          <div className="rounded-md border max-h-[70vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Register No.</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Fees Records</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map(student => {
                    const studentFees = getStudentFees(student.id);
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.registerNo}</TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>
                          {studentFees.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {studentFees.map(fee => (
                                <div key={fee.id} className="flex items-center gap-2 text-xs">
                                  <span className={`font-semibold ${fee.status === 'Paid' ? 'text-green-600' : fee.status === 'Partial' ? 'text-yellow-600' : 'text-red-600'}`}>
                                    ₹{fee.amount} - {fee.status}
                                  </span>
                                  <span className="text-muted-foreground">({format(parseISO(fee.date), 'dd MMM yyyy')})</span>
                                  <button onClick={() => openDialog(fee, student)} className="text-muted-foreground hover:text-primary"><Edit className="h-3 w-3"/></button>
                                  <button onClick={() => handleDeleteFee(fee.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3"/></button>
                                </div>
                              ))}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">No records</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openDialog(null, student)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Fee
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No students found.
                    </TableCell>
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
            onClose={() => setEditingFee(null)}
        />
      )}
    </>
  );
}


// Fee Form Dialog Subcomponent
function FeeFormDialog({ isOpen, setIsOpen, fee, onSave, onClose }: { isOpen: boolean, setIsOpen: (open: boolean) => void, fee: Partial<Fee> | null, onSave: (feeData: Omit<Fee, 'id' | 'timestamp'>) => void, onClose: () => void }) {
    const [formData, setFormData] = useState<Partial<Fee>>(fee || {});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    };

    const handleSelectChange = (name: keyof Fee, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.studentId || !formData.amount || !formData.status || !formData.date) {
            alert("Please fill all fields.");
            return;
        }
        setIsSubmitting(true);
        await onSave(formData as Omit<Fee, 'id' | 'timestamp'>);
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) onClose(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{fee?.id ? 'Edit' : 'Add'} Fee for {fee?.studentName}</DialogTitle>
                    <DialogDescription>
                        Register No: {fee?.registerNo}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="amount">Amount</Label>
                        <Input id="amount" name="amount" type="number" value={formData.amount || ''} onChange={handleChange} required />
                    </div>
                    <div>
                        <Label htmlFor="date">Date</Label>
                        <Input id="date" name="date" type="date" value={formData.date || ''} onChange={handleChange} required />
                    </div>
                    <div>
                        <Label htmlFor="status">Status</Label>
                        <Select onValueChange={(value) => handleSelectChange('status', value)} value={formData.status}>
                            <SelectTrigger id="status">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Unpaid">Unpaid</SelectItem>
                                <SelectItem value="Paid">Paid</SelectItem>
                                <SelectItem value="Partial">Partial</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isSubmitting ? 'Saving...' : 'Save Record'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
    