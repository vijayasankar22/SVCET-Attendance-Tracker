
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

/**
 * A singleton function to initialize and return Firebase services.
 * This ensures that Firebase is initialized only once.
 */
export function initializeFirebase() {
  let app: FirebaseApp;

  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  const firestore = getFirestore(app);
  const auth = getAuth(app);

  return {
    firebaseApp: app,
    firestore: firestore,
    auth: auth
  };
}

// Re-export other necessary modules.
export * from './provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';
