'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import type { Staff } from '@/lib/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: Staff | null;
  staff: Staff | null;
  isUserLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { firestore } = useFirebase();
  const [user, setUser] = useState<Staff | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('svcet-staff-user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem('svcet-staff-user');
      }
    }
    setIsUserLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const staffCollection = collection(firestore, 'staff');
      const q = query(staffCollection, where('email', '==', email));
      
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, error: 'Invalid email or password.' };
      }

      let foundUser: Staff | null = null;
      
      querySnapshot.forEach(doc => {
        const staffData = doc.data() as Omit<Staff, 'id'>;
        if (staffData.password === password) {
          foundUser = { id: doc.id, ...staffData };
        }
      });

      if (foundUser) {
        setUser(foundUser);
        localStorage.setItem('svcet-staff-user', JSON.stringify(foundUser));
        return { success: true };
      } else {
        return { success: false, error: 'Invalid email or password.' };
      }

    } catch (error: any) {
      console.error("Login error:", error);
      return { success: false, error: 'An error occurred during login.' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('svcet-staff-user');
    router.push('/login');
  };

  const value = useMemo(() => ({
    user,
    staff: user,
    isUserLoading,
    login,
    logout
  }), [user, isUserLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
