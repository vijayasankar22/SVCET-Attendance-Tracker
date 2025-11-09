
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { collection, writeBatch, doc, getDoc, getDocs, Firestore } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, Auth, User } from 'firebase/auth';
import { useFirebase } from '@/firebase';
import { departments, classes, students, staff } from '@/lib/data';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

async function seedDatabaseClient(db: Firestore, auth: Auth) {
  const batch = writeBatch(db);

  // Seed Departments, Classes, and Students
  const departmentsCollection = collection(db, 'departments');
  departments.forEach(dept => batch.set(doc(departmentsCollection, dept.id), dept));

  const classesCollection = collection(db, 'classes');
  classes.forEach(cls => batch.set(doc(classesCollection, cls.id), cls));
  
  const studentsCollection = collection(db, 'students');
  students.forEach(student => batch.set(doc(studentsCollection, student.id), student));

  // Seed Staff and create Auth users
  const staffCollection = collection(db, 'staff');
  for (const staffMember of staff) {
    if (!staffMember.password) continue; // Skip staff without a password

    let user: User | null = null;

    try {
      // Attempt to create the user
      const userCredential = await createUserWithEmailAndPassword(auth, staffMember.email, staffMember.password);
      user = userCredential.user;
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        // If user already exists, sign in to get their UID
        try {
          const existingUserCredential = await signInWithEmailAndPassword(auth, staffMember.email, staffMember.password);
          user = existingUserCredential.user;
        } catch (signInError: any) {
            console.error(`Failed to sign in existing user ${staffMember.email}:`, signInError.message);
            continue; // Skip this staff member if sign-in fails
        }
      } else {
        console.error(`Error creating user ${staffMember.email}:`, error.message);
        continue; // Skip this staff member if creation fails for other reasons
      }
    }

    if (user) {
      // Now that we have the user's UID, create their document in Firestore
      const staffDocRef = doc(staffCollection, user.uid);
      const { password, ...staffData } = staffMember; // Don't store password in Firestore
      batch.set(staffDocRef, { ...staffData, id: user.uid });
    }
  }

  try {
    await batch.commit();
    return { success: true, message: 'Database seeding completed successfully.' };
  } catch (error: any) {
     console.error('Error committing batch:', error);
    // Emit a contextual error for permission issues
    errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: '/', 
        operation: 'write',
        requestResourceData: {
          note: 'Batch write for seeding failed. Check permissions for departments, classes, students, and staff collections.'
        }
    }));
    return { success: false, message: 'A Firestore permission error occurred during batch commit.' };
  }
}

export default function SeedPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { firestore: db, auth } = useFirebase();

  const handleSeed = async () => {
    if (!db || !auth) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Firebase is not initialized. Cannot seed data.',
        });
        return;
    }

    setIsLoading(true);
    const result = await seedDatabaseClient(db, auth);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: 'Success',
        description: result.message,
        duration: 5000,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-primary p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Seed Database</CardTitle>
          <CardDescription>
            Click the button to populate your database with initial data. This includes departments, classes, students, and staff accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-bold">Warning: This is a potentially destructive action.</p>
            <p>Running this will overwrite any existing data in your collections. It will also create user accounts in Firebase Authentication.</p>
          </div>
          <Button onClick={handleSeed} disabled={isLoading} variant="destructive" className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Seeding...
              </>
            ) : (
              'Seed Data into Firestore & Auth'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
