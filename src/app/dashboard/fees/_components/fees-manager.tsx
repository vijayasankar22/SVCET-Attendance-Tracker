
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, writeBatch, Timestamp, query, where, runTransaction, getDoc, serverTimestamp, deleteDoc, setDoc, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Student, Fee, Class, Department, FeeTransaction } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, Search, Loader2, IndianRupee, HandCoins, Hourglass, History, FileDown, UserCheck, UserX, UserMinus } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { FirestorePermissionError, errorEmitter } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { exportToCsv, exportToXlsx } from '@/lib/utils';

export function FeesManager() {
  const { firestore } = useFirebase();
  const { staff, isUserLoading } = useAuth();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [transactions, setTransactions] = useState<Map<string, FeeTransaction[]>>(new Map());
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  
  const [editingFee, setEditingFee] = useState<Partial<Fee> | null>(null);
  const [paymentFeeTarget, setPaymentFeeTarget] = useState<Fee | null>(null);
  const [historyFeeTarget, setHistoryFeeTarget] = useState<Fee | null>(null);


  const isAdmin = staff?.role === 'admin';

  useEffect(() => {
    if (isUserLoading || !staff) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const studentsPromise = isAdmin 
            ? getDocs(collection(firestore, 'students'))
            : getDocs(query(collection(firestore, 'students'), where('classId', '==', staff.classId)));
            
        let feesQuery;
        if (isAdmin) {
            feesQuery = query(collection(firestore, 'fees'));
        } else {
            feesQuery = query(collection(firestore, 'fees'), where('classId', '==', staff.classId));
        }
        const feesPromise = getDocs(feesQuery);

        const [studentsSnap, feesSnap] = await Promise.all([studentsPromise, feesPromise]);

        setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
        const feesData = feesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Fee));
        setFees(feesData.sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)));

      } catch (error: any) {
        console.error("Error fetching fees data:", error);
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: '/fees or /students',
            operation: 'list',
          })
        )
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [firestore, staff, toast, isUserLoading, isAdmin]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.registerNo?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => (a.registerNo || a.name).localeCompare(b.registerNo || b.name));
  }, [students, searchTerm]);
  
  const feesSummary = useMemo(() => {
    const relevantFees = fees.filter(fee => students.some(s => s.id === fee.studentId));
    const totalAmount = relevantFees.reduce((sum, fee) => sum + fee.totalAmount, 0);
    const totalPaid = relevantFees.reduce((sum, fee) => sum + fee.paidAmount, 0);
    const totalBalance = totalAmount - totalPaid;
    
    const statusCounts = relevantFees.reduce((acc, fee) => {
        acc[fee.status] = (acc[fee.status] || 0) + 1;
        return acc;
    }, {} as Record<Fee['status'], number>);


    return { 
        totalAmount, 
        totalPaid, 
        totalBalance,
        paidCount: statusCounts['Paid'] || 0,
        partialCount: statusCounts['Partial'] || 0,
        unpaidCount: statusCounts['Unpaid'] || 0,
    };
  }, [fees, students]);


  const getStudentFees = (studentId: string) => {
    return fees.filter(f => f.studentId === studentId);
  }
  
  const getFeeStatusBadge = (status: Fee['status']) => {
    switch (status) {
      case 'Paid': return 'bg-green-500 hover:bg-green-600';
      case 'Partial': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'Unpaid': return 'bg-red-500 hover:bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const handleSaveFee = (feeData: Partial<Fee>) => {
    if (!staff) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to perform this action.' });
      return;
    }

    const isEditing = !!feeData.id;
    const feeId = isEditing ? feeData.id! : doc(collection(firestore, 'fees')).id;
    const docRef = doc(firestore, 'fees', feeId);

    const dataToSave: Omit<Fee, 'createdAt' | 'updatedAt'> & { createdAt?: any, updatedAt: any } = {
      id: feeId,
      studentId: feeData.studentId!,
      studentName: feeData.studentName!,
      classId: feeData.classId!,
      registerNo: feeData.registerNo!,
      description: feeData.description || 'General Fee',
      totalAmount: feeData.totalAmount || 0,
      paidAmount: isEditing ? feeData.paidAmount! : 0,
      balance: isEditing ? (feeData.totalAmount! - feeData.paidAmount!) : (feeData.totalAmount || 0),
      status: 'Unpaid', // Will be updated by transaction
      updatedAt: serverTimestamp(),
      recordedBy: staff.name,
    };
    
    if (!isEditing) {
      dataToSave.createdAt = serverTimestamp();
    } else {
        dataToSave.createdAt = feeData.createdAt;
    }

    dataToSave.status = dataToSave.balance <= 0 ? 'Paid' : dataToSave.paidAmount > 0 ? 'Partial' : 'Unpaid';

    setDoc(docRef, dataToSave, { merge: true })
      .then(() => {
        toast({ title: 'Success', description: `Fee ${isEditing ? 'updated' : 'added'}.` });
        const finalData = {
            ...dataToSave,
            createdAt: feeData.createdAt || Timestamp.now(), // Use existing or assume now
            updatedAt: Timestamp.now(),
        } as Fee;

        setFees(prev => {
          const existing = prev.find(f => f.id === feeId);
          if (existing) return prev.map(f => f.id === feeId ? finalData : f).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
          return [finalData, ...prev].sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        });
        setIsFeeDialogOpen(false);
      })
      .catch((e) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: isEditing ? 'update' : 'create', requestResourceData: dataToSave }));
      });
  };
  
  const handleAddPayment = async (fee: Fee, paymentAmount: number) => {
    const feeRef = doc(firestore, 'fees', fee.id);
    const transactionRef = doc(collection(firestore, 'fees', fee.id, 'transactions'));
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const feeDoc = await transaction.get(feeRef);
        if (!feeDoc.exists()) throw "Fee document does not exist!";
        
        const currentPaid = feeDoc.data().paidAmount || 0;
        const newPaidAmount = currentPaid + paymentAmount;
        const totalAmount = feeDoc.data().totalAmount;
        const newBalance = totalAmount - newPaidAmount;
        const newStatus: Fee['status'] = newBalance <= 0 ? 'Paid' : 'Partial';

        transaction.update(feeRef, {
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
        
        const newTransaction: Omit<FeeTransaction, 'id'| 'timestamp'> & {timestamp: any} = {
          feeId: fee.id,
          amount: paymentAmount,
          date: format(new Date(), 'yyyy-MM-dd'),
          recordedBy: staff!.name,
          timestamp: serverTimestamp()
        };
        transaction.set(transactionRef, newTransaction);
      });
      
      setFees(prev => prev.map(f => {
        if (f.id === fee.id) {
          const newPaid = f.paidAmount + paymentAmount;
          const newBalance = f.totalAmount - newPaid;
          return {
            ...f,
            paidAmount: newPaid,
            balance: newBalance,
            status: newBalance <= 0 ? 'Paid' : 'Partial'
          };
        }
        return f;
      }));

      toast({ title: "Success", description: "Payment recorded successfully." });
      setIsPaymentDialogOpen(false);
    } catch (e) {
      console.error(e);
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: feeRef.path, operation: 'update' }));
    }
  };
  
  const handleDeleteFee = async (feeId: string) => {
    if (!window.confirm("Are you sure you want to delete this entire fee record and all its payments?")) return;
    const docRef = doc(firestore, 'fees', feeId);
    deleteDoc(docRef)
    .then(() => {
        setFees(prev => prev.filter(f => f.id !== feeId));
        toast({ title: 'Success', description: 'Fee record deleted.' });
    })
    .catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
    })
  }
  
  const openFeeDialog = (student: Student, fee: Fee | null = null) => {
    if (fee) {
      setEditingFee(fee);
    } else {
      setEditingFee({
        studentId: student.id,
        studentName: student.name,
        classId: student.classId,
        registerNo: student.registerNo,
      });
    }
    setIsFeeDialogOpen(true);
  };

  const openPaymentDialog = (fee: Fee) => {
    setPaymentFeeTarget(fee);
    setIsPaymentDialogOpen(true);
  };
  
  const openHistoryDialog = async (fee: Fee) => {
    setHistoryFeeTarget(fee);
    setIsHistoryDialogOpen(true);
    try {
        const transQuery = query(collection(firestore, 'fees', fee.id, 'transactions'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(transQuery);
        const feeTransactions = snap.docs.map(d => ({...d.data(), id: d.id} as FeeTransaction));
        setTransactions(prev => new Map(prev.set(fee.id, feeTransactions)));
    } catch (e) {
        console.error(e);
        toast({variant: 'destructive', title: 'Error', description: 'Could not fetch payment history.'})
    }
  };

  const prepareExportData = () => {
    const data: any[] = [];
    filteredStudents.forEach(student => {
      const studentFees = getStudentFees(student.id);
      if (studentFees.length > 0) {
        studentFees.forEach(fee => {
          data.push({
            'Register No.': student.registerNo,
            'Student Name': student.name,
            'Fee Description': fee.description,
            'Total Amount': fee.totalAmount,
            'Paid Amount': fee.paidAmount,
            'Balance': fee.balance,
            'Status': fee.status,
            'Last Updated': fee.updatedAt.toDate ? format(fee.updatedAt.toDate(), 'dd-MM-yyyy') : 'N/A'
          });
        });
      } else {
         data.push({
            'Register No.': student.registerNo,
            'Student Name': student.name,
            'Fee Description': 'No fees recorded',
            'Total Amount': 0,
            'Paid Amount': 0,
            'Balance': 0,
            'Status': 'N/A',
            'Last Updated': 'N/A'
          });
      }
    });
    return data;
  }

  const handleExportExcel = () => {
    const data = prepareExportData();
    exportToXlsx('fees-report.xlsx', data);
  }

  const handleExportCsv = () => {
    const data = prepareExportData();
    exportToCsv('fees-report.csv', data);
  }


  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-96 w-full" /></div>
  }

  return (
    <>
      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div>
                <CardTitle>Fees Management</CardTitle>
                <CardDescription>
                  {isAdmin ? 'Search for a student to manage their fees.' : "Manage fees for students in your class."}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                           <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                           <IndianRupee className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                           <div className="text-2xl font-bold">₹{feesSummary.totalAmount.toLocaleString('en-IN')}</div>
                        </CardContent>
                     </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                           <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                           <HandCoins className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                           <div className="text-2xl font-bold text-green-600">₹{feesSummary.totalPaid.toLocaleString('en-IN')}</div>
                        </CardContent>
                     </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                           <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                           <Hourglass className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                           <div className="text-2xl font-bold text-destructive">₹{feesSummary.totalBalance.toLocaleString('en-IN')}</div>
                        </CardContent>
                     </Card>
                  </div>
                   <div className="grid gap-4 sm:grid-cols-3">
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                           <CardTitle className="text-sm font-medium">Fully Paid</CardTitle>
                           <UserCheck className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                           <div className="text-2xl font-bold">{feesSummary.paidCount}</div>
                        </CardContent>
                     </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                           <CardTitle className="text-sm font-medium">Partially Paid</CardTitle>
                           <UserMinus className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                           <div className="text-2xl font-bold">{feesSummary.partialCount}</div>
                        </CardContent>
                     </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                           <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
                           <UserX className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                           <div className="text-2xl font-bold">{feesSummary.unpaidCount}</div>
                        </CardContent>
                     </Card>
                  </div>

                   <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={handleExportExcel}>
                          <FileDown className="mr-2 h-4 w-4" /> Export Excel
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportCsv}>
                          <FileDown className="mr-2 h-4 w-4" /> Export CSV
                      </Button>
                  </div>
              </div>
            </div>
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
                        <TableCell className="font-medium align-top pt-4">{student.registerNo}</TableCell>
                        <TableCell className="align-top pt-4">{student.name}</TableCell>
                        <TableCell>
                          {studentFees.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {studentFees.map(fee => (
                                <div key={fee.id} className="p-2 rounded-md border bg-muted/50">
                                  <div className="flex justify-between items-center">
                                      <div className="font-semibold">{fee.description}</div>
                                      <div className="flex items-center gap-2">
                                        <Badge className={getFeeStatusBadge(fee.status)}>{fee.status}</Badge>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openFeeDialog(student, fee)}><Edit className="h-3 w-3" /></Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteFee(fee.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                      </div>
                                  </div>
                                  <Separator className="my-2"/>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                      <div><span className="text-muted-foreground">Total:</span> ₹{fee.totalAmount.toLocaleString('en-IN')}</div>
                                      <div><span className="text-muted-foreground">Paid:</span> ₹{fee.paidAmount.toLocaleString('en-IN')}</div>
                                      <div><span className="text-muted-foreground">Balance:</span> ₹{fee.balance.toLocaleString('en-IN')}</div>
                                  </div>
                                  <div className="mt-2 flex gap-2">
                                      <Button size="xs" variant="outline" onClick={() => openPaymentDialog(fee)} disabled={fee.balance <= 0}>Add Payment</Button>
                                      <Button size="xs" variant="ghost" onClick={() => openHistoryDialog(fee)}>History</Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">No records</span>}
                        </TableCell>
                        <TableCell className="text-right align-top pt-4">
                          <Button size="sm" variant="outline" onClick={() => openFeeDialog(student)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Fee Record
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center">No students found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {isFeeDialogOpen && <FeeFormDialog isOpen={isFeeDialogOpen} setIsOpen={setIsFeeDialogOpen} fee={editingFee} onSave={handleSaveFee} />}
      {isPaymentDialogOpen && <PaymentDialog isOpen={isPaymentDialogOpen} setIsOpen={setIsPaymentDialogOpen} fee={paymentFeeTarget} onSave={handleAddPayment} />}
      {isHistoryDialogOpen && <HistoryDialog isOpen={isHistoryDialogOpen} setIsOpen={setIsHistoryDialogOpen} fee={historyFeeTarget} transactions={transactions.get(historyFeeTarget?.id || '') || []} />}
    </>
  );
}

function FeeFormDialog({ isOpen, setIsOpen, fee, onSave }: { isOpen: boolean, setIsOpen: (open: boolean) => void, fee: Partial<Fee> | null, onSave: (data: Partial<Fee>) => void }) {
    const [formData, setFormData] = useState(fee);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData!);
    };
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader><DialogTitle>{fee?.id ? 'Edit' : 'Add'} Fee for {fee?.studentName}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Input id="description" value={formData?.description || ''} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="e.g., Tuition Fee 2024" required />
                    </div>
                    <div>
                        <Label htmlFor="totalAmount">Total Amount</Label>
                        <Input id="totalAmount" type="number" value={formData?.totalAmount || ''} onChange={e => setFormData(f => ({ ...f, totalAmount: Number(e.target.value) || 0 }))} required />
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

function PaymentDialog({ isOpen, setIsOpen, fee, onSave }: { isOpen: boolean, setIsOpen: (open: boolean) => void, fee: Fee | null, onSave: (fee: Fee, amount: number) => void }) {
    const [amount, setAmount] = useState<number | ''>('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (fee && amount) onSave(fee, Number(amount));
    };
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Payment for {fee?.description}</DialogTitle>
                    <DialogDescription>Student: {fee?.studentName} | Balance: ₹{fee?.balance.toLocaleString('en-IN')}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="paymentAmount">Payment Amount</Label>
                        <Input id="paymentAmount" type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} max={fee?.balance} required />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Record Payment</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function HistoryDialog({ isOpen, setIsOpen, fee, transactions }: { isOpen: boolean, setIsOpen: (open: boolean) => void, fee: Fee | null, transactions: FeeTransaction[] }) {
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Payment History for {fee?.description}</DialogTitle>
                     <DialogDescription>Student: {fee?.studentName}</DialogDescription>
                </DialogHeader>
                <div className="max-h-80 overflow-y-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Recorded By</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {transactions.length > 0 ? transactions.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell>{t.timestamp ? format(t.timestamp.toDate(), 'dd MMM yyyy, hh:mm a') : 'N/A'}</TableCell>
                                    <TableCell>₹{t.amount.toLocaleString('en-IN')}</TableCell>
                                    <TableCell>{t.recordedBy}</TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={3} className="text-center">No payments recorded yet.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}

    