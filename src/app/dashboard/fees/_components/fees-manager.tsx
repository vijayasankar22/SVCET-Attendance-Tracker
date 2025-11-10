
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, writeBatch, Timestamp, query, where, runTransaction, getDoc, serverTimestamp, deleteDoc, setDoc, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Student, Fee, Class, Department, FeeTransaction, FeeItem, FeeCategory } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, Search, Loader2, IndianRupee, HandCoins, Hourglass, History, FileDown, UserCheck, UserX, UserMinus, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { FirestorePermissionError, errorEmitter } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { exportToCsv, exportToXlsx } from '@/lib/utils';
import { FeeAnalytics } from '../../_components/fee-analytics';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

const feeCategories: FeeCategory[] = ['tuition', 'exam', 'transport', 'hostel', 'registration'];

export function FeesManager() {
  const { firestore } = useFirebase();
  const { staff, isUserLoading } = useAuth();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [transactions, setTransactions] = useState<Map<string, FeeTransaction[]>>(new Map());
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  
  const [editingFee, setEditingFee] = useState<Partial<Fee> | null>(null);
  const [paymentFeeTarget, setPaymentFeeTarget] = useState<Fee | null>(null);
  const [historyFeeTarget, setHistoryFeeTarget] = useState<Fee | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());

  const isAdmin = staff?.role === 'admin';

  useEffect(() => {
    if (isUserLoading || !staff) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const studentsPromise = isAdmin 
            ? getDocs(collection(firestore, 'students'))
            : getDocs(query(collection(firestore, 'students'), where('classId', '==', staff.classId)));
            
        const feesPromise = getDocs(collection(firestore, 'fees'));
        
        const classesPromise = getDocs(collection(firestore, 'classes'));
        const deptsPromise = getDocs(collection(firestore, 'departments'));

        const [studentsSnap, feesSnap, classesSnap, deptsSnap] = await Promise.all([studentsPromise, feesPromise, classesPromise, deptsPromise]);

        const studentsData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        setStudents(studentsData);
        
        const studentIds = new Set(studentsData.map(s => s.id));
        const feesData = feesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Fee)).filter(f => studentIds.has(f.studentId));
        setFees(feesData.sort((a,b) => (a.registerNo || a.studentName).localeCompare(b.registerNo || a.studentName)));
        
        setClasses(classesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Class)));
        setDepartments(deptsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Department)));

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

 const getStudentFeeProfile = (studentId: string): Fee => {
    const existingFee = fees.find(f => f.studentId === studentId);
    if (existingFee) return existingFee;

    const student = students.find(s => s.id === studentId);
    const defaultFeeItem: FeeItem = { total: 0, paid: 0, balance: 0 };
    
    return {
      id: studentId,
      studentId: studentId,
      studentName: student?.name || '',
      classId: student?.classId || '',
      registerNo: student?.registerNo || '',
      tuition: { ...defaultFeeItem },
      exam: { ...defaultFeeItem },
      transport: { ...defaultFeeItem },
      hostel: { ...defaultFeeItem },
      registration: { ...defaultFeeItem },
      totalAmount: 0,
      totalPaid: 0,
      totalBalance: 0,
      updatedAt: Timestamp.now(),
      recordedBy: '',
    };
  }

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.registerNo?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => (a.registerNo || a.name).localeCompare(b.registerNo || b.name));
  }, [students, searchTerm]);

  const studentFeeProfiles = useMemo(() => {
    return filteredStudents.map(s => getStudentFeeProfile(s.id));
  }, [filteredStudents, fees]);
  
  const feesSummary = useMemo(() => {
    const totalAmount = studentFeeProfiles.reduce((sum, fee) => sum + fee.totalAmount, 0);
    const totalPaid = studentFeeProfiles.reduce((sum, fee) => sum + fee.totalPaid, 0);
    const totalBalance = totalAmount - totalPaid;
    
    const paidCount = studentFeeProfiles.filter(f => f.totalBalance <= 0 && f.totalAmount > 0).length;
    const partialCount = studentFeeProfiles.filter(f => f.totalBalance > 0 && f.totalPaid > 0).length;
    const unpaidCount = studentFeeProfiles.filter(f => f.totalBalance > 0 && f.totalPaid === 0).length;

    return { totalAmount, totalPaid, totalBalance, paidCount, partialCount, unpaidCount };
  }, [studentFeeProfiles]);


  const handleSaveFee = (student: Student, feeData: Partial<Fee>) => {
    if (!staff) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
      return;
    }
    const feeId = student.id;
    const docRef = doc(firestore, 'fees', feeId);
    const isEditing = fees.some(f => f.id === feeId);

    const dataToSave: Omit<Fee, 'id' | 'updatedAt'> & { updatedAt: any } = {
      studentId: student.id,
      studentName: student.name,
      classId: student.classId,
      registerNo: student.registerNo,
      tuition: feeData.tuition || { total: 0, paid: 0, balance: 0 },
      exam: feeData.exam || { total: 0, paid: 0, balance: 0 },
      transport: feeData.transport || { total: 0, paid: 0, balance: 0 },
      hostel: feeData.hostel || { total: 0, paid: 0, balance: 0 },
      registration: feeData.registration || { total: 0, paid: 0, balance: 0 },
      totalAmount: 0,
      totalPaid: 0,
      totalBalance: 0,
      updatedAt: serverTimestamp(),
      recordedBy: staff.name,
    };
    
    feeCategories.forEach(cat => {
      dataToSave[cat].balance = dataToSave[cat].total - dataToSave[cat].paid;
    });

    dataToSave.totalAmount = feeCategories.reduce((sum, cat) => sum + dataToSave[cat].total, 0);
    dataToSave.totalPaid = feeCategories.reduce((sum, cat) => sum + dataToSave[cat].paid, 0);
    dataToSave.totalBalance = dataToSave.totalAmount - dataToSave.totalPaid;
    
    setDoc(docRef, dataToSave, { merge: true })
      .then(() => {
        toast({ title: 'Success', description: `Fees updated for ${student.name}.` });
        
        const finalData = { 
            ...dataToSave, 
            id: feeId, 
            updatedAt: Timestamp.now(),
         } as Fee;

        setFees(prev => {
          if (isEditing) return prev.map(f => f.id === feeId ? finalData : f);
          return [...prev, finalData];
        });
        setIsFeeDialogOpen(false);
      })
      .catch((e) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: isEditing ? 'update' : 'create', requestResourceData: dataToSave }));
      });
  };
  
  const handleAddPayment = async (feeProfile: Fee, feeType: FeeCategory, paymentAmount: number) => {
    if (!staff) return;
    const feeRef = doc(firestore, 'fees', feeProfile.id);
    const transactionRef = doc(collection(firestore, 'fees', feeProfile.id, 'transactions'));
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const feeDoc = await transaction.get(feeRef);
        if (!feeDoc.exists()) throw "Fee document does not exist!";
        
        const currentFeeData = feeDoc.data() as Fee;

        const newPaidForCategory = currentFeeData[feeType].paid + paymentAmount;
        
        const transactionData = {
          [`${feeType}.paid`]: newPaidForCategory,
          [`${feeType}.balance`]: currentFeeData[feeType].total - newPaidForCategory,
          totalPaid: currentFeeData.totalPaid + paymentAmount,
          totalBalance: currentFeeData.totalBalance - paymentAmount,
          updatedAt: serverTimestamp(),
        };

        transaction.update(feeRef, transactionData);
        
        const newTransactionData: Omit<FeeTransaction, 'id'| 'timestamp'> & {timestamp: any} = {
          feeId: feeProfile.id,
          feeType: feeType,
          amount: paymentAmount,
          date: format(new Date(), 'yyyy-MM-dd'),
          recordedBy: staff!.name,
          timestamp: serverTimestamp()
        };
        transaction.set(transactionRef, newTransactionData);
      });
      
      setFees(prev => prev.map(f => {
        if (f.id === feeProfile.id) {
          const updatedFee = { ...f };
          updatedFee[feeType].paid += paymentAmount;
          updatedFee[feeType].balance -= paymentAmount;
          updatedFee.totalPaid += paymentAmount;
          updatedFee.totalBalance -= paymentAmount;
          return updatedFee;
        }
        return f;
      }));

      toast({ title: "Success", description: "Payment recorded successfully." });
      setIsPaymentDialogOpen(false);
    } catch (e: any) {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: feeRef.path,
            operation: 'update',
            requestResourceData: {info: `Failed to record a payment of ${paymentAmount} for ${feeType}.`, error: e.message},
          })
        );
    }
  };
  
  const openFeeDialog = (student: Student) => {
    const feeProfile = getStudentFeeProfile(student.id);
    setEditingFee(feeProfile);
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

  const toggleStudentExpansion = (studentId: string) => {
    setExpandedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };
  
  const handleExport = (fileType: 'xlsx' | 'csv') => {
    const dataToExport = filteredStudents.map(student => {
        const fee = getStudentFeeProfile(student.id);
        return {
            'Register No': student.registerNo || 'N/A',
            'Student Name': student.name,
            'Tuition Total': fee.tuition.total,
            'Tuition Paid': fee.tuition.paid,
            'Tuition Balance': fee.tuition.balance,
            'Exam Total': fee.exam.total,
            'Exam Paid': fee.exam.paid,
            'Exam Balance': fee.exam.balance,
            'Transport Total': fee.transport.total,
            'Transport Paid': fee.transport.paid,
            'Transport Balance': fee.transport.balance,
            'Hostel Total': fee.hostel.total,
            'Hostel Paid': fee.hostel.paid,
            'Hostel Balance': fee.hostel.balance,
            'Registration Total': fee.registration.total,
            'Registration Paid': fee.registration.paid,
            'Registration Balance': fee.registration.balance,
            'Overall Total': fee.totalAmount,
            'Overall Paid': fee.totalPaid,
            'Overall Balance': fee.totalBalance,
        };
    });
    
    if (fileType === 'xlsx') {
        exportToXlsx('fees-report.xlsx', dataToExport);
    } else {
        exportToCsv('fees-report.csv', dataToExport);
    }
  }

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-96 w-full" /></div>
  }

  return (
    <div className="space-y-8">
      {isAdmin && <FeeAnalytics students={students} fees={fees} classes={classes} departments={departments} />}
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

              </div>
            </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 justify-between mb-4">
            <div className="relative max-w-lg flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search by student name or register no..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleExport('xlsx')} size="sm" variant="outline"><FileDown className="mr-2 h-4 w-4" /> Export XLSX</Button>
              <Button onClick={() => handleExport('csv')} size="sm" variant="outline"><FileDown className="mr-2 h-4 w-4" /> Export CSV</Button>
            </div>
          </div>

          <div className="rounded-md border max-h-[70vh] overflow-y-auto">
            <Accordion type="single" collapsible className="w-full">
              {studentFeeProfiles.map(feeProfile => {
                const student = students.find(s => s.id === feeProfile.studentId);
                if (!student) return null;

                return (
                  <AccordionItem value={student.id} key={student.id}>
                    <AccordionTrigger className="p-4 hover:no-underline hover:bg-muted/50">
                      <div className="flex justify-between items-center w-full">
                        <div>
                          <p className="font-semibold">{student.name}</p>
                          <p className="text-sm text-muted-foreground">{student.registerNo}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm mr-4">
                           <div>
                              <p className="text-muted-foreground">Balance</p>
                              <p className={cn("font-bold", feeProfile.totalBalance > 0 ? "text-destructive" : "text-green-600")}>
                                  ₹{feeProfile.totalBalance?.toLocaleString('en-IN') ?? '0'}
                              </p>
                           </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="p-4 border-t bg-background">
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {feeCategories.map(cat => (
                             <Card key={cat}>
                               <CardHeader className="pb-2">
                                 <CardTitle className="text-base capitalize">{cat} Fee</CardTitle>
                               </CardHeader>
                               <CardContent>
                                 <div className="space-y-1 text-sm">
                                   <div className="flex justify-between"><span>Total:</span> <span className="font-medium">₹{(feeProfile[cat]?.total ?? 0).toLocaleString('en-IN')}</span></div>
                                   <div className="flex justify-between"><span>Paid:</span> <span className="font-medium text-green-600">₹{(feeProfile[cat]?.paid ?? 0).toLocaleString('en-IN')}</span></div>
                                   <div className="flex justify-between"><span>Balance:</span> <span className="font-bold text-destructive">₹{(feeProfile[cat]?.balance ?? 0).toLocaleString('en-IN')}</span></div>
                                 </div>
                               </CardContent>
                             </Card>
                           ))}
                         </div>
                         <div className="mt-4 flex justify-end items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openHistoryDialog(feeProfile)}>
                                <History className="mr-2 h-4 w-4"/> View Payment History
                            </Button>
                            <Button variant="outline" size="sm" onClick={(e) => {e.stopPropagation(); openFeeDialog(student);}}>Edit Fees</Button>
                            <Button variant="default" size="sm" onClick={(e) => {e.stopPropagation(); openPaymentDialog(feeProfile);}} disabled={(feeProfile.totalBalance ?? 0) <= 0}>Add Payment</Button>
                         </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
              {filteredStudents.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">No students found.</div>
              )}
            </Accordion>
          </div>
        </CardContent>
      </Card>
      
      {isFeeDialogOpen && <FeeFormDialog isOpen={isFeeDialogOpen} setIsOpen={setIsFeeDialogOpen} fee={editingFee} onSave={(data) => handleSaveFee(students.find(s=>s.id === editingFee?.studentId!)!, data)} />}
      {isPaymentDialogOpen && <PaymentDialog isOpen={isPaymentDialogOpen} setIsOpen={setIsPaymentDialogOpen} fee={paymentFeeTarget} onSave={handleAddPayment} />}
      {isHistoryDialogOpen && <HistoryDialog isOpen={isHistoryDialogOpen} setIsOpen={setIsHistoryDialogOpen} fee={historyFeeTarget} transactions={transactions.get(historyFeeTarget?.id || '') || []} />}
    </div>
  );
}

function FeeFormDialog({ isOpen, setIsOpen, fee, onSave }: { isOpen: boolean, setIsOpen: (open: boolean) => void, fee: Partial<Fee> | null, onSave: (data: Partial<Fee>) => void }) {
    const [formData, setFormData] = useState<Partial<Fee>>(fee || {});
    
    const handleCategoryChange = (category: FeeCategory, value: string) => {
        const amount = Number(value) || 0;
        setFormData(prev => {
            const existingCategoryData = prev[category] || { total: 0, paid: 0, balance: 0 };
            return {
                ...prev,
                [category]: { ...existingCategoryData, total: amount }
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSave = { ...formData };
        feeCategories.forEach(cat => {
            if (!dataToSave[cat]) {
                dataToSave[cat] = { total: 0, paid: 0, balance: 0 };
            }
        });
        onSave(dataToSave);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Edit Fees for {fee?.studentName}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {feeCategories.map(cat => (
                           <div key={cat}>
                                <Label htmlFor={cat} className="capitalize">{cat} Fee Total</Label>
                                <Input id={cat} type="number" value={formData?.[cat]?.total || ''} onChange={e => handleCategoryChange(cat, e.target.value)} />
                           </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save Fees</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PaymentDialog({ isOpen, setIsOpen, fee, onSave }: { isOpen: boolean, setIsOpen: (open: boolean) => void, fee: Fee | null, onSave: (fee: Fee, feeType: FeeCategory, amount: number) => void }) {
    const [amount, setAmount] = useState<number | ''>('');
    const [feeType, setFeeType] = useState<FeeCategory>('tuition');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (fee && amount && feeType) onSave(fee, feeType, Number(amount));
    };

    const maxAmount = fee && fee[feeType] ? fee[feeType].balance : 0;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Payment for {fee?.studentName}</DialogTitle>
                    <DialogDescription>Overall Balance: ₹{fee?.totalBalance.toLocaleString('en-IN')}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="feeType">Fee Category</Label>
                      <Select onValueChange={(value: FeeCategory) => setFeeType(value)} value={feeType}>
                        <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                        <SelectContent>
                          {feeCategories.map(cat => (
                            <SelectItem key={cat} value={cat} disabled={!fee || (fee[cat]?.balance ?? 0) <= 0}>
                              <span className="capitalize">{cat}</span> (Balance: ₹{(fee?.[cat]?.balance ?? 0).toLocaleString('en-IN')})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                        <Label htmlFor="paymentAmount">Payment Amount</Label>
                        <Input id="paymentAmount" type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} max={maxAmount} required />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={!amount || Number(amount) <= 0 || Number(amount) > maxAmount}>Record Payment</Button>
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
                    <DialogTitle>Payment History for {fee?.studentName}</DialogTitle>
                </DialogHeader>
                <div className="max-h-80 overflow-y-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Recorded By</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {transactions.length > 0 ? transactions.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell>{t.timestamp ? format(t.timestamp.toDate(), 'dd MMM yyyy, hh:mm a') : 'N/A'}</TableCell>
                                    <TableCell className="capitalize">{t.feeType}</TableCell>
                                    <TableCell className="text-right">₹{t.amount.toLocaleString('en-IN')}</TableCell>
                                    <TableCell>{t.recordedBy}</TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={4} className="text-center">No payments recorded yet.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
    