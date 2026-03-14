'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Staff, Student, Department, Class } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit, Trash2, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function StaffPage() {
  const { firestore } = useFirebase();
  const { staff: currentStaff, isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const [deptFilter, setDeptFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');

  useEffect(() => {
    if (!isUserLoading && currentStaff?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [currentStaff, isUserLoading, router]);

  useEffect(() => {
    if (isUserLoading || currentStaff?.role !== 'admin') {
        return;
    }
    const fetchData = async () => {
      setLoading(true);
      try {
        const staffSnap = await getDocs(collection(firestore, 'staff'));
        const deptsSnap = await getDocs(query(collection(firestore, 'departments'), orderBy('name')));
        const classesSnap = await getDocs(query(collection(firestore, 'classes'), orderBy('name')));

        setStaffList(staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)).sort((a, b) => a.name.localeCompare(b.name)));
        setDepartments(deptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
        setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      } catch (error) {
        console.error("Error fetching staff data:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch management data.' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
  }, [firestore, toast, currentStaff, isUserLoading]);

  const availableClasses = useMemo(() => {
    if (deptFilter === 'all') return [];
    return classes.filter(c => c.departmentId === deptFilter);
  }, [deptFilter, classes]);

  useEffect(() => {
    if (deptFilter !== 'all' && !availableClasses.some(c => c.id === classFilter)) {
        setClassFilter('all');
    }
  }, [deptFilter, availableClasses, classFilter]);

  const handleSaveStaff = async (staffData: Staff) => {
    try {
      const staffDocRef = doc(firestore, 'staff', staffData.id);
      await setDoc(staffDocRef, staffData, { merge: true });

      setStaffList(prev => {
        const existing = prev.find(s => s.id === staffData.id);
        if (existing) {
          return prev.map(s => s.id === staffData.id ? staffData : s);
        }
        return [...prev, staffData].sort((a, b) => a.name.localeCompare(b.name));
      });
      setIsDialogOpen(false);
      setEditingStaff(null);
      toast({ title: 'Success', description: 'Staff member saved successfully.' });
    } catch (error) {
      console.error("Error saving staff:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save staff member.' });
    }
  };

  const handleSaveStudent = async (studentData: Omit<Student, 'id' | 'departmentId' | 'classId'>) => {
    if (deptFilter === 'all' || classFilter === 'all') {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a department and class first.' });
      return;
    }

    const studentId = doc(collection(firestore, 'students')).id;
    const newStudent: Student = { 
      ...studentData, 
      id: studentId,
      departmentId: deptFilter,
      classId: classFilter
    };

    const studentRef = doc(firestore, 'students', studentId);

    try {
        await setDoc(studentRef, newStudent);
        toast({ title: 'Success', description: 'Student added successfully.' });
        setIsStudentDialogOpen(false);
    } catch (e: any) {
        console.error("Error saving student:", e);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: studentRef.path,
            operation: 'create',
            requestResourceData: newStudent,
        }));
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
     if (staffId === currentStaff?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'You cannot delete your own account.' });
      return;
    }
    try {
      await deleteDoc(doc(firestore, 'staff', staffId));
      setStaffList(prev => prev.filter(s => s.id !== staffId));
      toast({ title: 'Success', description: 'Staff member deleted.' });
    } catch (error) {
      console.error("Error deleting staff:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete staff member.' });
    }
  };

  if (isUserLoading || currentStaff?.role !== 'admin') {
    return (
        <div className="space-y-8">
            <Card>
                <CardHeader><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></CardHeader>
                <CardContent><Skeleton className="h-96 w-full" /></CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Staff</CardTitle>
            <CardDescription>Add, edit, or remove staff members.</CardDescription>
          </div>
          <Button onClick={() => setEditingStaff(null) || setIsDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Staff
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Class ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-6" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  staffList.map((staff) => (
                    <TableRow key={staff.id}>
                      <TableCell className="font-medium">{staff.name}</TableCell>
                      <TableCell>{staff.email}</TableCell>
                      <TableCell>{staff.role}</TableCell>
                      <TableCell>{staff.classId || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditingStaff(staff) || setIsDialogOpen(true)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteStaff(staff.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <CardTitle>Student Management</CardTitle>
                    <CardDescription>Add new students to the institution. (Admin Only)</CardDescription>
                </div>
                <Button 
                    onClick={() => setIsStudentDialogOpen(true)} 
                    disabled={classFilter === 'all'}
                    className="bg-accent hover:bg-accent/90"
                >
                    <UserPlus className="mr-2 h-4 w-4" /> Add Student
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            <div className="flex flex-wrap items-center gap-4 mb-4">
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                        {departments.map(dept => (
                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={classFilter} onValueChange={setClassFilter} disabled={deptFilter === 'all'}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableClasses.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground italic">
                    *Select Department and Class to enable student addition.
                </p>
            </div>
        </CardContent>
      </Card>

      {isDialogOpen && (
        <StaffFormDialog
          isOpen={isDialogOpen}
          setIsOpen={setIsDialogOpen}
          staff={editingStaff}
          onSave={handleSaveStaff}
        />
      )}

      {isStudentDialogOpen && (
        <StudentFormDialog 
            isOpen={isStudentDialogOpen} 
            setIsOpen={setIsStudentDialogOpen} 
            onSave={handleSaveStudent} 
        />
      )}
    </div>
  );
}

function StaffFormDialog({ isOpen, setIsOpen, staff, onSave }: { isOpen: boolean; setIsOpen: (open: boolean) => void; staff: Staff | null; onSave: (staff: Staff) => void; }) {
  const { firestore } = useFirebase();
  const [formData, setFormData] = useState<Partial<Staff>>(staff || { role: 'teacher' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof Staff, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.email && formData.role) {
      const staffToSave: Staff = {
        id: formData.id || doc(collection(firestore, 'staff')).id,
        name: formData.name,
        email: formData.email,
        role: formData.role as Staff['role'],
        classId: formData.role === 'teacher' ? formData.classId : undefined,
        password: formData.password || 'svcet@123',
      };
      onSave(staffToSave);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{staff ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
          <DialogDescription>Fill in the details for the staff member.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} required />
          </div>
           <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" value={formData.password || ''} onChange={handleChange} placeholder={staff ? "Leave blank to keep unchanged" : "Default: svcet@123"} />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select onValueChange={(value) => handleSelectChange('role', value)} value={formData.role}>
              <SelectTrigger id="role"><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="dean">Dean</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.role === 'teacher' && (
            <div>
              <Label htmlFor="classId">Class ID</Label>
              <Input id="classId" name="classId" value={formData.classId || ''} onChange={handleChange} placeholder="e.g., cse-2-a" />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StudentFormDialog({ isOpen, setIsOpen, onSave }: { 
    isOpen: boolean; 
    setIsOpen: (open: boolean) => void; 
    onSave: (studentData: Omit<Student, 'id' | 'departmentId' | 'classId'>) => void;
}) {
  const [formData, setFormData] = useState<Partial<Omit<Student, 'id' | 'departmentId' | 'classId'>>>({ gender: 'MALE', admissionType: 'CENTAC' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof Student, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.gender) {
      onSave({
          name: formData.name,
          registerNo: formData.registerNo || '',
          gender: formData.gender as 'MALE' | 'FEMALE',
          mentor: formData.mentor || '',
          admissionType: formData.admissionType as 'CENTAC' | 'Management',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>Fill in the details for the new student.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="sname">Name</Label>
            <Input id="sname" name="name" value={formData.name || ''} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="registerNo">Register No.</Label>
            <Input id="registerNo" name="registerNo" value={formData.registerNo || ''} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="sgender">Gender</Label>
            <Select onValueChange={(value) => handleSelectChange('gender', value)} value={formData.gender}>
              <SelectTrigger id="sgender"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="admissionType">Admission Type</Label>
            <Select onValueChange={(value) => handleSelectChange('admissionType', value)} value={formData.admissionType}>
              <SelectTrigger id="admissionType"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CENTAC">CENTAC</SelectItem>
                <SelectItem value="Management">Management</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="mentor">Mentor</Label>
            <Input id="mentor" name="mentor" value={formData.mentor || ''} onChange={handleChange} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit">Add Student</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
