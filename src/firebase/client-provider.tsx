
'use client';

import { FirebaseProvider } from '@/firebase/provider';
import { useMemo, type ReactNode } from 'react';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  return (
    <FirebaseProvider>
      {children}
    </FirebaseProvider>
  );
}
