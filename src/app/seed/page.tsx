'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { collection, writeBatch, doc, getDocs, Firestore, query } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { departments, classes, students, staff } from '@/lib/data';

async function seedDatabaseClient(db: Firestore) {
  console.log("Starting database seed (non-destructive)...");

  try {
    // 1. Fetch existing document IDs to avoid overwriting
    const getExistingIds = async (collectionName: string): Promise<Set<string>> => {
      const querySnapshot = await getDocs(query(collection(db, collectionName)));
      return new Set(querySnapshot.docs.map(d => d.id));
    };

    const [
      existingDeptIds,
      existingClassIds,
      existingStudentIds,
      existingStaffIds,
    ] = await Promise.all([
      getExistingIds('departments'),
      getExistingIds('classes'),
      getExistingIds('students'),
      getExistingIds('staff'),
    ]);

    const mainBatch = writeBatch(db);
    let addedCount = 0;

    // Seed Departments
    departments.forEach(dept => {
      if (!existingDeptIds.has(dept.id)) {
        mainBatch.set(doc(db, 'departments', dept.id), dept);
        addedCount++;
      }
    });

    // Seed Classes
    classes.forEach(cls => {
      if (!existingClassIds.has(cls.id)) {
        mainBatch.set(doc(db, 'classes', cls.id), cls);
        addedCount++;
      }
    });

    // Seed Students
    students.forEach(student => {
      if (!existingStudentIds.has(student.id)) {
        mainBatch.set(doc(db, 'students', student.id), student);
        addedCount++;
      }
    });

    // Seed Staff
    staff.forEach(staffMember => {
      if (!existingStaffIds.has(staffMember.id)) {
        const staffDocRef = doc(db, 'staff', staffMember.id);
        mainBatch.set(staffDocRef, staffMember);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      await mainBatch.commit();
      console.log(`Database seeding completed. Added ${addedCount} new documents.`);
      return { success: true, message: `Successfully added ${addedCount} new documents.` };
    } else {
      console.log("Database is already up to date.");
      return { success: true, message: 'Database is already up to date. No new data added.' };
    }

  } catch (error: any) {
    console.error('FATAL: Error during seeding process:', error);
    return { success: false, message: `Failed to seed data. Check permissions. Error: ${error.message}` };
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
            Click the button to populate your Firestore database with initial data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
            <p className="font-bold">Notice: Non-destructive action.</p>
            <p>This will only add new data. Existing documents will not be cleared or overwritten.</p>
          </div>
          <Button onClick={handleSeed} disabled={isLoading} variant="secondary" className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Seeding...
              </>
            ) : (
              'Seed New Data'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
