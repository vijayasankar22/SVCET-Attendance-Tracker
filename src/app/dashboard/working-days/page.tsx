
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkingDay } from '@/lib/types';
import { format, getMonth, startOfMonth } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function WorkingDaysPage() {
  const { firestore: db } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [workingDays, setWorkingDays] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

  const fetchWorkingDays = async (month: Date) => {
    setLoading(true);
    try {
      const workingDaysCollection = collection(db, 'workingDays');
      const querySnapshot = await getDocs(workingDaysCollection);
      const daysMap = new Map<string, boolean>();
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<WorkingDay, 'id'>;
        const dateKey = format(data.timestamp.toDate(), 'yyyy-MM-dd');
        daysMap.set(dateKey, data.isWorkingDay);
      });
      setWorkingDays(daysMap);
    } catch (error) {
      console.error("Error fetching working days: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch working days data.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkingDays(currentMonth);
  }, [currentMonth, db]);

  const handleDayClick = async (day: Date, modifiers: { disabled?: boolean }) => {
    if (modifiers.disabled) {
      return;
    }
    const dateKey = format(day, 'yyyy-MM-dd');
    const isCurrentlyWorking = workingDays.get(dateKey) ?? false; // Default to holiday
    const newIsWorking = !isCurrentlyWorking;

    try {
      const docRef = doc(db, 'workingDays', dateKey);
      const newWorkingDay: Omit<WorkingDay, 'id'> = {
        isWorkingDay: newIsWorking,
        timestamp: Timestamp.fromDate(day),
      };
      await setDoc(docRef, newWorkingDay, { merge: true });

      setWorkingDays(new Map(workingDays.set(dateKey, newIsWorking)));
      toast({
        title: 'Success',
        description: `Date ${dateKey} marked as ${newIsWorking ? 'a working day' : 'a holiday'}.`,
      });
    } catch (error) {
      console.error('Error updating working day:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update the date status.',
      });
    }
  };

  const workingDayModifiers = useMemo(() => {
    const working: Date[] = [];
    workingDays.forEach((isWorkingDay, dateStr) => {
      if (isWorkingDay) {
        working.push(new Date(dateStr));
      }
    });
    return {
      working: working,
      holiday: (date: Date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return workingDays.get(dateKey) === false;
      },
    };
  }, [workingDays]);
  
  const modifierStyles = {
    holiday: {
      backgroundColor: 'hsl(var(--destructive))',
      color: 'hsl(var(--destructive-foreground))',
      borderRadius: 'var(--radius)',
    },
    working: {
      backgroundColor: 'hsl(var(--primary))',
      color: 'hsl(var(--primary-foreground))',
      borderRadius: 'var(--radius)',
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-12 w-1/2" />
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
          <CardContent><Skeleton className="h-96 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold">Manage Working Days</h1>
          <p className="text-muted-foreground">Click on a date to mark it as a working day or a holiday.</p>
        </div>
      </div>

      <Alert>
        <AlertDescription>
          By default, all days are holidays. Click a date to mark it as a working day. Click it again to revert it to a holiday. Sundays are always holidays.
        </AlertDescription>
      </Alert>

      <div className="flex justify-center">
        <Card className="p-4">
            <Calendar
                mode="single"
                onDayClick={handleDayClick}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                modifiers={workingDayModifiers}
                modifiersStyles={modifierStyles}
                className="p-0"
                disabled={{ dayOfWeek: [0] }}
                components={{
                    DayContent: (props) => {
                        const dateKey = format(props.date, 'yyyy-MM-dd');
                        const isWorking = workingDays.get(dateKey);
                        const isSunday = props.date.getDay() === 0;
                        
                        let indicator = null;
                        if (isSunday) {
                            indicator = 'H';
                        } else if (isWorking === false) { // Explicitly a holiday
                            indicator = 'H';
                        } else if (isWorking === true) { // Explicitly a working day
                            indicator = 'W';
                        }
                        // If undefined, it's a default holiday, no indicator needed

                        return (
                            <div className="relative w-full h-full flex items-center justify-center">
                               <span>{props.date.getDate()}</span>
                               {indicator && <span className="absolute bottom-0 right-0 text-[8px] font-bold">{indicator}</span>}
                            </div>
                        )
                    }
                }}
            />
        </Card>
      </div>
    </div>
  );
}
