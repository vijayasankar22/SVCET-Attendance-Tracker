

'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
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
import { Staff } from '@/lib/types';
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
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function StaffPage() {
  const { firestore } = useFirebase();
  const { staff: currentStaff, isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  useEffect(() => {
    if (!isUserLoading && currentStaff?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [currentStaff, isUserLoading, router]);

  useEffect(() => {
    if (isUserLoading || currentStaff?.role !== 'admin') {
        return;
    }
    const fetchStaff = async () => {
      setLoading(true);
      try {
        const staffCollection = collection(firestore, 'staff');
        const snapshot = await getDocs(staffCollection);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
        setStaffList(list.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Error fetching staff:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch staff data.' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchStaff();
    
  }, [firestore, toast, currentStaff, isUserLoading]);

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

  const openDialog = (staff: Staff | null = null) => {
    setEditingStaff(staff);
    setIsDialogOpen(true);
  };
  
  if (isUserLoading || currentStaff?.role !== 'admin') {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-96 w-full" />
            </CardContent>
        </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Staff</CardTitle>
            <CardDescription>Add, edit, or remove staff members.</CardDescription>
          </div>
          <Button onClick={() => openDialog()}>
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
                        <Button variant="ghost" size="icon" onClick={() => openDialog(staff)}>
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
      {isDialogOpen && (
        <StaffFormDialog
          isOpen={isDialogOpen}
          setIsOpen={setIsDialogOpen}
          staff={editingStaff}
          onSave={handleSaveStaff}
        />
      )}
    </>
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
        password: formData.password || 'svcet@123', // Default password for new users
      };
      onSave(staffToSave);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{staff ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
          <DialogDescription>
            Fill in the details for the staff member.
          </DialogDescription>
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
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
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
