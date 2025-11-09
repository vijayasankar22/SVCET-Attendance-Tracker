'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { collection, writeBatch, doc, getDocs, Firestore, deleteDoc, query, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { departments, classes, students, staff } from '@/lib/data';
import type { Staff } from '@/lib/types';


async function seedDatabaseClient(db: Firestore) {
  console.log("Starting database seed...");

  // Clear existing data (optional, be careful in production)
  console.log("Clearing existing data...");
  const collectionsToClear = ['departments', 'classes', 'students', 'attendanceRecords', 'workingDays', 'attendanceSubmissions'];
  for (const coll of collectionsToClear) {
    try {
      const snapshot = await getDocs(query(collection(db, coll), limit(500)));
      if (snapshot.empty) continue;
      const clearBatch = writeBatch(db);
      snapshot.docs.forEach(doc => clearBatch.delete(doc.ref));
      await clearBatch.commit();
      console.log(`Cleared ${snapshot.size} documents from ${coll}.`);
    } catch (e) {
      console.warn(`Could not clear collection ${coll}. It might not exist yet.`, e);
    }
  }

  // Start a new batch for seeding
  const mainBatch = writeBatch(db);

  // Seed Departments, Classes, and Students
  console.log("Seeding departments, classes, and students...");
  departments.forEach(dept => mainBatch.set(doc(db, 'departments', dept.id), dept));
  classes.forEach(cls => mainBatch.set(doc(db, 'classes', cls.id), cls));
  students.forEach(student => mainBatch.set(doc(db, 'students', student.id), student));

  // Seed Staff - THIS DOES NOT CREATE AUTH USERS.
  // This is a simplified seed that just puts staff data in Firestore.
  // Auth users should be created manually or via a separate, more secure process.
  console.log("Seeding staff data...");
  for (const staffMember of staff) {
    const staffDocRef = doc(db, 'staff', staffMember.id);
    // Storing password directly in Firestore is NOT recommended for production.
    // This is for demonstration purposes only.
    mainBatch.set(staffDocRef, staffMember);
  }

  try {
    await mainBatch.commit();
    console.log("Database seeding completed successfully.");
    return { success: true, message: 'Database seeding completed successfully.' };
  } catch (error: any) {
    console.error('FATAL: Error committing main data batch:', error);
    return { success: false, message: `Failed to commit data to Firestore. Check permissions. Error: ${error.message}` };
  }
}


export default function SeedPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { firestore: db } = useFirebase();

  const handleSeed = async () => {
    if (!db) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Firebase is not initialized. Cannot seed data.',
        });
        return;
    }
    setIsLoading(true);
    try {
      const result = await seedDatabaseClient(db);
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
          duration: 5000,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Seeding Failed',
        description: error.message || 'An unknown error occurred.',
        duration: 9000,
      });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-primary p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Seed Database</CardTitle>
          <CardDescription>
            Click the button to populate your Firestore database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-bold">Warning: This is a destructive action.</p>
            <p>Running this will clear specified collections and re-populate them. This is intended for initial setup.</p>
          </div>
          <Button onClick={handleSeed} disabled={isLoading} variant="destructive" className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Seeding...
              </>
            ) : (
              'Seed Data into Firestore'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
